import { Elysia } from "elysia";
import { join } from "path";
import { mkdir, appendFile } from "node:fs/promises";

// WeakMap to store request metadata for calculating response time
const requestMetadata = new WeakMap<Request, { startTime: number }>();

// Configuration
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth-token",
];

// Log directory path
const LOG_DIR = join(process.cwd(), "logs");

// Ensure log directory exists
await mkdir(LOG_DIR, { recursive: true }).catch((error) => {
  console.error("Failed to create logs directory:", error);
});

/**
 * Get current log file path with daily rotation
 * Format: app-YYYY-MM-DD.log
 */
function getLogFilePath(): string {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  return join(LOG_DIR, `app-${dateStr}.log`);
}

/**
 * Filter and format headers for logging
 * @param headers - Request or response headers
 * @returns Filtered headers object
 */
function filterHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value && !SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      filtered[key] = value;
    } else if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      filtered[key] = "[REDACTED]";
    }
  }

  return filtered;
}

/**
 * Logger class for programmatic logging in services
 *
 * Usage:
 * ```typescript
 * class MyService {
 *   constructor(private logger: Logger) {}
 *
 *   async doSomething() {
 *     this.logger.info('Doing something', { userId: 123 });
 *     this.logger.error('Something failed', { error: err });
 *   }
 * }
 *
 * const myService = new MyService(new Logger('MyService'));
 * ```
 */
export class Logger {
  constructor(private context?: string) {}

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(
    level: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? `[${this.context}]` : "";
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : "";
    return `${level} [${timestamp}]${contextStr} ${message}${metadataStr}`;
  }

  /**
   * Write a raw log message to file and console
   * Used internally by other log methods
   */
  private writeLog(message: string, isError = false): void {
    // Write to console
    if (isError) {
      console.error(message);
    } else {
      console.log(message);
    }

    // Write to file asynchronously (fire-and-forget)
    const logFilePath = getLogFilePath();
    appendFile(logFilePath, message + "\n", "utf8").catch((error) => {
      console.error("Failed to write to log file:", error);
    });
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    const formattedMessage = this.formatMessage("ℹ️ INFO", message, metadata);
    this.writeLog(formattedMessage);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    const formattedMessage = this.formatMessage("❌ ERROR", message, metadata);
    this.writeLog(formattedMessage, true);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    const formattedMessage = this.formatMessage("⚠️ WARN", message, metadata);
    this.writeLog(formattedMessage);
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "production") {
      const formattedMessage = this.formatMessage(
        "🔍 DEBUG",
        message,
        metadata,
      );
      this.writeLog(formattedMessage);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext);
  }
}

/**
 * HTTP Request/Response Logger Plugin
 *
 * Logs all HTTP requests and responses with timing information.
 * Uses Elysia lifecycle hooks to track request lifecycle.
 *
 * Logs include:
 * - Request: method, path, query params, headers (filtered)
 * - Response: status, timing
 * - Errors: stack traces in development
 *
 * Configuration via environment variables:
 * - ENABLE_HTTP_LOGS: Set to "false" to disable all logging (default: enabled)
 * - LOG_HEALTH_CHECKS: Set to "true" to include /health endpoint logs (default: disabled)
 *
 * Security:
 * - Sensitive headers (authorization, cookie, etc.) are automatically redacted
 */
export const logger = new Elysia({
  name: "http-logger",
})
  .decorate("httpLogger", new Logger("HTTP"))
  .onRequest(({ request, httpLogger }) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Skip health check logs unless explicitly enabled
    if (path === "/health" && process.env.LOG_HEALTH_CHECKS !== "true") {
      return;
    }

    // Skip logging if disabled
    if (process.env.ENABLE_HTTP_LOGS === "false") {
      return;
    }

    // Store request start time
    requestMetadata.set(request, { startTime: Date.now() });

    // Log incoming request
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const headersObj: Record<string, string | undefined> = {};
    request.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    const filteredHeaders = filterHeaders(headersObj);

    httpLogger.info(`${method} ${path}`, {
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      headers:
        Object.keys(filteredHeaders).length > 0 ? filteredHeaders : undefined,
    });
  })
  .onAfterResponse(({ request, set, httpLogger }) => {
    // Extract path and method from request
    const path = new URL(request.url).pathname;
    const method = request.method;

    // Skip health check logs unless explicitly enabled
    if (path === "/health" && process.env.LOG_HEALTH_CHECKS !== "true") {
      return;
    }

    // Skip logging if disabled
    if (process.env.ENABLE_HTTP_LOGS === "false") {
      return;
    }

    // Calculate response time
    const metadata = requestMetadata.get(request);
    const duration = metadata ? Date.now() - metadata.startTime : 0;

    // Determine status code
    const status = (set.status as number) || 200;

    // Log completed request with appropriate level
    const message = `${method} ${path} → ${status}`;
    const logMetadata = { duration: `${duration}ms`, status };

    if (status >= 400) {
      httpLogger.error(message, logMetadata);
    } else {
      httpLogger.info(message, logMetadata);
    }

    // Clean up metadata
    requestMetadata.delete(request);
  })
  .onError(({ error, code, path, request, httpLogger }) => {
    const method = request.method;

    // Skip logging if disabled
    if (process.env.ENABLE_HTTP_LOGS === "false") {
      return;
    }

    // Calculate response time
    const metadata = requestMetadata.get(request);
    const duration = metadata ? Date.now() - metadata.startTime : 0;

    // Extract error details safely
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log error with details
    httpLogger.error(`${method} ${path} → ${code}`, {
      duration: `${duration}ms`,
      code,
      error: errorMessage,
      stack: process.env.NODE_ENV !== "production" ? errorStack : undefined,
    });

    // Clean up metadata
    requestMetadata.delete(request);
  });

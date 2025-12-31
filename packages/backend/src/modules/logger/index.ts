import { Elysia } from "elysia";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

// WeakMap to store request metadata for calculating response time
const requestMetadata = new WeakMap<Request, { startTime: number }>();

// Configuration
const MAX_BODY_LENGTH = 5000; // Truncate bodies longer than this
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth-token",
];

// Log directory path
const LOG_DIR = join(process.cwd(), "logs");

// Ensure log directory exists
try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch (error) {
  console.error("Failed to create logs directory:", error);
}

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
 * Format and truncate body content for logging
 * @param body - Request or response body
 * @returns Formatted string representation
 */
function formatBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }

  // Check if body logging is disabled
  if (process.env.ENABLE_BODY_LOGS === "false") {
    return "[body logging disabled]";
  }

  let bodyStr: string;

  if (typeof body === "string") {
    bodyStr = body;
  } else if (typeof body === "object") {
    try {
      bodyStr = JSON.stringify(body, null, 2);
    } catch {
      bodyStr = String(body);
    }
  } else {
    bodyStr = String(body);
  }

  // Truncate if too long
  if (bodyStr.length > MAX_BODY_LENGTH) {
    return (
      bodyStr.substring(0, MAX_BODY_LENGTH) +
      `... [truncated ${bodyStr.length - MAX_BODY_LENGTH} chars]`
    );
  }

  return bodyStr;
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
 * Write log to both file and console
 * @param message - Log message
 * @param isError - Whether this is an error log
 */
function writeLog(message: string, isError = false): void {
  // Write to console
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }

  // Write to file
  try {
    const logFile = getLogFilePath();
    appendFileSync(logFile, message + "\n", "utf8");
  } catch (error) {
    console.error("Failed to write to log file:", error);
  }
}

/**
 * HTTP Request/Response Logger Plugin
 *
 * Logs all HTTP requests and responses with timing information.
 * Uses Elysia lifecycle hooks to track request lifecycle.
 *
 * Logs include:
 * - Request: method, path, query params, headers (filtered), body
 * - Response: status, timing, headers, body
 * - Errors: stack traces in development
 *
 * Configuration via environment variables:
 * - ENABLE_HTTP_LOGS: Set to "false" to disable all logging (default: enabled)
 * - ENABLE_BODY_LOGS: Set to "false" to disable request/response body logging (default: enabled)
 * - LOG_HEALTH_CHECKS: Set to "true" to include /health endpoint logs (default: disabled)
 *
 * Security:
 * - Sensitive headers (authorization, cookie, etc.) are automatically redacted
 * - Request/response bodies are truncated at 5000 characters
 */
export const logger = new Elysia({
  name: "http-logger",
})
  .onRequest(({ request }) => {
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

    // Log incoming request header
    writeLog(`🔵 [${new Date().toISOString()}] ${method} ${path}`);

    // Log query parameters if present
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    if (Object.keys(queryParams).length > 0) {
      writeLog(`   Query: ${JSON.stringify(queryParams)}`);
    }

    // Log headers (filtered for security)
    const headersObj: Record<string, string | undefined> = {};
    request.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    const filteredHeaders = filterHeaders(headersObj);
    if (Object.keys(filteredHeaders).length > 0) {
      writeLog(`   Headers: ${JSON.stringify(filteredHeaders)}`);
    }
  })
  .onBeforeHandle(({ body, request }) => {
    const path = new URL(request.url).pathname;

    // Skip health check logs unless explicitly enabled
    if (path === "/health" && process.env.LOG_HEALTH_CHECKS !== "true") {
      return;
    }

    // Skip logging if disabled
    if (process.env.ENABLE_HTTP_LOGS === "false") {
      return;
    }

    // Log request body if present (body is parsed at this stage)
    const bodyContent = formatBody(body);
    if (bodyContent) {
      writeLog(`   Request Body: ${bodyContent}`);
    }
  })
  .onAfterHandle(({ response, request, set }) => {
    const path = new URL(request.url).pathname;

    // Skip health check logs unless explicitly enabled
    if (path === "/health" && process.env.LOG_HEALTH_CHECKS !== "true") {
      return;
    }

    // Skip logging if disabled
    if (process.env.ENABLE_HTTP_LOGS === "false") {
      return;
    }

    // Log response headers if present
    if (set.headers && Object.keys(set.headers).length > 0) {
      writeLog(`   Response Headers: ${JSON.stringify(set.headers)}`);
    }

    // Log response body
    const responseBody = formatBody(response);
    if (responseBody) {
      writeLog(`   Response Body: ${responseBody}`);
    }
  })
  .onAfterResponse(({ request, set }) => {
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

    // Determine status code and emoji
    const status = (set.status as number) || 200;
    const emoji = (status as number) >= 400 ? "❌" : "✅";

    // Log completed request
    writeLog(
      `${emoji} [${new Date().toISOString()}] ${method} ${path} → ${status} (${duration}ms)`,
    );

    // Clean up metadata
    requestMetadata.delete(request);
  })
  .onError(({ error, code, path, request }) => {
    const method = request.method;

    // Skip logging if disabled
    if (process.env.ENABLE_HTTP_LOGS === "false") {
      return;
    }

    // Calculate response time
    const metadata = requestMetadata.get(request);
    const duration = metadata ? Date.now() - metadata.startTime : 0;

    // Log error
    writeLog(
      `❌ [${new Date().toISOString()}] ${method} ${path} → ${code} (${duration}ms)`,
      true,
    );

    // Extract error message safely
    const errorMessage = error instanceof Error ? error.message : String(error);
    writeLog(`   Error: ${errorMessage}`, true);

    // Log stack trace in development
    if (
      process.env.NODE_ENV !== "production" &&
      error instanceof Error &&
      error.stack
    ) {
      writeLog(`   Stack: ${error.stack}`, true);
    }

    // Clean up metadata
    requestMetadata.delete(request);
  });

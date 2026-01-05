import { Elysia } from "elysia";
import { Logger } from "../modules/logger";

// WeakMap to store request metadata for calculating response time
const requestMetadata = new WeakMap<Request, { startTime: number }>();

// Configuration
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth-token",
];

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

const baseHttpLogger = new Logger("HTTP");

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
export const httpLogger = new Elysia({
  name: "http-logger",
})
  .decorate("httpLogger", baseHttpLogger)
  .onRequest(({ request, httpLogger }) => {
    const activeLogger = httpLogger ?? baseHttpLogger;
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

    activeLogger.info(`${method} ${path}`, {
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      headers:
        Object.keys(filteredHeaders).length > 0 ? filteredHeaders : undefined,
    });
  })
  .onAfterResponse(({ request, set, httpLogger }) => {
    const activeLogger = httpLogger ?? baseHttpLogger;
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
      activeLogger.error(message, logMetadata);
    } else {
      activeLogger.info(message, logMetadata);
    }

    // Clean up metadata
    requestMetadata.delete(request);
  })
  .onError(({ error, code, path, request, httpLogger }) => {
    const activeLogger = httpLogger ?? baseHttpLogger;
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
    activeLogger.error(`${method} ${path} → ${code}`, {
      duration: `${duration}ms`,
      code,
      error: errorMessage,
      stack: process.env.NODE_ENV !== "production" ? errorStack : undefined,
    });

    // Clean up metadata
    requestMetadata.delete(request);
  })
  .as("global");

import { join } from "path";
import { mkdir, appendFile } from "node:fs/promises";

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

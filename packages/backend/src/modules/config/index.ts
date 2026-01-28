/**
 * Application Configuration Service
 *
 * Centralized configuration management with validation.
 * Reads from environment variables and validates on startup.
 */

export interface AppConfig {
  env: "development" | "production" | "test";
  server: {
    port: number;
    host: string;
  };
  cors: {
    origins: string[];
  };
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
  };
  openai: {
    apiKey: string;
  };
  oauth: {
    apple: {
      clientIdWeb: string;
      clientIdNative: string;
      teamId: string;
      keyId: string;
      privateKey: string;
      redirectUriWeb: string;
    };
    google: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
  };
  ingestion: {
    provider: string;
  };
  email: {
    postmark: {
      serverToken: string;
      fromEmail: string;
      messageStream: string;
    };
  };
}

export class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadAndValidate();
  }

  private loadAndValidate(): AppConfig {
    // Validate NODE_ENV
    const nodeEnv = process.env.NODE_ENV || "development";
    if (!["development", "production", "test"].includes(nodeEnv)) {
      throw new Error(
        `Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`,
      );
    }

    // Validate and parse PORT
    const portStr = process.env.PORT || "3000";
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(
        `Invalid PORT: ${portStr}. Must be a number between 1 and 65535`,
      );
    }

    // Parse CORS origins
    const corsOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : [];

    // Warn if no CORS origins in production
    if (nodeEnv === "production" && corsOrigins.length === 0) {
      console.warn(
        "⚠️  WARNING: No CORS_ORIGINS configured in production mode!",
      );
    }

    // Validate database URL (priority: POSTGRES_URL > POSTGRES_URL_LOCAL)
    const dbUrl = process.env.POSTGRES_URL || process.env.POSTGRES_URL_LOCAL;
    if (!dbUrl) {
      throw new Error(
        "Database URL not configured. Set POSTGRES_URL or POSTGRES_URL_LOCAL",
      );
    }

    // Validate JWT secrets
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error("JWT_ACCESS_SECRET not configured");
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error("JWT_REFRESH_SECRET not configured");
    }

    // Parse JWT TTLs
    const accessTtl = parseInt(
      process.env.JWT_ACCESS_EXPIRES_IN_SECONDS || "900",
      10,
    );
    const refreshTtl = parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || "2592000",
      10,
    );

    if (isNaN(accessTtl) || accessTtl < 1) {
      throw new Error("Invalid JWT_ACCESS_EXPIRES_IN_SECONDS");
    }
    if (isNaN(refreshTtl) || refreshTtl < 1) {
      throw new Error("Invalid JWT_REFRESH_EXPIRES_IN_SECONDS");
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    return {
      env: nodeEnv as "development" | "production" | "test",
      server: {
        port,
        host: process.env.HOST || "127.0.0.1",
      },
      cors: {
        origins: corsOrigins,
      },
      database: {
        url: dbUrl,
      },
      jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessTtlSeconds: accessTtl,
        refreshTtlSeconds: refreshTtl,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
      },
      oauth: {
        apple: {
          clientIdWeb:
            process.env.APPLE_CLIENT_ID_WEB ||
            process.env.APPLE_CLIENT_ID ||
            "",
          clientIdNative:
            process.env.APPLE_CLIENT_ID_NATIVE ||
            process.env.APPLE_CLIENT_ID ||
            "",
          teamId: process.env.APPLE_TEAM_ID || "",
          keyId: process.env.APPLE_KEY_ID || "",
          privateKey: process.env.APPLE_PRIVATE_KEY || "",
          redirectUriWeb:
            process.env.APPLE_REDIRECT_URI_WEB ||
            process.env.APPLE_REDIRECT_URI ||
            "",
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
        },
      },
      ingestion: {
        provider: process.env.INGESTION_PROVIDER || "docling",
      },
      email: {
        postmark: {
          serverToken: process.env.POSTMARK_SERVER_TOKEN || "",
          fromEmail: process.env.POSTMARK_FROM_EMAIL || "",
          messageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
        },
      },
    };
  }

  /**
   * Get the full application configuration
   */
  get(): AppConfig {
    return this.config;
  }

  /**
   * Check if running in development mode
   */
  get isDevelopment(): boolean {
    return this.config.env === "development";
  }

  /**
   * Check if running in production mode
   */
  get isProduction(): boolean {
    return this.config.env === "production";
  }

  /**
   * Check if running in test mode
   */
  get isTest(): boolean {
    return this.config.env === "test";
  }
}

// Export singleton instance
export const configService = new ConfigService();

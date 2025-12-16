import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";

/**
 * Database service - handles connection lifecycle and provides db instance
 */
export class DbService {
  private dbClient!: SQL;
  private db!: BunSQLDatabase;

  /**
   * Get database connection string from environment with fallback
   */
  private getConnectionString(): string {
    return (
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_LOCAL ||
      "postgres://postgres:postgres@localhost:5432/boardgame_ref"
    );
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    if (this.db) {
      console.log("⚠️  Database already connected");
      return;
    }

    const connectionString = this.getConnectionString();
    const connectionType = process.env.POSTGRES_URL
      ? "production"
      : process.env.POSTGRES_URL_LOCAL
        ? "local"
        : "default";

    console.log(`📊 Connecting to ${connectionType} database...`);

    this.dbClient = new SQL(connectionString, {
      max: 20, // Connection pool size
      idleTimeout: 30, // Close idle connections after 30 seconds
      connectionTimeout: 30, // Timeout for establishing connections
    });

    try {
      await this.dbClient.connect();
      this.db = drizzle(this.dbClient);
      console.log("✓ Database connected (pool size: 20)");
    } catch (error) {
      console.error("✗ Failed to connect to database:", error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.dbClient.close();
      console.log("✓ Database connection closed");
    } catch (error) {
      console.error("✗ Error closing database:", error);
      throw error;
    }
  }

  /**
   * Get the database instance
   */
  getDb(): BunSQLDatabase {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  /**
   * Health check - verify database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.execute(`select 1`);
      return true;
    } catch (error) {
      console.error("✗ Database health check failed:", error);
      return false;
    }
  }
}

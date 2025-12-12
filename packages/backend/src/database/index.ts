import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

// Database configuration with fallback chain:
// 1. POSTGRES_URL (production/actual database)
// 2. POSTGRES_URL_LOCAL (local development database)
// 3. Hardcoded default (fallback)
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_LOCAL ||
  "postgres://postgres:postgres@localhost:5432/boardgame_ref";

// Log which connection is being used (without exposing password)
const connectionType = process.env.POSTGRES_URL
  ? "production"
  : process.env.POSTGRES_URL_LOCAL
    ? "local"
    : "default";
console.log(`📊 Using ${connectionType} database connection`);

// Create singleton database connection with Bun's native SQL
const dbClient = new SQL(connectionString, {
  max: 20, // Connection pool size
  idleTimeout: 30, // Close idle connections after 30 seconds
  connectionTimeout: 30, // Timeout for establishing connections
  // tls: process.env.NODE_ENV === "production", // Enable TLS in production
});

try {
  await dbClient.connect();
} catch (error) {
  console.error("✗ Failed to connect to the database:", error);
  process.exit(1); // Exit the process if the database connection fails
}

export const db = drizzle(dbClient);

console.log("✓ Database connection pool created (max: 20 connections)");

// Graceful shutdown handler
export const closeDatabase = async () => {
  try {
    await dbClient.close();
    console.log("✓ Database connection closed");
  } catch (error) {
    console.error("✗ Error closing database:", error);
  }
};

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await db.execute(`select 1`);
    return true;
  } catch (error) {
    console.error("✗ Database health check failed:", error);
    return false;
  }
};

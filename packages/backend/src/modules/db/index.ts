import { Elysia } from "elysia";
import { DbService } from "./service";

/**
 * Database module - Elysia instance that manages database lifecycle
 *
 * This module:
 * - Connects to database on server start (onStart hook)
 * - Stops server if connection fails
 * - Handles graceful shutdown
 *
 * Note: The database instance is NOT exposed to controllers.
 * Services should use DbService.getDb() directly instead.
 *
 * Usage:
 * ```ts
 * new Elysia()
 *   .use(db)
 *   .get('/users', async () => {
 *     // Use services that call DbService.getDb() internally
 *     return UserService.list();
 *   })
 * ```
 */

export const db = new Elysia({ name: "db" })
  .onStart(async () => {
    try {
      console.log("📊 Connecting to database...");
      await DbService.connect();

      // Verify connection with health check
      const isHealthy = await DbService.healthCheck();
      if (!isHealthy) {
        throw new Error("Database health check failed");
      }
      console.log("✓ Database health check passed");
    } catch (error) {
      console.error(
        "❌ Failed to connect to database. Shutting down server...",
      );
      console.error("Error:", error);
      process.exit(1);
    }
  })
  .onStop(async () => {
    try {
      console.log("📊 Shutting down database...");
      await DbService.disconnect();
    } catch (error) {
      console.error("⚠️  Error during database disconnection:", error);
      // Don't exit process - server is already shutting down
    }
  });

/**
 * Export health check for use in health endpoints
 */
export const checkDbHealth = () => DbService.healthCheck();
export { DbService };

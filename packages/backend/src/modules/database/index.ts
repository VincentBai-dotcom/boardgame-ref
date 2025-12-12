import { Elysia } from "elysia";
import { DatabaseService } from "./service";

/**
 * Database module - Elysia instance that manages database lifecycle
 *
 * This module:
 * - Connects to database at module load (top-level await)
 * - Decorates context with db instance for use in routes
 * - Handles graceful shutdown
 *
 * Usage:
 * ```ts
 * new Elysia()
 *   .use(database)
 *   .get('/users', ({ db }) => db.query.users.findMany())
 * ```
 */

// Connect to database before creating Elysia instance
await DatabaseService.connect();

export const database = new Elysia({ name: "database" })
  .decorate("db", DatabaseService.getDb())
  .onStop(async () => {
    console.log("📊 Shutting down database...");
    await DatabaseService.disconnect();
  });

/**
 * Export health check for use in health endpoints
 */
export const checkDatabaseHealth = () => DatabaseService.healthCheck();

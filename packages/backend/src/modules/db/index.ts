import { Elysia } from "elysia";
import { DbService } from "./service";

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
 *   .use(db)
 *   .get('/users', ({ db }) => db.query.users.findMany())
 * ```
 */

// Connect to database before creating Elysia instance
await DbService.connect();

export const db = new Elysia({ name: "db" })
  .decorate("db", DbService.getDb())
  .onStop(async () => {
    console.log("📊 Shutting down database...");
    await DbService.disconnect();
  });

/**
 * Export health check for use in health endpoints
 */
export const checkDbHealth = () => DbService.healthCheck();

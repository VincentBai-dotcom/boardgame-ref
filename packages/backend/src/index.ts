import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { database, checkDatabaseHealth } from "./modules/database";

const app = new Elysia()
  .use(openapi())
  .use(database)
  .get("/", () => "Hello Elysia")
  .get("/health", async () => {
    const dbHealthy = await checkDatabaseHealth();
    return {
      status: dbHealthy ? "healthy" : "unhealthy",
      database: dbHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

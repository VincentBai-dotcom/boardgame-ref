import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { closeDatabase, checkDatabaseHealth } from "./database";

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello Elysia")
  .get("/health", async () => {
    const dbHealthy = await checkDatabaseHealth();
    return {
      status: dbHealthy ? "healthy" : "unhealthy",
      database: dbHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  })
  .onStop(async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await closeDatabase();
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

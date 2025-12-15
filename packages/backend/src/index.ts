import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { db, dbService } from "./modules/db";
import { auth } from "./modules/auth";
import { user } from "./modules/user";

const app = new Elysia()
  .use(openapi())
  .use(db)
  .use(auth)
  .use(user)
  .get("/", () => "Hello Elysia")
  .get("/health", async () => {
    const dbHealthy = await dbService.healthCheck();
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

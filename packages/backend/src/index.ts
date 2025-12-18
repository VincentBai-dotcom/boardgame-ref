import openapi from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { db, dbService } from "./modules/db";
import { auth } from "./modules/auth";
import { user } from "./modules/user";
import { refreshTokenCleanup } from "./modules/refresh-token-cleanup";

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:5173",
    }),
  )
  .use(openapi())
  .use(db)
  .use(refreshTokenCleanup)
  .use(user)
  .use(auth)
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

export type App = typeof app;

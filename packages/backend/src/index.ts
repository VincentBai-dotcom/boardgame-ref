import openapi from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { db, dbService } from "./modules/db";
import { auth } from "./modules/auth";
import { user } from "./modules/user";
import { chat } from "./modules/chat";
import { refreshTokenCleanup } from "./modules/refresh-token-cleanup";
import { ingestion } from "./modules/ingestion";
import { httpLogger } from "./plugins/http-logger";

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "127.0.0.1";
const CORS_ORIGINS =
  process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()) || [];

// CORS configuration based on environment
const getCorsConfig = () => {
  if (NODE_ENV === "development") {
    // Development: Allow configured origins or all if none specified
    return {
      origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : true,
      credentials: true,
    };
  } else {
    // Production: Only allow whitelisted origins (reject all if none specified)
    if (CORS_ORIGINS.length === 0) {
      console.warn(
        "⚠️  WARNING: No CORS_ORIGINS configured in production mode!",
      );
    }
    return {
      origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : false,
      credentials: true,
    };
  }
};

const app = new Elysia()
  .use(cors(getCorsConfig()))
  .use(httpLogger)
  .use(openapi())
  .use(ingestion)
  .use(db)
  .use(refreshTokenCleanup)
  .use(user)
  .use(auth)
  .use(chat)
  .get("/", () => "Hello Elysia")
  .get("/health", async () => {
    const dbHealthy = await dbService.healthCheck();
    return {
      status: dbHealthy ? "healthy" : "unhealthy",
      database: dbHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  })
  .listen({
    port: PORT,
    hostname: HOST,
  });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
console.log(`📦 Environment: ${NODE_ENV}`);
console.log(`🌐 Listening on: ${HOST}:${PORT}`);
console.log(
  `🔒 CORS origins: ${CORS_ORIGINS.length > 0 ? CORS_ORIGINS.join(", ") : "all (development mode)"}`,
);

export type App = typeof app;

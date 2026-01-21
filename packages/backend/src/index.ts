import openapi from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { configService } from "./modules/config";
import { db, dbService } from "./modules/db";
import { auth } from "./modules/auth";
import { user } from "./modules/user";
import { chat } from "./modules/chat";
import { refreshTokenCleanup } from "./modules/refresh-token-cleanup";
import { ingestion } from "./modules/ingestion";
import { httpLogger } from "./plugins/http-logger";
import { generateOpenAPISpec } from "./utils/generate-openapi-spec";

// Get configuration
const config = configService.get();

// CORS configuration based on environment
const getCorsConfig = () => {
  if (configService.isDevelopment) {
    // Development: Allow configured origins or all if none specified
    return {
      origin: config.cors.origins.length > 0 ? config.cors.origins : true,
      credentials: true,
    };
  } else {
    // Production: Only allow whitelisted origins
    return {
      origin: config.cors.origins.length > 0 ? config.cors.origins : false,
      credentials: true,
    };
  }
};

const app = new Elysia()
  .use(cors(getCorsConfig()))
  .use(httpLogger)
  .use(
    openapi({
      documentation: {
        openapi: "3.1.0", // Add this
      },
    }),
  )
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
    port: config.server.port,
    hostname: config.server.host,
  });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
console.log(`📦 Environment: ${config.env}`);
console.log(`🌐 Listening on: ${config.server.host}:${config.server.port}`);
console.log(
  `🔒 CORS origins: ${config.cors.origins.length > 0 ? config.cors.origins.join(", ") : "all (development mode)"}`,
);

if (configService.isDevelopment) {
  generateOpenAPISpec(config.server.host, config.server.port);
}

export type App = typeof app;

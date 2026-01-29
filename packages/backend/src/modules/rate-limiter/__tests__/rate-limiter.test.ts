import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { ApiError } from "../../errors";
import { MemoryStore } from "../impl/memory-store";
import type { ConfigService, IConfigService } from "../../config";
import { RateLimiterFactory } from "../index";

describe("RateLimiterFactory", () => {
  let mockConfig: IConfigService;
  let factory: RateLimiterFactory;

  beforeEach(() => {
    mockConfig = {
      get: () => ({
        env: "test",
        server: { port: 3000, host: "127.0.0.1" },
        cors: { origins: [] },
        database: { url: "postgres://test" },
        jwt: {
          accessSecret: "access",
          refreshSecret: "refresh",
          accessTtlSeconds: 900,
          refreshTtlSeconds: 2592000,
        },
        openai: { apiKey: "test" },
        oauth: {
          apple: {
            clientIdWeb: "",
            clientIdNative: "",
            teamId: "",
            keyId: "",
            privateKey: "",
            redirectUriWeb: "",
          },
          google: { clientId: "", clientSecret: "", redirectUri: "" },
        },
        ingestion: { provider: "docling" },
        email: {
          postmark: {
            serverToken: "",
            fromEmail: "",
            messageStream: "outbound",
          },
        },
        tokenCleanup: {
          cron: "0 3 * * *",
          refresh: { revokedRetentionDays: 7, expiredGraceDays: 1 },
          emailVerification: { usedRetentionDays: 7, expiredGraceDays: 1 },
        },
      }),
      isProduction: false,
      isDevelopment: false,
      isTest: true,
    };
    factory = new RateLimiterFactory(mockConfig as ConfigService);
  });

  test("perMinute helper derives capacity and refill", () => {
    const config = factory.perMinute(30);
    expect(config.capacity).toBe(30);
    expect(config.refillPerSecond).toBe(0.5);
    expect(config.burst).toBe(30);
  });

  test("blocks requests and sets headers", async () => {
    const store = new MemoryStore();
    const rateLimiter = factory.createRateLimiter(
      {
        default: { capacity: 1, refillPerSecond: 0, burst: 1 },
        keyBuilder: () => "fixed",
      },
      store,
    );

    const app = new Elysia()
      .use(rateLimiter)
      .onError(({ error, status }) => {
        if (error instanceof ApiError) {
          return status(error.status, { errorCode: error.code });
        }
        throw error;
      })
      .get("/", () => "ok");

    const first = await app.handle(new Request("http://localhost/"));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("0");

    const second = await app.handle(new Request("http://localhost/"));
    expect(second.status).toBe(429);
    const body = await second.json();
    expect(body.errorCode).toBe("RATE_LIMITED");
    expect(second.headers.get("Retry-After")).toBe("0");
  });
});

import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { ApiError } from "../../errors";
import { MemoryStore } from "../impl/memory-store";
import { RateLimiterFactory } from "../index";

describe("RateLimiterFactory", () => {
  test("perMinute helper derives capacity and refill", () => {
    const factory = new RateLimiterFactory({ isProduction: false } as never);
    const config = factory.perMinute(30);
    expect(config.capacity).toBe(30);
    expect(config.refillPerSecond).toBe(0.5);
    expect(config.burst).toBe(30);
  });

  test("blocks requests and sets headers", async () => {
    const store = new MemoryStore();
    const factory = new RateLimiterFactory({ isProduction: false } as never);
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

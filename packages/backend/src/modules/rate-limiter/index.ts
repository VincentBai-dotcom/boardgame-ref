import { RedisClient } from "bun";
import { Elysia } from "elysia";
import { ApiError } from "../errors";
import { configService, type ConfigService } from "../config";
import { getClientIp } from "../../utils/request";
import type { RateLimitConfig, RateLimitStore } from "./types";
import { MemoryStore } from "./impl/memory-store";
import { RedisStore } from "./impl/redis-store";

export type RateLimiterOptions = {
  default: RateLimitConfig;
  routeOverrides?: Record<string, RateLimitConfig>;
  keyBuilder?: (ctx: { method: string; path: string; ip: string }) => string;
  headerPrefix?: string;
};

export class RateLimiterFactory {
  constructor(private readonly configService: ConfigService) {}

  public perMinute(requests: number): RateLimitConfig {
    return {
      capacity: requests,
      refillPerSecond: requests / 60,
      burst: requests,
    };
  }

  public createRateLimiter(
    options: RateLimiterOptions,
    store?: RateLimitStore,
  ) {
    const headerPrefix = options.headerPrefix ?? "X-RateLimit";
    const activeStore = store ?? this.createDefaultStore();

    return new Elysia({ name: "global-rate-limiter" })
      .onRequest(async ({ request, set }) => {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method.toUpperCase();
        const ip = getClientIp(request) ?? "unknown";

        const config = this.resolveConfig(options, method, path);
        const key = (options.keyBuilder ?? this.defaultKeyBuilder)({
          method,
          path,
          ip,
        });

        const nowMs = Date.now();
        const result = await activeStore.consume(key, config, nowMs);

        set.headers["Retry-After"] = String(
          Math.ceil(result.retryAfterMs / 1000),
        );
        set.headers[`${headerPrefix}-Limit`] = String(
          config.burst ?? config.capacity,
        );
        set.headers[`${headerPrefix}-Remaining`] = String(result.remaining);
        set.headers[`${headerPrefix}-Reset`] = String(
          Math.ceil(result.resetMs / 1000),
        );

        if (!result.allowed) {
          throw new ApiError(429, "RATE_LIMITED", "Too many requests.", {
            retryAfterMs: result.retryAfterMs,
          });
        }
      })
      .as("scoped");
  }

  private defaultKeyBuilder(input: {
    method: string;
    path: string;
    ip: string;
  }): string {
    return `${input.method}:${input.path}:${input.ip}`;
  }

  private resolveConfig(
    options: RateLimiterOptions,
    method: string,
    path: string,
  ): RateLimitConfig {
    if (!options.routeOverrides) return options.default;
    const byMethod = options.routeOverrides[`${method} ${path}`];
    if (byMethod) return byMethod;
    const byPath = options.routeOverrides[path];
    if (byPath) return options.default;
    return options.default;
  }

  private createDefaultStore(): RateLimitStore {
    if (this.configService.isProduction) {
      const url =
        process.env.REDIS_URL ||
        process.env.VALKEY_URL ||
        "redis://localhost:6379";
      const client = new RedisClient(url);
      return new RedisStore(client);
    }
    return new MemoryStore();
  }
}

export const rateLimiterFactory = new RateLimiterFactory(configService);

export type { RateLimitConfig, RateLimitResult, RateLimitStore } from "./types";
export { MemoryStore } from "./impl/memory-store";
export { RedisStore } from "./impl/redis-store";

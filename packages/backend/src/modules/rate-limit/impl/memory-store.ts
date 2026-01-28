import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitStore,
} from "../types";

export class MemoryStore implements RateLimitStore {
  private buckets = new Map<
    string,
    { tokens: number; lastRefillMs: number; expiresAtMs: number }
  >();

  async consume(
    key: string,
    config: RateLimitConfig,
    nowMs: number,
  ): Promise<RateLimitResult> {
    const capacity = config.burst ?? config.capacity;
    const ttlMs = Math.ceil((capacity / config.refillPerSecond) * 1000 * 2);
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.expiresAtMs <= nowMs) {
      bucket = {
        tokens: capacity,
        lastRefillMs: nowMs,
        expiresAtMs: nowMs + ttlMs,
      };
    }

    const elapsedSeconds = Math.max(0, nowMs - bucket.lastRefillMs) / 1000;
    const refilled = bucket.tokens + elapsedSeconds * config.refillPerSecond;
    const tokens = Math.min(capacity, refilled);

    const allowed = tokens >= 1;
    const remaining = allowed ? Math.floor(tokens - 1) : 0;
    const newTokens = allowed ? tokens - 1 : tokens;

    bucket.tokens = newTokens;
    bucket.lastRefillMs = nowMs;
    bucket.expiresAtMs = nowMs + ttlMs;
    this.buckets.set(key, bucket);

    const retryAfterMs =
      allowed || config.refillPerSecond === 0
        ? 0
        : Math.ceil(((1 - tokens) / config.refillPerSecond) * 1000);
    const resetMs =
      config.refillPerSecond === 0
        ? 0
        : Math.ceil(((capacity - newTokens) / config.refillPerSecond) * 1000);

    return { allowed, remaining, retryAfterMs, resetMs };
  }
}

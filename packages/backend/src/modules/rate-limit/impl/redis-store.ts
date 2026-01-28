import type { RedisClient } from "bun";
import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitStore,
} from "../types";

export class RedisStore implements RateLimitStore {
  constructor(private client: RedisClient) {}

  async consume(
    key: string,
    config: RateLimitConfig,
    nowMs: number,
  ): Promise<RateLimitResult> {
    const capacity = config.burst ?? config.capacity;
    const ttlSeconds = Math.ceil((capacity / config.refillPerSecond) * 2);

    const result = (await this.client.send("EVAL", [
      LUA_TOKEN_BUCKET,
      "1",
      key,
      String(capacity),
      String(config.refillPerSecond),
      String(nowMs),
      String(ttlSeconds),
    ])) as [number, number, number, number];

    const allowed = result[0] === 1;
    const remaining = Math.max(0, Math.floor(result[1]));
    const retryAfterMs = Math.max(0, result[2]);
    const resetMs = Math.max(0, result[3]);

    return { allowed, remaining, retryAfterMs, resetMs };
  }
}

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_second = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local ttl_seconds = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'lastRefillMs')
local tokens = tonumber(data[1])
local lastRefillMs = tonumber(data[2])

if tokens == nil or lastRefillMs == nil then
  tokens = capacity
  lastRefillMs = now_ms
end

local elapsed_seconds = math.max(0, now_ms - lastRefillMs) / 1000.0
local refilled = tokens + (elapsed_seconds * refill_per_second)
local current = math.min(capacity, refilled)

local allowed = 0
if current >= 1 then
  allowed = 1
  current = current - 1
end

local retryAfterMs = 0
if allowed == 0 and refill_per_second > 0 then
  retryAfterMs = math.ceil(((1 - current) / refill_per_second) * 1000)
end

local resetMs = 0
if refill_per_second > 0 then
  resetMs = math.ceil(((capacity - current) / refill_per_second) * 1000)
end

redis.call('HSET', key, 'tokens', current, 'lastRefillMs', now_ms)
redis.call('EXPIRE', key, ttl_seconds)

return { allowed, current, retryAfterMs, resetMs }
`;

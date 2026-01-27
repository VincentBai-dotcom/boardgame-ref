# Elysia Rate Limiter Plugin Design

## Overview

Implement a reusable Elysia plugin that enforces API rate limits early in the request lifecycle using `onRequest`. The plugin supports global defaults plus per-route overrides, and uses Redis in production with an in-memory fallback for local development.

## Goals

- Enforce limits before request parsing/validation for minimal overhead.
- Provide consistent responses with `429` + `Retry-After` + JSON body.
- Support IP + route key, optionally userId when authenticated.
- Allow per-route overrides and per-scope configuration.
- Work in multi-instance deployments (Redis backing store).

## Non-Goals

- Advanced abuse protection (WAF, geo-fencing, bot detection).
- Distributed tracing or analytics aggregation.

## Defaults (as requested)

- Storage: Redis (shared) + in-memory fallback for dev
- Key: `route + ip` (optionally `route + ip + userId` if available)
- Algorithm: token bucket (burst + steady rate)
- Response: `429` + `Retry-After` header + JSON body

## Elysia Lifecycle Integration

- Use `onRequest` so the limiter runs before parsing/validation and short-circuits the request when throttled.
- Implement as a plugin and register it before routes to ensure it applies to all desired endpoints.
- Use hook scope controls if limiting should apply globally or per-module.

## API Design (Plugin)

### Plugin factory

```ts
rateLimiter({
  store: RedisStore | MemoryStore,
  keyBuilder?: (ctx) => string,
  default: {
    capacity: number,
    refillPerSecond: number,
    burst?: number
  },
  routeOverrides?: Record<string, { capacity: number; refillPerSecond: number }>,
  includeUserId?: boolean,
  headerPrefix?: string // e.g., X-RateLimit-*
})
```

### Key strategy

- Default key: `${method}:${path}:${ip}`
- If authenticated and `includeUserId=true`: `${method}:${path}:${ip}:${userId}`
- Normalize `path` to route template if available (avoid per-ID explosion).

## Token Bucket Algorithm

- Each key has:
  - `tokens` (float)
  - `lastRefill` (timestamp)
- Refill: `tokens = min(capacity, tokens + (now-lastRefill)*refillPerSecond)`
- Allow if `tokens >= 1`, then decrement.
- Deny otherwise; compute `retryAfterMs = ceil((1 - tokens)/refillPerSecond * 1000)`.

## Redis Storage

- Use Bun's native Redis client (`import { redis, RedisClient } from "bun"`) as the default driver.
- Default connection uses environment variables `REDIS_URL`, then `VALKEY_URL`, else `redis://localhost:6379`.
- Use a Lua script for atomic check+refill+consume.
- Store as hash: `tokens`, `lastRefill`.
- TTL: set to a few multiples of refill window (e.g., 2x capacity/refill).

## In-Memory Store

- Map keyed by limiter key with the same token bucket state.
- Periodic cleanup (interval) to purge expired entries.

## Response Format

- Status: `429`
- Headers:
  - `Retry-After` in seconds
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (optional)
- Body:

```json
{ "error": "rate_limited", "retryAfterMs": 1200 }
```

## Per-Route Overrides

- Add a route-level hook to attach override config to the context.
- The limiter reads overrides from context in `onRequest`.

## Configuration Placement

- Default values in `packages/backend/.env` or config service.
- Example:
  - `RATE_LIMIT_CAPACITY=60`
  - `RATE_LIMIT_REFILL_PER_SECOND=1`
  - `REDIS_URL=redis://...`

## Testing Strategy

- Unit tests for token bucket math.
- Integration tests for: allow, deny, reset timing.
- Redis-backed tests optional in CI.

## Production Notes

- Redis is required for multi-instance correctness.
- Rate limits should be tuned per endpoint:
  - Auth endpoints stricter.
  - Public read endpoints more generous.
- Monitor 429 rates and adjust.

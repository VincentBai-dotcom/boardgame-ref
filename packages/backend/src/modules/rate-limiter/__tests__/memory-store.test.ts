import { describe, expect, test } from "bun:test";
import { MemoryStore } from "../impl/memory-store";
import type { RateLimitConfig } from "../types";

describe("MemoryStore", () => {
  test("consumes tokens and refills over time", async () => {
    const store = new MemoryStore();
    const config: RateLimitConfig = {
      capacity: 2,
      refillPerSecond: 1,
    };

    const t0 = 0;
    const first = await store.consume("key", config, t0);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = await store.consume("key", config, t0);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = await store.consume("key", config, t0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterMs).toBe(1000);
    expect(third.resetMs).toBe(2000);

    const fourth = await store.consume("key", config, t0 + 1000);
    expect(fourth.allowed).toBe(true);
    expect(fourth.remaining).toBe(0);
  });

  test("expires buckets after ttl", async () => {
    const store = new MemoryStore();
    const config: RateLimitConfig = {
      capacity: 2,
      refillPerSecond: 1,
    };

    const t0 = 0;
    await store.consume("key", config, t0);

    const expired = await store.consume("key", config, t0 + 5000);
    expect(expired.allowed).toBe(true);
    expect(expired.remaining).toBe(1);
  });

  test("honors burst capacity", async () => {
    const store = new MemoryStore();
    const config: RateLimitConfig = {
      capacity: 1,
      refillPerSecond: 1,
      burst: 3,
    };

    const t0 = 0;
    const first = await store.consume("key", config, t0);
    const second = await store.consume("key", config, t0);
    const third = await store.consume("key", config, t0);
    const fourth = await store.consume("key", config, t0);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
    expect(fourth.allowed).toBe(false);
  });

  test("handles zero refill", async () => {
    const store = new MemoryStore();
    const config: RateLimitConfig = {
      capacity: 1,
      refillPerSecond: 0,
    };

    const t0 = 0;
    const first = await store.consume("key", config, t0);
    const second = await store.consume("key", config, t0);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBe(0);
    expect(second.resetMs).toBe(0);
  });
});

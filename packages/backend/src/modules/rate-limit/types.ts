export type RateLimitConfig = {
  capacity: number;
  refillPerSecond: number;
  burst?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetMs: number;
};

export interface RateLimitStore {
  consume(
    key: string,
    config: RateLimitConfig,
    nowMs: number,
  ): Promise<RateLimitResult>;
}

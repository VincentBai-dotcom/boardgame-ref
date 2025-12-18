import { cron } from "@elysiajs/cron";
import { Elysia } from "elysia";
import { dbService } from "../db";
import {
  RefreshTokenCleanupConfig,
  RefreshTokenCleanupService,
} from "./service";

const cleanupPattern = process.env.REFRESH_TOKEN_CLEANUP_CRON || "0 3 * * *"; // Default: daily at 03:00

const toNonNegative = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const cleanupConfig: RefreshTokenCleanupConfig = {
  revokedRetentionDays: toNonNegative(
    process.env.REFRESH_TOKEN_CLEANUP_REVOKED_RETENTION_DAYS,
    7,
  ),
  expiredGraceDays: toNonNegative(
    process.env.REFRESH_TOKEN_CLEANUP_EXPIRED_GRACE_DAYS,
    1,
  ),
};

// Singleton service instance (DI via constructor)
export const refreshTokenCleanupService = new RefreshTokenCleanupService(
  dbService,
  cleanupConfig,
);

export const refreshTokenCleanup = new Elysia({
  name: "refresh-token-cleanup",
}).use(
  cron({
    name: "refresh-token-cleaner",
    pattern: cleanupPattern,
    run: async () => {
      try {
        const { deletedCount, revokedCutoff, expiredCutoff } =
          await refreshTokenCleanupService.cleanup();

        console.log(
          `🧹 Refresh token cleanup removed ${deletedCount} tokens (revoked before ${revokedCutoff.toISOString()}, expired before ${expiredCutoff.toISOString()})`,
        );
      } catch (error) {
        console.error("⚠️ Refresh token cleanup failed:", error);
      }
    },
  }),
);

export { RefreshTokenCleanupService };

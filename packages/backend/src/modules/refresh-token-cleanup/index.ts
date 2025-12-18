import { cron } from "@elysiajs/cron";
import { Elysia } from "elysia";
import { dbService } from "../db";
import { RefreshTokenCleanupService } from "./service";

const cleanupPattern = process.env.REFRESH_TOKEN_CLEANUP_CRON || "0 3 * * *"; // Default: daily at 03:00

// Singleton service instance (DI via constructor)
export const refreshTokenCleanupService = new RefreshTokenCleanupService(
  dbService,
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

import { cron } from "@elysiajs/cron";
import { Elysia } from "elysia";
import { dbService } from "../db";
import { configService } from "../config";
import { TokenCleanupService } from "./service";

const cleanupPattern = configService.get().tokenCleanup.cron;

export const tokenCleanupService = new TokenCleanupService(
  dbService,
  configService,
);

export const tokenCleanup = new Elysia({ name: "token-cleanup" }).use(
  cron({
    name: "token-cleaner",
    pattern: cleanupPattern,
    run: async () => {
      try {
        const result = await tokenCleanupService.cleanup();
        console.log(
          `🧹 Token cleanup removed ${result.refreshTokensDeleted} refresh tokens (revoked before ${result.refreshRevokedCutoff.toISOString()}, expired before ${result.refreshExpiredCutoff.toISOString()})`,
        );
        console.log(
          `🧹 Token cleanup removed ${result.emailVerificationsDeleted} email verification codes (used before ${result.emailUsedCutoff.toISOString()}, expired before ${result.emailExpiredCutoff.toISOString()})`,
        );
      } catch (error) {
        console.error("⚠️ Token cleanup failed:", error);
      }
    },
  }),
);

export { TokenCleanupService };

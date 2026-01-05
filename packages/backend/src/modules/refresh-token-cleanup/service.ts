import { and, isNotNull, lt, or } from "drizzle-orm";
import { DbService } from "../db";
import { refreshToken } from "../../schema";

const DAY_MS = 86_400_000;

export interface RefreshTokenCleanupConfig {
  revokedRetentionDays: number;
  expiredGraceDays: number;
}

export interface CleanupResult {
  deletedCount: number;
  revokedCutoff: Date;
  expiredCutoff: Date;
}

/**
 * Service responsible for cleaning stale refresh tokens.
 *
 * Kept separate from the plugin to follow Elysia best practices: business
 * logic lives in a service, the plugin only wires scheduling and DI.
 */
export class RefreshTokenCleanupService {
  constructor(
    private dbService: DbService,
    private config: RefreshTokenCleanupConfig = this.readConfigFromEnv(),
  ) {}

  async cleanup(): Promise<CleanupResult> {
    const db = this.dbService.getDb();
    const now = Date.now();

    const revokedCutoff = new Date(
      now - Math.max(0, this.config.revokedRetentionDays) * DAY_MS,
    );
    const expiredCutoff = new Date(
      now - Math.max(0, this.config.expiredGraceDays) * DAY_MS,
    );

    const deleted = await db
      .delete(refreshToken)
      .where(
        or(
          and(
            isNotNull(refreshToken.revokedAt),
            lt(refreshToken.revokedAt, revokedCutoff),
          ),
          lt(refreshToken.expiresAt, expiredCutoff),
        ),
      )
      .returning({ id: refreshToken.id });

    return {
      deletedCount: deleted.length,
      revokedCutoff,
      expiredCutoff,
    };
  }

  private readConfigFromEnv(): RefreshTokenCleanupConfig {
    const toNonNegative = (
      value: string | undefined,
      fallback: number,
    ): number => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(0, parsed);
    };

    const revokedRetentionDays = toNonNegative(
      process.env.REFRESH_TOKEN_CLEANUP_REVOKED_RETENTION_DAYS,
      7,
    );
    const expiredGraceDays = toNonNegative(
      process.env.REFRESH_TOKEN_CLEANUP_EXPIRED_GRACE_DAYS,
      1,
    );
    return {
      revokedRetentionDays,
      expiredGraceDays,
    };
  }
}

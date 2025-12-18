import { and, isNotNull, lt, or } from "drizzle-orm";
import { DbService } from "../db";
import { refreshToken } from "../db/schema";

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
    private config: RefreshTokenCleanupConfig,
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
}

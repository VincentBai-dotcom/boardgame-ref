import { and, isNotNull, lt, or } from "drizzle-orm";
import { DbService } from "../db";
import { refreshToken } from "../../schema";
import { emailVerificationCode } from "../../schema/auth";
import type { ConfigService } from "../config";

const DAY_MS = 86_400_000;

export interface RefreshTokenCleanupConfig {
  revokedRetentionDays: number;
  expiredGraceDays: number;
}

export interface EmailVerificationCleanupConfig {
  usedRetentionDays: number;
  expiredGraceDays: number;
}

export interface TokenCleanupConfig {
  refresh: RefreshTokenCleanupConfig;
  emailVerification: EmailVerificationCleanupConfig;
}

export interface TokenCleanupResult {
  refreshTokensDeleted: number;
  emailVerificationsDeleted: number;
  refreshRevokedCutoff: Date;
  refreshExpiredCutoff: Date;
  emailUsedCutoff: Date;
  emailExpiredCutoff: Date;
}

export class TokenCleanupService {
  constructor(
    private dbService: DbService,
    private configService: ConfigService,
  ) {}

  async cleanup(): Promise<TokenCleanupResult> {
    const config = this.getConfig();
    const db = this.dbService.getDb();
    const now = Date.now();

    const refreshRevokedCutoff = new Date(
      now - Math.max(0, config.refresh.revokedRetentionDays) * DAY_MS,
    );
    const refreshExpiredCutoff = new Date(
      now - Math.max(0, config.refresh.expiredGraceDays) * DAY_MS,
    );

    const emailUsedCutoff = new Date(
      now - Math.max(0, config.emailVerification.usedRetentionDays) * DAY_MS,
    );
    const emailExpiredCutoff = new Date(
      now - Math.max(0, config.emailVerification.expiredGraceDays) * DAY_MS,
    );

    const refreshDeleted = await db
      .delete(refreshToken)
      .where(
        or(
          and(
            isNotNull(refreshToken.revokedAt),
            lt(refreshToken.revokedAt, refreshRevokedCutoff),
          ),
          lt(refreshToken.expiresAt, refreshExpiredCutoff),
        ),
      )
      .returning({ id: refreshToken.id });

    const emailDeleted = await db
      .delete(emailVerificationCode)
      .where(
        or(
          and(
            isNotNull(emailVerificationCode.usedAt),
            lt(emailVerificationCode.usedAt, emailUsedCutoff),
          ),
          lt(emailVerificationCode.expiresAt, emailExpiredCutoff),
        ),
      )
      .returning({ id: emailVerificationCode.id });

    return {
      refreshTokensDeleted: refreshDeleted.length,
      emailVerificationsDeleted: emailDeleted.length,
      refreshRevokedCutoff,
      refreshExpiredCutoff,
      emailUsedCutoff,
      emailExpiredCutoff,
    };
  }

  private getConfig(): TokenCleanupConfig {
    return this.configService.get().tokenCleanup;
  }
}

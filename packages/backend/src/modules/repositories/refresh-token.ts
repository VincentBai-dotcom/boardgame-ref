import { and, eq, isNull } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { refreshToken } from "../../schema";
import type { DbService } from "../db/service";

export type RefreshToken = InferSelectModel<typeof refreshToken>;
export type NewRefreshToken = InferInsertModel<typeof refreshToken>;

/**
 * Refresh token repository - handles all database operations for refresh tokens
 */
export class RefreshTokenRepository {
  constructor(private dbService: DbService) {}

  /**
   * Store a new refresh token
   */
  async create(token: NewRefreshToken): Promise<RefreshToken> {
    const db = this.dbService.getDb();
    const [created] = await db.insert(refreshToken).values(token).returning();
    return created;
  }

  /**
   * Find an active (non-revoked) token by hash
   */
  async findActiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    const db = this.dbService.getDb();
    const [stored] = await db
      .select()
      .from(refreshToken)
      .where(
        and(
          eq(refreshToken.tokenHash, tokenHash),
          isNull(refreshToken.revokedAt),
        ),
      )
      .limit(1);

    return stored ?? null;
  }

  /**
   * Mark a refresh token as rotated
   */
  async markRotated(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db
      .update(refreshToken)
      .set({
        revokedAt: new Date(),
        revokedReason: "rotated",
        lastUsedAt: new Date(),
      })
      .where(eq(refreshToken.id, id));
  }

  /**
   * Revoke a refresh token by hash
   */
  async revokeByHash(tokenHash: string, reason: string): Promise<void> {
    const db = this.dbService.getDb();
    await db
      .update(refreshToken)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(refreshToken.tokenHash, tokenHash),
          isNull(refreshToken.revokedAt),
        ),
      );
  }
}

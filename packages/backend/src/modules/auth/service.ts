import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { DbService } from "../db";
import { refreshToken as refreshTokenTable } from "../db/schema";
import type { UserService, User } from "../user";

interface TokenMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Auth service - focuses on persistence and credential validation.
 * Token signing/verification stays at the controller layer (auth module).
 */
export class AuthService {
  constructor(
    private dbService: DbService,
    private userService: UserService,
  ) {}

  private get refreshTtlSeconds(): number {
    const raw = process.env.JWT_REFRESH_EXPIRES_IN_SECONDS;
    return raw ? Number(raw) : 60 * 60 * 24 * 30; // default: 30 days
  }

  private hashToken(token: string): string {
    return new Bun.CryptoHasher("sha256").update(token).digest("hex");
  }

  async registerUser(email: string, password: string): Promise<User> {
    const existing = await this.userService.findByEmail(email, {
      includeDeleted: false,
    });
    if (existing) {
      throw new Error(`User already exists with email: ${email}`);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    return await this.userService.create({
      email,
      passwordHash,
      role: "user",
    });
  }

  async registerAdmin(email: string, password: string): Promise<User> {
    const existing = await this.userService.findByEmail(email, {
      includeDeleted: false,
    });
    if (existing) {
      throw new Error(`User already exists with email: ${email}`);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    return await this.userService.create({
      email,
      passwordHash,
      role: "admin",
    });
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const dbUser = await this.userService.findByEmail(email);

    if (!dbUser || !dbUser.passwordHash || dbUser.deletedAt) {
      throw new Error("Invalid credentials");
    }

    const isValid = await Bun.password.verify(password, dbUser.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    await this.userService.updateLastLogin(dbUser.id);
    return dbUser;
  }

  /**
   * Persist a newly issued refresh token.
   */
  async storeRefreshToken(
    userId: string,
    refreshToken: string,
    meta: TokenMeta,
  ): Promise<void> {
    const db = this.dbService.getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1000);

    await db.insert(refreshTokenTable).values({
      id: randomUUID(),
      userId,
      tokenHash: this.hashToken(refreshToken),
      issuedAt: now,
      expiresAt,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    });
  }

  /**
   * Consume a refresh token for rotation: validate and revoke the old one.
   * Returns the associated userId if valid.
   */
  async consumeRefreshToken(refreshToken: string): Promise<string> {
    const db = this.dbService.getDb();
    const tokenHash = this.hashToken(refreshToken);
    const [stored] = await db
      .select()
      .from(refreshTokenTable)
      .where(
        and(
          eq(refreshTokenTable.tokenHash, tokenHash),
          isNull(refreshTokenTable.revokedAt),
        ),
      )
      .limit(1);

    if (!stored || stored.expiresAt <= new Date()) {
      throw new Error("Refresh token expired or revoked");
    }

    await db
      .update(refreshTokenTable)
      .set({
        revokedAt: new Date(),
        revokedReason: "rotated",
        lastUsedAt: new Date(),
      })
      .where(eq(refreshTokenTable.id, stored.id));

    return stored.userId;
  }

  /**
   * Revoke a refresh token (logout).
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const db = this.dbService.getDb();
    const tokenHash = this.hashToken(refreshToken);

    await db
      .update(refreshTokenTable)
      .set({
        revokedAt: new Date(),
        revokedReason: "logout",
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(refreshTokenTable.tokenHash, tokenHash),
          isNull(refreshTokenTable.revokedAt),
        ),
      );
  }
}

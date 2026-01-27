import { randomUUID } from "crypto";
import type { Cookie } from "elysia";
import type {
  RefreshTokenRepository,
  User,
  UserRepository,
} from "../repositories";
import type { ConfigService } from "../config";
import { AuthError } from "./errors";

export interface AuthConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  accessSecret: string;
  refreshSecret: string;
  secureCookies: boolean;
}

interface TokenMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Auth service - focuses on persistence and credential validation.
 * Token signing/verification stays at the controller layer (auth module).
 */
export class AuthService {
  private config: AuthConfig;

  constructor(
    private userRepository: UserRepository,
    private refreshTokenRepository: RefreshTokenRepository,
    private configService: ConfigService,
    config?: AuthConfig,
  ) {
    this.config = config ?? this.readConfigFromEnv();
  }

  getConfig(): AuthConfig {
    return this.config;
  }

  setRefreshCookie(
    refreshToken: string,
    cookie: Record<string, Cookie<unknown>>,
  ) {
    cookie.refreshToken.value = refreshToken;
    cookie.refreshToken.httpOnly = true;
    cookie.refreshToken.secure = this.config.secureCookies;
    cookie.refreshToken.sameSite = "lax";
    cookie.refreshToken.path = "/auth";
    cookie.refreshToken.maxAge = this.config.refreshTtlSeconds;
  }

  async registerUser(email: string, password: string): Promise<User> {
    const existing = await this.userRepository.findByEmail(email, {
      includeDeleted: false,
    });
    if (existing) {
      if (existing.oauthProvider && !existing.passwordHash) {
        throw AuthError.oauthLoginRequired(existing.oauthProvider);
      }
      throw AuthError.userAlreadyExists(email);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    return await this.userRepository.create({
      email,
      passwordHash,
      role: "user",
    });
  }

  async registerAdmin(email: string, password: string): Promise<User> {
    const existing = await this.userRepository.findByEmail(email, {
      includeDeleted: false,
    });
    if (existing) {
      throw AuthError.userAlreadyExists(email);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    return await this.userRepository.create({
      email,
      passwordHash,
      role: "admin",
    });
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const dbUser = await this.userRepository.findByEmail(email);

    if (!dbUser || dbUser.deletedAt) {
      throw AuthError.invalidCredentials();
    }

    if (!dbUser.passwordHash && dbUser.oauthProvider) {
      throw AuthError.oauthLoginRequired(dbUser.oauthProvider);
    }

    if (!dbUser.passwordHash) {
      throw AuthError.invalidCredentials();
    }

    const isValid = await Bun.password.verify(password, dbUser.passwordHash);
    if (!isValid) {
      throw AuthError.invalidCredentials();
    }

    await this.userRepository.updateLastLogin(dbUser.id);
    return dbUser;
  }

  /**
   * Find or create an OAuth user from provider claims.
   */
  async findOrCreateOAuthUser(input: {
    provider: "apple" | "google";
    providerUserId: string;
    email?: string;
    emailVerified?: boolean;
    oauthRefreshToken?: string;
  }): Promise<User> {
    const existing = await this.userRepository.findByOAuthProvider(
      input.provider,
      input.providerUserId,
    );

    if (existing) {
      if (input.oauthRefreshToken) {
        await this.userRepository.update(existing.id, {
          oauthRefreshToken: input.oauthRefreshToken,
        });
      }
      await this.userRepository.updateLastLogin(existing.id);
      return existing;
    }

    if (!input.email) {
      throw AuthError.oauthEmailMissing();
    }

    const emailOwner = await this.userRepository.findByEmail(input.email, {
      includeDeleted: false,
    });
    if (emailOwner) {
      // Block if already linked to a different OAuth provider
      if (
        emailOwner.oauthProvider &&
        emailOwner.oauthProvider !== input.provider
      ) {
        throw AuthError.oauthEmailLinkedToOtherProvider(
          emailOwner.oauthProvider,
        );
      }

      // For password-only accounts, require verified email to link
      if (!emailOwner.oauthProvider && !input.emailVerified) {
        throw AuthError.oauthEmailRequiresPasswordLink();
      }

      // Link OAuth to existing account (password-only with verified email)
      const updated = await this.userRepository.update(emailOwner.id, {
        oauthProvider: input.provider,
        oauthProviderUserId: input.providerUserId,
        oauthRefreshToken: input.oauthRefreshToken ?? null,
        emailVerified: true,
      });

      if (!updated) {
        throw AuthError.oauthLinkFailed();
      }

      await this.userRepository.updateLastLogin(updated.id);
      return updated;
    }

    const user = await this.userRepository.create({
      email: input.email,
      emailVerified: input.emailVerified ?? false,
      passwordHash: null,
      role: "user",
      oauthProvider: input.provider,
      oauthProviderUserId: input.providerUserId,
      oauthRefreshToken: input.oauthRefreshToken ?? null,
    });

    await this.userRepository.updateLastLogin(user.id);
    return user;
  }

  /**
   * Persist a newly issued refresh token.
   */
  async storeRefreshToken(
    userId: string,
    refreshToken: string,
    meta: TokenMeta,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.refreshTtlSeconds * 1000,
    );

    await this.refreshTokenRepository.create({
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
    const tokenHash = this.hashToken(refreshToken);
    const stored =
      await this.refreshTokenRepository.findActiveByHash(tokenHash);

    if (!stored || stored.expiresAt <= new Date()) {
      throw AuthError.refreshTokenExpiredOrRevoked();
    }

    await this.refreshTokenRepository.markRotated(stored.id);

    return stored.userId;
  }

  /**
   * Revoke a refresh token (logout).
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenRepository.revokeByHash(tokenHash, "logout");
  }

  private hashToken(token: string): string {
    return new Bun.CryptoHasher("sha256").update(token).digest("hex");
  }

  private readConfigFromEnv(): AuthConfig {
    const config = this.configService.get();

    return {
      accessTtlSeconds: config.jwt.accessTtlSeconds,
      refreshTtlSeconds: config.jwt.refreshTtlSeconds,
      accessSecret: config.jwt.accessSecret,
      refreshSecret: config.jwt.refreshSecret,
      secureCookies: this.configService.isProduction,
    };
  }
}

import { beforeEach, describe, expect, test } from "bun:test";
import type { Cookie } from "elysia";
import type {
  FindUserOptions,
  IOAuthAccountRepository,
  IRefreshTokenRepository,
  IUserRepository,
  ListUsersOptions,
  NewOAuthAccount,
  NewUser,
  NewRefreshToken,
  OAuthAccount,
  RefreshToken,
  User,
} from "../../repositories";
import type { IConfigService } from "../../config";
import { AuthService } from "../service";
import { AuthErrorCodes } from "../errors";

const baseConfig = {
  accessTtlSeconds: 900,
  refreshTtlSeconds: 60 * 60 * 24 * 30,
  accessSecret: "access",
  refreshSecret: "refresh",
  secureCookies: false,
};

type UserRecord = User;

type RefreshTokenRecord = RefreshToken;

const makeUser = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  id: overrides.id ?? "user-1",
  email: overrides.email ?? "test@example.com",
  emailVerified: overrides.emailVerified ?? false,
  passwordHash: overrides.passwordHash ?? null,
  role: overrides.role ?? "user",
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  lastLoginAt: overrides.lastLoginAt ?? null,
  deletedAt: overrides.deletedAt ?? null,
});

class MockUserRepository implements IUserRepository {
  users: UserRecord[] = [];
  created: UserRecord[] = [];
  updated: Array<{ id: string; updates: Partial<UserRecord> }> = [];
  lastLoginUpdates: string[] = [];

  async findByEmail(
    email: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<UserRecord | null> {
    return (
      this.users.find(
        (user) =>
          user.email === email &&
          (options.includeDeleted ? true : !user.deletedAt),
      ) ?? null
    );
  }

  async create(data: NewUser): Promise<UserRecord> {
    const user = makeUser({ ...data, id: data.id ?? `user-${Date.now()}` });
    this.users.push(user);
    this.created.push(user);
    return user;
  }

  async update(
    id: string,
    updates: Partial<NewUser>,
  ): Promise<UserRecord | null> {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...updates };
    this.updated.push({ id, updates });
    return this.users[index];
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = this.users.find((entry) => entry.id === id);
    if (user) {
      user.lastLoginAt = new Date();
    }
    this.lastLoginUpdates.push(id);
  }

  async findById(
    id: string,
    options: FindUserOptions = {},
  ): Promise<UserRecord | null> {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) return null;
    if (options.includeDeleted) return user;
    return user.deletedAt ? null : user;
  }

  async list(options: ListUsersOptions = {}): Promise<UserRecord[]> {
    const { includeDeleted = false, role } = options;
    return this.users.filter((entry) => {
      if (!includeDeleted && entry.deletedAt) return false;
      if (role && entry.role !== role) return false;
      return true;
    });
  }

  async softDelete(id: string): Promise<void> {
    const user = this.users.find((entry) => entry.id === id);
    if (user) user.deletedAt = new Date();
  }

  async restore(id: string): Promise<UserRecord | null> {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) return null;
    user.deletedAt = null;
    return user;
  }

  async hardDelete(id: string): Promise<void> {
    this.users = this.users.filter((entry) => entry.id !== id);
  }

  async count(
    options: Pick<ListUsersOptions, "includeDeleted" | "role"> = {},
  ): Promise<number> {
    return (await this.list(options)).length;
  }
}

class MockRefreshTokenRepository implements IRefreshTokenRepository {
  tokens: RefreshTokenRecord[] = [];
  rotated: string[] = [];
  revoked: Array<{ tokenHash: string; reason: string }> = [];

  async create(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    const created: RefreshTokenRecord = {
      id: token.id ?? `token-${Date.now()}`,
      userId: token.userId,
      tokenHash: token.tokenHash,
      issuedAt: token.issuedAt ?? null,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt ?? null,
      userAgent: token.userAgent ?? null,
      ipAddress: token.ipAddress ?? null,
      revokedAt: token.revokedAt ?? null,
      revokedReason: token.revokedReason ?? null,
    };
    this.tokens.push(created);
    return created;
  }

  async findActiveByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    return (
      this.tokens.find(
        (token) => token.tokenHash === tokenHash && !token.revokedAt,
      ) ?? null
    );
  }

  async markRotated(id: string): Promise<void> {
    const token = this.tokens.find((entry) => entry.id === id);
    if (token) {
      token.revokedAt = new Date();
      token.revokedReason = "rotated";
      token.lastUsedAt = new Date();
    }
    this.rotated.push(id);
  }

  async revokeByHash(tokenHash: string, reason: string): Promise<void> {
    const token = this.tokens.find(
      (entry) => entry.tokenHash === tokenHash && !entry.revokedAt,
    );
    if (token) {
      token.revokedAt = new Date();
      token.revokedReason = reason;
      token.lastUsedAt = new Date();
    }
    this.revoked.push({ tokenHash, reason });
  }
}

class MockOAuthAccountRepository implements IOAuthAccountRepository {
  accounts: OAuthAccount[] = [];

  async findByProvider(
    provider: OAuthAccount["provider"],
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return (
      this.accounts.find(
        (account) =>
          account.provider === provider &&
          account.providerUserId === providerUserId,
      ) ?? null
    );
  }

  async findByUserProvider(
    userId: string,
    provider: OAuthAccount["provider"],
  ): Promise<OAuthAccount | null> {
    return (
      this.accounts.find(
        (account) => account.userId === userId && account.provider === provider,
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.accounts.filter((account) => account.userId === userId);
  }

  async create(account: NewOAuthAccount): Promise<OAuthAccount> {
    const created: OAuthAccount = {
      id: account.id ?? `oauth-${Date.now()}`,
      userId: account.userId,
      provider: account.provider,
      providerUserId: account.providerUserId,
      createdAt: account.createdAt ?? new Date(),
      updatedAt: account.updatedAt ?? new Date(),
    };
    this.accounts.push(created);
    return created;
  }
}

describe("AuthService", () => {
  let userRepo: MockUserRepository;
  let oauthAccountRepo: MockOAuthAccountRepository;
  let tokenRepo: MockRefreshTokenRepository;
  let service: AuthService;
  let mockConfigService: IConfigService;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    oauthAccountRepo = new MockOAuthAccountRepository();
    tokenRepo = new MockRefreshTokenRepository();
    mockConfigService = {
      get: () => ({
        env: "test",
        server: { port: 3000, host: "127.0.0.1" },
        cors: { origins: [] },
        database: { url: "postgres://test" },
        jwt: {
          accessSecret: "access",
          refreshSecret: "refresh",
          accessTtlSeconds: baseConfig.accessTtlSeconds,
          refreshTtlSeconds: baseConfig.refreshTtlSeconds,
        },
        openai: { apiKey: "test" },
        oauth: {
          apple: {
            clientIdWeb: "",
            clientIdNative: "",
            teamId: "",
            keyId: "",
            privateKey: "",
            redirectUriWeb: "",
          },
          google: {
            clientId: "",
            clientSecret: "",
            redirectUri: "",
          },
        },
        ingestion: { provider: "docling" },
        email: {
          postmark: {
            serverToken: "",
            fromEmail: "",
            messageStream: "outbound",
          },
        },
        tokenCleanup: {
          cron: "0 3 * * *",
          refresh: { revokedRetentionDays: 7, expiredGraceDays: 1 },
          emailVerification: { usedRetentionDays: 7, expiredGraceDays: 1 },
        },
      }),
      isProduction: false,
      isDevelopment: false,
      isTest: true,
    };
    service = new AuthService(
      userRepo,
      oauthAccountRepo,
      tokenRepo,
      mockConfigService,
      baseConfig,
    );
  });

  test("registerVerifiedUser sets emailVerified", async () => {
    const user = await service.registerVerifiedUser(
      "verified@example.com",
      "Password123!",
    );

    expect(user.emailVerified).toBe(true);
  });

  test("registerVerifiedUser links oauth-only account by setting password", async () => {
    const oauthUser = makeUser({
      id: "oauth-user",
      email: "oauth@example.com",
      passwordHash: null,
    });
    userRepo.users.push(oauthUser);
    await oauthAccountRepo.create({
      userId: "oauth-user",
      provider: "google",
      providerUserId: "google-1",
    });

    const user = await service.registerVerifiedUser(
      "oauth@example.com",
      "Password123!",
    );

    expect(user.id).toBe("oauth-user");
    expect(user.passwordHash).not.toBeNull();
    expect(await Bun.password.verify("Password123!", user.passwordHash!)).toBe(
      true,
    );
  });

  test("validateCredentials blocks oauth-only users", async () => {
    const oauthUser = makeUser({
      id: "oauth-user",
      email: "oauth@example.com",
      passwordHash: null,
    });
    userRepo.users.push(oauthUser);
    await oauthAccountRepo.create({
      userId: "oauth-user",
      provider: "apple",
      providerUserId: "apple-1",
    });

    await expect(
      service.validateCredentials("oauth@example.com", "Password123!"),
    ).rejects.toMatchObject({ code: AuthErrorCodes.OAuthLoginRequired });
  });

  test("validateCredentials rejects invalid password", async () => {
    const hash = await Bun.password.hash("CorrectPassword", {
      algorithm: "argon2id",
    });
    userRepo.users.push(
      makeUser({
        email: "user@example.com",
        passwordHash: hash,
      }),
    );

    await expect(
      service.validateCredentials("user@example.com", "WrongPassword"),
    ).rejects.toMatchObject({ code: AuthErrorCodes.InvalidCredentials });
  });

  test("findOrCreateOAuthUser returns existing provider user", async () => {
    userRepo.users.push(
      makeUser({
        id: "existing",
        email: "oauth@example.com",
      }),
    );
    await oauthAccountRepo.create({
      userId: "existing",
      provider: "google",
      providerUserId: "google-1",
    });

    const user = await service.findOrCreateOAuthUser({
      provider: "google",
      providerUserId: "google-1",
      email: "oauth@example.com",
      emailVerified: true,
    });

    expect(user.id).toBe("existing");
    expect(userRepo.lastLoginUpdates).toContain("existing");
  });

  test("findOrCreateOAuthUser links by verified email", async () => {
    userRepo.users.push(
      makeUser({
        id: "existing",
        email: "oauth@example.com",
      }),
    );

    const user = await service.findOrCreateOAuthUser({
      provider: "apple",
      providerUserId: "apple-1",
      email: "oauth@example.com",
      emailVerified: true,
    });

    expect(user.id).toBe("existing");
    expect(oauthAccountRepo.accounts).toHaveLength(1);
  });

  test("storeRefreshToken hashes and stores token", async () => {
    await service.storeRefreshToken("user-1", "raw-token", {
      userAgent: "agent",
      ipAddress: "127.0.0.1",
    });

    expect(tokenRepo.tokens).toHaveLength(1);
    expect(tokenRepo.tokens[0].tokenHash).not.toBe("raw-token");
    expect(tokenRepo.tokens[0].userId).toBe("user-1");
  });

  test("consumeRefreshToken returns userId and rotates token", async () => {
    await service.storeRefreshToken("user-1", "token", {
      userAgent: null,
      ipAddress: null,
    });

    const stored = tokenRepo.tokens[0];
    stored.expiresAt = new Date(Date.now() + 60_000);

    const userId = await service.consumeRefreshToken("token");
    expect(userId).toBe("user-1");
    expect(tokenRepo.rotated).toContain(stored.id);
  });

  test("consumeRefreshToken rejects expired tokens", async () => {
    await service.storeRefreshToken("user-1", "token", {
      userAgent: null,
      ipAddress: null,
    });

    const stored = tokenRepo.tokens[0];
    stored.expiresAt = new Date(Date.now() - 1000);

    await expect(service.consumeRefreshToken("token")).rejects.toMatchObject({
      code: AuthErrorCodes.RefreshTokenExpiredOrRevoked,
    });
  });

  test("setRefreshCookie applies cookie settings", () => {
    const cookie = {
      refreshToken: { value: "" },
    } as unknown as Record<string, Cookie<unknown>>;

    service.setRefreshCookie("token", cookie);

    expect(cookie.refreshToken.value).toBe("token");
    expect(cookie.refreshToken.httpOnly).toBe(true);
    expect(cookie.refreshToken.sameSite).toBe("lax");
    expect(cookie.refreshToken.path).toBe("/auth");
    expect(cookie.refreshToken.maxAge).toBe(baseConfig.refreshTtlSeconds);
  });
});

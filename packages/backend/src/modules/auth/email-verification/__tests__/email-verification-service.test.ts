import { beforeEach, describe, expect, test } from "bun:test";
import type {
  EmailVerificationCode,
  IEmailVerificationRepository,
  IOAuthAccountRepository,
  IUserRepository,
  NewEmailVerificationCode,
  OAuthAccount,
  NewOAuthAccount,
  User,
  NewUser,
  FindUserOptions,
} from "../../../repositories";
import { EmailVerificationService } from "../service";
import { AuthErrorCodes } from "../../errors";
import type { EmailSender } from "../../../email/sender/sender";

class MockEmailSender implements EmailSender {
  sent: Array<{ to: string; code: string }> = [];
  shouldFail = false;

  async sendVerificationCode(to: string, code: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error("send failed");
    }
    this.sent.push({ to, code });
  }
}

class MockUserRepository implements IUserRepository {
  users: User[] = [];

  async create(userData: NewUser): Promise<User> {
    const user: User = {
      id: userData.id ?? `user-${Date.now()}`,
      email: userData.email,
      emailVerified: userData.emailVerified ?? false,
      passwordHash: userData.passwordHash ?? null,
      role: userData.role ?? "user",
      createdAt: userData.createdAt ?? new Date(),
      updatedAt: userData.updatedAt ?? new Date(),
      lastLoginAt: userData.lastLoginAt ?? null,
      deletedAt: userData.deletedAt ?? null,
    };
    this.users.push(user);
    return user;
  }

  async findById(
    id: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) return null;
    if (options.includeDeleted) return user;
    return user.deletedAt ? null : user;
  }

  async findByEmail(
    email: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const user = this.users.find((entry) => entry.email === email);
    if (!user) return null;
    if (options.includeDeleted) return user;
    return user.deletedAt ? null : user;
  }

  async list(): Promise<User[]> {
    return this.users;
  }

  async update(id: string, updates: Partial<NewUser>): Promise<User | null> {
    const index = this.users.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...updates } as User;
    return this.users[index];
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = this.users.find((entry) => entry.id === id);
    if (user) user.lastLoginAt = new Date();
  }

  async softDelete(id: string): Promise<void> {
    const user = this.users.find((entry) => entry.id === id);
    if (user) user.deletedAt = new Date();
  }

  async restore(id: string): Promise<User | null> {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) return null;
    user.deletedAt = null;
    return user;
  }

  async hardDelete(id: string): Promise<void> {
    this.users = this.users.filter((entry) => entry.id !== id);
  }

  async count(): Promise<number> {
    return this.users.length;
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

class MockEmailVerificationRepository implements IEmailVerificationRepository {
  records: EmailVerificationCode[] = [];
  invalidated: Array<{ email: string; purpose: string }> = [];

  async create(code: NewEmailVerificationCode): Promise<EmailVerificationCode> {
    const created: EmailVerificationCode = {
      id: code.id ?? `code-${Date.now()}`,
      email: code.email,
      purpose: code.purpose,
      codeHash: code.codeHash,
      codeSalt: code.codeSalt,
      attempts: code.attempts ?? 0,
      createdAt: code.createdAt ?? new Date(),
      expiresAt: code.expiresAt,
      usedAt: code.usedAt ?? null,
    };
    this.records.push(created);
    return created;
  }

  async findLatestActiveByEmail(
    email: string,
    purpose: string,
  ): Promise<EmailVerificationCode | null> {
    const active = this.records
      .filter(
        (record) =>
          record.email === email &&
          record.purpose === purpose &&
          !record.usedAt &&
          record.expiresAt > new Date(),
      )
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
    return active[0] ?? null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const record = this.records.find((entry) => entry.id === id);
    if (record) record.attempts += 1;
  }

  async markUsed(id: string): Promise<void> {
    const record = this.records.find((entry) => entry.id === id);
    if (record) record.usedAt = new Date();
  }

  async invalidateActiveByEmail(email: string, purpose: string): Promise<void> {
    this.invalidated.push({ email, purpose });
    this.records = this.records.map((record) =>
      record.email === email && record.purpose === purpose && !record.usedAt
        ? { ...record, usedAt: new Date() }
        : record,
    );
  }
}

describe("EmailVerificationService", () => {
  let emailSender: MockEmailSender;
  let userRepository: MockUserRepository;
  let oauthAccountRepository: MockOAuthAccountRepository;
  let emailVerificationRepository: MockEmailVerificationRepository;
  let service: EmailVerificationService;

  beforeEach(() => {
    emailSender = new MockEmailSender();
    userRepository = new MockUserRepository();
    oauthAccountRepository = new MockOAuthAccountRepository();
    emailVerificationRepository = new MockEmailVerificationRepository();
    service = new EmailVerificationService(
      emailSender,
      userRepository,
      oauthAccountRepository,
      emailVerificationRepository,
    );
  });

  test("getEmailIntent returns register for new email", async () => {
    const result = await service.getEmailIntent("new@example.com");
    expect(result.intent).toBe("register");
  });

  test("getEmailIntent returns register with provider for oauth-only user", async () => {
    const user = await userRepository.create({
      email: "oauth@example.com",
      passwordHash: null,
      role: "user",
    });
    await oauthAccountRepository.create({
      userId: user.id,
      provider: "google",
      providerUserId: "google-1",
    });

    const result = await service.getEmailIntent("oauth@example.com");
    expect(result.intent).toBe("register");
    if (result.intent === "register") {
      expect(result.provider).toBe("google");
    }
  });

  test("startRegistration returns alreadySent within cooldown", async () => {
    const record = await emailVerificationRepository.create({
      email: "cooldown@example.com",
      purpose: EmailVerificationService.PURPOSE_REGISTER,
      codeHash: "hash",
      codeSalt: "salt",
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const result = await service.startRegistration("cooldown@example.com");
    expect(result.alreadySent).toBe(true);
    expect(emailSender.sent).toHaveLength(0);
    expect(record.usedAt).toBeNull();
  });

  test("resendRegistration throws on cooldown", async () => {
    await emailVerificationRepository.create({
      email: "cooldown@example.com",
      purpose: EmailVerificationService.PURPOSE_REGISTER,
      codeHash: "hash",
      codeSalt: "salt",
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await expect(
      service.resendRegistration("cooldown@example.com"),
    ).rejects.toMatchObject({
      code: AuthErrorCodes.EmailVerificationResendTooSoon,
    });
  });

  test("verifyRegistrationCode marks used", async () => {
    const record = await emailVerificationRepository.create({
      email: "verify@example.com",
      purpose: EmailVerificationService.PURPOSE_REGISTER,
      codeHash: "hash",
      codeSalt: "salt",
      attempts: 0,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const hash = new Bun.CryptoHasher("sha256")
      .update(`salt:123456`)
      .digest("hex");
    record.codeHash = hash;

    await service.verifyRegistrationCode("verify@example.com", "123456");
    expect(record.usedAt).not.toBeNull();
  });

  test("verifyRegistrationCode increments attempts on mismatch", async () => {
    const record = await emailVerificationRepository.create({
      email: "verify@example.com",
      purpose: EmailVerificationService.PURPOSE_REGISTER,
      codeHash: "hash",
      codeSalt: "salt",
      attempts: 0,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await expect(
      service.verifyRegistrationCode("verify@example.com", "123456"),
    ).rejects.toMatchObject({ code: AuthErrorCodes.EmailVerificationInvalid });
    expect(record.attempts).toBe(1);
  });

  test("sendRegistrationCode invalidates on send failure", async () => {
    emailSender.shouldFail = true;
    await expect(
      service.startRegistration("fail@example.com"),
    ).rejects.toMatchObject({ code: AuthErrorCodes.EmailSendFailed });
    expect(emailVerificationRepository.invalidated).toHaveLength(2);
  });

  test("startRegistration blocks when password exists", async () => {
    await userRepository.create({
      email: "user@example.com",
      passwordHash: "hash",
      role: "user",
    });

    await expect(
      service.startRegistration("user@example.com"),
    ).rejects.toMatchObject({ code: AuthErrorCodes.UserAlreadyExists });
  });
});

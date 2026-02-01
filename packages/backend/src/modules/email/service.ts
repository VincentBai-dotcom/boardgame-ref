import { randomBytes, randomInt } from "crypto";
import {
  emailVerificationRepository,
  oauthAccountRepository,
  userRepository,
} from "../repositories";
import { AuthError } from "../auth/errors";
import type { EmailSender } from "./sender/sender";

export class EmailVerificationService {
  static readonly RESEND_COOLDOWN_SECONDS = 60;
  static readonly PURPOSE_REGISTER = "register";
  static readonly CODE_EXPIRY_MINUTES = 10;
  static readonly MAX_ATTEMPTS = 5;

  constructor(private emailSender: EmailSender) {}

  async getEmailIntent(
    email: string,
  ): Promise<
    { intent: "login" } | { intent: "register"; provider?: "apple" | "google" }
  > {
    const existing = await userRepository.findByEmail(email, {
      includeDeleted: false,
    });

    if (!existing) {
      return { intent: "register" };
    }

    if (!existing.passwordHash) {
      const accounts = await oauthAccountRepository.findByUserId(existing.id);
      if (accounts.length > 0) {
        return { intent: "register", provider: accounts[0].provider };
      }
      return { intent: "register" };
    }

    return { intent: "login" };
  }

  async startRegistration(email: string): Promise<{ alreadySent: boolean }> {
    await this.assertRegistrationAllowed(email);

    const cooldown = await this.getRegistrationCooldown(email);
    if (cooldown.withinCooldown) {
      return { alreadySent: true };
    }

    await this.sendRegistrationCode(email);
    return { alreadySent: false };
  }

  async resendRegistration(email: string): Promise<void> {
    await this.assertRegistrationAllowed(email);

    const cooldown = await this.getRegistrationCooldown(email);
    if (cooldown.withinCooldown) {
      throw AuthError.emailVerificationResendTooSoon(cooldown.secondsRemaining);
    }

    await this.sendRegistrationCode(email);
  }

  async verifyRegistrationCode(email: string, code: string): Promise<void> {
    const record = await emailVerificationRepository.findLatestActiveByEmail(
      email,
      EmailVerificationService.PURPOSE_REGISTER,
    );

    if (!record) {
      throw AuthError.emailVerificationInvalid();
    }

    if (record.expiresAt <= new Date()) {
      throw AuthError.emailVerificationExpired();
    }

    if (record.attempts >= EmailVerificationService.MAX_ATTEMPTS) {
      throw AuthError.emailVerificationAttemptsExceeded();
    }

    const expectedHash = this.hashCode(code, record.codeSalt);
    if (expectedHash !== record.codeHash) {
      await emailVerificationRepository.incrementAttempts(record.id);
      throw AuthError.emailVerificationInvalid();
    }

    await emailVerificationRepository.markUsed(record.id);
  }

  private generateCode(): string {
    const value = randomInt(0, 1000000);
    return String(value).padStart(6, "0");
  }

  private async getRegistrationCooldown(email: string): Promise<{
    withinCooldown: boolean;
    secondsRemaining: number;
  }> {
    const active = await emailVerificationRepository.findLatestActiveByEmail(
      email,
      EmailVerificationService.PURPOSE_REGISTER,
    );

    if (!active?.createdAt || active.expiresAt <= new Date()) {
      return { withinCooldown: false, secondsRemaining: 0 };
    }

    const elapsedMs = Date.now() - active.createdAt.getTime();
    const remainingMs =
      EmailVerificationService.RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
    if (remainingMs <= 0) {
      return { withinCooldown: false, secondsRemaining: 0 };
    }

    return {
      withinCooldown: true,
      secondsRemaining: Math.ceil(remainingMs / 1000),
    };
  }

  private async assertRegistrationAllowed(email: string): Promise<void> {
    const existing = await userRepository.findByEmail(email, {
      includeDeleted: false,
    });

    if (existing) {
      if (!existing.passwordHash) {
        return;
      }
      throw AuthError.userAlreadyExists(email);
    }
  }

  private async sendRegistrationCode(email: string): Promise<void> {
    await emailVerificationRepository.invalidateActiveByEmail(
      email,
      EmailVerificationService.PURPOSE_REGISTER,
    );

    const code = this.generateCode();
    const salt = randomBytes(16).toString("hex");
    const codeHash = this.hashCode(code, salt);

    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + EmailVerificationService.CODE_EXPIRY_MINUTES,
    );

    await emailVerificationRepository.create({
      email,
      purpose: EmailVerificationService.PURPOSE_REGISTER,
      codeHash,
      codeSalt: salt,
      expiresAt,
      attempts: 0,
    });

    try {
      await this.emailSender.sendVerificationCode(email, code);
    } catch (error) {
      await emailVerificationRepository.invalidateActiveByEmail(
        email,
        EmailVerificationService.PURPOSE_REGISTER,
      );
      const message = error instanceof Error ? error.message : String(error);
      throw AuthError.emailSendFailed(message);
    }
  }

  private hashCode(code: string, salt: string): string {
    return new Bun.CryptoHasher("sha256")
      .update(`${salt}:${code}`)
      .digest("hex");
  }
}

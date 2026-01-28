import { randomBytes, randomInt } from "crypto";
import { emailVerificationRepository, userRepository } from "../repositories";
import { AuthError } from "../auth/errors";
import type { EmailSender } from "./sender/sender";

const PURPOSE_REGISTER = "register";
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export class EmailVerificationService {
  constructor(private emailSender: EmailSender) {}

  async getEmailIntent(
    email: string,
  ): Promise<
    | { intent: "login" }
    | { intent: "register" }
    | { intent: "oauth"; provider: "apple" | "google" }
  > {
    const existing = await userRepository.findByEmail(email, {
      includeDeleted: false,
    });

    if (!existing) {
      return { intent: "register" };
    }

    if (existing.oauthProvider && !existing.passwordHash) {
      return { intent: "oauth", provider: existing.oauthProvider };
    }

    return { intent: "login" };
  }

  async startRegistration(email: string): Promise<void> {
    const existing = await userRepository.findByEmail(email, {
      includeDeleted: false,
    });

    if (existing) {
      if (existing.oauthProvider && !existing.passwordHash) {
        throw AuthError.oauthLoginRequired(existing.oauthProvider);
      }
      throw AuthError.userAlreadyExists(email);
    }

    await emailVerificationRepository.invalidateActiveByEmail(
      email,
      PURPOSE_REGISTER,
    );

    const code = this.generateCode();
    const salt = randomBytes(16).toString("hex");
    const codeHash = this.hashCode(code, salt);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRY_MINUTES);

    await emailVerificationRepository.create({
      email,
      purpose: PURPOSE_REGISTER,
      codeHash,
      codeSalt: salt,
      expiresAt,
      attempts: 0,
    });

    try {
      await this.emailSender.sendVerificationCode(email, code);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw AuthError.emailSendFailed(message);
    }
  }

  async resendRegistration(email: string): Promise<void> {
    const existing = await emailVerificationRepository.findLatestActiveByEmail(
      email,
      PURPOSE_REGISTER,
    );

    if (existing?.createdAt) {
      const elapsedMs = Date.now() - existing.createdAt.getTime();
      if (elapsedMs < RESEND_COOLDOWN_SECONDS * 1000) {
        const secondsRemaining = Math.ceil(
          (RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000,
        );
        throw AuthError.emailVerificationResendTooSoon(secondsRemaining);
      }
    }

    return this.startRegistration(email);
  }

  async verifyRegistrationCode(email: string, code: string): Promise<void> {
    const record = await emailVerificationRepository.findLatestActiveByEmail(
      email,
      PURPOSE_REGISTER,
    );

    if (!record) {
      throw AuthError.emailVerificationInvalid();
    }

    if (record.expiresAt <= new Date()) {
      throw AuthError.emailVerificationExpired();
    }

    if (record.attempts >= MAX_ATTEMPTS) {
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

  private hashCode(code: string, salt: string): string {
    return new Bun.CryptoHasher("sha256")
      .update(`${salt}:${code}`)
      .digest("hex");
  }
}

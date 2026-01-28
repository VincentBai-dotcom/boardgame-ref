import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { emailVerificationCode } from "../../schema/auth";
import type { DbService } from "../db/service";

export type EmailVerificationCode = InferSelectModel<
  typeof emailVerificationCode
>;
export type NewEmailVerificationCode = InferInsertModel<
  typeof emailVerificationCode
>;

export class EmailVerificationRepository {
  constructor(private dbService: DbService) {}

  async create(code: NewEmailVerificationCode): Promise<EmailVerificationCode> {
    const db = this.dbService.getDb();
    const [created] = await db
      .insert(emailVerificationCode)
      .values(code)
      .returning();
    return created;
  }

  async findLatestActiveByEmail(
    email: string,
    purpose: string,
  ): Promise<EmailVerificationCode | null> {
    const db = this.dbService.getDb();
    const [found] = await db
      .select()
      .from(emailVerificationCode)
      .where(
        and(
          eq(emailVerificationCode.email, email),
          eq(emailVerificationCode.purpose, purpose),
          isNull(emailVerificationCode.usedAt),
          gt(emailVerificationCode.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(emailVerificationCode.createdAt))
      .limit(1);

    return found ?? null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db
      .update(emailVerificationCode)
      .set({
        attempts: sql`${emailVerificationCode.attempts} + 1`,
      })
      .where(eq(emailVerificationCode.id, id));
  }

  async markUsed(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db
      .update(emailVerificationCode)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationCode.id, id));
  }

  async invalidateActiveByEmail(email: string, purpose: string): Promise<void> {
    const db = this.dbService.getDb();
    await db
      .update(emailVerificationCode)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationCode.email, email),
          eq(emailVerificationCode.purpose, purpose),
          isNull(emailVerificationCode.usedAt),
        ),
      );
  }
}

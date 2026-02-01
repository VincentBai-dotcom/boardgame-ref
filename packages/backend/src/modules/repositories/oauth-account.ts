import { eq, and } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { oauthAccount } from "../../schema";
import type { DbService } from "../db/service";

export type OAuthAccount = InferSelectModel<typeof oauthAccount>;
export type NewOAuthAccount = InferInsertModel<typeof oauthAccount>;

export interface IOAuthAccountRepository {
  findByProvider(
    provider: OAuthAccount["provider"],
    providerUserId: string,
  ): Promise<OAuthAccount | null>;
  findByUserProvider(
    userId: string,
    provider: OAuthAccount["provider"],
  ): Promise<OAuthAccount | null>;
  findByUserId(userId: string): Promise<OAuthAccount[]>;
  create(account: NewOAuthAccount): Promise<OAuthAccount>;
}

export class OAuthAccountRepository implements IOAuthAccountRepository {
  constructor(private dbService: DbService) {}

  async findByProvider(
    provider: OAuthAccount["provider"],
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    const db = this.dbService.getDb();
    const [found] = await db
      .select()
      .from(oauthAccount)
      .where(
        and(
          eq(oauthAccount.provider, provider),
          eq(oauthAccount.providerUserId, providerUserId),
        ),
      )
      .limit(1);

    return found ?? null;
  }

  async findByUserProvider(
    userId: string,
    provider: OAuthAccount["provider"],
  ): Promise<OAuthAccount | null> {
    const db = this.dbService.getDb();
    const [found] = await db
      .select()
      .from(oauthAccount)
      .where(
        and(
          eq(oauthAccount.userId, userId),
          eq(oauthAccount.provider, provider),
        ),
      )
      .limit(1);

    return found ?? null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const db = this.dbService.getDb();
    return await db
      .select()
      .from(oauthAccount)
      .where(eq(oauthAccount.userId, userId));
  }

  async create(account: NewOAuthAccount): Promise<OAuthAccount> {
    const db = this.dbService.getDb();
    const [created] = await db.insert(oauthAccount).values(account).returning();
    return created;
  }
}

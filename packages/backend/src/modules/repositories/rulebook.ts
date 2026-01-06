import { eq, and, sql, desc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { rulebook } from "../../schema";
import type { DbService } from "../db/service";

export type Rulebook = InferSelectModel<typeof rulebook>;
export type NewRulebook = InferInsertModel<typeof rulebook>;

export interface ListRulebooksOptions {
  limit?: number;
  offset?: number;
  gameId?: string;
  rulebookType?: string;
  language?: string;
}

/**
 * Rulebook repository - handles all database operations for the rulebook table
 */
export class RulebookRepository {
  constructor(private dbService: DbService) {}

  /**
   * Create a new rulebook
   * @param rulebookData - Rulebook data to insert
   * @param tx - Optional transaction context
   * @returns Created rulebook record
   */
  async create(
    rulebookData: NewRulebook,
    tx?: BunSQLDatabase,
  ): Promise<Rulebook> {
    const db = tx || this.dbService.getDb();
    const [created] = await db
      .insert(rulebook)
      .values(rulebookData)
      .returning();
    return created;
  }

  /**
   * Find rulebook by ID
   * @param id - Rulebook ID
   * @param tx - Optional transaction context
   * @returns Rulebook record or null if not found
   */
  async findById(id: string, tx?: BunSQLDatabase): Promise<Rulebook | null> {
    const db = tx || this.dbService.getDb();
    const found = await db
      .select()
      .from(rulebook)
      .where(eq(rulebook.id, id))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find rulebooks by game ID
   * @param gameId - Game ID
   * @param tx - Optional transaction context
   * @returns Array of rulebook records
   */
  async findByGameId(gameId: string, tx?: BunSQLDatabase): Promise<Rulebook[]> {
    const db = tx || this.dbService.getDb();
    return await db
      .select()
      .from(rulebook)
      .where(eq(rulebook.gameId, gameId))
      .orderBy(desc(rulebook.createdAt));
  }

  /**
   * List rulebooks with pagination and filtering
   * @param options - Query options (pagination, filters, etc.)
   * @param tx - Optional transaction context
   * @returns Array of rulebook records
   */
  async list(
    options: ListRulebooksOptions = {},
    tx?: BunSQLDatabase,
  ): Promise<Rulebook[]> {
    const db = tx || this.dbService.getDb();
    const { limit = 100, offset = 0, gameId, rulebookType, language } = options;

    let query = db.select().from(rulebook).$dynamic();

    // Build where clause
    const conditions = [];
    if (gameId) {
      conditions.push(eq(rulebook.gameId, gameId));
    }
    if (rulebookType) {
      conditions.push(eq(rulebook.rulebookType, rulebookType));
    }
    if (language) {
      conditions.push(eq(rulebook.language, language));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(rulebook.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Update rulebook by ID
   * @param id - Rulebook ID
   * @param updates - Partial rulebook data to update
   * @param tx - Optional transaction context
   * @returns Updated rulebook record or null if not found
   */
  async update(
    id: string,
    updates: Partial<NewRulebook>,
    tx?: BunSQLDatabase,
  ): Promise<Rulebook | null> {
    const db = tx || this.dbService.getDb();
    const [updated] = await db
      .update(rulebook)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rulebook.id, id))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete rulebook by ID (cascades to chunks)
   * @param id - Rulebook ID
   * @param tx - Optional transaction context
   */
  async delete(id: string, tx?: BunSQLDatabase): Promise<void> {
    const db = tx || this.dbService.getDb();
    await db.delete(rulebook).where(eq(rulebook.id, id));
  }

  /**
   * Count rulebooks
   * @param options - Count options (filters)
   * @param tx - Optional transaction context
   * @returns Number of rulebooks matching criteria
   */
  async count(
    options: Pick<
      ListRulebooksOptions,
      "gameId" | "rulebookType" | "language"
    > = {},
    tx?: BunSQLDatabase,
  ): Promise<number> {
    const db = tx || this.dbService.getDb();
    const { gameId, rulebookType, language } = options;

    let query = db
      .select({ count: sql<number>`count(*)::int` })
      .from(rulebook)
      .$dynamic();

    const conditions = [];
    if (gameId) {
      conditions.push(eq(rulebook.gameId, gameId));
    }
    if (rulebookType) {
      conditions.push(eq(rulebook.rulebookType, rulebookType));
    }
    if (language) {
      conditions.push(eq(rulebook.language, language));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result[0]?.count ?? 0;
  }

  /**
   * Upsert rulebook by game ID, type, and language - update if exists, create if not
   * @param gameId - Game ID
   * @param rulebookType - Type of rulebook (base, expansion, etc.)
   * @param language - Language code (e.g., 'en', 'es')
   * @param rulebookData - Rulebook data (without gameId, rulebookType, language)
   * @param tx - Optional transaction context
   * @returns Upserted rulebook record
   */
  async upsertByGameIdAndType(
    gameId: string,
    rulebookType: string,
    language: string,
    rulebookData: Omit<NewRulebook, "gameId" | "rulebookType" | "language">,
    tx?: BunSQLDatabase,
  ): Promise<Rulebook> {
    const existingRulebooks = await this.findByGameId(gameId, tx);
    const existing = existingRulebooks.find(
      (rb) => rb.rulebookType === rulebookType && rb.language === language,
    );

    if (existing) {
      const updated = await this.update(existing.id, rulebookData, tx);
      return updated!;
    } else {
      return await this.create(
        { ...rulebookData, gameId, rulebookType, language },
        tx,
      );
    }
  }
}

import { eq, and, sql, desc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { rulebook } from "../db/schema";
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
   * @returns Created rulebook record
   */
  async create(rulebookData: NewRulebook): Promise<Rulebook> {
    const db = this.dbService.getDb();
    const [created] = await db
      .insert(rulebook)
      .values(rulebookData)
      .returning();
    return created;
  }

  /**
   * Find rulebook by ID
   * @param id - Rulebook ID
   * @returns Rulebook record or null if not found
   */
  async findById(id: string): Promise<Rulebook | null> {
    const db = this.dbService.getDb();
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
   * @returns Array of rulebook records
   */
  async findByGameId(gameId: string): Promise<Rulebook[]> {
    const db = this.dbService.getDb();
    return await db
      .select()
      .from(rulebook)
      .where(eq(rulebook.gameId, gameId))
      .orderBy(desc(rulebook.createdAt));
  }

  /**
   * List rulebooks with pagination and filtering
   * @param options - Query options (pagination, filters, etc.)
   * @returns Array of rulebook records
   */
  async list(options: ListRulebooksOptions = {}): Promise<Rulebook[]> {
    const db = this.dbService.getDb();
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
   * @returns Updated rulebook record or null if not found
   */
  async update(
    id: string,
    updates: Partial<NewRulebook>,
  ): Promise<Rulebook | null> {
    const db = this.dbService.getDb();
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
   */
  async delete(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(rulebook).where(eq(rulebook.id, id));
  }

  /**
   * Count rulebooks
   * @param options - Count options (filters)
   * @returns Number of rulebooks matching criteria
   */
  async count(
    options: Pick<
      ListRulebooksOptions,
      "gameId" | "rulebookType" | "language"
    > = {},
  ): Promise<number> {
    const db = this.dbService.getDb();
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
}

import { eq, and, sql, asc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { ruleChunk } from "../../schema";
import type { DbService } from "../db/service";

export type RuleChunk = InferSelectModel<typeof ruleChunk>;
export type NewRuleChunk = InferInsertModel<typeof ruleChunk>;

export interface ListRuleChunksOptions {
  limit?: number;
  offset?: number;
  rulebookId?: string;
  gameId?: string;
}

/**
 * Rule chunk repository - handles all database operations for the rule_chunks table
 */
export class RuleChunkRepository {
  constructor(private dbService: DbService) {}

  /**
   * Create a new rule chunk
   * @param chunkData - Rule chunk data to insert
   * @returns Created rule chunk record
   */
  async create(chunkData: NewRuleChunk): Promise<RuleChunk> {
    const db = this.dbService.getDb();
    const [created] = await db.insert(ruleChunk).values(chunkData).returning();
    return created;
  }

  /**
   * Create multiple rule chunks in batch
   * @param chunksData - Array of rule chunk data to insert
   * @returns Array of created rule chunk records
   */
  async createMany(chunksData: NewRuleChunk[]): Promise<RuleChunk[]> {
    const db = this.dbService.getDb();
    if (chunksData.length === 0) return [];
    return await db.insert(ruleChunk).values(chunksData).returning();
  }

  /**
   * Find rule chunk by ID
   * @param id - Rule chunk ID
   * @returns Rule chunk record or null if not found
   */
  async findById(id: string): Promise<RuleChunk | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(ruleChunk)
      .where(eq(ruleChunk.id, id))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find rule chunks by rulebook ID
   * @param rulebookId - Rulebook ID
   * @returns Array of rule chunk records ordered by chunk index
   */
  async findByRulebookId(rulebookId: string): Promise<RuleChunk[]> {
    const db = this.dbService.getDb();
    return await db
      .select()
      .from(ruleChunk)
      .where(eq(ruleChunk.rulebookId, rulebookId))
      .orderBy(asc(ruleChunk.chunkIndex));
  }

  /**
   * Find rule chunks by game ID
   * @param gameId - Game ID
   * @returns Array of rule chunk records
   */
  async findByGameId(gameId: string): Promise<RuleChunk[]> {
    const db = this.dbService.getDb();
    return await db
      .select()
      .from(ruleChunk)
      .where(eq(ruleChunk.gameId, gameId))
      .orderBy(asc(ruleChunk.chunkIndex));
  }

  /**
   * List rule chunks with pagination and filtering
   * @param options - Query options (pagination, filters, etc.)
   * @returns Array of rule chunk records
   */
  async list(options: ListRuleChunksOptions = {}): Promise<RuleChunk[]> {
    const db = this.dbService.getDb();
    const { limit = 100, offset = 0, rulebookId, gameId } = options;

    let query = db.select().from(ruleChunk).$dynamic();

    const conditions = [];
    if (rulebookId) {
      conditions.push(eq(ruleChunk.rulebookId, rulebookId));
    }
    if (gameId) {
      conditions.push(eq(ruleChunk.gameId, gameId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(asc(ruleChunk.chunkIndex));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Update rule chunk by ID
   * @param id - Rule chunk ID
   * @param updates - Partial rule chunk data to update
   * @returns Updated rule chunk record or null if not found
   */
  async update(
    id: string,
    updates: Partial<NewRuleChunk>,
  ): Promise<RuleChunk | null> {
    const db = this.dbService.getDb();
    const [updated] = await db
      .update(ruleChunk)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ruleChunk.id, id))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete rule chunk by ID
   * @param id - Rule chunk ID
   */
  async delete(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(ruleChunk).where(eq(ruleChunk.id, id));
  }

  /**
   * Delete all rule chunks for a rulebook
   * @param rulebookId - Rulebook ID
   */
  async deleteByRulebookId(rulebookId: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(ruleChunk).where(eq(ruleChunk.rulebookId, rulebookId));
  }

  /**
   * Count rule chunks
   * @param options - Count options (filters)
   * @returns Number of rule chunks matching criteria
   */
  async count(
    options: Pick<ListRuleChunksOptions, "rulebookId" | "gameId"> = {},
  ): Promise<number> {
    const db = this.dbService.getDb();
    const { rulebookId, gameId } = options;

    let query = db
      .select({ count: sql<number>`count(*)::int` })
      .from(ruleChunk)
      .$dynamic();

    const conditions = [];
    if (rulebookId) {
      conditions.push(eq(ruleChunk.rulebookId, rulebookId));
    }
    if (gameId) {
      conditions.push(eq(ruleChunk.gameId, gameId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result[0]?.count ?? 0;
  }

  /**
   * Search for similar rule chunks using cosine similarity
   * @param embedding - Embedding vector to search with
   * @param rulebookId - Rulebook ID to search in
   * @param limit - Maximum number of results
   * @param similarityThreshold - Minimum similarity score (0-1)
   * @returns Array of rule chunks with similarity scores
   */
  async searchBySimilarity(
    embedding: number[],
    rulebookId: string,
    limit: number,
    similarityThreshold: number,
  ): Promise<Array<RuleChunk & { similarity: number }>> {
    const db = this.dbService.getDb();

    // Convert embedding array to pgvector format
    const embeddingStr = `[${embedding.join(",")}]`;

    const results = await db
      .select({
        id: ruleChunk.id,
        rulebookId: ruleChunk.rulebookId,
        gameId: ruleChunk.gameId,
        chunkText: ruleChunk.chunkText,
        embedding: ruleChunk.embedding,
        chunkIndex: ruleChunk.chunkIndex,
        createdAt: ruleChunk.createdAt,
        updatedAt: ruleChunk.updatedAt,
        similarity:
          sql<number>`1 - (${ruleChunk.embedding} <=> ${embeddingStr}::vector)`.as(
            "similarity",
          ),
      })
      .from(ruleChunk)
      .where(
        sql`${ruleChunk.rulebookId} = ${rulebookId} AND 1 - (${ruleChunk.embedding} <=> ${embeddingStr}::vector) >= ${similarityThreshold}`,
      )
      .orderBy(sql`${ruleChunk.embedding} <=> ${embeddingStr}::vector`)
      .limit(limit);

    return results as Array<RuleChunk & { similarity: number }>;
  }
}

import { eq, and, sql, desc, asc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { game, rulebook, ruleChunk } from "../db/schema";
import type { DbService } from "../db/service";

// Type definitions
type Game = InferSelectModel<typeof game>;
type NewGame = InferInsertModel<typeof game>;

type Rulebook = InferSelectModel<typeof rulebook>;
type NewRulebook = InferInsertModel<typeof rulebook>;

type RuleChunk = InferSelectModel<typeof ruleChunk>;
type NewRuleChunk = InferInsertModel<typeof ruleChunk>;

interface ListGamesOptions {
  limit?: number;
  offset?: number;
}

interface ListRulebooksOptions {
  limit?: number;
  offset?: number;
  gameId?: string;
  rulebookType?: string;
  language?: string;
}

interface ListRuleChunksOptions {
  limit?: number;
  offset?: number;
  rulebookId?: string;
  gameId?: string;
}

interface SimilaritySearchOptions {
  embedding: number[];
  gameId?: string;
  rulebookId?: string;
  limit?: number;
  similarityThreshold?: number;
}

interface SimilaritySearchResult extends RuleChunk {
  similarity: number;
}

/**
 * Game service - provides CRUD operations for game, rulebook, and rule chunk management
 *
 * This service handles:
 * - Game CRUD operations (create, find, list, update, delete)
 * - Rulebook CRUD operations (create, find, list, update, delete)
 * - Rule chunk CRUD operations (create, find, list, update, delete)
 * - Semantic similarity search for RAG retrieval
 */
export class GameService {
  constructor(private dbService: DbService) {}

  // ============================================================================
  // GAME OPERATIONS
  // ============================================================================

  /**
   * Create a new game
   * @param gameData - Game data to insert
   * @returns Created game record
   * @throws Error if game name already exists
   */
  async createGame(gameData: NewGame): Promise<Game> {
    const db = this.dbService.getDb();

    // Check name uniqueness
    const existing = await db
      .select()
      .from(game)
      .where(eq(game.name, gameData.name))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Game already exists with name: ${gameData.name}`);
    }

    const [created] = await db.insert(game).values(gameData).returning();
    return created;
  }

  /**
   * Find game by ID
   * @param id - Game ID
   * @returns Game record or null if not found
   */
  async findGameById(id: string): Promise<Game | null> {
    const db = this.dbService.getDb();
    const found = await db.select().from(game).where(eq(game.id, id)).limit(1);
    return found[0] ?? null;
  }

  /**
   * Find game by name
   * @param name - Game name
   * @returns Game record or null if not found
   */
  async findGameByName(name: string): Promise<Game | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(game)
      .where(eq(game.name, name))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find game by BoardGameGeek ID
   * @param bggId - BoardGameGeek ID
   * @returns Game record or null if not found
   */
  async findGameByBggId(bggId: number): Promise<Game | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(game)
      .where(eq(game.bggId, bggId))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * List games with pagination
   * @param options - Query options (pagination)
   * @returns Array of game records
   */
  async listGames(options: ListGamesOptions = {}): Promise<Game[]> {
    const db = this.dbService.getDb();
    const { limit = 100, offset = 0 } = options;

    let query = db.select().from(game).$dynamic();

    query = query.orderBy(asc(game.name));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Update game by ID
   * @param id - Game ID
   * @param updates - Partial game data to update
   * @returns Updated game record or null if not found
   */
  async updateGame(
    id: string,
    updates: Partial<NewGame>,
  ): Promise<Game | null> {
    const db = this.dbService.getDb();
    const [updated] = await db
      .update(game)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(game.id, id))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete game by ID (cascades to rulebooks and chunks)
   * @param id - Game ID
   */
  async deleteGame(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(game).where(eq(game.id, id));
  }

  /**
   * Count games
   * @returns Number of games
   */
  async countGames(): Promise<number> {
    const db = this.dbService.getDb();

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(game);

    return result[0]?.count ?? 0;
  }

  // ============================================================================
  // RULEBOOK OPERATIONS
  // ============================================================================

  /**
   * Create a new rulebook
   * @param rulebookData - Rulebook data to insert
   * @returns Created rulebook record
   */
  async createRulebook(rulebookData: NewRulebook): Promise<Rulebook> {
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
  async findRulebookById(id: string): Promise<Rulebook | null> {
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
  async findRulebooksByGameId(gameId: string): Promise<Rulebook[]> {
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
  async listRulebooks(options: ListRulebooksOptions = {}): Promise<Rulebook[]> {
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
  async updateRulebook(
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
  async deleteRulebook(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(rulebook).where(eq(rulebook.id, id));
  }

  /**
   * Count rulebooks
   * @param options - Count options (filters)
   * @returns Number of rulebooks matching criteria
   */
  async countRulebooks(
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

  // ============================================================================
  // RULE CHUNK OPERATIONS
  // ============================================================================

  /**
   * Create a new rule chunk
   * @param chunkData - Rule chunk data to insert
   * @returns Created rule chunk record
   */
  async createRuleChunk(chunkData: NewRuleChunk): Promise<RuleChunk> {
    const db = this.dbService.getDb();
    const [created] = await db.insert(ruleChunk).values(chunkData).returning();
    return created;
  }

  /**
   * Create multiple rule chunks in batch
   * @param chunksData - Array of rule chunk data to insert
   * @returns Array of created rule chunk records
   */
  async createRuleChunks(chunksData: NewRuleChunk[]): Promise<RuleChunk[]> {
    const db = this.dbService.getDb();
    if (chunksData.length === 0) return [];
    return await db.insert(ruleChunk).values(chunksData).returning();
  }

  /**
   * Find rule chunk by ID
   * @param id - Rule chunk ID
   * @returns Rule chunk record or null if not found
   */
  async findRuleChunkById(id: string): Promise<RuleChunk | null> {
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
  async findRuleChunksByRulebookId(rulebookId: string): Promise<RuleChunk[]> {
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
  async findRuleChunksByGameId(gameId: string): Promise<RuleChunk[]> {
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
  async listRuleChunks(
    options: ListRuleChunksOptions = {},
  ): Promise<RuleChunk[]> {
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
  async updateRuleChunk(
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
  async deleteRuleChunk(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(ruleChunk).where(eq(ruleChunk.id, id));
  }

  /**
   * Delete all rule chunks for a rulebook
   * @param rulebookId - Rulebook ID
   */
  async deleteRuleChunksByRulebookId(rulebookId: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(ruleChunk).where(eq(ruleChunk.rulebookId, rulebookId));
  }

  /**
   * Count rule chunks
   * @param options - Count options (filters)
   * @returns Number of rule chunks matching criteria
   */
  async countRuleChunks(
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

  // ============================================================================
  // SEMANTIC SEARCH OPERATIONS
  // ============================================================================

  /**
   * Search for similar rule chunks using cosine similarity
   * @param options - Search options (embedding, filters, limit, threshold)
   * @returns Array of rule chunks with similarity scores
   */
  async similaritySearch(
    options: SimilaritySearchOptions,
  ): Promise<SimilaritySearchResult[]> {
    const db = this.dbService.getDb();
    const {
      embedding,
      gameId,
      rulebookId,
      limit = 10,
      similarityThreshold = 0.7,
    } = options;

    // Convert embedding array to pgvector format
    const embeddingStr = `[${embedding.join(",")}]`;

    let query = db
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
      .$dynamic();

    const conditions = [];
    if (gameId) {
      conditions.push(eq(ruleChunk.gameId, gameId));
    }
    if (rulebookId) {
      conditions.push(eq(ruleChunk.rulebookId, rulebookId));
    }
    // Add similarity threshold
    conditions.push(
      sql`1 - (${ruleChunk.embedding} <=> ${embeddingStr}::vector) >= ${similarityThreshold}`,
    );

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query
      .orderBy(sql`${ruleChunk.embedding} <=> ${embeddingStr}::vector`)
      .limit(limit);

    return (await query) as SimilaritySearchResult[];
  }
}

// Export types for external use
export type {
  Game,
  NewGame,
  Rulebook,
  NewRulebook,
  RuleChunk,
  NewRuleChunk,
  ListGamesOptions,
  ListRulebooksOptions,
  ListRuleChunksOptions,
  SimilaritySearchOptions,
  SimilaritySearchResult,
};

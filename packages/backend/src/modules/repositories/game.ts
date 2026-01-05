import { eq, sql, asc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { game } from "../../schema";
import type { DbService } from "../db/service";

export type Game = InferSelectModel<typeof game>;
export type NewGame = InferInsertModel<typeof game>;

export interface ListGamesOptions {
  limit?: number;
  offset?: number;
}

/**
 * Game repository - handles all database operations for the game table
 */
export class GameRepository {
  constructor(private dbService: DbService) {}

  /**
   * Create a new game
   * @param gameData - Game data to insert
   * @returns Created game record
   * @throws Error if bggId already exists
   */
  async create(gameData: NewGame): Promise<Game> {
    const db = this.dbService.getDb();

    // Check bggId uniqueness
    const existing = await db
      .select()
      .from(game)
      .where(eq(game.bggId, gameData.bggId))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Game already exists with BGG ID: ${gameData.bggId}`);
    }

    const [created] = await db.insert(game).values(gameData).returning();
    return created;
  }

  /**
   * Find game by ID
   * @param id - Game ID
   * @returns Game record or null if not found
   */
  async findById(id: string): Promise<Game | null> {
    const db = this.dbService.getDb();
    const found = await db.select().from(game).where(eq(game.id, id)).limit(1);
    return found[0] ?? null;
  }

  /**
   * Find game by name
   * @param name - Game name
   * @returns Game record or null if not found
   */
  async findByName(name: string): Promise<Game | null> {
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
  async findByBggId(bggId: number): Promise<Game | null> {
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
  async list(options: ListGamesOptions = {}): Promise<Game[]> {
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
  async update(id: string, updates: Partial<NewGame>): Promise<Game | null> {
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
  async delete(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(game).where(eq(game.id, id));
  }

  /**
   * Count games
   * @returns Number of games
   */
  async count(): Promise<number> {
    const db = this.dbService.getDb();

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(game);

    return result[0]?.count ?? 0;
  }

  /**
   * Fuzzy search for games by name using pg_trgm similarity
   * @param query - Search query string
   * @param limit - Maximum number of results
   * @param similarityThreshold - Minimum similarity score (0-1)
   * @returns Array of games with similarity scores
   */
  async searchByNameFuzzy(
    query: string,
    limit: number,
    similarityThreshold: number,
  ): Promise<Array<Game & { similarity: number }>> {
    const db = this.dbService.getDb();

    const results = await db
      .select({
        id: game.id,
        name: game.name,
        yearPublished: game.yearPublished,
        bggId: game.bggId,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        similarity: sql<number>`similarity(${game.name}, ${query})`.as(
          "similarity",
        ),
      })
      .from(game)
      .where(sql`${game.name} % ${query}`) // % is the similarity operator
      .orderBy(sql`similarity DESC`)
      .limit(limit);

    // Filter by similarity threshold
    return results.filter((r) => r.similarity >= similarityThreshold);
  }
}

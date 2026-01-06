import { eq, sql, asc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
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
   * @param tx - Optional transaction context
   * @returns Created game record
   * @throws Error if bggId already exists
   */
  async create(gameData: NewGame, tx?: BunSQLDatabase): Promise<Game> {
    const db = tx || this.dbService.getDb();

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
   * @param tx - Optional transaction context
   * @returns Game record or null if not found
   */
  async findById(id: string, tx?: BunSQLDatabase): Promise<Game | null> {
    const db = tx || this.dbService.getDb();
    const found = await db.select().from(game).where(eq(game.id, id)).limit(1);
    return found[0] ?? null;
  }

  /**
   * Find game by name
   * @param name - Game name
   * @param tx - Optional transaction context
   * @returns Game record or null if not found
   */
  async findByName(name: string, tx?: BunSQLDatabase): Promise<Game | null> {
    const db = tx || this.dbService.getDb();
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
   * @param tx - Optional transaction context
   * @returns Game record or null if not found
   */
  async findByBggId(bggId: number, tx?: BunSQLDatabase): Promise<Game | null> {
    const db = tx || this.dbService.getDb();
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
   * @param tx - Optional transaction context
   * @returns Array of game records
   */
  async list(
    options: ListGamesOptions = {},
    tx?: BunSQLDatabase,
  ): Promise<Game[]> {
    const db = tx || this.dbService.getDb();
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
   * @param tx - Optional transaction context
   * @returns Updated game record or null if not found
   */
  async update(
    id: string,
    updates: Partial<NewGame>,
    tx?: BunSQLDatabase,
  ): Promise<Game | null> {
    const db = tx || this.dbService.getDb();
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
   * @param tx - Optional transaction context
   */
  async delete(id: string, tx?: BunSQLDatabase): Promise<void> {
    const db = tx || this.dbService.getDb();
    await db.delete(game).where(eq(game.id, id));
  }

  /**
   * Count games
   * @param tx - Optional transaction context
   * @returns Number of games
   */
  async count(tx?: BunSQLDatabase): Promise<number> {
    const db = tx || this.dbService.getDb();

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
   * @param tx - Optional transaction context
   * @returns Array of games with similarity scores
   */
  async searchByNameFuzzy(
    query: string,
    limit: number,
    similarityThreshold: number,
    tx?: BunSQLDatabase,
  ): Promise<Array<Game & { similarity: number }>> {
    const db = tx || this.dbService.getDb();

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

  /**
   * Upsert game by BGG ID - update if exists, create if not
   * @param bggId - BoardGameGeek ID to match on
   * @param gameData - Game data (without bggId)
   * @param tx - Optional transaction context
   * @returns Upserted game record
   */
  async upsertByBggId(
    bggId: number,
    gameData: Omit<NewGame, "bggId">,
    tx?: BunSQLDatabase,
  ): Promise<Game> {
    const existing = await this.findByBggId(bggId, tx);

    if (existing) {
      const updated = await this.update(existing.id, gameData, tx);
      return updated!;
    } else {
      return await this.create({ ...gameData, bggId }, tx);
    }
  }
}

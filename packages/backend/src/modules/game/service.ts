import type { GameRepository } from "../repositories/game";
import type { RuleChunkRepository } from "../repositories/rule-chunk";
import type { Game, Rulebook, RuleChunk } from "../repositories";

export interface SimilaritySearchOptions {
  embedding: number[];
  rulebookId: string;
  limit?: number;
  similarityThreshold?: number;
}

export interface SimilaritySearchResult extends RuleChunk {
  similarity: number;
}

/**
 * Game service - provides business logic for game-related operations
 *
 * This service handles:
 * - Fuzzy search for games (tries exact match first, then fuzzy)
 * - Semantic similarity search with adaptive thresholds
 * - Delegates CRUD operations to repositories
 */
export class GameService {
  constructor(
    private gameRepository: GameRepository,
    private ruleChunkRepository: RuleChunkRepository,
  ) {}

  /**
   * Fuzzy search for games by name using pg_trgm
   * Tries exact match first, then fuzzy search
   * @param query - Search query string
   * @param limit - Maximum number of results (default: 5)
   * @param similarityThreshold - Minimum similarity score (default: 0.3)
   * @returns Array of games with similarity scores, ordered by relevance
   */
  async fuzzySearchGames(
    query: string,
    limit: number = 5,
    similarityThreshold: number = 0.3,
  ): Promise<Array<Game & { similarity: number }>> {
    // Try exact match first (case-insensitive comparison)
    const exactMatch = await this.gameRepository.findByName(query);

    if (exactMatch) {
      return [{ ...exactMatch, similarity: 1.0 }];
    }

    // Fallback to fuzzy search
    return this.gameRepository.searchByNameFuzzy(
      query,
      limit,
      similarityThreshold,
    );
  }

  /**
   * Semantic similarity search with adaptive thresholds
   * Tries multiple thresholds (0.7, 0.55, 0.4) until results are found
   * @param options - Search options
   * @returns Array of rule chunks with similarity scores
   */
  async similaritySearch(
    options: Omit<SimilaritySearchOptions, "similarityThreshold">,
  ): Promise<SimilaritySearchResult[]> {
    const { embedding, rulebookId, limit = 10 } = options;

    // Try multiple thresholds in descending order
    const thresholds = [0.7, 0.55, 0.4];

    for (const threshold of thresholds) {
      const results = await this.ruleChunkRepository.searchBySimilarity(
        embedding,
        rulebookId,
        limit,
        threshold,
      );

      if (results.length > 0) {
        return results as SimilaritySearchResult[];
      }
    }

    // No results found at any threshold
    return [];
  }
}

export type { Game, Rulebook, RuleChunk };

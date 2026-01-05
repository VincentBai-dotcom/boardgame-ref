import { tool } from "@openai/agents";
import { z } from "zod";
import type { GameService } from "../../../game/service";
import type { RulebookRepository } from "../../../repositories/rulebook";

/**
 * Create search board game tool for the agent
 * @param gameService - GameService instance
 * @param rulebookRepository - RulebookRepository instance
 * @returns Tool definition for OpenAI Agents SDK
 */
export function createSearchBoardGameTool(
  gameService: GameService,
  rulebookRepository: RulebookRepository,
) {
  return tool({
    name: "search_board_game",
    description:
      "Search for a board game by name. Use this when the user mentions a game name to find the correct game in the database. Handles typos and variations in spelling. Returns matching games with confidence scores.",
    parameters: z.object({
      gameName: z
        .string()
        .describe(
          "The board game name extracted from the user's query. Can be partial or misspelled.",
        ),
    }),
    async execute({ gameName }) {
      const results = await gameService.fuzzySearchGames(gameName);

      if (results.length === 0) {
        return {
          status: "no_match",
          query: gameName,
          matches: [],
          message:
            "No board game found. Ask the user to check spelling or provide a different name.",
        };
      }

      if (results.length === 1 && results[0].similarity > 0.8) {
        // High confidence single match - get rulebooks
        const game = results[0];
        const rulebooks = await rulebookRepository.findByGameId(game.id);

        if (rulebooks.length === 0) {
          return {
            status: "single_match",
            query: gameName,
            game,
            rulebooks: [],
            message:
              "Found a matching game but no rulebooks are available yet.",
          };
        }

        return {
          status: "single_match",
          query: gameName,
          game,
          rulebooks: rulebooks.map((rb) => ({
            id: rb.id,
            title: rb.title,
            rulebookType: rb.rulebookType,
            language: rb.language,
          })),
          message:
            "Use grep_rules or semantic-search_rules or  with a rulebook ID to find specific rules.",
        };
      }

      // Multiple matches or low confidence - ask user to clarify
      return {
        status: "multiple_matches",
        query: gameName,
        matches: results.map((g) => ({
          id: g.id,
          name: g.name,
          yearPublished: g.yearPublished,
          similarity: g.similarity,
        })),
        message: "Ask the user to clarify which game they mean.",
      };
    },
  });
}

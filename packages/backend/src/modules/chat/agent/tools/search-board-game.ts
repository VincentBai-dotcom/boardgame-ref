import { tool } from "@openai/agents";
import { z } from "zod";
import type { GameService } from "../../../game/service";

/**
 * Create search board game tool for the agent
 * @param gameService - GameService instance
 * @returns Tool definition for OpenAI Agents SDK
 */
export function createSearchBoardGameTool(gameService: GameService) {
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
        return `No board game found matching "${gameName}". Please check the spelling or try a different name.`;
      }

      if (results.length === 1 && results[0].similarity > 0.8) {
        // High confidence single match - get rulebooks
        const game = results[0];
        const rulebooks = await gameService.findRulebooksByGameId(game.id);

        if (rulebooks.length === 0) {
          return `Found game "${game.name}" but no rulebooks are available yet.`;
        }

        const rulebooksList = rulebooks
          .map((rb) => `${rb.id}:${rb.rulebookType}:${rb.language}`)
          .join(",");

        return `Game: ${game.name} (ID: ${game.id})
Rulebooks: ${rulebooksList}
Use search_rules tool with a rulebook ID to find specific rules.`;
      }

      // Multiple matches or low confidence - ask user to clarify
      const gamesList = results
        .map(
          (g) =>
            `"${g.name}"${g.yearPublished ? ` (${g.yearPublished})` : ""} [confidence: ${(g.similarity * 100).toFixed(0)}%]`,
        )
        .join(", ");

      return `Found ${results.length} possible matches. Please ask the user which game they mean:\n${gamesList}`;
    },
  });
}

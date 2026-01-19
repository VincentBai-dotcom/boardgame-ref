import { tool } from "@openai/agents";
import { z } from "zod";
import type { RuleChunkRepository, RuleChunk } from "../../../../repositories";
import type OpenAI from "openai";

/**
 * Create semantic search tool for the agent
 * @param ruleChunkRepository - RuleChunkRepository instance
 * @param openaiClient - OpenAI client for embeddings
 * @returns Tool definition for OpenAI Agents SDK
 */
export function createSemanticSearchRulesTool(
  ruleChunkRepository: RuleChunkRepository,
  openaiClient: OpenAI,
) {
  return tool({
    name: "semantic_search_rules",
    description:
      "Semantic search for rules in a board game rulebook using vector embeddings. Finds rules by meaning/context rather than exact keywords. Use this after identifying the game and rulebook to find relevant rule sections based on conceptual similarity to the question.",
    parameters: z.object({
      rulebookId: z
        .string()
        .describe(
          "The rulebook ID to search in (obtained from search_board_game tool)",
        ),
      question: z
        .string()
        .describe(
          "Any question about the rules (will be used for semantic search)",
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe(
          "Maximum number of relevant rule chunks to return (default: 5)",
        ),
    }),
    async execute({ rulebookId, question, limit = 5 }) {
      // Generate embedding for the question
      const embeddingResponse = await openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: question,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Adaptive threshold search: try multiple thresholds until results are found
      const thresholds = [0.7, 0.55, 0.4];
      let results: Array<RuleChunk & { similarity: number }> = [];

      for (const threshold of thresholds) {
        results = await ruleChunkRepository.searchBySimilarity(
          embedding,
          rulebookId,
          limit,
          threshold,
        );

        if (results.length > 0) {
          break;
        }
      }

      if (results.length === 0) {
        return "No relevant rules found for this question.";
      }

      // Format results
      const formattedResults = results
        .map(
          (chunk, idx) =>
            `[Chunk ${idx + 1}] (Relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n${chunk.chunkText}`,
        )
        .join("\n\n---\n\n");

      return `Found ${results.length} relevant rule sections:\n\n${formattedResults}`;
    },
  });
}

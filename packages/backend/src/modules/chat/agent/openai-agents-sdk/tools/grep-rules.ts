import { tool } from "@openai/agents";
import { z } from "zod";
import type { RulebookRepository } from "../../../../repositories/rulebook";

const formatGrepOutput = (
  lines: string[],
  matchedLines: Set<number>,
  contextLines: Set<number>,
) => {
  const output: string[] = [];
  let previousLine = 0;

  for (let i = 1; i <= lines.length; i += 1) {
    if (!contextLines.has(i)) continue;

    if (previousLine > 0 && i > previousLine + 1) {
      output.push("--");
    }

    const delimiter = matchedLines.has(i) ? ":" : "-";
    output.push(`${i}${delimiter}${lines[i - 1] ?? ""}`);
    previousLine = i;
  }

  return output.join("\n");
};

/**
 * Create grep rules tool for the agent
 * @param rulebookRepository - RulebookRepository instance
 * @returns Tool definition for OpenAI Agents SDK
 */
export function createGrepRulesTool(rulebookRepository: RulebookRepository) {
  return tool({
    name: "grep_rules",
    description:
      "Search a rulebook's full text using a regular expression and return grep-like output with line numbers and optional context.",
    parameters: z.object({
      rulebookId: z
        .string()
        .describe(
          "The rulebook ID to search in (obtained from search_board_game tool)",
        ),
      regex: z
        .string()
        .describe(
          "Regular expression pattern to search for (case-sensitive, no slashes)",
        ),
      context: z
        .number()
        .int()
        .min(0)
        .optional()
        .default(0)
        .describe("Number of context lines to include before/after matches"),
    }),
    async execute({ rulebookId, regex, context = 0 }) {
      const rulebook = await rulebookRepository.findById(rulebookId);

      if (!rulebook) {
        return `Rulebook not found for ID ${rulebookId}.`;
      }

      let pattern: RegExp;
      try {
        pattern = new RegExp(regex);
      } catch (error) {
        return `Invalid regex: ${(error as Error).message}`;
      }

      const lines = (rulebook.fullText || "").split(/\r?\n/);
      const matchedLines = new Set<number>();
      const contextLines = new Set<number>();

      for (let i = 0; i < lines.length; i += 1) {
        if (!pattern.test(lines[i] ?? "")) continue;

        const lineNumber = i + 1;
        matchedLines.add(lineNumber);

        const start = Math.max(1, lineNumber - context);
        const end = Math.min(lines.length, lineNumber + context);
        for (let line = start; line <= end; line += 1) {
          contextLines.add(line);
        }
      }

      if (matchedLines.size === 0) {
        return "No matches found.";
      }

      return formatGrepOutput(lines, matchedLines, contextLines);
    },
  });
}

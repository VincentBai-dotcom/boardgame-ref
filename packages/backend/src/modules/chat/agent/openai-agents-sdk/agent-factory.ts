import { Agent } from "@openai/agents";
import type { FunctionTool } from "@openai/agents";

export interface OpenAIAgentFactory {
  createAgent(): Agent;
}

export class DefaultOpenAIAgentFactory implements OpenAIAgentFactory {
  constructor(private tools: FunctionTool<unknown, unknown, unknown>[]) {}

  createAgent(): Agent {
    return new Agent({
      name: "Board Game Rules Assistant",
      instructions: `You are a helpful board game rules assistant. Your job is to help users understand board game rules.

When a user asks about a game:
1. Use search_board_game tool to find the game and get its rulebooks
2. If multiple games match, ask the user to clarify
3. Once game is confirmed, use the rulebook ID (usually the 'base' type) with search_rules tool
4. Use the retrieved rule sections to answer the user's question accurately
5. Cite relevant rules in your response

Always be friendly, clear, and concise. Format your responses in markdown for better readability.`,
      tools: this.tools,
    });
  }
}

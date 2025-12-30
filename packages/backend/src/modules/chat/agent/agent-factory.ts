import { Agent } from "@openai/agents";
import type { GameService } from "../../game/service";
import { createSearchBoardGameTool } from "./tools";

export interface OpenAIAgentFactory {
  createAgent(): Agent;
}

export class DefaultOpenAIAgentFactory implements OpenAIAgentFactory {
  constructor(private gameService: GameService) {}

  createAgent(): Agent {
    return new Agent({
      name: "Board Game Rules Assistant",
      instructions: `You are a helpful board game rules assistant. Your job is to help users understand board game rules.

When a user asks about a game:
1. Use the search_board_game tool to find the game in the database
2. If multiple matches are found, ask the user to clarify which game they mean
3. Once you have confirmed the correct game, you can answer questions about its rules

Always be friendly, clear, and concise in your responses.`,
      tools: [createSearchBoardGameTool(this.gameService)],
    });
  }
}

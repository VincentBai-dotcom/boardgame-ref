import { OpenAIAgentFactory } from "./agent-factory";
import { OpenAISessionProvider } from "./session-provider";

export type ChatTurn = {
  conversationId: string;
  userId: string;
  userText: string;
};

export abstract class AgentRuntime {
  abstract streamChatTurn(
    turn: ChatTurn,
  ): AsyncGenerator<string, void, unknown>;
}

export abstract class OpenAIAgentRuntime extends AgentRuntime {
  constructor(
    protected readonly sessionProvider: OpenAISessionProvider,
    protected readonly agentFactory: OpenAIAgentFactory,
  ) {
    super();
  }
}

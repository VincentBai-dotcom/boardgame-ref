import type { Logger } from "../../logger";
import type { ConfigService } from "../../config";
import type { ConversationRepository } from "../../repositories";
import type {
  OpenAIAgentFactory,
  OpenAIConversationsSessionProvider,
} from "../agent/openai-agents-sdk";
import { OpenAIAgentsChatService } from "./impl/openai-agents";
import type { ChatService } from "./base";

// Re-export types
export type {
  ChatService,
  StreamChatInput,
  RetrieveMessagesInput,
  Conversation,
} from "./base";

/**
 * Factory function to create the appropriate ChatService implementation
 * based on configuration.
 *
 * Currently supports:
 * - "openai-agents" (default): Uses OpenAI Agents SDK with built-in persistence
 *
 * Future implementations could include:
 * - "anthropic": Direct Anthropic API with custom persistence
 * - "openai-direct": Direct OpenAI API with custom persistence
 */
export function createChatService(
  configService: ConfigService,
  sessionProvider: OpenAIConversationsSessionProvider,
  agentFactory: OpenAIAgentFactory,
  conversationRepository: ConversationRepository,
  logger: Logger,
): ChatService {
  // For now, we only have the OpenAI Agents implementation
  // In the future, this could read from configService to select provider
  const provider = "openai-agents";

  switch (provider) {
    case "openai-agents":
      return new OpenAIAgentsChatService(
        logger,
        sessionProvider,
        agentFactory,
        conversationRepository,
      );
    default: {
      const allowed = ["openai-agents"];
      throw new Error(
        `Unknown chat provider "${provider}". Allowed: ${allowed.join(", ")}`,
      );
    }
  }
}

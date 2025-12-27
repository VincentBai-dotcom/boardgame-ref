import { Elysia } from "elysia";
import { ChatService } from "./service";
import { conversationService } from "../conversation";
import {
  OpenAIConversationsSessionProvider,
  DefaultOpenAIAgentFactory,
} from "./agent";
import { authGuard } from "../guard";

// Create singleton instances
const sessionProvider = new OpenAIConversationsSessionProvider();
const agentFactory = new DefaultOpenAIAgentFactory();
const chatService = new ChatService(
  sessionProvider,
  agentFactory,
  conversationService,
);

export const chat = new Elysia({ name: "chat", prefix: "/chat" }).use(
  authGuard,
);
// TODO: Add chat endpoints for createAndStreamChat and continueAndStreamChat

// Export singleton instance
export { chatService, ChatService };

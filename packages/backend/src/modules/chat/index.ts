import { Elysia, sse } from "elysia";
import { ChatService } from "./service";
import { conversationService } from "../conversation";
import {
  OpenAIConversationsSessionProvider,
  DefaultOpenAIAgentFactory,
} from "./agent";
import { ChatModel } from "./model";
import { authGuard } from "../guard";

// Create singleton instances
const sessionProvider = new OpenAIConversationsSessionProvider();
const agentFactory = new DefaultOpenAIAgentFactory();
const chatService = new ChatService(
  sessionProvider,
  agentFactory,
  conversationService,
);

export const chat = new Elysia({ name: "chat", prefix: "/chat" })
  .use(authGuard)
  .post(
    "/new",
    async function* ({ body, userId }) {
      try {
        const result = await chatService.createAndStreamChat({
          userId,
          userText: body.userText,
        });

        // Send conversation ID first
        yield sse({
          data: {
            type: "conversation_id",
            conversationId: result.conversationId,
          },
        });

        // Stream OpenAI events
        for await (const event of result.events) {
          yield sse({ data: event });
        }

        // Send completion signal
        yield sse({ data: { type: "done" } });
      } catch (error) {
        yield sse({ data: { type: "error", error: (error as Error).message } });
      }
    },
    {
      body: ChatModel.createChat,
    },
  )
  .post(
    "/continue/:id",
    async function* ({ body, params: { id } }) {
      try {
        const result = await chatService.continueAndStreamChat({
          conversationId: id,
          userText: body.userText,
        });

        // Send conversation ID confirmation
        yield sse({
          data: {
            type: "conversation_id",
            conversationId: result.conversationId,
          },
        });

        // Stream OpenAI events
        for await (const event of result.events) {
          yield sse({ data: event });
        }

        // Send completion signal
        yield sse({ data: { type: "done" } });
      } catch (error) {
        yield sse({ data: { type: "error", error: (error as Error).message } });
      }
    },
    {
      body: ChatModel.createChat,
    },
  );

// Export singleton instance
export { chatService, ChatService };

import { Elysia, sse, t } from "elysia";
import { ChatService } from "./service";
import { conversationService } from "../conversation";
import {
  OpenAIConversationsSessionProvider,
  DefaultOpenAIAgentFactory,
} from "./agent";
import { ChatModel, ChatResponse, UnifiedStreamEvent } from "./model";
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
    async function* ({ body, userId }): AsyncGenerator<UnifiedStreamEvent> {
      try {
        const stream = chatService.streamChat({
          userId,
          userText: body.userText,
        });

        for await (const event of stream) {
          yield sse(event);
        }
      } catch (error) {
        yield sse({
          event: "error",
          data: { error: (error as Error).message },
        });
      }
    },
    {
      body: ChatModel.createChat,
      response: {
        200: t.AsyncIterator(ChatResponse.streamEvent),
      },
    },
  )
  .post(
    "/continue/:id",
    async function* ({
      body,
      params: { id },
      userId,
    }): AsyncGenerator<UnifiedStreamEvent> {
      try {
        const stream = chatService.streamChat({
          userId,
          userText: body.userText,
          conversationId: id,
        });

        for await (const event of stream) {
          yield sse(event);
        }
      } catch (error) {
        yield sse({
          event: "error",
          data: { error: (error as Error).message },
        });
      }
    },
    {
      body: ChatModel.createChat,
      params: ChatModel.conversationParams,
      response: {
        200: t.AsyncIterator(ChatResponse.streamEvent),
      },
    },
  )
  .get(
    "/messages/:id",
    async ({ params: { id }, userId, status }) => {
      const result = await chatService.retrieveMessages({
        userId,
        conversationId: id,
      });

      return status(200, result);
    },
    {
      params: ChatModel.conversationParams,
      response: { 200: ChatResponse.messages },
    },
  );

// Export singleton instance
export { chatService, ChatService };

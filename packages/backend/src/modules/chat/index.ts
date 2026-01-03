import { Elysia, sse, t } from "elysia";
import OpenAI from "openai";
import { ChatService } from "./service";
import { conversationService } from "../conversation";
import { gameService } from "../game";
import {
  OpenAIConversationsSessionProvider,
  DefaultOpenAIAgentFactory,
} from "./agent";
import {
  createSearchBoardGameTool,
  createSearchRulesTool,
} from "./agent/tools";
import { ChatModel, ChatResponse, UnifiedStreamEvent } from "./model";
import { authGuard } from "../guard";
import { Logger } from "../logger";

// Create singleton instances
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sessionProvider = new OpenAIConversationsSessionProvider();

// Create singleton tools
const searchBoardGameTool = createSearchBoardGameTool(gameService);
const searchRulesTool = createSearchRulesTool(gameService, openaiClient);

// Create agent factory with tools
const agentFactory = new DefaultOpenAIAgentFactory([
  searchBoardGameTool,
  searchRulesTool,
]);

const chatService = new ChatService(
  sessionProvider,
  agentFactory,
  conversationService,
  new Logger("ChatService"),
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

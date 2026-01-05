import { Elysia, sse, t } from "elysia";
import OpenAI from "openai";
import { ChatService } from "./service";
import {
  conversationRepository,
  gameRepository,
  rulebookRepository,
  ruleChunkRepository,
} from "../repositories";
import {
  OpenAIConversationsSessionProvider,
  DefaultOpenAIAgentFactory,
} from "./agent";
import {
  createGrepRulesTool,
  createSearchBoardGameTool,
  createSemanticSearchRulesTool,
} from "./agent/tools";
import { ChatModel, ChatResponse, UnifiedStreamEvent } from "./model";
import { authGuard } from "../../plugins/guard";
import { Logger } from "../logger";
import { httpLogger } from "../../plugins/http-logger";

// Create singleton instances
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sessionProvider = new OpenAIConversationsSessionProvider();

// Create singleton tools
const searchBoardGameTool = createSearchBoardGameTool(
  gameRepository,
  rulebookRepository,
);
const semanticSearchRulesTool = createSemanticSearchRulesTool(
  ruleChunkRepository,
  openaiClient,
);
const grepRulesTool = createGrepRulesTool(rulebookRepository);

// Create agent factory with tools
const agentFactory = new DefaultOpenAIAgentFactory([
  searchBoardGameTool,
  grepRulesTool,
  semanticSearchRulesTool,
]);

const chatService = new ChatService(
  sessionProvider,
  agentFactory,
  conversationRepository,
  new Logger("ChatService"),
);

export const chat = new Elysia({ name: "chat", prefix: "/chat" })
  .use(authGuard)
  .use(httpLogger)
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
  )
  .get(
    "/conversations",
    async ({ userId, status }) => {
      try {
        const conversations = await conversationRepository.list({
          userId,
          limit: 100,
        });
        return status(200, conversations);
      } catch (error) {
        return status(500, { error: (error as Error).message });
      }
    },
    {
      response: {
        200: ChatResponse.conversations,
        500: ChatResponse.error,
      },
    },
  )
  .get(
    "/conversations/:id",
    async ({ userId, params: { id }, status }) => {
      const conversation = await conversationRepository.findByIdForUser(
        id,
        userId,
      );

      if (!conversation) {
        return status(404, { error: "Conversation not found" });
      }

      return conversation;
    },
    {
      params: ChatModel.conversationParams,
      response: {
        200: ChatResponse.conversation,
        404: ChatResponse.error,
      },
    },
  )
  .patch(
    "/conversations/:id",
    async ({ userId, params: { id }, body, status }) => {
      // Verify ownership
      const conversation = await conversationRepository.findByIdForUser(
        id,
        userId,
      );

      if (!conversation) {
        return status(404, { error: "Conversation not found" });
      }

      const updated = await conversationRepository.updateTitle(id, body.title);

      if (!updated) {
        return status(500, { error: "Failed to update conversation" });
      }

      return updated;
    },
    {
      body: ChatModel.updateConversation,
      params: ChatModel.conversationParams,
      response: {
        200: ChatResponse.conversation,
        404: ChatResponse.error,
        500: ChatResponse.error,
      },
    },
  )
  .delete("/conversations/:id", async ({ userId, params: { id }, status }) => {
    const deleted = await conversationRepository.deleteForUser(id, userId);

    if (!deleted) {
      return status(404, { error: "Conversation not found" });
    }

    return status(204);
  });

// Export singleton instance
export { chatService, ChatService };

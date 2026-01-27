import { Elysia, sse, t } from "elysia";
import OpenAI from "openai";
import { ChatService } from "./service";
import { configService } from "../config";
import {
  gameRepository,
  rulebookRepository,
  ruleChunkRepository,
  conversationRepository,
} from "../repositories";
import {
  OpenAIConversationsSessionProvider,
  DefaultOpenAIAgentFactory,
  OpenAIAgentsAgent,
} from "./agent/openai-agents-sdk";
import {
  createGrepRulesTool,
  createSearchBoardGameTool,
  createSemanticSearchRulesTool,
} from "./agent/openai-agents-sdk/tools";
import { ChatModel, ChatResponse, UIStreamEvent } from "./model";
import { authGuard } from "../../plugins/guard";
import { ChatError } from "./errors";
import { httpLogger } from "../../plugins/http-logger";
import { Logger } from "../logger";

// Create singleton instances
const openaiClient = new OpenAI({
  apiKey: configService.get().openai.apiKey,
});

const sessionProvider = new OpenAIConversationsSessionProvider(
  conversationRepository,
);

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

const openAIAgent = new OpenAIAgentsAgent(
  new Logger("ChatService", configService),
  sessionProvider,
  agentFactory.createAgent(),
  conversationRepository,
  openaiClient,
);

// Create chat service
const chatService = new ChatService(openAIAgent, conversationRepository);

export const chat = new Elysia({ name: "chat", prefix: "/chat" })
  .use(authGuard)
  .use(httpLogger)
  .post(
    "/new",
    async function* ({ body, userId }): AsyncGenerator<UIStreamEvent> {
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
    }): AsyncGenerator<UIStreamEvent> {
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
        const conversations = await chatService.listConversations(userId);
        return status(200, conversations);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw ChatError.listFailed(message);
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
    async ({ userId, params: { id } }) => {
      const conversation = await chatService.getConversation(id, userId);

      if (!conversation) {
        throw ChatError.conversationNotFound(id);
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
  .delete(
    "/conversations/:id",
    async ({ userId, params: { id }, status }) => {
      const deleted = await chatService.deleteConversation(id, userId);

      if (!deleted) {
        throw ChatError.conversationNotFound(id);
      }

      return status(204, undefined);
    },
    {
      response: { 204: t.Void(), 404: ChatResponse.error },
      params: ChatModel.conversationParams,
    },
  );

// Export singleton instance and types
export { chatService };

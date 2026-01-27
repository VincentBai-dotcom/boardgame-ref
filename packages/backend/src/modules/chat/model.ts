import { t } from "elysia";
import { ApiErrorResponseSchema } from "../errors";

export const ChatModel = {
  createChat: t.Object({
    userText: t.String({ minLength: 1 }),
  }),

  continueChat: t.Object({
    conversationId: t.String({ format: "uuid" }),
    userText: t.String({ minLength: 1 }),
  }),

  conversationParams: t.Object({
    id: t.String({ format: "uuid" }),
  }),

  updateConversation: t.Object({
    title: t.String({ minLength: 1 }),
  }),
};

export const ChatResponse = {
  conversationId: t.Object({
    conversationId: t.String(),
  }),

  error: ApiErrorResponseSchema,

  conversation: t.Object({
    id: t.String(),
    userId: t.String(),
    provider: t.String(),
    title: t.String(),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  }),

  conversations: t.Array(
    t.Object({
      id: t.String(),
      userId: t.String(),
      provider: t.String(),
      title: t.String(),
      createdAt: t.Date(),
      updatedAt: t.Date(),
    }),
  ),

  messages: t.Object({
    messages: t.Array(
      t.Object({
        role: t.Union([
          t.Literal("user"),
          t.Literal("assistant"),
          t.Literal("system"),
        ]),
        content: t.Array(
          t.Union([
            t.Object({
              type: t.Literal("text"),
              text: t.String(),
            }),
            t.Object({
              type: t.Literal("image"),
              imageUrl: t.String(),
              alt: t.Optional(t.String()),
            }),
            t.Object({
              type: t.Literal("tool_call"),
              toolCallId: t.String(),
              toolName: t.String(),
              arguments: t.Record(t.String(), t.Any()),
            }),
            t.Object({
              type: t.Literal("tool_result"),
              toolCallId: t.String(),
              toolName: t.String(),
              result: t.Any(),
            }),
          ]),
        ),
        metadata: t.Optional(
          t.Object({
            provider: t.Optional(t.String()),
          }),
        ),
      }),
    ),
    hasMore: t.Boolean(),
  }),

  // SSE stream event schemas
  // streamEvent: t.Union([
  //   t.Object({
  //     type: t.Literal("conversation_id"),
  //     conversationId: t.String(),
  //   }),
  //   t.Object({
  //     type: t.Literal("text_delta"),
  //     text: t.String(),
  //   }),
  //   t.Object({
  //     type: t.Literal("tool_call"),
  //     toolName: t.String(),
  //   }),
  //   t.Object({
  //     type: t.Literal("tool_result"),
  //     toolName: t.String(),
  //     result: t.Unknown(),
  //   }),
  //   t.Object({
  //     type: t.Literal("done"),
  //   }),
  //   t.Object({
  //     type: t.Literal("error"),
  //     error: t.String(),
  //   }),
  // ]),

  streamEvent: t.Union([
    t.Object({
      event: t.Literal("conversation_id"),
      data: t.Object({
        conversationId: t.String(),
      }),
    }),
    t.Object({
      event: t.Literal("text_delta"),
      data: t.Object({
        text: t.String(),
      }),
    }),
    t.Object({
      event: t.Literal("tool_call"),
      data: t.Object({
        toolName: t.String(),
        arguments: t.Optional(t.Record(t.String(), t.Any())),
      }),
    }),
    t.Object({
      event: t.Literal("tool_result"),
      data: t.Object({
        toolName: t.String(),
        result: t.Unknown(),
      }),
    }),
    t.Object({
      event: t.Literal("done"),
    }),
    t.Object({
      event: t.Literal("error"),
      data: t.Object({
        error: t.String(),
      }),
    }),
  ]),
};

// Derive TypeScript types from TypeBox schemas
export type UIMessageList = (typeof ChatResponse.messages)["static"];
export type UIMessage = UIMessageList["messages"][number];
export type MessageContent = UIMessage["content"][number];

// UI stream event types - agnostic to agent SDK
export type UIStreamEvent = (typeof ChatResponse.streamEvent)["static"];

// Conversation types
export type Conversations = (typeof ChatResponse.conversations)["static"];

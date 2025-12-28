import { t } from "elysia";

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
};

export const ChatResponse = {
  conversationId: t.Object({
    conversationId: t.String(),
  }),

  error: t.Object({
    error: t.String(),
  }),

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
};

// Derive TypeScript types from TypeBox schemas
export type UnifiedMessageList = (typeof ChatResponse.messages)["static"];
export type UnifiedMessage = UnifiedMessageList["messages"][number];
export type MessageContent = UnifiedMessage["content"][number];

// Unified stream event types - agnostic to agent SDK
export type UnifiedStreamEvent =
  | { type: "conversation_id"; conversationId: string }
  | { type: "text_delta"; text: string }
  | {
      type: "tool_call";
      toolName: string;
    }
  | {
      type: "tool_result";
      toolName: string;
      result: unknown;
    }
  | { type: "done" }
  | { type: "error"; error: string };

import { t } from "elysia";

export const ChatModel = {
  createChat: t.Object({
    userText: t.String({ minLength: 1 }),
  }),

  continueChat: t.Object({
    conversationId: t.String({ format: "uuid" }),
    userText: t.String({ minLength: 1 }),
  }),
};

export const ChatResponse = {
  conversationId: t.Object({
    conversationId: t.String(),
  }),

  error: t.Object({
    error: t.String(),
  }),
};

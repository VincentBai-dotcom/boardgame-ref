import { t } from "elysia";

export const ConversationModel = {
  updateConversation: t.Object({
    title: t.String({ minLength: 1 }),
  }),
};

export const ConversationResponse = {
  conversation: t.Object({
    id: t.String(),
    userId: t.String(),
    openaiConversationId: t.String(),
    title: t.String(),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  }),

  conversations: t.Array(
    t.Object({
      id: t.String(),
      userId: t.String(),
      openaiConversationId: t.String(),
      title: t.String(),
      createdAt: t.Date(),
      updatedAt: t.Date(),
    }),
  ),

  error: t.Object({
    error: t.String(),
  }),
};

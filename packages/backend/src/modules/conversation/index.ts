import { Elysia } from "elysia";
import { ConversationModel, ConversationResponse } from "./model";
import { conversationRepository } from "../repositories";
import { authGuard } from "../guard";

export const conversation = new Elysia({
  name: "conversation",
  prefix: "/conversations",
})
  .use(authGuard)
  .get(
    "/",
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
        200: ConversationResponse.conversations,
        500: ConversationResponse.error,
      },
    },
  )
  .get(
    "/:id",
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
      response: {
        200: ConversationResponse.conversation,
        404: ConversationResponse.error,
      },
    },
  )
  .patch(
    "/:id",
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
      body: ConversationModel.updateConversation,
      response: {
        200: ConversationResponse.conversation,
        404: ConversationResponse.error,
        500: ConversationResponse.error,
      },
    },
  )
  .delete("/:id", async ({ userId, params: { id }, status }) => {
    const deleted = await conversationRepository.deleteForUser(id, userId);

    if (!deleted) {
      return status(404, { error: "Conversation not found" });
    }

    return status(204);
  });

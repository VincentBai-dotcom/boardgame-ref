import { Elysia } from "elysia";
import { ConversationService } from "./service";
import { ConversationModel, ConversationResponse } from "./model";
import { dbService } from "../db";
import { authGuard } from "../guard";

// Create singleton instance
const conversationService = new ConversationService(dbService);

export const conversation = new Elysia({
  name: "conversation",
  prefix: "/conversations",
})
  .use(authGuard)
  .get(
    "/",
    async ({ userId }) => {
      const conversations = await conversationService.listConversations({
        userId,
        limit: 100,
      });
      return conversations;
    },
    {
      response: {
        200: ConversationResponse.conversations,
      },
    },
  )
  .get(
    "/:id",
    async ({ userId, params: { id }, status }) => {
      const conversation =
        await conversationService.findConversationByIdForUser(id, userId);

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
      const conversation =
        await conversationService.findConversationByIdForUser(id, userId);

      if (!conversation) {
        return status(404, { error: "Conversation not found" });
      }

      const updated = await conversationService.updateConversationTitle(
        id,
        body.title,
      );

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
    const deleted = await conversationService.deleteConversationForUser(
      id,
      userId,
    );

    if (!deleted) {
      return status(404, { error: "Conversation not found" });
    }

    return status(204);
  });

// Export singleton instance and class
export { conversationService, ConversationService };

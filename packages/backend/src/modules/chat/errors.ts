import { ApiError } from "../errors";

export const ChatErrorCodes = {
  ListFailed: "CHAT_LIST_FAILED",
  ConversationNotFound: "CHAT_CONVERSATION_NOT_FOUND",
} as const;

export class ChatError extends ApiError {
  static listFailed(reason?: string) {
    return new ChatError(
      500,
      ChatErrorCodes.ListFailed,
      "Failed to list conversations.",
      reason ? { reason } : undefined,
    );
  }

  static conversationNotFound(conversationId: string) {
    return new ChatError(
      404,
      ChatErrorCodes.ConversationNotFound,
      "Conversation not found.",
      { conversationId },
    );
  }
}

import type {
  UnifiedMessageList,
  UnifiedStreamEvent,
  Conversations,
} from "../model";

/**
 * Input for streaming chat
 */
export type StreamChatInput = {
  userId: string;
  userText: string;
  conversationId?: string;
};

/**
 * Input for retrieving messages
 */
export type RetrieveMessagesInput = {
  userId: string;
  conversationId: string;
  limit?: number;
};

/**
 * Conversation type for service layer
 */
export type Conversation = Conversations[number];

/**
 * ChatService interface
 *
 * Defines the contract for chat service implementations.
 * Implementations handle both LLM interaction AND persistence,
 * since different providers have fundamentally different persistence models.
 *
 * - OpenAI Agents SDK: SDK owns persistence via session provider
 * - Direct LLM: Application owns persistence via repositories
 */
export interface ChatService {
  /**
   * Stream chat - creates new or continues existing conversation
   * Implementation handles its own persistence model
   */
  streamChat(input: StreamChatInput): AsyncGenerator<UnifiedStreamEvent>;

  /**
   * Retrieve messages from a conversation
   * Implementation knows where to fetch messages from
   */
  retrieveMessages(input: RetrieveMessagesInput): Promise<UnifiedMessageList>;

  /**
   * List conversations for a user
   */
  listConversations(userId: string, limit?: number): Promise<Conversation[]>;

  /**
   * Get a single conversation by ID (with ownership check)
   */
  getConversation(id: string, userId: string): Promise<Conversation | null>;

  /**
   * Update conversation title
   */
  updateConversationTitle(
    id: string,
    userId: string,
    title: string,
  ): Promise<Conversation | null>;

  /**
   * Delete a conversation
   */
  deleteConversation(id: string, userId: string): Promise<boolean>;
}

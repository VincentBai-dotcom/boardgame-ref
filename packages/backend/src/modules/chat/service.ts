import type { Agent, StreamChatInput } from "./agent/base";
import type { ConversationRepository } from "../repositories";
import type { Conversations, UIMessageList, UIStreamEvent } from "./model";
import { convertAgentInputItemToUIMessageList } from "./utils/message-converter";

/**
 * ChatService - handles LLM interaction and persistence.
 */
export class ChatService {
  constructor(
    private readonly agent: Agent,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  /**
   * Stream chat - creates new or continues existing conversation
   */
  async *streamChat(input: StreamChatInput): AsyncGenerator<UIStreamEvent> {
    yield* this.agent.streamChat(input);
  }

  async retrieveMessages(input: RetrieveMessagesInput): Promise<UIMessageList> {
    const { userId, conversationId, limit } = input;

    const conversation = await this.conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const messages = await this.conversationRepository.getMessages(
      conversation.id,
      { limit },
    );

    const items = messages.map((message) => message.content);
    return convertAgentInputItemToUIMessageList(items);
  }

  async listConversations(
    userId: string,
    limit: number = 100,
  ): Promise<Conversation[]> {
    return this.conversationRepository.list({ userId, limit });
  }

  /**
   * Get a single conversation by ID (with ownership check)
   */
  async getConversation(
    id: string,
    userId: string,
  ): Promise<Conversation | null> {
    return this.conversationRepository.findByIdForUser(id, userId);
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string, userId: string): Promise<boolean> {
    return this.conversationRepository.deleteForUser(id, userId);
  }
}

/**
 * Conversation type for service layer
 */
export type Conversation = Conversations[number];

/**
 * Input for retrieving messages
 */
export type RetrieveMessagesInput = {
  userId: string;
  conversationId: string;
  limit?: number;
};

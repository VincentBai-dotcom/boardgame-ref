import { eq, and, desc, asc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { conversation, message } from "../../schema";
import type { DbService } from "../db/service";

export type Conversation = InferSelectModel<typeof conversation>;
export type NewConversation = InferInsertModel<typeof conversation>;

export type Message = InferSelectModel<typeof message>;
export type NewMessage = InferInsertModel<typeof message>;

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  userId?: string;
}

export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
}

/**
 * Conversation repository - handles all database operations for conversations and messages
 */
export class ConversationRepository {
  constructor(private dbService: DbService) {}

  // ============ Conversation Operations ============

  /**
   * Create a new conversation
   * @param conversationData - Conversation data to insert
   * @returns Created conversation record
   */
  async create(conversationData: NewConversation): Promise<Conversation> {
    const db = this.dbService.getDb();
    const [created] = await db
      .insert(conversation)
      .values(conversationData)
      .returning();
    return created;
  }

  /**
   * Find conversation by ID
   * @param conversationId - Conversation ID
   * @returns Conversation record or null if not found
   */
  async findById(conversationId: string): Promise<Conversation | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find conversation by ID and verify ownership
   * @param id - Conversation ID
   * @param userId - User ID to verify ownership
   * @returns Conversation record or null if not found or not owned by user
   */
  async findByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.userId, userId),
        ),
      )
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * List conversations with pagination and filtering
   * @param options - Query options (pagination, userId filter)
   * @returns Array of conversation records ordered by most recent first
   */
  async list(options: ListConversationsOptions = {}): Promise<Conversation[]> {
    const db = this.dbService.getDb();
    const { limit = 100, offset = 0, userId } = options;

    let query = db.select().from(conversation).$dynamic();

    if (userId) {
      query = query.where(eq(conversation.userId, userId));
    }

    query = query.orderBy(desc(conversation.updatedAt));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Update conversation by ID
   * @param conversationId - Conversation ID
   * @param updates - Partial conversation data to update
   * @returns Updated conversation record or null if not found
   */
  async update(
    conversationId: string,
    updates: Partial<Omit<NewConversation, "userId" | "provider">>,
  ): Promise<Conversation | null> {
    const db = this.dbService.getDb();
    const [updated] = await db
      .update(conversation)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversation.id, conversationId))
      .returning();

    return updated ?? null;
  }

  /**
   * Update conversation title
   * @param conversationId - Conversation ID
   * @param title - New title
   * @returns Updated conversation record or null if not found
   */
  async updateTitle(
    conversationId: string,
    title: string,
  ): Promise<Conversation | null> {
    return this.update(conversationId, { title });
  }

  /**
   * Delete conversation by ID
   * @param conversationId - Conversation ID
   */
  async delete(conversationId: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(conversation).where(eq(conversation.id, conversationId));
  }

  /**
   * Delete conversation by ID with user ownership verification
   * @param conversationId - Conversation ID
   * @param userId - User ID to verify ownership
   * @returns true if deleted, false if not found or not owned by user
   */
  async deleteForUser(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const db = this.dbService.getDb();
    const result = await db
      .delete(conversation)
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.userId, userId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  // ============ Message Operations ============

  /**
   * Create a new message
   * @param messageData - Message data to insert
   * @returns Created message record
   */
  async createMessage(messageData: NewMessage): Promise<Message> {
    const db = this.dbService.getDb();
    const [created] = await db.insert(message).values(messageData).returning();
    return created;
  }

  /**
   * Create multiple messages (bulk insert)
   * @param messages - Array of message data to insert
   * @returns Array of created message records
   */
  async createMessages(messages: NewMessage[]): Promise<Message[]> {
    if (messages.length === 0) {
      return [];
    }
    const db = this.dbService.getDb();
    return await db.insert(message).values(messages).returning();
  }

  /**
   * Get messages for a conversation ordered by creation time (oldest first)
   * @param conversationId - Conversation ID
   * @param options - Pagination options
   * @returns Array of message records
   */
  async getMessages(
    conversationId: string,
    options: GetMessagesOptions = {},
  ): Promise<Message[]> {
    const db = this.dbService.getDb();
    const { limit, offset = 0 } = options;

    let query = db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(asc(message.createdAt))
      .$dynamic();

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Count messages in a conversation
   * @param conversationId - Conversation ID
   * @returns Number of messages
   */
  async countMessages(conversationId: string): Promise<number> {
    const db = this.dbService.getDb();
    const result = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId));
    return result.length;
  }

  /**
   * Get the most recent message in a conversation
   * @param conversationId - Conversation ID
   * @returns Most recent message or null if none
   */
  async getLatestMessage(conversationId: string): Promise<Message | null> {
    const db = this.dbService.getDb();
    const [latest] = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(desc(message.createdAt))
      .limit(1);
    return latest ?? null;
  }

  /**
   * Remove and return the most recent message in a conversation
   * @param conversationId - Conversation ID
   * @returns Removed message or null if none
   */
  async popLatestMessage(conversationId: string): Promise<Message | null> {
    const db = this.dbService.getDb();
    const latest = await this.getLatestMessage(conversationId);
    if (!latest) {
      return null;
    }
    await db.delete(message).where(eq(message.id, latest.id));
    return latest;
  }

  /**
   * Delete all messages for a conversation
   * @param conversationId - Conversation ID
   */
  async deleteMessagesByConversationId(conversationId: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(message).where(eq(message.conversationId, conversationId));
  }
}

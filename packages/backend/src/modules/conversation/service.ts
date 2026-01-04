import { eq, and, desc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { conversation } from "../db/schema";
import type { DbService } from "../db/service";

// Type definitions
type Conversation = InferSelectModel<typeof conversation>;
type NewConversation = InferInsertModel<typeof conversation>;

interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  userId?: string;
}

/**
 * Conversation service - provides CRUD operations for conversation management
 *
 * This service handles:
 * - Conversation CRUD operations (create, find, list, update, delete)
 * - Integration with OpenAI Conversations API via openaiConversationId
 */
export class ConversationService {
  constructor(private dbService: DbService) {}

  /**
   * Create a new conversation
   * @param conversationData - Conversation data to insert
   * @returns Created conversation record
   */
  async createConversation(
    conversationData: NewConversation,
  ): Promise<Conversation> {
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
  async findConversationById(
    conversationId: string,
  ): Promise<Conversation | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find conversation by OpenAI conversation ID
   * @param openaiConversationId - OpenAI conversation ID
   * @returns Conversation record or null if not found
   */
  async findConversationByOpenAIId(
    openaiConversationId: string,
  ): Promise<Conversation | null> {
    const db = this.dbService.getDb();
    const found = await db
      .select()
      .from(conversation)
      .where(eq(conversation.openaiConversationId, openaiConversationId))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find conversation by ID and verify ownership
   * @param id - Conversation ID
   * @param userId - User ID to verify ownership
   * @returns Conversation record or null if not found or not owned by user
   */
  async findConversationByIdForUser(
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
  async listConversations(
    options: ListConversationsOptions = {},
  ): Promise<Conversation[]> {
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
  async updateConversation(
    conversationId: string,
    updates: Partial<Omit<NewConversation, "userId" | "openaiConversationId">>,
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
  async updateConversationTitle(
    conversationId: string,
    title: string,
  ): Promise<Conversation | null> {
    return this.updateConversation(conversationId, { title });
  }

  /**
   * Delete conversation by ID
   * @param conversationId - Conversation ID
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(conversation).where(eq(conversation.id, conversationId));
  }

  /**
   * Delete conversation by ID with user ownership verification
   * @param conversationId - Conversation ID
   * @param userId - User ID to verify ownership
   * @returns true if deleted, false if not found or not owned by user
   */
  async deleteConversationForUser(
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
}

// Export types for external use
export type { Conversation, NewConversation, ListConversationsOptions };

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./user";

// LLM provider enum
export const chatProviderEnum = pgEnum("chat_provider", [
  "openai-agents-sdk",
  "anthropic",
]);

// Conversation table: stores conversation metadata
// Messages are stored in the message table
export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // LLM provider for this conversation
    // All messages in a conversation use the same provider
    provider: chatProviderEnum("provider").notNull(),

    // Conversation metadata
    title: text("title").notNull().default("New conversation"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_conversation_user_id").on(table.userId),
    index("idx_conversation_created_at").on(table.createdAt),
  ],
);

// Message table: stores individual messages in provider-specific format
// Content is jsonb containing role, text, tool calls, etc.
// Format varies by conversation.provider - conversion to unified format happens at read time
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),

    // Provider-specific message content (role, text, tool calls, etc.)
    content: jsonb("content").notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_message_conversation_id").on(table.conversationId)],
);

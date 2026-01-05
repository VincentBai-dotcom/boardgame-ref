import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./user";

// Conversation table: stores metadata for OpenAI conversations
// Actual message history is stored by OpenAI's Conversations API
export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // OpenAI conversation ID - used to retrieve conversation history from OpenAI
    openaiConversationId: text("openai_conversation_id").notNull().unique(),

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
    index("idx_conversation_openai_id").on(table.openaiConversationId),
    index("idx_conversation_created_at").on(table.createdAt),
  ],
);

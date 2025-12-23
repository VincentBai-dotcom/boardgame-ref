import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
  index,
  check,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Rulebook type enum values
export const rulebookTypes = [
  "base",
  "expansion",
  "quickstart",
  "reference",
  "faq",
  "other",
] as const;

// Game table: master list of supported board games
export const game = pgTable(
  "game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    yearPublished: integer("year_published"),
    bggId: integer("bgg_id").notNull().unique(), // BoardGameGeek ID for reference
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    check(
      "year_published_check",
      sql`${table.yearPublished} IS NULL OR (${table.yearPublished} >= 1900 AND ${table.yearPublished} <= 2100)`,
    ),
    index("idx_game_name").on(table.name),
    index("idx_game_bgg_id").on(table.bggId),
  ],
);

// Rulebook table: specific rulebook documents for each game
export const rulebook = pgTable(
  "rulebook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),

    // Identification
    title: text("title").notNull(),
    rulebookType: text("rulebook_type").notNull().default("base"), // enum
    language: text("language").notNull().default("en"),

    // Content
    fullText: text("full_text").notNull(), // for MVP

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique().on(table.gameId, table.title, table.language),
    check(
      "rulebook_type_check",
      sql`${table.rulebookType} IN ('base', 'expansion', 'quickstart', 'reference', 'faq', 'other')`,
    ),
    index("idx_rulebook_game_id").on(table.gameId),
    index("idx_rulebook_language").on(table.language),
    index("idx_rulebook_type").on(table.rulebookType),
  ],
);

// RuleChunk table: stores chunked rulebook text with embeddings for RAG
export const ruleChunk = pgTable(
  "rule_chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rulebookId: uuid("rulebook_id")
      .notNull()
      .references(() => rulebook.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),

    // Content
    chunkText: text("chunk_text").notNull(),
    // OpenAI's text-embedding-3-small uses 1536 dimensions
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),

    // Ordering
    chunkIndex: integer("chunk_index").notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_rule_chunk_rulebook_id").on(table.rulebookId),
    index("idx_rule_chunk_game_id").on(table.gameId),
    index("idx_rule_chunk_index").on(table.rulebookId, table.chunkIndex),
    // HNSW index for fast cosine similarity search
    index("idx_rule_chunk_embedding_cosine")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
  ],
);

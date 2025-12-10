import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
  index,
  check,
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
    name: text("name").notNull().unique(),
    publisher: text("publisher"),
    yearPublished: integer("year_published"),
    bggId: integer("bgg_id").unique(), // BoardGameGeek ID for reference
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_game_name").on(table.name),
    index("idx_game_bgg_id")
      .on(table.bggId)
      .where(sql`${table.bggId} IS NOT NULL`),
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
    rulebookType: text("rulebook_type").notNull(),
    edition: text("edition"),
    version: text("version"),
    language: text("language").notNull().default("en"),

    // Content
    fullText: text("full_text").notNull(), // for MVP

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique().on(table.gameId, table.title, table.edition, table.language),
    check(
      "rulebook_type_check",
      sql`${table.rulebookType} IN ('base', 'expansion', 'quickstart', 'reference', 'faq', 'other')`,
    ),
    index("idx_rulebook_game_id").on(table.gameId),
    index("idx_rulebook_language").on(table.language),
    index("idx_rulebook_type").on(table.rulebookType),
  ],
);

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "apple"]);

export const oauthAccount = pgTable(
  "oauth_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique().on(table.provider, table.providerUserId),
    unique().on(table.userId, table.provider),
    index("idx_oauth_account_user_id").on(table.userId),
    index("idx_oauth_account_provider").on(
      table.provider,
      table.providerUserId,
    ),
  ],
);

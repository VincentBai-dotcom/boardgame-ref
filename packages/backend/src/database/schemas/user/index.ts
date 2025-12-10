import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// User role enum
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

// User table
export const user = pgTable(
  "user",
  {
    // Primary identifier
    id: uuid("id").primaryKey().defaultRandom(),

    // Core authentication
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").default(false),
    passwordHash: text("password_hash"), // NULL for OAuth-only users

    // Role
    role: userRoleEnum("role").notNull().default("user"),

    // OAuth provider info (NULL for traditional email/password users)
    oauthProvider: varchar("oauth_provider", { length: 50 }), // 'google', 'apple', 'microsoft', NULL
    oauthProviderUserId: varchar("oauth_provider_user_id", { length: 255 }), // Provider's user ID

    // OAuth tokens (NULL for traditional users, encrypted in production!)
    oauthRefreshToken: text("oauth_refresh_token"), // Provider's refresh token

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Unique constraint on oauth provider and provider user id
    unique().on(table.oauthProvider, table.oauthProviderUserId),

    // Check constraint: Must have either password OR oauth provider (not both, not neither)
    check(
      "auth_method_check",
      sql`(${table.passwordHash} IS NOT NULL AND ${table.oauthProvider} IS NULL) OR (${table.passwordHash} IS NULL AND ${table.oauthProvider} IS NOT NULL)`,
    ),

    // Indexes
    index("idx_user_email")
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_user_oauth")
      .on(table.oauthProvider, table.oauthProviderUserId)
      .where(sql`${table.oauthProvider} IS NOT NULL`),
  ],
);

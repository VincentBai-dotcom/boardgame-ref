import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  inet,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./user";

// Password reset token (for traditional users)
export const passwordResetToken = pgTable(
  "password_reset_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Token data
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(), // SHA256 hash

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // Typically 1 hour
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_password_reset_token_user_id").on(table.userId),
    index("idx_password_reset_token_hash").on(table.tokenHash),
  ],
);

// Email verification token (for traditional signup)
export const emailVerificationToken = pgTable(
  "email_verification_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Token data
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(), // SHA256 hash

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // Typically 24-48 hours
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_email_verification_token_user_id").on(table.userId),
    index("idx_email_verification_token_hash").on(table.tokenHash),
  ],
);

// JWT refresh token table
export const refreshToken = pgTable(
  "refresh_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Token data
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(), // SHA256 hash of the refresh token

    // Metadata
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    // Device/session tracking
    userAgent: text("user_agent"),
    ipAddress: inet("ip_address"),

    // Revocation
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: varchar("revoked_reason", { length: 100 }), // 'logout', 'security', 'expired'
  },
  (table) => [
    index("idx_refresh_token_user_id").on(table.userId),
    index("idx_refresh_token_hash").on(table.tokenHash),
    index("idx_refresh_token_expires").on(table.expiresAt),
  ],
);

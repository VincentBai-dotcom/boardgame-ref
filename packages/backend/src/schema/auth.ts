import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  inet,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { user } from ".";

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

// Email verification code (email-first registration)
export const emailVerificationCode = pgTable(
  "email_verification_code",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    purpose: varchar("purpose", { length: 50 }).notNull(), // e.g. 'register'
    codeHash: varchar("code_hash", { length: 255 }).notNull(),
    codeSalt: varchar("code_salt", { length: 255 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_email_verification_code_email").on(table.email),
    index("idx_email_verification_code_hash").on(table.codeHash),
    index("idx_email_verification_code_expires").on(table.expiresAt),
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

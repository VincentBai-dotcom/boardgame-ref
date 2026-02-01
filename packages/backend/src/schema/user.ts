import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
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

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_user_email")
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

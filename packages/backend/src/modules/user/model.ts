import { t } from "elysia";
import { createSelectSchema } from "drizzle-typebox";
import { user } from "../../schema";
import { ApiErrorResponseSchema } from "../errors";

/**
 * User module validation models
 *
 * Following Elysia best practices:
 * - Use Elysia.t for validation (single source of truth)
 * - Reuse Drizzle schemas where possible via drizzle-typebox
 * - Extract TypeScript types using typeof model.static
 */

// Derive schema from Drizzle table
const userSelectSchema = createSelectSchema(user);

// Response models - use Drizzle-derived schema and exclude sensitive fields
export const UserResponse = {
  user: t.Omit(userSelectSchema, [
    "passwordHash",
    "oauthRefreshToken",
    "deletedAt",
  ]),

  error: ApiErrorResponseSchema,
};

// Extract TypeScript types from models
export type UserResponseType = typeof UserResponse.user.static;
export type ErrorResponse = typeof UserResponse.error.static;

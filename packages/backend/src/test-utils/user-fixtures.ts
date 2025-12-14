import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { user } from "../modules/db/schema";

type User = InferSelectModel<typeof user>;
type NewUser = InferInsertModel<typeof user>;

/**
 * Creates a mock User object with default values
 * @param overrides - Partial user data to override defaults
 * @returns Complete User object
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "test@example.com",
    emailVerified: false,
    passwordHash: "hashed_password_123",
    role: "user",
    oauthProvider: null,
    oauthProviderUserId: null,
    oauthRefreshToken: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Creates a mock NewUser object for insert operations
 * @param overrides - Partial user data to override defaults
 * @returns NewUser object ready for insertion
 */
export function createMockNewUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    email: "newuser@example.com",
    passwordHash: "hashed_password",
    role: "user",
    ...overrides,
  };
}

/**
 * Creates a mock OAuth user
 * @param overrides - Partial user data to override defaults
 * @returns User object configured for OAuth
 */
export function createMockOAuthUser(overrides: Partial<User> = {}): User {
  return createMockUser({
    passwordHash: null,
    oauthProvider: "google",
    oauthProviderUserId: "google_user_123",
    oauthRefreshToken: "refresh_token_xyz",
    emailVerified: true,
    ...overrides,
  });
}

/**
 * Creates a mock soft-deleted user
 * @param overrides - Partial user data to override defaults
 * @returns User object with deletedAt set
 */
export function createMockDeletedUser(overrides: Partial<User> = {}): User {
  return createMockUser({
    deletedAt: new Date("2024-01-15T00:00:00Z"),
    ...overrides,
  });
}

import { Elysia } from "elysia";
import { UserService } from "./service";
import { UserResponse } from "./model";
import { dbService } from "../db";
import { authGuard } from "../guard";

/**
 * User module - provides user CRUD operations
 *
 * This module:
 * - GET /user/me - Get current authenticated user
 * - Handles user lifecycle management (CRUD + soft deletes)
 *
 * Usage:
 * ```ts
 * import { userService } from './modules/user';
 *
 * // In routes or other services
 * const user = await userService.findById(params.id);
 * ```
 */

// Create singleton instance
export const userService = new UserService(dbService);

export const user = new Elysia({ name: "user", prefix: "/user" })
  .use(authGuard)
  .get(
    "/me",
    async ({ userId, status }) => {
      // userId is guaranteed to be non-null here due to authGuard
      const foundUser = await userService.findById(userId);

      if (!foundUser) {
        return status(404, { error: "User not found" });
      }

      // Return user without sensitive fields using object destructuring
      return {
        id: foundUser.id,
        email: foundUser.email,
        emailVerified: foundUser.emailVerified,
        role: foundUser.role,
        oauthProvider: foundUser.oauthProvider,
        oauthProviderUserId: foundUser.oauthProviderUserId,
        createdAt: foundUser.createdAt,
        updatedAt: foundUser.updatedAt,
        lastLoginAt: foundUser.lastLoginAt,
      };
    },
    {
      response: {
        200: UserResponse.user,
        404: UserResponse.error,
      },
    },
  );

// Re-export class and types for testing/mocking purposes
export { UserService };
export type {
  User,
  NewUser,
  FindUserOptions,
  ListUsersOptions,
} from "./service";

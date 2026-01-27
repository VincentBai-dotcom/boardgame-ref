import { Elysia } from "elysia";
import { UserResponse } from "./model";
import { authGuard } from "../../plugins/guard";
import { userRepository } from "../repositories";
import { UserError } from "./errors";

/**
 * User module - provides user-related routes
 *
 * This module:
 * - GET /user/me - Get current authenticated user
 */

export const user = new Elysia({ name: "user", prefix: "/user" })
  .use(authGuard)
  .get(
    "/me",
    async ({ userId }) => {
      // userId is guaranteed to be non-null here due to authGuard
      const foundUser = await userRepository.findById(userId);

      if (!foundUser) {
        throw UserError.notFound(userId);
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

// Re-export types from repository for convenience
export type {
  User,
  NewUser,
  FindUserOptions,
  ListUsersOptions,
} from "../repositories";

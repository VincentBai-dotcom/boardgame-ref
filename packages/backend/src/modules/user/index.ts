import { Elysia } from "elysia";
import { UserService } from "./service";

/**
 * User module - provides user CRUD operations
 *
 * This module:
 * - Decorates context with UserService for use in routes and other modules
 * - Provides service-only functionality (no HTTP routes)
 * - Handles user lifecycle management (CRUD + soft deletes)
 *
 * Usage:
 * ```ts
 * new Elysia()
 *   .use(db)
 *   .use(user)
 *   .get('/profile/:id', async ({ db, UserService, params }) => {
 *     const user = await UserService.findById(db, params.id);
 *     if (!user) return { error: 'User not found' };
 *     return user;
 *   })
 * ```
 */
export const user = new Elysia({ name: "user" });

// Re-export service and types
export { UserService };
export type {
  User,
  NewUser,
  FindUserOptions,
  ListUsersOptions,
} from "./service";

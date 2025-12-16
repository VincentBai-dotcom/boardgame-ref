import { Elysia } from "elysia";
import { UserService } from "./service";
import { dbService } from "../db";

/**
 * User module - provides user CRUD operations
 *
 * This module:
 * - Provides service-only functionality (no HTTP routes)
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
export const user = new Elysia({ name: "user" });

// Create singleton instance
export const userService = new UserService(dbService);

// Re-export class and types for testing/mocking purposes
export { UserService };
export type {
  User,
  NewUser,
  FindUserOptions,
  ListUsersOptions,
} from "./service";

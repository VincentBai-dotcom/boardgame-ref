import { eq, and, isNull, sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { user } from "../db/schema";
import { DbService } from "../db";

// Type definitions inline (no separate types.ts file)
type User = InferSelectModel<typeof user>;
type NewUser = InferInsertModel<typeof user>;

interface FindUserOptions {
  includeDeleted?: boolean;
}

interface ListUsersOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  role?: "user" | "admin";
}

/**
 * User service - provides CRUD operations for user management
 *
 * This service handles:
 * - User creation with email uniqueness validation
 * - Finding users by various criteria (ID, email, OAuth provider)
 * - Listing users with pagination and filtering
 * - Updating user records
 * - Soft delete and restore functionality
 * - Hard delete for permanent removal
 */
export abstract class UserService {
  /**
   * Helper to build WHERE clause with soft delete filter
   * @param condition - The base WHERE condition
   * @param includeDeleted - Whether to include soft-deleted users (default: false)
   * @returns Combined WHERE clause with soft delete filter if applicable
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static buildWhereClause(condition: any, includeDeleted = false) {
    if (includeDeleted) {
      return condition;
    }
    return and(condition, isNull(user.deletedAt));
  }

  /**
   * Create a new user
   * @param userData - User data to insert
   * @returns Created user record
   * @throws Error if email already exists
   */
  static async create(userData: NewUser): Promise<User> {
    const db = DbService.getDb();

    // Check email uniqueness (excluding soft-deleted)
    const existing = await db
      .select()
      .from(user)
      .where(this.buildWhereClause(eq(user.email, userData.email)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`User already exists with email: ${userData.email}`);
    }

    const [created] = await db.insert(user).values(userData).returning();
    return created;
  }

  /**
   * Find user by ID
   * @param id - User ID
   * @param options - Query options
   * @returns User record or null if not found
   */
  static async findById(
    id: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const db = DbService.getDb();
    const found = await db
      .select()
      .from(user)
      .where(this.buildWhereClause(eq(user.id, id), options.includeDeleted))
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find user by email
   * @param email - User email
   * @param options - Query options
   * @returns User record or null if not found
   */
  static async findByEmail(
    email: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const db = DbService.getDb();
    const found = await db
      .select()
      .from(user)
      .where(
        this.buildWhereClause(eq(user.email, email), options.includeDeleted),
      )
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * Find user by OAuth provider credentials
   * @param provider - OAuth provider name (e.g., 'google', 'apple')
   * @param providerUserId - User ID from the OAuth provider
   * @param options - Query options
   * @returns User record or null if not found
   */
  static async findByOAuthProvider(
    provider: string,
    providerUserId: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const db = DbService.getDb();
    const found = await db
      .select()
      .from(user)
      .where(
        this.buildWhereClause(
          and(
            eq(user.oauthProvider, provider),
            eq(user.oauthProviderUserId, providerUserId),
          ),
          options.includeDeleted,
        ),
      )
      .limit(1);
    return found[0] ?? null;
  }

  /**
   * List users with pagination and filtering
   * @param options - Query options (pagination, role filter, etc.)
   * @returns Array of user records
   */
  static async list(options: ListUsersOptions = {}): Promise<User[]> {
    const db = DbService.getDb();
    const { includeDeleted = false, limit = 100, offset = 0, role } = options;

    let whereClause = includeDeleted ? undefined : isNull(user.deletedAt);
    if (role) {
      whereClause = whereClause
        ? and(whereClause, eq(user.role, role))
        : eq(user.role, role);
    }

    let query = db.select().from(user);

    if (whereClause) {
      query = query.where(whereClause);
    }

    query = query.orderBy(user.createdAt);

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return query;
  }

  /**
   * Update user by ID
   * @param id - User ID
   * @param updates - Partial user data to update
   * @returns Updated user record or null if not found
   */
  static async update(
    id: string,
    updates: Partial<NewUser>,
  ): Promise<User | null> {
    const db = DbService.getDb();
    const [updated] = await db
      .update(user)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(user.id, id), isNull(user.deletedAt)))
      .returning();

    return updated ?? null;
  }

  /**
   * Update user's last login timestamp
   * @param id - User ID
   */
  static async updateLastLogin(id: string): Promise<void> {
    const db = DbService.getDb();
    await db
      .update(user)
      .set({ lastLoginAt: new Date() })
      .where(eq(user.id, id));
  }

  /**
   * Soft delete user (sets deletedAt timestamp)
   * @param id - User ID
   */
  static async softDelete(id: string): Promise<void> {
    const db = DbService.getDb();
    await db.update(user).set({ deletedAt: new Date() }).where(eq(user.id, id));
  }

  /**
   * Restore soft-deleted user (clears deletedAt timestamp)
   * @param id - User ID
   * @returns Restored user record or null if not found
   */
  static async restore(id: string): Promise<User | null> {
    const db = DbService.getDb();
    const [restored] = await db
      .update(user)
      .set({ deletedAt: null })
      .where(eq(user.id, id))
      .returning();

    return restored ?? null;
  }

  /**
   * Hard delete user (permanent deletion)
   * WARNING: This is irreversible
   * @param id - User ID
   */
  static async hardDelete(id: string): Promise<void> {
    const db = DbService.getDb();
    await db.delete(user).where(eq(user.id, id));
  }

  /**
   * Count users
   * @param options - Count options (includeDeleted, role filter)
   * @returns Number of users matching criteria
   */
  static async count(
    options: Pick<ListUsersOptions, "includeDeleted" | "role"> = {},
  ): Promise<number> {
    const db = DbService.getDb();
    const { includeDeleted = false, role } = options;

    let whereClause = includeDeleted ? undefined : isNull(user.deletedAt);
    if (role) {
      whereClause = whereClause
        ? and(whereClause, eq(user.role, role))
        : eq(user.role, role);
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(whereClause);

    return result[0]?.count ?? 0;
  }

  /**
   * Check if user exists by email
   * @param email - User email
   * @param options - Query options
   * @returns True if user exists, false otherwise
   */
  static async existsByEmail(
    email: string,
    options: FindUserOptions = {},
  ): Promise<boolean> {
    const found = await this.findByEmail(email, options);
    return found !== null;
  }
}

// Export types for external use
export type { User, NewUser, FindUserOptions, ListUsersOptions };

import { eq, and, isNull, sql, desc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { user } from "../../schema";
import type { DbService } from "../db/service";

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export interface FindUserOptions {
  includeDeleted?: boolean;
}

export interface ListUsersOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  role?: "user" | "admin";
}

export interface IUserRepository {
  create(userData: NewUser): Promise<User>;
  findById(id: string, options?: FindUserOptions): Promise<User | null>;
  findByEmail(email: string, options?: FindUserOptions): Promise<User | null>;
  findByOAuthProvider(
    provider: string,
    providerUserId: string,
    options?: FindUserOptions,
  ): Promise<User | null>;
  list(options?: ListUsersOptions): Promise<User[]>;
  update(id: string, updates: Partial<NewUser>): Promise<User | null>;
  updateLastLogin(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<User | null>;
  hardDelete(id: string): Promise<void>;
  count(
    options?: Pick<ListUsersOptions, "includeDeleted" | "role">,
  ): Promise<number>;
}

/**
 * User repository - handles all database operations for the user table
 */
export class UserRepository implements IUserRepository {
  constructor(private dbService: DbService) {}

  /**
   * Create a new user
   * @param userData - User data to insert
   * @returns Created user record
   * @throws Error if email already exists
   */
  async create(userData: NewUser): Promise<User> {
    const db = this.dbService.getDb();

    // Check email uniqueness (excluding soft-deleted)
    const existing = await db
      .select()
      .from(user)
      .where(and(eq(user.email, userData.email), isNull(user.deletedAt)))
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
  async findById(
    id: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const db = this.dbService.getDb();
    const whereClause = options.includeDeleted
      ? eq(user.id, id)
      : and(eq(user.id, id), isNull(user.deletedAt));

    const found = await db.select().from(user).where(whereClause).limit(1);
    return found[0] ?? null;
  }

  /**
   * Find user by email
   * @param email - User email
   * @param options - Query options
   * @returns User record or null if not found
   */
  async findByEmail(
    email: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const db = this.dbService.getDb();
    const whereClause = options.includeDeleted
      ? eq(user.email, email)
      : and(eq(user.email, email), isNull(user.deletedAt));

    const found = await db.select().from(user).where(whereClause).limit(1);
    return found[0] ?? null;
  }

  /**
   * Find user by OAuth provider credentials
   * @param provider - OAuth provider name (e.g., 'google', 'apple')
   * @param providerUserId - User ID from the OAuth provider
   * @param options - Query options
   * @returns User record or null if not found
   */
  async findByOAuthProvider(
    provider: string,
    providerUserId: string,
    options: FindUserOptions = {},
  ): Promise<User | null> {
    const db = this.dbService.getDb();
    const whereClause = options.includeDeleted
      ? and(
          eq(user.oauthProvider, provider),
          eq(user.oauthProviderUserId, providerUserId),
        )
      : and(
          eq(user.oauthProvider, provider),
          eq(user.oauthProviderUserId, providerUserId),
          isNull(user.deletedAt),
        );

    const found = await db.select().from(user).where(whereClause).limit(1);
    return found[0] ?? null;
  }

  /**
   * List users with pagination and filtering
   * @param options - Query options (pagination, role filter, etc.)
   * @returns Array of user records
   */
  async list(options: ListUsersOptions = {}): Promise<User[]> {
    const db = this.dbService.getDb();
    const { includeDeleted = false, limit = 100, offset = 0, role } = options;

    // Build where clause
    let whereClause;
    if (!includeDeleted && role) {
      whereClause = and(isNull(user.deletedAt), eq(user.role, role));
    } else if (!includeDeleted) {
      whereClause = isNull(user.deletedAt);
    } else if (role) {
      whereClause = eq(user.role, role);
    }

    let query = db.select().from(user).$dynamic();

    if (whereClause) {
      query = query.where(whereClause);
    }

    query = query.orderBy(desc(user.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Update user by ID
   * @param id - User ID
   * @param updates - Partial user data to update
   * @returns Updated user record or null if not found
   */
  async update(id: string, updates: Partial<NewUser>): Promise<User | null> {
    const db = this.dbService.getDb();
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
  async updateLastLogin(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db
      .update(user)
      .set({ lastLoginAt: new Date() })
      .where(eq(user.id, id));
  }

  /**
   * Soft delete user (sets deletedAt timestamp)
   * @param id - User ID
   */
  async softDelete(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.update(user).set({ deletedAt: new Date() }).where(eq(user.id, id));
  }

  /**
   * Restore soft-deleted user (clears deletedAt timestamp)
   * @param id - User ID
   * @returns Restored user record or null if not found
   */
  async restore(id: string): Promise<User | null> {
    const db = this.dbService.getDb();
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
  async hardDelete(id: string): Promise<void> {
    const db = this.dbService.getDb();
    await db.delete(user).where(eq(user.id, id));
  }

  /**
   * Count users
   * @param options - Count options (includeDeleted, role filter)
   * @returns Number of users matching criteria
   */
  async count(
    options: Pick<ListUsersOptions, "includeDeleted" | "role"> = {},
  ): Promise<number> {
    const db = this.dbService.getDb();
    const { includeDeleted = false, role } = options;

    // Build where clause
    let whereClause;
    if (!includeDeleted && role) {
      whereClause = and(isNull(user.deletedAt), eq(user.role, role));
    } else if (!includeDeleted) {
      whereClause = isNull(user.deletedAt);
    } else if (role) {
      whereClause = eq(user.role, role);
    }

    let query = db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .$dynamic();

    if (whereClause) {
      query = query.where(whereClause);
    }

    const result = await query;
    return result[0]?.count ?? 0;
  }

  /**
   * Check if user exists by email
   * @param email - User email
   * @param options - Query options
   * @returns True if user exists, false otherwise
   */
  async existsByEmail(
    email: string,
    options: FindUserOptions = {},
  ): Promise<boolean> {
    const found = await this.findByEmail(email, options);
    return found !== null;
  }
}

import { bearer } from "@elysiajs/bearer";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { UserService } from "../user/service";
import { dbService } from "../db";

const accessTtlSeconds = Number(
  process.env.JWT_ACCESS_EXPIRES_IN_SECONDS ?? 60 * 15,
);

const accessSecret = process.env.JWT_ACCESS_SECRET;

if (!accessSecret) {
  throw new Error("JWT_ACCESS_SECRET must be set");
}

// Create userService instance for admin guard
const userService = new UserService(dbService);

/**
 * Auth guard plugin - adds `userId` to context or rejects with 401.
 *
 * This module is separate from auth to avoid circular dependencies.
 * It validates JWT tokens and adds userId to the request context.
 *
 * Usage:
 * ```ts
 * import { authGuard } from './modules/guard';
 *
 * const app = new Elysia()
 *   .use(authGuard)
 *   .get('/protected', ({ userId }) => {
 *     if (!userId) {
 *       return { error: 'Unauthorized' };
 *     }
 *     // userId is available here
 *   });
 * ```
 */
export const authGuard = new Elysia({ name: "auth-guard" })
  .use(bearer())
  .use(
    jwt({
      name: "accessJwt",
      secret: accessSecret,
      exp: `${accessTtlSeconds}s`,
    }),
  )
  .resolve({ as: "scoped" }, async ({ bearer, accessJwt, set }) => {
    if (!bearer) {
      set.status = 401;
      return { userId: null };
    }

    const payload = await accessJwt.verify(bearer);

    if (!payload || payload.type !== "access" || !payload.sub) {
      set.status = 401;
      return { userId: null };
    }

    return { userId: payload.sub as string };
  });

/**
 * Admin guard plugin - adds `userId` to context and verifies admin role.
 *
 * This guard ensures the user is authenticated AND has admin privileges.
 * Returns 401 if not authenticated, 403 if authenticated but not admin.
 *
 * Usage:
 * ```ts
 * import { adminGuard } from './modules/guard';
 *
 * const app = new Elysia()
 *   .use(adminGuard)
 *   .get('/admin/users', ({ userId }) => {
 *     // Only admins can access this route
 *     // userId is guaranteed to be non-null for admin users
 *   });
 * ```
 */
export const adminGuard = new Elysia({ name: "admin-guard" })
  .use(bearer())
  .use(
    jwt({
      name: "accessJwt",
      secret: accessSecret,
      exp: `${accessTtlSeconds}s`,
    }),
  )
  .resolve({ as: "scoped" }, async ({ bearer, accessJwt, set }) => {
    if (!bearer) {
      set.status = 401;
      return { userId: null };
    }

    const payload = await accessJwt.verify(bearer);

    if (!payload || payload.type !== "access" || !payload.sub) {
      set.status = 401;
      return { userId: null };
    }

    const userId = payload.sub as string;

    // Fetch user to verify admin role
    const user = await userService.findById(userId);

    if (!user) {
      set.status = 401;
      return { userId: null };
    }

    if (user.role !== "admin") {
      set.status = 403;
      return { userId: null };
    }

    return { userId };
  });

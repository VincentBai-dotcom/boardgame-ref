import bearer from "./bearer";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { userRepository } from "../modules/repositories";
import { configService } from "../modules/config";

const config = configService.get();
const accessTtlSeconds = config.jwt.accessTtlSeconds;
const accessSecret = config.jwt.accessSecret;

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
  .derive({ as: "scoped" }, async ({ bearer, accessJwt, status }) => {
    if (!bearer) {
      return status(401, { error: "Unauthorized" });
    }

    const payload = await accessJwt.verify(bearer);

    if (!payload || payload.type !== "access" || !payload.sub) {
      return status(401, { error: "Unauthorized" });
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
  .derive({ as: "scoped" }, async ({ bearer, accessJwt, status }) => {
    if (!bearer) {
      return status(401, { error: "Unauthorized" });
    }

    const payload = await accessJwt.verify(bearer);

    if (!payload || payload.type !== "access" || !payload.sub) {
      return status(401, { error: "Unauthorized" });
    }

    const userId = payload.sub as string;

    // Fetch user to verify admin role
    const user = await userRepository.findById(userId);

    if (!user) {
      return status(401, { error: "Unauthorized" });
    }

    if (user.role !== "admin") {
      return status(403, { error: "Forbidden" });
    }

    return { userId };
  });

/**
 * Local guard plugin - restricts access to local/development environments only.
 *
 * This guard checks if NODE_ENV is not production and returns 404 otherwise.
 * Used for development-only routes like ingestion endpoints.
 * Uses onRequest lifecycle to block before validation.
 *
 * Usage:
 * ```ts
 * import { localGuard } from './modules/guard';
 *
 * const app = new Elysia()
 *   .use(localGuard)
 *   .get('/local/dev-tool', () => {
 *     // Only accessible in development
 *   });
 * ```
 */
export const localGuard = new Elysia({ name: "local-guard" }).onRequest(
  ({ status }) => {
    if (configService.isProduction) {
      return status(404, { error: "Not Found" });
    }
  },
);

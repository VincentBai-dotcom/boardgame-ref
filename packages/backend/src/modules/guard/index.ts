import { bearer } from "@elysiajs/bearer";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";

const accessTtlSeconds = Number(
  process.env.JWT_ACCESS_EXPIRES_IN_SECONDS ?? 60 * 15,
);

const accessSecret = process.env.JWT_ACCESS_SECRET;

if (!accessSecret) {
  throw new Error("JWT_ACCESS_SECRET must be set");
}

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

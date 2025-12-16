import { bearer } from "@elysiajs/bearer";
import { jwt } from "@elysiajs/jwt";
import { Cookie, Elysia, t } from "elysia";
import { AuthService } from "./service";
import { dbService } from "../db";
import { userService } from "../user";

// Create singleton instance
const authService = new AuthService(dbService, userService);

const accessTtlSeconds = Number(
  process.env.JWT_ACCESS_EXPIRES_IN_SECONDS ?? 60 * 15,
);
const refreshTtlSeconds = Number(
  process.env.JWT_REFRESH_EXPIRES_IN_SECONDS ?? 60 * 60 * 24 * 30,
);

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret || !refreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set");
}

const secureCookies = process.env.NODE_ENV === "production";

const getClientIp = (request: Request): string | null => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first) return first.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return null;
};

const setRefreshCookie = (
  refreshToken: string,
  cookie: Record<string, Cookie<unknown>>,
) => {
  cookie.refreshToken.value = refreshToken;
  cookie.refreshToken.httpOnly = true;
  cookie.refreshToken.secure = secureCookies;
  cookie.refreshToken.sameSite = "lax";
  cookie.refreshToken.path = "/auth";
  cookie.refreshToken.maxAge = refreshTtlSeconds;
};

export const auth = new Elysia({ name: "auth", prefix: "/auth" })
  .use(
    jwt({
      name: "accessJwt",
      secret: accessSecret,
      exp: `${accessTtlSeconds}s`,
    }),
  )
  .use(
    jwt({
      name: "refreshJwt",
      secret: refreshSecret,
      exp: `${refreshTtlSeconds}s`,
    }),
  )
  .derive(({ request }) => ({
    userAgent: request.headers.get("user-agent"),
    ipAddress: getClientIp(request),
  }))
  .post(
    "/register",
    async ({
      body,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      cookie,
      set,
    }) => {
      try {
        const user = await authService.registerUser(body.email, body.password);

        const accessToken = await accessJwt.sign({
          sub: user.id,
          type: "access",
        });

        const refreshToken = await refreshJwt.sign({
          sub: user.id,
          type: "refresh",
          jti: crypto.randomUUID(),
        });

        await authService.storeRefreshToken(user.id, refreshToken, {
          userAgent,
          ipAddress,
        });

        setRefreshCookie(refreshToken, cookie);
        return { accessToken, refreshToken };
      } catch (error) {
        set.status = 400;
        return { error: (error as Error).message };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
      }),
    },
  )
  .post(
    "/login",
    async ({
      body,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      cookie,
      set,
    }) => {
      try {
        const user = await authService.validateCredentials(
          body.email,
          body.password,
        );

        const accessToken = await accessJwt.sign({
          sub: user.id,
          type: "access",
        });

        const refreshToken = await refreshJwt.sign({
          sub: user.id,
          type: "refresh",
          jti: crypto.randomUUID(),
        });

        await authService.storeRefreshToken(user.id, refreshToken, {
          userAgent,
          ipAddress,
        });

        setRefreshCookie(refreshToken, cookie);
        return { accessToken, refreshToken };
      } catch {
        set.status = 401;
        return { error: "Invalid credentials" };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    },
  )
  .post(
    "/refresh",
    async ({
      body,
      cookie,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      set,
    }) => {
      const provided = body?.refreshToken as string | undefined;
      const token = (provided || cookie.refreshToken?.value) as
        | string
        | undefined;

      if (!token) {
        set.status = 401;
        return { error: "Missing refresh token" };
      }

      try {
        const payload = await refreshJwt.verify(token);
        if (!payload || payload.type !== "refresh" || !payload.sub) {
          throw new Error("Invalid refresh token");
        }

        // Validate & revoke existing refresh token, then issue new pair
        const userId = await authService.consumeRefreshToken(token);

        const accessToken = await accessJwt.sign({
          sub: userId,
          type: "access",
        });

        const newRefreshToken = await refreshJwt.sign({
          sub: userId,
          type: "refresh",
          jti: crypto.randomUUID(),
        });

        await authService.storeRefreshToken(userId, newRefreshToken, {
          userAgent,
          ipAddress,
        });

        setRefreshCookie(newRefreshToken, cookie);
        return { accessToken, refreshToken: newRefreshToken };
      } catch (error) {
        set.status = 401;
        return { error: (error as Error).message };
      }
    },
    {
      body: t.Optional(
        t.Object({
          refreshToken: t.String(),
        }),
      ),
    },
  )
  .post(
    "/logout",
    async ({ body, cookie, set }) => {
      const token = ((body as { refreshToken?: string })?.refreshToken ||
        cookie.refreshToken?.value) as string | undefined;

      if (token) {
        await authService.revokeRefreshToken(token);
      }

      cookie.refreshToken?.remove?.();
      set.status = 204;
      return null;
    },
    {
      body: t.Optional(
        t.Object({
          refreshToken: t.String(),
        }),
      ),
    },
  );

/**
 * Auth guard plugin - adds `userId` to context or rejects with 401.
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
  .derive(async ({ bearer, accessJwt, set }) => {
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

// Export singleton instance and class for testing/mocking
export { authService, AuthService };

import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { AuthService } from "./service";
import { AuthModel, AuthResponse } from "./model";
import { dbService } from "../db";
import { userRepository } from "../repositories";
import { getClientIp } from "../../utils/request";
import { httpLogger } from "../logger";

// Create singleton instance with config
const authService = new AuthService(dbService, userRepository);

const authConfig = authService.getConfig();
const { accessSecret, refreshSecret, accessTtlSeconds, refreshTtlSeconds } =
  authConfig;

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
  .use(httpLogger)
  .post(
    "/register",
    async ({
      body,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      cookie,
      status,
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

        authService.setRefreshCookie(refreshToken, cookie);
        return { accessToken, refreshToken };
      } catch (error) {
        return status(400, { error: (error as Error).message });
      }
    },
    {
      body: AuthModel.register,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
      },
    },
  )
  .post(
    "/register-admin",
    async ({
      body,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      cookie,
      status,
    }) => {
      try {
        const user = await authService.registerAdmin(body.email, body.password);

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

        authService.setRefreshCookie(refreshToken, cookie);
        return { accessToken, refreshToken };
      } catch (error) {
        return status(400, { error: (error as Error).message });
      }
    },
    {
      body: AuthModel.register,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
      },
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
      status,
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

        authService.setRefreshCookie(refreshToken, cookie);
        return { accessToken, refreshToken };
      } catch {
        return status(401, { error: "Invalid credentials" });
      }
    },
    {
      body: AuthModel.login,
      response: {
        200: AuthResponse.tokens,
        401: AuthResponse.error,
      },
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
      status,
    }) => {
      const provided = body?.refreshToken as string | undefined;
      const token = (provided || cookie.refreshToken?.value) as
        | string
        | undefined;

      if (!token) {
        return status(401, { error: "Missing refresh token" });
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

        authService.setRefreshCookie(newRefreshToken, cookie);
        return { accessToken, refreshToken: newRefreshToken };
      } catch (error) {
        return status(401, { error: (error as Error).message });
      }
    },
    {
      body: AuthModel.refresh,
      response: {
        200: AuthResponse.tokens,
        401: AuthResponse.error,
      },
    },
  )
  .post(
    "/logout",
    async ({ body, cookie, status }) => {
      const token = ((body as { refreshToken?: string })?.refreshToken ||
        cookie.refreshToken?.value) as string | undefined;

      if (token) {
        await authService.revokeRefreshToken(token);
      }

      cookie.refreshToken?.remove?.();
      return status(204, null);
    },
    {
      body: AuthModel.logout,
    },
  );

// Export singleton instance and class for testing/mocking
export { authService, AuthService };

// Re-export authGuard for convenience
export { authGuard } from "../guard";

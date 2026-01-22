import { jwt } from "@elysiajs/jwt";
import { Elysia, redirect } from "elysia";
import { AuthService } from "./service";
import { AuthModel, AuthResponse } from "./model";
import { t } from "elysia";
import { userRepository, refreshTokenRepository } from "../repositories";
import { configService } from "../config";
import { getClientIp } from "../../utils/request";
import { httpLogger } from "../../plugins/http-logger";
import { AppleOAuthProvider, GoogleOAuthProvider, OAuthService } from "./oauth";

// Create singleton instance with config
const authService = new AuthService(
  userRepository,
  refreshTokenRepository,
  configService,
);

const oauthService = new OAuthService({
  apple: new AppleOAuthProvider(configService.get().oauth.apple),
  google: new GoogleOAuthProvider(configService.get().oauth.google),
});

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
  .get(
    "/oauth/:provider/authorize",
    ({ params, cookie, query }) => {
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();

      cookie.oauthState.value = state;
      cookie.oauthState.httpOnly = true;
      cookie.oauthState.sameSite = "lax";
      cookie.oauthState.path = "/auth/oauth";
      cookie.oauthState.maxAge = 600;

      cookie.oauthNonce.value = nonce;
      cookie.oauthNonce.httpOnly = true;
      cookie.oauthNonce.sameSite = "lax";
      cookie.oauthNonce.path = "/auth/oauth";
      cookie.oauthNonce.maxAge = 600;

      const url = oauthService.getAuthorizeUrl(
        params.provider,
        state,
        nonce,
        query?.codeChallenge,
        query?.codeChallengeMethod as "S256" | "plain" | undefined,
      );
      return redirect(url, 302);
    },
    {
      params: AuthModel.oauthProviderParams,
      query: t.Optional(
        t.Object({
          codeChallenge: t.Optional(t.String()),
          codeChallengeMethod: t.Optional(t.String()),
        }),
      ),
      response: {
        302: t.Void(),
      },
    },
  )
  .get(
    "/oauth/:provider/callback",
    async ({
      params,
      query,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      cookie,
      status,
    }) => {
      const expectedState = cookie.oauthState?.value as string | undefined;
      const expectedNonce = cookie.oauthNonce?.value as string | undefined;

      if (!expectedState || !expectedNonce || query.state !== expectedState) {
        return status(401, { error: "Invalid OAuth state" });
      }

      cookie.oauthState?.remove?.();
      cookie.oauthNonce?.remove?.();

      try {
        const { claims, refreshToken: providerRefreshToken } =
          await oauthService.exchangeAndVerify(
            params.provider,
            query.code,
            expectedNonce,
          );

        const user = await authService.findOrCreateOAuthUser({
          provider: params.provider,
          providerUserId: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          oauthRefreshToken: providerRefreshToken,
        });

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
        return status(401, { error: (error as Error).message });
      }
    },
    {
      params: AuthModel.oauthProviderParams,
      query: AuthModel.oauthCallbackQuery,
      response: {
        200: AuthResponse.tokens,
        401: AuthResponse.error,
      },
    },
  )
  .post(
    "/oauth/:provider/token",
    async ({
      params,
      body,
      accessJwt,
      refreshJwt,
      userAgent,
      ipAddress,
      cookie,
      status,
    }) => {
      try {
        const { claims, refreshToken: providerRefreshToken } =
          await oauthService.exchangeAndVerify(
            params.provider,
            body.code,
            body.nonce,
            body.codeVerifier,
          );

        const user = await authService.findOrCreateOAuthUser({
          provider: params.provider,
          providerUserId: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          oauthRefreshToken: providerRefreshToken,
        });

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
        return status(401, { error: (error as Error).message });
      }
    },
    {
      params: AuthModel.oauthProviderParams,
      body: AuthModel.oauthTokenBody,
      response: {
        200: AuthResponse.tokens,
        401: AuthResponse.error,
      },
    },
  )
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
      return status(204, undefined);
    },
    {
      body: AuthModel.logout,
      response: {
        204: t.Void(),
      },
    },
  );

// Export singleton instance and class for testing/mocking
export { authService, AuthService };

// Re-export authGuard for convenience
export { authGuard } from "../../plugins/guard";

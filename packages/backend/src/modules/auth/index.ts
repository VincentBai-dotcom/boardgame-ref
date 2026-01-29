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
import { ApiError } from "../errors";
import { AuthError } from "./errors";
import { emailVerificationService } from "../email";
import { rateLimiterFactory } from "../rate-limiter";

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

const perMinute = rateLimiterFactory.perMinute.bind(rateLimiterFactory);

const authRateLimiter = rateLimiterFactory.createRateLimiter({
  default: perMinute(60),
  headerPrefix: "X-Auth-RateLimit",
  routeOverrides: {
    "POST /auth/email/intent": perMinute(30),
    "POST /auth/register/start": perMinute(5),
    "POST /auth/register/verify": perMinute(5),
    "POST /auth/register/resend": perMinute(3),
    "POST /auth/register/complete": perMinute(5),
    "POST /auth/login": perMinute(10),
    "POST /auth/refresh": perMinute(30),
    "POST /auth/oauth/apple/token": perMinute(10),
    "POST /auth/oauth/google/token": perMinute(10),
    "GET /auth/oauth/apple/authorize": perMinute(30),
    "GET /auth/oauth/google/authorize": perMinute(30),
  },
});

const authConfig = authService.getConfig();
const { accessSecret, refreshSecret, accessTtlSeconds, refreshTtlSeconds } =
  authConfig;
const registrationTtlSeconds = 900;

export const auth = new Elysia({ name: "auth", prefix: "/auth" })
  .use(authRateLimiter)
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
  .use(
    jwt({
      name: "registerJwt",
      secret: accessSecret,
      exp: `${registrationTtlSeconds}s`,
    }),
  )
  .derive(({ request }) => ({
    userAgent: request.headers.get("user-agent"),
    ipAddress: getClientIp(request),
  }))
  .use(httpLogger)
  .post(
    "/email/intent",
    async ({ body }) => {
      return emailVerificationService.getEmailIntent(body.email);
    },
    {
      body: AuthModel.emailIntent,
      response: {
        200: AuthResponse.emailIntent,
        400: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
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
        400: AuthResponse.error,
        401: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/register/start",
    async ({ body }) => {
      await emailVerificationService.startRegistration(body.email);
      return { ok: true };
    },
    {
      body: AuthModel.registerStart,
      response: {
        200: AuthResponse.ok,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        429: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/register/resend",
    async ({ body }) => {
      await emailVerificationService.resendRegistration(body.email);
      return { ok: true };
    },
    {
      body: AuthModel.registerResend,
      response: {
        200: AuthResponse.ok,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        429: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/register/verify",
    async ({ body, registerJwt }) => {
      await emailVerificationService.verifyRegistrationCode(
        body.email,
        body.code,
      );
      const registrationToken = await registerJwt.sign({
        email: body.email,
        purpose: "register",
      });
      return { registrationToken };
    },
    {
      body: AuthModel.registerVerify,
      response: {
        200: AuthResponse.registrationToken,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        429: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/register/complete",
    async ({
      body,
      accessJwt,
      refreshJwt,
      registerJwt,
      userAgent,
      ipAddress,
      cookie,
    }) => {
      let payload: Record<string, unknown> | null = null;
      try {
        payload = (await registerJwt.verify(body.registrationToken)) as Record<
          string,
          unknown
        > | null;
      } catch {
        throw AuthError.registrationTokenInvalid();
      }
      if (
        !payload ||
        payload.purpose !== "register" ||
        payload.email !== body.email
      ) {
        throw AuthError.registrationTokenInvalid();
      }

      const user = await authService.registerVerifiedUser(
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
    },
    {
      body: AuthModel.registerComplete,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        500: AuthResponse.error,
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
    }) => {
      const expectedState = cookie.oauthState?.value as string | undefined;
      const expectedNonce = cookie.oauthNonce?.value as string | undefined;

      if (!expectedState || !expectedNonce || query.state !== expectedState) {
        throw AuthError.invalidOAuthState();
      }

      cookie.oauthState?.remove?.();
      cookie.oauthNonce?.remove?.();

      try {
        // Web redirect flow uses Service ID + redirect URI.
        const { claims, refreshToken: providerRefreshToken } =
          await oauthService.exchangeAndVerify(
            params.provider,
            query.code,
            expectedNonce,
            undefined,
            "web",
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
        if (error instanceof ApiError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw AuthError.oauthExchangeFailed(message);
      }
    },
    {
      params: AuthModel.oauthProviderParams,
      query: AuthModel.oauthCallbackQuery,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        500: AuthResponse.error,
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
    }) => {
      try {
        // Native/mobile flow uses bundle ID and no redirect URI.
        const { claims, refreshToken: providerRefreshToken } =
          await oauthService.exchangeAndVerify(
            params.provider,
            body.code,
            body.nonce,
            body.codeVerifier,
            "native",
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
        if (error instanceof ApiError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw AuthError.oauthExchangeFailed(message);
      }
    },
    {
      params: AuthModel.oauthProviderParams,
      body: AuthModel.oauthTokenBody,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/register-admin",
    async ({ body, accessJwt, refreshJwt, userAgent, ipAddress, cookie }) => {
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
        if (error instanceof ApiError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw AuthError.registerAdminFailed(message);
      }
    },
    {
      body: AuthModel.register,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
        409: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/login",
    async ({ body, accessJwt, refreshJwt, userAgent, ipAddress, cookie }) => {
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
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw AuthError.invalidCredentials();
      }
    },
    {
      body: AuthModel.login,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
        401: AuthResponse.error,
        409: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  )
  .post(
    "/refresh",
    async ({ body, cookie, accessJwt, refreshJwt, userAgent, ipAddress }) => {
      const provided = body?.refreshToken as string | undefined;
      const token = (provided || cookie.refreshToken?.value) as
        | string
        | undefined;

      if (!token) {
        throw AuthError.missingRefreshToken();
      }

      try {
        const payload = await refreshJwt.verify(token);
        if (!payload || payload.type !== "refresh" || !payload.sub) {
          throw AuthError.invalidRefreshToken();
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
        if (error instanceof ApiError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw AuthError.invalidRefreshToken(message);
      }
    },
    {
      body: AuthModel.refresh,
      response: {
        200: AuthResponse.tokens,
        400: AuthResponse.error,
        401: AuthResponse.error,
        500: AuthResponse.error,
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
        400: AuthResponse.error,
        401: AuthResponse.error,
        500: AuthResponse.error,
      },
    },
  );

// Export singleton instance and class for testing/mocking
export { authService, AuthService };

// Re-export authGuard for convenience
export { authGuard } from "../../plugins/guard";

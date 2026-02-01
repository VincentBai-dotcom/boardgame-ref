import { t } from "elysia";
import { ApiErrorResponseSchema } from "../errors";

/**
 * Auth module validation models
 *
 * Following Elysia best practices:
 * - Use Elysia.t for validation (single source of truth)
 * - Extract TypeScript types using typeof model.static
 * - Group related models in namespaces
 */

// Request models
export const AuthModel = {
  register: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
  }),

  login: t.Object({
    email: t.String({ format: "email" }),
    password: t.String(),
  }),

  refresh: t.Optional(
    t.Object({
      refreshToken: t.String(),
    }),
  ),

  logout: t.Optional(
    t.Object({
      refreshToken: t.String(),
    }),
  ),

  oauthProviderParams: t.Object({
    provider: t.Union([t.Literal("apple"), t.Literal("google")]),
  }),

  oauthCallbackQuery: t.Object({
    code: t.String(),
    state: t.String(),
  }),

  oauthTokenBody: t.Object({
    code: t.String(),
    nonce: t.String(),
    codeVerifier: t.Optional(t.String()),
  }),

  emailIntent: t.Object({
    email: t.String({ format: "email" }),
  }),

  registerStart: t.Object({
    email: t.String({ format: "email" }),
  }),

  registerVerify: t.Object({
    email: t.String({ format: "email" }),
    code: t.String({ minLength: 6, maxLength: 6 }),
  }),

  registerComplete: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
    registrationToken: t.String(),
  }),

  registerResend: t.Object({
    email: t.String({ format: "email" }),
  }),
};

// Response models
export const AuthResponse = {
  tokens: t.Object({
    accessToken: t.String(),
    refreshToken: t.String(),
  }),

  error: ApiErrorResponseSchema,

  emailIntent: t.Object({
    intent: t.Union([t.Literal("login"), t.Literal("register")]),
    provider: t.Optional(t.Union([t.Literal("apple"), t.Literal("google")])),
  }),

  ok: t.Object({
    ok: t.Boolean(),
  }),

  cooldown: t.Object({
    ok: t.Boolean(),
    cooldownSeconds: t.Number(),
    alreadySent: t.Optional(t.Boolean()),
  }),

  registrationToken: t.Object({
    registrationToken: t.String(),
  }),
};

// Extract TypeScript types from models
export type RegisterBody = typeof AuthModel.register.static;
export type LoginBody = typeof AuthModel.login.static;
export type RefreshBody = typeof AuthModel.refresh.static;
export type LogoutBody = typeof AuthModel.logout.static;

export type TokenResponse = typeof AuthResponse.tokens.static;
export type ErrorResponse = typeof AuthResponse.error.static;

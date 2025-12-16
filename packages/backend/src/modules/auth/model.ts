import { t } from "elysia";

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
};

// Response models
export const AuthResponse = {
  tokens: t.Object({
    accessToken: t.String(),
    refreshToken: t.String(),
  }),

  error: t.Object({
    error: t.String(),
  }),
};

// Extract TypeScript types from models
export type RegisterBody = typeof AuthModel.register.static;
export type LoginBody = typeof AuthModel.login.static;
export type RefreshBody = typeof AuthModel.refresh.static;
export type LogoutBody = typeof AuthModel.logout.static;

export type TokenResponse = typeof AuthResponse.tokens.static;
export type ErrorResponse = typeof AuthResponse.error.static;

# Global API Error Handling Design

## Overview

Introduce a consistent, typed error contract for all API responses. Each module throws a structured `ApiError` (or module-specific subclass), and a global error handler converts it into a standardized JSON response. This lets clients map `errorCode` to custom UI while still providing a safe default `errorMessage`.

## Goals

- Single, global error response shape across all endpoints.
- Stable, machine-readable `errorCode` for client logic.
- Human-readable `errorMessage` as a safe default.
- Optional `details` for debugging (dev only or gated).
- Centralized logging with severity and context.

## Non-Goals

- Full i18n/translation system (client can handle localization based on `errorCode`).
- Complex error analytics pipeline.

## Error Response Contract

```ts
type ApiErrorResponse = {
  errorCode: string; // stable enum-like code
  errorMessage: string; // safe for display
  details?: Record<string, unknown>; // optional, controlled
  requestId?: string; // correlation id
};
```

## Response Schema Integration (Elysia)

Elysia validates responses when a `response` schema is provided, and supports per-status schemas. To keep validation consistent, attach a shared error schema to every status you plan to return (eg, 400/401/403/404/409/422/429/500) either per-route or via a guarded group.

Example response map:

```ts
response: {
  200: SuccessSchema,
  400: ErrorSchema,
  401: ErrorSchema,
  403: ErrorSchema,
  404: ErrorSchema,
  409: ErrorSchema,
  422: ErrorSchema,
  429: ErrorSchema,
  500: ErrorSchema
}
```

## Base Error Class

```ts
class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

## Module-Specific Errors

Each module can define its own error codes and convenience constructors, but all should extend `ApiError`.

Example (Auth):

```ts
export const AuthErrorCodes = {
  InvalidCredentials: "AUTH_INVALID_CREDENTIALS",
  OAuthRequired: "AUTH_OAUTH_REQUIRED",
  EmailNotVerified: "AUTH_EMAIL_NOT_VERIFIED",
} as const;

export class AuthError extends ApiError {
  static invalidCredentials() {
    return new AuthError(
      401,
      AuthErrorCodes.InvalidCredentials,
      "Invalid email or password.",
    );
  }
}
```

Example (Games):

```ts
export class GameError extends ApiError {
  static notFound(id: string) {
    return new GameError(404, "GAME_NOT_FOUND", "Game not found.", { id });
  }
}
```

## Global Error Handling

- Use a single `onError` or `error` handler at the app level.
- Register `onError` before the routes it should apply to.
- Register custom errors with `.error({ ApiError, AuthError, ... })` so Elysia narrows `code` for type-safe handling in `onError`. Prefer handling all errors centrally rather than defining `toResponse()` on each error class.
- If `instanceof ApiError`:
  - return `status`, `errorCode`, `errorMessage`, optional `details`.
- Otherwise:
  - return `500` and `errorCode = "INTERNAL_SERVER_ERROR"`.
- For validation errors, map Elysia's `VALIDATION` code to a stable `errorCode` (eg, `VALIDATION_ERROR`) and optionally include safe details; Elysia can also customize validation messages via schema or `onError`.

Pseudo:

```ts
app.error({ ApiError, AuthError });

app.onError(({ code, error, set }) => {
  if (code === "ApiError" || code === "AuthError") {
    set.status = error.status;
    return {
      errorCode: error.code,
      errorMessage: error.message,
      requestId,
      details: includeDetails ? error.details : undefined,
    };
  }

  if (error instanceof ApiError) {
    set.status = error.status;
    return {
      errorCode: error.code,
      errorMessage: error.message,
      details: includeDetails ? error.details : undefined,
    };
  }

  set.status = 500;
  return {
    errorCode: "INTERNAL_SERVER_ERROR",
    errorMessage: "Something went wrong.",
    requestId,
  };
});
```

## Error Code Conventions

- Prefix by module: `AUTH_*`, `USER_*`, `GAME_*`, `INGEST_*`.
- Keep codes stable and additive.
- Avoid leaking sensitive information in `errorMessage`.

## Client Guidance

- Clients should map `errorCode` to localized/custom messages.
- If no mapping, fall back to `errorMessage`.

## Logging

- Log all errors with:
  - `errorCode`
  - `status`
  - `module`
  - `requestId`
  - `stack` (server logs only)

## Environment Controls

- `details` returned only in non-production or with an explicit flag:
  - `ERROR_DETAILS_ENABLED=true`

## Migration Plan

1. Add base `ApiError` class in shared module.
2. Add global error handler in server bootstrap.
3. Update modules incrementally to throw `ApiError`.
4. Replace ad-hoc `try/catch` responses with `throw` of structured errors.

## Code Placement (Recommended)

- **Base error class + codes**: `packages/backend/src/modules/errors`
  - `index.ts` exports `ApiError`, `ErrorCodes`, and shared helpers.
  - Module-specific errors live near their module, eg `modules/auth/errors.ts`.
- **Global error handler**: implement as an Elysia plugin in `packages/backend/src/plugins/error-handler.ts`
  - Registers custom errors with `.error({ ApiError, AuthError, ... })`
  - Adds `.onError(...)` and optional response schema defaults.
  - Imported and applied in the server bootstrap (app entry) before routes.

This keeps error handling centralized and reusable while allowing modules to define their own error codes and constructors.

## Open Questions

- Which modules should be migrated first (auth, user, game)?

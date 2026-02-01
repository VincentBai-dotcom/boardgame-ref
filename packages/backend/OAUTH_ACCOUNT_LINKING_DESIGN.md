# OAuth Account Linking Design

## Summary

We want to allow users who already have an OAuth account (Apple/Google) to log in with a different OAuth provider **using the same email**, and to link those providers automatically **only when email ownership is verified**. The current schema only supports a single OAuth provider per user, so true multi‑provider linking requires a new table.

This document captures the current implementation and proposes the changes needed for safe auto‑linking.

## Current State (Codebase)

### Auth endpoints

- `GET /auth/oauth/:provider/authorize` → `GET /auth/oauth/:provider/callback`
- `POST /auth/oauth/:provider/token` (native)
- `POST /auth/login` (email/password)
- Email‑first registration with verification:
  - `POST /auth/email/intent`
  - `POST /auth/register/start`
  - `POST /auth/register/verify`
  - `POST /auth/register/complete`
  - `POST /auth/register/resend`

Location: `packages/backend/src/modules/auth/index.ts`

### AuthService behavior

- `findOrCreateOAuthUser`:
  - Uses `oauthProvider` + `oauthProviderUserId` to find existing user.
  - If email matches an existing user with different provider, **blocks** with `AUTH_OAUTH_EMAIL_LINKED_TO_OTHER_PROVIDER`.
- `registerVerifiedUser`:
  - If an OAuth‑only user exists, sets `passwordHash` (linking email/password to that account).

Location: `packages/backend/src/modules/auth/service.ts`

### OAuth Service

- Providers verify `id_token` (email + email_verified) and return `claims`.

Location: `packages/backend/src/modules/auth/oauth/*`

### Schema

- `user` table includes **single** provider fields:
  - `oauthProvider`, `oauthProviderUserId`, `oauthRefreshToken`
- Unique constraint on `(oauthProvider, oauthProviderUserId)`.

Location: `packages/backend/src/schema/user.ts`

### Current Email Intent

- OAuth‑only users now return `{ intent: "register", provider }` (no blocking).

Location: `packages/backend/src/modules/email/service.ts`

## Problem

We cannot link multiple OAuth providers to a single user with the current schema:

- Only one `oauthProvider` / `oauthProviderUserId` fits on `user`.
- Auto‑linking a second provider would require overwriting existing fields (unsafe).

We want **safe auto‑linking** when:

- The incoming OAuth provider reports `email_verified: true`.
- The email matches an existing user.

## Proposed Solution

### Add `oauth_account` table

Create a separate table to store provider identities per user.

#### Table: `oauth_account`

- `id` (uuid, PK)
- `user_id` (FK → user.id)
- `provider` (enum: apple, google)
- `provider_user_id` (string)
- `created_at`, `updated_at`
- Optional fields if needed later:
  - `refresh_token` (provider‑issued)
  - `access_token`, `expires_at`, `scopes`

Constraints:

- Unique `(provider, provider_user_id)`
- Optional unique `(user_id, provider)` if one account per provider

#### Keep on `user`

- `oauthProvider`, `oauthProviderUserId`, `oauthRefreshToken` can be deprecated after migration (or kept for backward compatibility during migration).

## Proposed Flow Changes (Option B)

### OAuth login / token exchange

When OAuth returns `claims`:

1. Find `oauth_account` by `(provider, provider_user_id)`.
2. If found → load user → issue app tokens.
3. If not found:
   - If `claims.email` is missing → error (current behavior).
   - If `claims.email_verified !== true` → **do not auto‑link**; return `AUTH_OAUTH_EMAIL_REQUIRES_PASSWORD_LINK` or a new error.
   - If `claims.email_verified === true`:
     - Look up user by email.
       - If user exists → create `oauth_account` for that user (link).
       - If no user → create user + oauth_account.

### Email/password registration

- `registerVerifiedUser` already links password to OAuth‑only user.
- With `oauth_account`, that logic should ensure `user.emailVerified = true` and optionally keep linking semantics.

### Email intent

- Keep returning `{ intent: "register", provider }` for OAuth‑only accounts to allow verified registration flow to link password.

## Data Migration Strategy

- No data migration needed (app not launched yet).

1. Create `oauth_account` table.
2. Update `AuthService.findOrCreateOAuthUser` to use `oauth_account` as source of truth.
3. (Optional) Remove provider fields from `user` after new table is adopted.

## API / Contract Impacts

- No new endpoints required.
- Existing `POST /auth/oauth/:provider/*` continue to work.
- The only semantic change: OAuth login with a different provider but **verified email** will now auto‑link instead of failing.

## Security Considerations

- Auto‑link only when `email_verified` is true.
- If `email_verified` is false or missing, do not auto‑link.
- Keep rate limiting on OAuth endpoints (`authRateLimiter`).

## Open Questions

- Should we require **both** providers to have verified email, or only the incoming provider?
- Should we allow linking multiple accounts per provider (rare) or enforce unique `(user_id, provider)`?
- Should we store provider refresh tokens in `oauth_account` now or later?

## Recommended Next Steps

1. Decide on `oauth_account` schema and constraints.
2. Implement repository + service changes for OAuth linking.
3. Add migration and backfill.
4. Add tests for:
   - Auto‑link when `email_verified = true`.
   - Block when `email_verified = false`.
   - Existing provider account still works.

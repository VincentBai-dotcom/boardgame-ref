# OAuth Account Schema + Implementation Steps

## Target Schema

### `user` table (updated)

Remove OAuth provider fields from `user`:

- `oauth_provider`
- `oauth_provider_user_id`
- `oauth_refresh_token`

Keep existing fields:

- `id` (uuid PK)
- `email` (unique)
- `email_verified`
- `password_hash`
- `role`
- `created_at`, `updated_at`, `last_login_at`, `deleted_at`

### `oauth_account` table (new)

Purpose: store multiple OAuth provider identities per user.

Columns:

- `id` uuid PK (default random)
- `user_id` uuid FK → `user.id` (on delete cascade)
- `provider` enum (`apple`, `google`)
- `provider_user_id` varchar(255) (provider subject / sub)
- `created_at` timestamptz default now
- `updated_at` timestamptz default now

Constraints / indexes:

- Unique `(provider, provider_user_id)`
- Unique `(user_id, provider)` (one account per provider per user)
- Index `(user_id)`
- Index `(provider, provider_user_id)`

Notes:

- We are **not** storing provider refresh tokens (app uses its own refresh tokens).
- If needed later, add optional `refresh_token` and `scopes`.

## Behavior Changes

### OAuth login

- Find `oauth_account` by `(provider, provider_user_id)`.
  - If found → load `user` by `user_id` and issue app tokens.
- If not found:
  - If `claims.email` missing → error (existing behavior).
  - If `claims.email_verified !== true` → error (do not auto‑link).
  - If verified → find user by email:
    - If user exists → create `oauth_account` linked to that user.
    - If user does not exist → create user (email_verified true) + oauth_account.

### Email registration

- `registerVerifiedUser` already links a password to an existing OAuth‑only account (by email).
- With `oauth_account`, OAuth‑only users are those with a user row + at least one oauth_account and no password_hash.

## Implementation Steps

1. **Add schema**
   - Create `oauth_account` table in `packages/backend/src/schema/`.
   - Add `oauthProviderEnum` if not already used for the new table (re‑use existing enum).
   - Update `schema/index.ts` exports.

2. **Remove OAuth fields from `user` schema**
   - Remove columns + constraints + indexes related to `oauthProvider` and `oauthProviderUserId`.
   - Update any type usage in codebase.

3. **Create repository**
   - `modules/repositories/oauth-account.ts` with methods:
     - `findByProvider(provider, providerUserId)`
     - `findByUserProvider(userId, provider)`
     - `create({ userId, provider, providerUserId })`
   - Export in `modules/repositories/index.ts`.

4. **Update AuthService**
   - Replace `findByOAuthProvider` usage with `oauthAccountRepository.findByProvider`.
   - When linking, create oauth_account record rather than writing provider fields on `user`.
   - Ensure email_verified rules are enforced before auto‑link.

5. **Update email intent logic**
   - If user has any oauth_account and no password_hash, return `{ intent: "register", provider: <first provider> }`.
   - This keeps the “verified registration links password” flow.

6. **Update tests**
   - Add tests for:
     - auto‑link when email_verified true
     - reject when email_verified false
     - existing oauth_account lookup
   - Update existing mocks for new repository.

7. **Remove old fields from code**
   - Remove references to `oauthProvider`, `oauthProviderUserId`, `oauthRefreshToken` in services and responses.

8. **Migration**
   - Since app not launched, no data backfill needed.
   - Apply a single migration that drops old columns and adds oauth_account table.

## Deliverables

- New `oauth_account` schema + repository
- Updated AuthService linking logic
- Updated email intent logic
- Updated tests
- Migration (drop old fields + add new table)

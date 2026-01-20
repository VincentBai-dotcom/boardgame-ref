# OAuth Design: Apple + Google (Elysia/Bun Backend)

## Context (Current State)

- Backend has email/password auth and refresh tokens.
- `user` table already includes:
  - `oauthProvider`, `oauthProviderUserId`, `oauthRefreshToken`
- `refresh_token` table handles app-issued refresh tokens.
- `AuthService` handles issuing app tokens and storing refresh tokens.

## Goals

- Add OAuth 2.0 / OIDC login for Apple and Google.
- Keep existing AuthService flow for issuing app access/refresh tokens.
- Support both web and mobile clients.
- Avoid large refactors while keeping a clean abstraction.

## Non-Goals (for now)

- Multi-tenant org accounts.
- Social account linking across providers.
- Token revocation sync with provider (can be added later).

## OAuth vs OIDC (Why It Matters)

- Apple and Google both use OpenID Connect on top of OAuth 2.0.
- We must verify the `id_token` JWT to authenticate the user.
- Access tokens from providers are not used for app auth.

## Lifecycle (Apple Login + Auth Routes)

### Web (redirect + cookie state/nonce)

1. Client calls `GET /auth/oauth/apple/authorize`.
2. Backend sets `oauthState` + `oauthNonce` cookies and redirects to Apple.
3. User authenticates at Apple, consents.
4. Apple redirects to `GET /auth/oauth/apple/callback?code=...&state=...`.
5. Backend validates state/nonce, exchanges code, verifies `id_token`.
6. Backend upserts user and returns app tokens (sets refresh cookie).

### Mobile (PKCE + token endpoint)

1. Client generates `code_verifier` + `code_challenge`.
2. Client opens Apple authorize URL with `code_challenge` and `nonce`.
3. Apple redirects with `code`.
4. Client calls `POST /auth/oauth/apple/token` with:
   - `code`, `nonce`, `codeVerifier`
5. Backend exchanges code, verifies `id_token`, issues app tokens.

Notes:

- Apple returns `email` and `name` only on the first authorization.
- The `client_secret` is a JWT signed with Apple private key (p8).

## Lifecycle (Google Login)

Google follows the same route flow as Apple:

- Web: `GET /auth/oauth/google/authorize` → `GET /auth/oauth/google/callback`
- Mobile: PKCE + `POST /auth/oauth/google/token`

Differences vs Apple:

- Google always returns `email` in `id_token`.
- Apple uses JWT client secret; Google uses client secret string.
- Apple user info is limited and one-time for name/email.

## Design Options

### Option A: Minimal Custom OAuth Service (Recommended)

Create a provider-agnostic OAuth module with provider-specific adapters.

Core components:

- `OAuthService` (or `AuthOAuthService`)
  - `getAuthorizeUrl(provider, opts)`
  - `exchangeCode(provider, code, redirectUri)`
  - `verifyIdToken(provider, idToken, nonce)`
  - `upsertUser(provider, claims)`
  - `issueAppTokens(userId, userAgent, ipAddress)`

Provider adapters:

- `AppleProvider`
- `GoogleProvider`

Pros:

- No heavy dependencies.
- Full control over security and token storage.
- Matches current AuthService style.

Cons:

- More code to maintain.
- Must keep up with provider quirks.

### Option B: Provider-Agnostic Framework

Use a library to handle OAuth/OIDC and JWT verification.

Candidates:

- `openid-client` (OIDC/OAuth standard client)
- `oauth4webapi` (low-level, spec-compliant)
- `lucia` or `auth.js` (higher-level auth frameworks)

Pros:

- Standards-compliant handling, less crypto/JWT code.
- Easier to add more providers later.

Cons:

- Extra dependency surface area.
- Some frameworks assume specific web stacks.

Recommendation:

- Start with Option A or `openid-client`.
- Avoid a full auth framework unless you plan to expand to many providers quickly.

## Suggested Backend API

### 1) Start OAuth Flow

`GET /auth/oauth/:provider/authorize`

- Generates state + nonce (and PKCE verifier if web/mobile).
- Stores state/nonce in signed cookie or DB.
- Redirects to provider authorize URL.

### 2) OAuth Callback

`GET /auth/oauth/:provider/callback`

- Validates state/nonce.
- Exchanges code for tokens.
- Verifies `id_token`.
- Upserts user by `provider` + `sub`.
- Issues app access/refresh tokens (existing flow).
- Sets refresh cookie; returns access token JSON.

### 3) Mobile Token Exchange (Optional)

`POST /auth/oauth/:provider/token`

- For mobile native flows returning `code`.
- Backend does exchange + verification; returns app tokens.

## Data Model Considerations

### Current Schema (user table)

Currently stores provider info on user. This is OK for a single provider per user.

Limitations:

- One provider per user (no linking).
- No token history or multiple accounts.

### Alternative (recommended if multi-provider is planned)

Add `oauth_account` table:

- user_id, provider, provider_user_id
- refresh_token (encrypted)
- created_at, updated_at

This enables account linking and multiple providers per user.

## Security Checklist

- Use Authorization Code + PKCE for mobile/native.
- Validate `state` and `nonce` on callback.
- Verify JWT signature via provider JWKS.
- Validate `iss`, `aud`, `exp`, `nonce`.
- Store refresh tokens securely (encrypt at rest if possible).
- Log and rate-limit auth endpoints.

## Config Requirements

Add to `ConfigService`:

- `oauth.apple.clientId`
- `oauth.apple.teamId`
- `oauth.apple.keyId`
- `oauth.apple.privateKey`
- `oauth.apple.redirectUri`
- `oauth.google.clientId`
- `oauth.google.clientSecret`
- `oauth.google.redirectUri`

## Implementation Steps (Recommended Path)

1. Add provider config to `ConfigService`.
2. Create provider adapters (`apple`, `google`).
3. Add OAuth routes in `modules/auth`.
4. Implement `AuthService` methods to upsert OAuth users.
5. Add migrations if moving to `oauth_account` table.
6. Add tests for JWT verification and account creation.

## Apple vs Google: Summary

- Both are OAuth 2.0 + OIDC with the same core lifecycle.
- Apple requires a JWT client secret and returns limited user data.
- Google is simpler to configure but more permissive with profile data.

## Open Questions

- Do we want multiple providers linked to one user?
- Should provider refresh tokens be stored and used?
- Should web and mobile use the same callback, or separate endpoints?

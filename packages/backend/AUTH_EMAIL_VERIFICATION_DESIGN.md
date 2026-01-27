# Email-First Auth + Email Verification (Postmark)

## Overview

Redesign auth to support a single email-first flow and add email verification for registration. The mobile/web client first asks for the user's email, then the backend indicates whether the user should log in, register, or use an OAuth provider (Apple/Google). Registration requires verifying the email with a 6-digit code delivered via Postmark.

## Goals

- Single email-first UX: user enters email once, backend returns next step.
- Preserve existing OAuth-only account behavior (block password login when account is OAuth-only).
- Add email verification to registration using a short-lived code.
- Keep flows explicit for native vs web OAuth already implemented.

## Non-Goals

- Password reset (can be added later using same verification primitives).
- OAuth account linking changes (no change to current behavior).

## User Flows

### Email-first intent

1. Client submits email.
2. Backend responds with the next action:
   - `login` for password accounts.
   - `oauth` for OAuth-only accounts (include provider).
   - `register` for new emails.

### Registration with verification (code-based)

1. Client calls `POST /auth/register/start` with email.
2. Backend generates 6-digit code, stores hashed code + expiry, sends email via Postmark.
3. Client calls `POST /auth/register/verify` with email + code.
4. Backend validates code and returns a short-lived `registrationToken`.
5. Client calls `POST /auth/register/complete` with email + password + registrationToken.
6. Backend creates account and returns access/refresh tokens.

### Login

- Existing `POST /auth/login` remains unchanged.

## API Endpoints

### 1) Email intent

**POST** `/auth/email/intent`

- **Body**: `{ email: string }`
- **Response**:
  - `{ intent: "login" }`
  - `{ intent: "oauth", provider: "apple" | "google" }`
  - `{ intent: "register" }`

### 2) Register start

**POST** `/auth/register/start`

- **Body**: `{ email: string }`
- **Response**: `{ ok: true }`
- **Behavior**:
  - Rate limit by email/IP.
  - Create verification record with:
    - `email`
    - `code_hash`
    - `expires_at`
    - `attempts`
  - Send code via Postmark.

### 3) Register verify

**POST** `/auth/register/verify`

- **Body**: `{ email: string, code: string }`
- **Response**: `{ registrationToken: string }`
- **Behavior**:
  - Validate code + expiry.
  - Invalidate code record.
  - Issue short-lived registration token (JWT or random token stored in DB).

### 4) Register complete

**POST** `/auth/register/complete`

- **Body**: `{ email: string, password: string, registrationToken: string }`
- **Response**: `{ accessToken: string, refreshToken: string }`
- **Behavior**:
  - Validate registration token.
  - Create user with verified email.
  - Issue auth tokens.

## Data Model

### Option A: New table `email_verifications`

Fields:

- `id` (uuid)
- `email` (varchar, indexed)
- `code_hash` (text)
- `purpose` (enum: `register`)
- `expires_at` (timestamp)
- `attempts` (int)
- `created_at` (timestamp)

### Registration token

- Short-lived JWT (10-15 min) or DB table `registration_sessions`.
- JWT payload includes `email`, `purpose: register`, `exp`.

## Postmark Integration

### Config

- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `POSTMARK_MESSAGE_STREAM` (e.g. `outbound`)

### Sending

- `POST /email` via Postmark API with simple template:
  - Subject: “Your verification code”
  - Body: `Your code is 123456` (plain text)

### Local Testing

- Use Postmark Sandbox Server token in `.env.local`.
- Send to any email; view messages in Postmark UI (no real delivery).

## Security Considerations

- Hash verification codes at rest (e.g., SHA-256 + per-record salt).
- Short expiry (e.g., 10 minutes).
- Rate limit by email and IP.
- Limit verify attempts (e.g., 5 per code).
- Avoid disclosing account existence if desired (optional).

## Backward Compatibility

- Keep existing `/auth/login`, `/auth/oauth/*` endpoints, remove `/auth/register`.
- New endpoints are additive.
- Client can migrate to email-first flow without breaking existing clients.

## Open Questions

- Should we allow login for unverified accounts (legacy users)?
- Registration token storage: JWT vs DB row?
- Should we add `/auth/register/resend` now or later?

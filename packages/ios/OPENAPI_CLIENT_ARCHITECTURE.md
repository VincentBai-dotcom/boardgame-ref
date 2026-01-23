# Ideal Code Organization with Generated OpenAPI Client

This document proposes an **ideal** structure for the iOS app now that you have generated `Client.swift` and `Types.swift`. It **does not** consider migration cost.

## Current snapshot (what exists today)

- `Core/Network/APIEndpoint.swift` hard‑codes routes.
- `Core/Network/HTTPClient.swift` manually builds requests and decodes DTOs.
- `Shared/Models/DTOs/*` defines request/response DTOs for auth/chat/conversations.
- `Shared/Services/*Service.swift` uses `HTTPClient` + DTOs.
- `Generated/OpenAPI/Client.swift` and `Types.swift` exist but aren’t integrated.

## Target architecture (ideal)

### High‑level idea

Use the generated OpenAPI client **as the single source of truth** for:

- Endpoint paths/methods
- Request/response models
- Encoding/decoding rules

Then wrap it with a thin, app‑specific layer that:

- Injects auth headers
- Implements retries/refresh
- Converts generated models → domain models

### Layered layout

```json
BoardGameRef/
  Core/
    Networking/
      OpenAPI/
        Generated/                <-- output of swift-openapi-generator
      Transport/
        APIClient.swift           <-- wrapper around Generated Client
        AuthMiddleware.swift      <-- injects tokens
        RetryPolicy.swift         <-- token refresh + retry
      Errors/
        APIError.swift            <-- app-level error mapping
  Domain/
    Models/                       <-- app’s domain models (User, Message, Conversation)
    Repositories/
      AuthRepository.swift
      ChatRepository.swift
      ConversationRepository.swift
  Features/
    Authentication/
      ViewModels/                 <-- depends on repositories
    Chat/
      ViewModels/
  Shared/
    Storage/                      <-- SwiftData entities, token storage
```

## Details by layer

### 1) Generated OpenAPI layer (raw)

**Purpose:** keep all generated code isolated and untouched.

- Folder: `Core/Networking/OpenAPI/Generated/`
- Contents:
  - `Client.swift`
  - `Types.swift`
- Rule: _Never edit these files manually._

### 2) Transport layer (app‑specific HTTP)

**Purpose:** configure the generated client once and handle auth/refresh/retry.

Key types:

- **`APIClient`**
  - Holds the generated `Client` instance.
  - Exposes strongly typed functions like:
    - `auth.login(...)`
    - `chat.start(...)`
    - `conversation.list(...)`

- **`AuthMiddleware`**
  - Injects `Authorization: Bearer <token>` into every request that needs it.
  - Reads from your existing `TokenManager`.

- **`RetryPolicy` / `RefreshTokenHandler`**
  - If a request returns `401`, try refresh once using generated auth endpoints.
  - Then retry the original request.
  - If refresh fails, clear tokens.

Why this layer?  
It replaces `HTTPClient.swift` and `APIEndpoint.swift` entirely, while keeping all
OpenAPI logic centralized.

### 3) Domain layer (pure app models)

**Purpose:** keep UI and business logic independent from OpenAPI types.

- **Domain models** (e.g., `User`, `Message`, `Conversation`) live here.
- **Mapping** happens between:
  - Generated OpenAPI types → Domain models
  - Domain models → Generated request types

This means your UI never touches `Operations.*` types directly.

### 4) Repository layer (use cases)

**Purpose:** centralize app use‑cases and hide network details from UI.

Repositories call `APIClient` and return **domain models** or app errors.

Examples:

- `AuthRepository`
  - `register(email:password:) -> User`
  - `login(email:password:) -> User`
  - `logout()`
- `ChatRepository`
  - `startNewChat(text:) -> AsyncStream<ChatEvent>`
  - `continueChat(conversationId:text:) -> AsyncStream<ChatEvent>`
  - `getMessages(conversationId:) -> [Message]`
- `ConversationRepository`
  - `list() -> [Conversation]`
  - `get(id:) -> Conversation`
  - `updateTitle(id:title:)`
  - `delete(id:)`

### 5) Feature layer (UI)

**Purpose:** ViewModels depend only on repositories and domain models.

So the flow becomes:

```json
ViewModel -> Repository -> APIClient -> Generated Client -> HTTP
```

No view or view model should import `OpenAPIRuntime` or `Operations.*`.

## What gets deleted or replaced

### Remove (or deprecate)

- `Core/Network/APIEndpoint.swift`
- `Core/Network/HTTPClient.swift`
- `Shared/Models/DTOs/*` (request/response DTOs)

### Keep

- `Core/Network/NetworkMonitor.swift` (still useful for offline UI)
- `Core/Network/SSEClient.swift` (if you keep SSE for chat streaming)
- `Shared/Storage/*` (token manager, SwiftData)

## Where SSE fits (chat streaming)

Your chat endpoints are SSE (`text/event-stream`).  
The generated OpenAPI client won’t manage streaming by itself unless you wire it
to a streaming transport. Two good options:

1. **Keep your existing `SSEClient`**, but move it under `Core/Networking/Transport/Streaming/`.
2. Wrap SSE in `ChatRepository` and expose an `AsyncStream<ChatEvent>` to the UI.

This keeps streaming concerns out of views and keeps the rest of the client using
generated types.

## Example flow (register)

1. ViewModel calls `AuthRepository.register(email:password:)`
2. Repository creates generated request type:
   - `Operations.postAuthRegister.Input.Body.json(...)`
3. `APIClient` sends request using generated `Client`.
4. Generated response is mapped to `Domain.User`.
5. Domain model is saved to SwiftData.

## File structure suggestions (concrete)

- Move generated output to:
  - `BoardGameRef/Core/Networking/OpenAPI/Generated/`
- Add:
  - `BoardGameRef/Core/Networking/Transport/APIClient.swift`
  - `BoardGameRef/Core/Networking/Transport/AuthMiddleware.swift`
  - `BoardGameRef/Core/Networking/Transport/RefreshTokenHandler.swift`
- Add:
  - `BoardGameRef/Domain/Models/User.swift`
  - `BoardGameRef/Domain/Models/Message.swift`
  - `BoardGameRef/Domain/Models/Conversation.swift`
  - `BoardGameRef/Domain/Repositories/AuthRepository.swift`
  - `BoardGameRef/Domain/Repositories/ChatRepository.swift`
  - `BoardGameRef/Domain/Repositories/ConversationRepository.swift`

## Why this is better than hardcoded DTOs/endpoints

- **Single source of truth**: OpenAPI spec → generated code → app.
- **Less drift**: no manual endpoints or DTOs to keep in sync.
- **Clear separation**: generated types are isolated, domain stays clean.
- **Easier testing**: repository layer can be mocked without touching networking.

## Migration note (informational only)

You asked for ideal design without considering switching costs.  
If you ever migrate, the safest path is: transport layer first, repositories next,
then replace DTO usage in features, then delete `HTTPClient`/`APIEndpoint`.

# Agent Runtime + Message Types (Draft)

## Context

We want an LLM-provider-agnostic agent runtime that uses Vercel AI SDK v6 for streaming output and a centralized PostgreSQL message store. We do NOT need Mastra's agent implementation or multiple storage backends. We do need:

- A stable, typed canonical message layer that is independent of DB details.
- Stream chunk -> message conversion from AI SDK v6 to the canonical layer.
- DB adapter to persist/retrieve canonical messages via Drizzle.

## Goals

- Provider-agnostic LLM streaming using AI SDK v6 types.
- Canonical message types that are stable across SDK changes.
- Postgres storage via Drizzle with JSON content.
- Minimal runtime surface area (no Mastra agent workflows).

## Non-goals

- Implementing tool execution or agent logic in this doc.
- Supporting alternative storages (DynamoDB, SQLite, etc.).
- Full UI message compatibility with Mastra.

## Package layout (proposed)

```json
packages/
  agent/                  # Agent runtime (LLM + stream conversion)
    src/
      agent.ts            # Agent class (skeleton)
      message-list.ts      # Aggregation of stream parts
      conversions/         # AI SDK v6 <-> canonical types
  agent-types/             # Canonical message types (no AI SDK dependency)
    src/
      messages.ts
  backend/                 # Drizzle + Postgres storage adapter
    src/
      schema/              # DB schema definitions
      modules/
        agent-store/       # PostgresMemoryStore (implements interface)
```

Rationale:

- `agent-types` is dependency-free (no AI SDK). This keeps `backend` isolated from AI SDK churn.
- `agent` depends on AI SDK v6 and `agent-types`.
- `backend` depends on Drizzle + `agent-types`.

## Canonical message types (second layer)

Located in `packages/agent-types/src/messages.ts`.

```ts
export type MessageRole = "system" | "user" | "assistant" | "tool";
export type MessageType = "text" | "tool" | "event";

export type CanonicalMessage = {
  id: string;
  threadId: string;
  role: MessageRole;
  type: MessageType;
  content: MessageContentV2;
  createdAt: Date;
  resourceId?: string;
};

export type MessageContentV2 = {
  format: 2;
  parts: MessagePart[];
  content?: string; // Optional convenience string
  metadata?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
};

export type MessagePart =
  | { type: "text"; text: string; providerMetadata?: Record<string, unknown> }
  | {
      type: "reasoning";
      reasoning: string;
      details?: unknown;
      providerMetadata?: Record<string, unknown>;
    }
  | {
      type: "tool-invocation";
      toolCallId: string;
      toolName: string;
      args?: unknown;
      result?: unknown;
      state: "call" | "result" | "partial-call";
      providerMetadata?: Record<string, unknown>;
    }
  | { type: "file"; data: string | Uint8Array; mimeType?: string }
  | {
      type: "source";
      id?: string;
      title?: string;
      url?: string;
      providerMetadata?: Record<string, unknown>;
    }
  | { type: "data"; data: unknown };
```

This is the stable layer. AI SDK changes should only affect conversion code in `packages/agent`, not the DB or backend.

## AI SDK v6 <-> canonical conversion

Located in `packages/agent/src/conversions`.

### Input to AI SDK (Canonical -> ModelMessage[])

- Convert `CanonicalMessage[]` from storage into AI SDK v6 `ModelMessage[]`.
- Filter or normalize parts for provider compatibility (e.g., remove partial tool calls, flatten text).

Pseudo-interface:

```ts
import type { ModelMessage } from "ai";
import type { CanonicalMessage } from "@boardgame-ref/agent-types";

export function toAiSdkMessages(messages: CanonicalMessage[]): ModelMessage[];
```

### Output from AI SDK (Stream parts -> CanonicalMessage)

- Convert streaming parts (`TextStreamPart`, `ToolCallPart`, `ToolResultPart`, `ReasoningPart`, `SourcePart`, `FilePart`) into `MessagePart` and aggregate into `CanonicalMessage`.
- Maintain a message accumulator during streaming; flush to canonical on `finish` or tool result boundaries.

Pseudo-interface:

```ts
import type { TextStreamPart } from "ai";
import type { CanonicalMessage } from "@boardgame-ref/agent-types";

export function updateFromStreamPart(
  part: TextStreamPart,
  state: MessageListState,
): void;
export function flushToCanonical(
  state: MessageListState,
): CanonicalMessage | null;
```

## MessageList aggregator (agent package)

- In-memory accumulator for streaming parts.
- Tracks pending text, tool calls, tool results, reasoning.
- Produces a `CanonicalMessage` when a logical boundary is reached (finish, tool result, etc.).

## DB layer (backend)

### Schema (example)

Use `jsonb` for `content` to keep storage stable.

```ts
export const conversationMessage = pgTable("conversation_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull(),
  role: text("role").notNull(),
  type: text("type").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resourceId: text("resource_id"),
});
```

### Storage adapter interface

```ts
export interface MemoryStore {
  listMessages(args: {
    threadId: string;
    limit?: number;
    orderBy?: "asc" | "desc";
  }): Promise<CanonicalMessage[]>;
  saveMessages(args: { messages: CanonicalMessage[] }): Promise<void>;
  getThreadById(args: { threadId: string }): Promise<Thread | null>;
  saveThread(args: { thread: Thread }): Promise<void>;
}
```

`backend` implements this using Drizzle and maps rows <-> `CanonicalMessage`.

## Agent class (skeleton)

Located in `packages/agent/src/agent.ts`.

```ts
export class Agent {
  constructor(private opts: { model: unknown; store: MemoryStore }) {}

  async stream(): Promise<void> {
    // TODO: invoke AI SDK v6, aggregate stream parts, persist messages
  }
}
```

## Data flow summary

1. Backend loads `CanonicalMessage[]` from Postgres.
2. Agent converts canonical messages to AI SDK v6 `ModelMessage[]` and calls `streamText`.
3. Stream parts are converted to `MessagePart[]` and aggregated into a `CanonicalMessage`.
4. Backend persists `CanonicalMessage` to Postgres via Drizzle.

## Open questions

- Should tool-result messages be separate rows or merged into a single assistant message?
- How much AI SDK provider metadata should be stored (and where)?
- Should we store reasoning parts in DB or keep them ephemeral?

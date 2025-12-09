# BoardGame Ref - Design Document

## Problem Statement

During boardgame sessions, rule disagreements require lengthy searches through rulebooks, internet searches, or LLM queries that frequently hallucinate. Players need instant, accurate rule clarifications with exact rulebook references.

## Requirements

- Provide LLM-like conversational experience
- Zero hallucinations - only use actual rulebook content
- Always cite exact paragraph/section from rulebook
- Fast lookup during gameplay
- Handle complex rule interactions

## Technology Stack

- **Runtime**: Bun (JavaScript/TypeScript runtime & package manager)
- **Backend Framework**: Elysia (Fast, type-safe web framework for Bun)
- **Web Client**: React + TypeScript
- **Mobile Client**: React Native + TypeScript
- **Vector Database**: PostgreSQL with pgvector extension
- **State Database**: PostgreSQL (conversation history, LangGraph checkpoints)
- **LLM Providers**: OpenAI (embeddings, completions), Anthropic (completions)

## Architecture Overview

```txt
┌──────────────────────────────────────────────────────────────┐
│           DATA PREPARATION (Run Once/Periodically)           │
│                                                              │
│  ┌──────────────────────┐                                    │
│  │     Rulebook PDFs    │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
│             ▼                                                │
│  ┌──────────────────────┐                                    │
│  │  Ingestion Pipeline  │                                    │
│  │   (Bun + TypeScript) │                                    │
│  │                      │                                    │
│  │  • PDF Parser        │                                    │
│  │  • Chunker           │                                    │
│  │  • Embedder (OpenAI) │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
│             │ writes chunks                                  │
└─────────────┼────────────────────────────────────────────────┘
              │
              ▼
     ┌────────────────┐
     │   Vector DB    │
     │   PostgreSQL   │
     │   pgvector     │
     └────────┬───────┘
              │
              │ reads
              │
┌─────────────┼────────────────────────────────────────────────┐
│             │         RUNTIME (User-facing)                  │
│             │                                                │
│  ┌──────────────────┐                                        │
│  │   Web Client     │────┐                                   │
│  │   (React/TS)     │    │                                   │
│  └──────────────────┘    │ HTTP                              │
│                          │                                   │
│  ┌──────────────────┐    │                                   │
│  │  Mobile Client   │────┤                                   │
│  │ (React Native)   │    │                                   │
│  └──────────────────┘    │                                   │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐    │
│  │         Elysia Backend (Bun + TypeScript)            │    │
│  │                                                      │    │
│  │  ┌───────────────────────────────────────────────┐   │    │
│  │  │  API Routes (Elysia)                          │   │    │
│  │  │  • POST /api/query                            │   │    │
│  │  │  • POST /api/query/continue                   │   │    │
│  │  │  • GET  /api/games                            │   │    │
│  │  │  • POST /admin/ingest                         │   │    │
│  │  └───────────────────┬───────────────────────────┘   │    │
│  │                      │                               │    │
│  │  ┌───────────────────▼───────────────────────────┐   │    │
│  │  │  LangGraph Workflow Engine                    │   │    │
│  │  │                                               │   │    │
│  │  │   State Graph:                                │   │    │
│  │  │   detectGame → askClarification               │   │    │
│  │  │             ↘         ↓                       │   │    │
│  │  │               retrieve                        │   │    │
│  │  │                  ↓                            │   │    │
│  │  │               checkConfidence                 │   │    │
│  │  │                  ↓                            │   │    │
│  │  │               generate                        │   │    │
│  │  │                                               │   │    │
│  │  │  • State persistence (checkpointing)          │   │    │
│  │  │  • Resume from saved state                    │   │    │
│  │  └───────────────────┬───────────────────────────┘   │    │
│  │                      │                               │    │
│  │  ┌───────────────────▼───────────────────────────┐   │    │
│  │  │  RAG Functions (used by graph nodes)          │   │    │
│  │  │  • retrieval.ts                               │   │    │
│  │  │  • generation.ts                              │   │    │
│  │  │  • citations.ts                               │   │    │
│  │  │  • detection.ts                               │   │    │
│  │  └───────────────────┬───────────────────────────┘   │    │
│  │                      │                               │    │
│  │  ┌───────────────────▼───────────────────────────┐   │    │
│  │  │  Services Layer                               │   │    │
│  │  │  • vectordb.service.ts                        │   │    │
│  │  │  • llm.service.ts                             │   │    │
│  │  └───────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│                     ┌──────────────┐                         │
│                     │  PostgreSQL  │                         │
│                     │  (LangGraph  │                         │
│                     │ checkpoints +│                         │
│                     │conversation) │                         │
│                     └──────────────┘                         │
│                                                              │
│         ┌──────────────────────────────────────┐             │
│         │  External APIs                       │             │
│         │  • OpenAI (embeddings, completions)  │             │
│         │  • Anthropic (completions)           │             │
│         └──────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Ingestion Pipeline

- Parse rulebook PDFs → preserve section numbers/structure
- Chunk by logical sections (not arbitrary tokens)
- Store chunks with metadata: {chunk_text, section_id, page_num, metadata}
- Embed chunks → Vector DB

### 2. Retrieval

- Embed user query
- Top-K similarity search (K=5-10)
- Return ranked chunks with metadata

### 3. Generation

- Prompt: "Answer ONLY using these rulebook sections. Quote exact text. If unsure, say so."
- LLM synthesizes answer
- Force citation format: "According to Section 4.2..."

### 4. Response

- Answer + inline citations
- Display actual rulebook text snippets

## Critical Design Decisions

### Chunking Strategy

- Respect rulebook hierarchy (sections/subsections) over fixed token sizes
- Rationale: Rules often span multiple sentences; breaking mid-concept reduces accuracy

### Anti-Hallucination Measures

- Constrained prompting: Only answer from provided context
- Show retrieved context to user
- No generation without retrieval results

## Future Enhancements

- Reranking after retrieval
- Hybrid search (vector + keyword)
- Multi-hop for rules that reference other rules
- Multi-game support

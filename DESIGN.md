# BoardGame Ref - Design Document

## Problem Statement

During boardgame sessions, rule disagreements require lengthy searches through rulebooks, internet searches, or LLM queries that frequently hallucinate. Players need instant, accurate rule clarifications with exact rulebook references.

## Requirements

- Provide LLM-like conversational experience
- Zero hallucinations - only use actual rulebook content
- Always cite exact paragraph/section from rulebook
- Fast lookup during gameplay
- Handle complex rule interactions
- Transparent search process - users can see how rules are discovered

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
│  │  • Section Extractor │                                    │
│  │  • Indexer           │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
│             │ writes structured rulebook data                │
└─────────────┼────────────────────────────────────────────────┘
              │
              ▼
     ┌────────────────┐
     │   PostgreSQL   │
     │  (Rulebooks +  │
     │   Sections +   │
     │   Full-text    │
     │    search)     │
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
│  │  │  • POST /api/chat/stream                      │   │    │
│  │  │  • GET  /api/games                            │   │    │
│  │  │  • POST /admin/ingest                         │   │    │
│  │  └───────────────────┬───────────────────────────┘   │    │
│  │                      │                               │    │
│  │  ┌───────────────────▼───────────────────────────┐   │    │
│  │  │  Agentic Workflow (OpenAI Agents SDK)         │   │    │
│  │  │                                               │   │    │
│  │  │  Agent receives user query and uses tools     │   │    │
│  │  │  to discover relevant rules:                  │   │    │
│  │  │                                               │   │    │
│  │  │  Available Tools:                             │   │    │
│  │  │  • search_rules(keywords, rulebook_id)        │   │    │
│  │  │  • get_section(section_id)                    │   │    │
│  │  │  • list_rulebooks(game_id)                    │   │    │
│  │  │  • search_toc(keywords, rulebook_id)          │   │    │
│  │  │                                               │   │    │
│  │  │  The agent:                                   │   │    │
│  │  │  1. Explores using keywords/search            │   │    │
│  │  │  2. Reads relevant sections                   │   │    │
│  │  │  3. Synthesizes answer from findings          │   │    │
│  │  │  4. Cites exact sections used                 │   │    │
│  │  │                                               │   │    │
│  │  │  • Full transparency - user sees all searches │   │    │
│  │  │  • State persistence (checkpointing)          │   │    │
│  │  └───────────────────┬───────────────────────────┘   │    │
│  │                      │                               │    │
│  │  ┌───────────────────▼───────────────────────────┐   │    │
│  │  │  Tool Implementations                         │   │    │
│  │  │  • search.service.ts (keyword/full-text)      │   │    │
│  │  │  • rulebook.service.ts (section retrieval)    │   │    │
│  │  │  • game.service.ts (game/rulebook metadata)   │   │    │
│  │  └───────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│                     ┌──────────────┐                         │
│                     │  PostgreSQL  │                         │
│                     │  (Rulebooks, │                         │
│                     │   Sections,  │                         │
│                     │Conversations)│                         │
│                     └──────────────┘                         │
│                                                              │
│         ┌──────────────────────────────────────┐             │
│         │  External APIs                       │             │
│         │  • OpenAI (agent reasoning)          │             │
│         │  • Anthropic (agent reasoning)       │             │
│         └──────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

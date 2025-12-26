import { t } from "elysia";

/**
 * Ingestion module validation models
 *
 * Following Elysia best practices:
 * - Use Elysia.t for validation (single source of truth)
 * - Extract TypeScript types using typeof model.static
 * - Group related models in namespaces
 */

// Request models
export const IngestionModel = {
  ingestGame: t.Object({
    boardgameName: t.String({ minLength: 1 }),
    // Use t.Numeric() for multipart/form-data - accepts numeric strings and converts to number
    yearPublished: t.Numeric({
      minimum: 1900,
      maximum: new Date().getFullYear(),
    }),
    bggId: t.Numeric({ minimum: 1 }),
    rulebookTitle: t.String({ minLength: 1 }),
    rulebookPdfFile: t.File({ type: "application/pdf" }),
    rulebookType: t.Optional(
      t.Union([
        t.Literal("base"),
        t.Literal("expansion"),
        t.Literal("quickstart"),
        t.Literal("reference"),
        t.Literal("faq"),
        t.Literal("other"),
      ]),
    ),
    language: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
  }),
};

// Response models
export const IngestionResponse = {
  ingestGameResult: t.Object({
    gameId: t.String(),
    rulebookId: t.String(),
    chunksCreated: t.Number(),
  }),

  error: t.Object({
    error: t.String(),
  }),
};

// Extract TypeScript types from models
export type IngestGameBody = typeof IngestionModel.ingestGame.static;
export type IngestGameResult = typeof IngestionResponse.ingestGameResult.static;
export type ErrorResponse = typeof IngestionResponse.error.static;

import { t } from "elysia";

export const ApiErrorResponseSchema = t.Object({
  errorCode: t.String(),
  errorMessage: t.String(),
  requestId: t.Optional(t.String()),
  details: t.Optional(t.Record(t.String(), t.Any())),
});

export type ApiErrorResponse = typeof ApiErrorResponseSchema.static;

export class ApiError extends Error {
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

import { ApiError } from "../errors";

export const IngestionErrorCodes = {
  Failed: "INGESTION_FAILED",
} as const;

export class IngestionError extends ApiError {
  static failed(reason?: string) {
    return new IngestionError(
      400,
      IngestionErrorCodes.Failed,
      reason ?? "Ingestion failed.",
    );
  }
}

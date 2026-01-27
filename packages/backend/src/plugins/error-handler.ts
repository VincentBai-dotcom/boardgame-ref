import { Elysia } from "elysia";
import { configService } from "../modules/config";
import { ApiError } from "../modules/errors";
import { AuthError } from "../modules/auth/errors";
import { ChatError } from "../modules/chat/errors";
import { UserError } from "../modules/user/errors";
import { IngestionError } from "../modules/ingestion/errors";

const includeDetails =
  process.env.ERROR_DETAILS_ENABLED === "true" || !configService.isProduction;

export const errorHandler = new Elysia({ name: "error-handler" })
  .error({ ApiError, AuthError, ChatError, UserError, IngestionError })
  .onError(({ code, error, set }) => {
    const requestId = set.headers["x-request-id"];

    if (error instanceof ApiError) {
      set.status = error.status;
      return {
        errorCode: error.code,
        errorMessage: error.message,
        requestId: requestId,
        details: includeDetails ? error.details : undefined,
      };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Invalid request.",
        requestId: requestId,
        details: includeDetails
          ? { reason: error instanceof Error ? error.message : String(error) }
          : undefined,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        errorCode: "NOT_FOUND",
        errorMessage: "Not found.",
        requestId: requestId,
      };
    }

    set.status = 500;
    return {
      errorCode: "INTERNAL_SERVER_ERROR",
      errorMessage: "Something went wrong.",
      requestId: requestId,
    };
  })
  .as("scoped");

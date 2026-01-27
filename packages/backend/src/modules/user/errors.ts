import { ApiError } from "../errors";

export const UserErrorCodes = {
  NotFound: "USER_NOT_FOUND",
} as const;

export class UserError extends ApiError {
  static notFound(userId: string) {
    return new UserError(404, UserErrorCodes.NotFound, "User not found.", {
      userId,
    });
  }
}

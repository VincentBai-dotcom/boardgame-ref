import { ApiError } from "../errors";

export const AuthErrorCodes = {
  Unauthorized: "AUTH_UNAUTHORIZED",
  Forbidden: "AUTH_FORBIDDEN",
  OAuthNotConfigured: "AUTH_OAUTH_NOT_CONFIGURED",
  OAuthRedirectUriMissing: "AUTH_OAUTH_REDIRECT_URI_MISSING",
  OAuthProviderUnsupported: "AUTH_OAUTH_PROVIDER_UNSUPPORTED",
  InvalidOAuthState: "AUTH_INVALID_OAUTH_STATE",
  OAuthExchangeFailed: "AUTH_OAUTH_EXCHANGE_FAILED",
  OAuthIdTokenMissing: "AUTH_OAUTH_ID_TOKEN_MISSING",
  OAuthNonceMismatch: "AUTH_OAUTH_NONCE_MISMATCH",
  OAuthEmailMissing: "AUTH_OAUTH_EMAIL_MISSING",
  OAuthEmailLinkedToOtherProvider: "AUTH_OAUTH_EMAIL_LINKED_TO_OTHER_PROVIDER",
  OAuthEmailRequiresPasswordLink: "AUTH_OAUTH_EMAIL_REQUIRES_PASSWORD_LINK",
  OAuthLinkFailed: "AUTH_OAUTH_LINK_FAILED",
  InvalidCredentials: "AUTH_INVALID_CREDENTIALS",
  UserAlreadyExists: "AUTH_USER_ALREADY_EXISTS",
  OAuthLoginRequired: "AUTH_OAUTH_LOGIN_REQUIRED",
  MissingRefreshToken: "AUTH_MISSING_REFRESH_TOKEN",
  InvalidRefreshToken: "AUTH_INVALID_REFRESH_TOKEN",
  RefreshTokenExpiredOrRevoked: "AUTH_REFRESH_TOKEN_EXPIRED_OR_REVOKED",
  RegisterFailed: "AUTH_REGISTER_FAILED",
  RegisterAdminFailed: "AUTH_REGISTER_ADMIN_FAILED",
} as const;

export class AuthError extends ApiError {
  static unauthorized() {
    return new AuthError(401, AuthErrorCodes.Unauthorized, "Unauthorized.");
  }

  static forbidden() {
    return new AuthError(403, AuthErrorCodes.Forbidden, "Forbidden.");
  }

  static oauthNotConfigured() {
    return new AuthError(
      500,
      AuthErrorCodes.OAuthNotConfigured,
      "OAuth is not configured.",
    );
  }

  static oauthRedirectUriMissing() {
    return new AuthError(
      500,
      AuthErrorCodes.OAuthRedirectUriMissing,
      "OAuth redirect URI is not configured.",
    );
  }

  static oauthProviderUnsupported(provider: string) {
    return new AuthError(
      400,
      AuthErrorCodes.OAuthProviderUnsupported,
      "Unsupported OAuth provider.",
      { provider },
    );
  }

  static invalidOAuthState() {
    return new AuthError(
      401,
      AuthErrorCodes.InvalidOAuthState,
      "Invalid OAuth state.",
    );
  }

  static oauthExchangeFailed(message?: string) {
    return new AuthError(
      401,
      AuthErrorCodes.OAuthExchangeFailed,
      "OAuth token exchange failed.",
      message ? { reason: message } : undefined,
    );
  }

  static oauthIdTokenMissing() {
    return new AuthError(
      401,
      AuthErrorCodes.OAuthIdTokenMissing,
      "OAuth token response missing id_token.",
    );
  }

  static oauthNonceMismatch() {
    return new AuthError(
      401,
      AuthErrorCodes.OAuthNonceMismatch,
      "OAuth id_token nonce mismatch.",
    );
  }

  static oauthEmailMissing() {
    return new AuthError(
      401,
      AuthErrorCodes.OAuthEmailMissing,
      "OAuth provider did not return an email.",
    );
  }

  static oauthEmailLinkedToOtherProvider(provider: string) {
    return new AuthError(
      409,
      AuthErrorCodes.OAuthEmailLinkedToOtherProvider,
      `This email is already linked to ${provider}. Please sign in with ${provider} instead.`,
      { provider },
    );
  }

  static oauthEmailRequiresPasswordLink() {
    return new AuthError(
      409,
      AuthErrorCodes.OAuthEmailRequiresPasswordLink,
      "Email already registered; please log in with your password to link accounts.",
    );
  }

  static oauthLinkFailed() {
    return new AuthError(
      500,
      AuthErrorCodes.OAuthLinkFailed,
      "Failed to link OAuth account.",
    );
  }

  static invalidCredentials() {
    return new AuthError(
      401,
      AuthErrorCodes.InvalidCredentials,
      "Invalid credentials.",
    );
  }

  static userAlreadyExists(email: string) {
    return new AuthError(
      409,
      AuthErrorCodes.UserAlreadyExists,
      `User already exists with email: ${email}`,
      { email },
    );
  }

  static oauthLoginRequired(provider: string) {
    return new AuthError(
      401,
      AuthErrorCodes.OAuthLoginRequired,
      `This email is registered via ${provider}. Please sign in with ${provider} instead.`,
      { provider },
    );
  }

  static missingRefreshToken() {
    return new AuthError(
      401,
      AuthErrorCodes.MissingRefreshToken,
      "Missing refresh token.",
    );
  }

  static invalidRefreshToken(message?: string) {
    return new AuthError(
      401,
      AuthErrorCodes.InvalidRefreshToken,
      "Invalid refresh token.",
      message ? { reason: message } : undefined,
    );
  }

  static refreshTokenExpiredOrRevoked() {
    return new AuthError(
      401,
      AuthErrorCodes.RefreshTokenExpiredOrRevoked,
      "Refresh token expired or revoked.",
    );
  }

  static registerFailed(message?: string) {
    return new AuthError(
      400,
      AuthErrorCodes.RegisterFailed,
      message ?? "Registration failed.",
    );
  }

  static registerAdminFailed(message?: string) {
    return new AuthError(
      400,
      AuthErrorCodes.RegisterAdminFailed,
      message ?? "Admin registration failed.",
    );
  }
}

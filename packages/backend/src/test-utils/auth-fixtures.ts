import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { refreshToken } from "../modules/db/schema/auth";

type RefreshToken = InferSelectModel<typeof refreshToken>;
type NewRefreshToken = InferInsertModel<typeof refreshToken>;

export interface TokenMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AccessPayload {
  sub: string;
  type: "access";
  exp?: number;
  iat?: number;
}

export interface RefreshPayload {
  sub: string;
  type: "refresh";
  jti: string;
  exp?: number;
  iat?: number;
}

/**
 * Creates a mock RefreshToken object with default values
 * @param overrides - Partial refresh token data to override defaults
 * @returns Complete RefreshToken object
 */
export function createMockRefreshToken(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  const now = new Date("2024-01-01T00:00:00Z");
  const thirtyDaysLater = new Date("2024-01-31T00:00:00Z");

  return {
    id: "token-123e4567-e89b-12d3-a456-426614174000",
    userId: "user-123e4567-e89b-12d3-a456-426614174000",
    tokenHash:
      "abc123def456789abc123def456789abc123def456789abc123def456789abc1",
    issuedAt: now,
    expiresAt: thirtyDaysLater,
    lastUsedAt: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ipAddress: "192.168.1.1",
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}

/**
 * Creates a mock NewRefreshToken object for insert operations
 * @param overrides - Partial refresh token data to override defaults
 * @returns NewRefreshToken object ready for insertion
 */
export function createMockNewRefreshToken(
  overrides: Partial<NewRefreshToken> = {},
): NewRefreshToken {
  const now = new Date("2024-01-01T00:00:00Z");
  const thirtyDaysLater = new Date("2024-01-31T00:00:00Z");

  return {
    userId: "user-123e4567-e89b-12d3-a456-426614174000",
    tokenHash:
      "abc123def456789abc123def456789abc123def456789abc123def456789abc1",
    expiresAt: thirtyDaysLater,
    issuedAt: now,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ipAddress: "192.168.1.1",
    ...overrides,
  };
}

/**
 * Creates a mock expired RefreshToken
 * @param overrides - Partial refresh token data to override defaults
 * @returns RefreshToken with expiresAt in the past
 */
export function createMockExpiredRefreshToken(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  return createMockRefreshToken({
    issuedAt: new Date("2023-12-01T00:00:00Z"),
    expiresAt: new Date("2023-12-31T00:00:00Z"), // Expired
    ...overrides,
  });
}

/**
 * Creates a mock revoked RefreshToken
 * @param overrides - Partial refresh token data to override defaults
 * @returns RefreshToken with revokedAt set
 */
export function createMockRevokedRefreshToken(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  return createMockRefreshToken({
    revokedAt: new Date("2024-01-15T00:00:00Z"),
    revokedReason: "logout",
    lastUsedAt: new Date("2024-01-15T00:00:00Z"),
    ...overrides,
  });
}

/**
 * Creates a mock access token string
 * @returns JWT-like access token string
 */
export function createMockAccessToken(): string {
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTY0MDk5NjEwMH0.mock_access_signature";
}

/**
 * Creates a mock refresh token string
 * @returns JWT-like refresh token string
 */
export function createMockJwtToken(): string {
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInR5cGUiOiJyZWZyZXNoIiwianRpIjoidG9rZW4taWQtMTIzIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE2NDM1ODcyMDB9.mock_refresh_signature";
}

/**
 * Creates a SHA256 hash of a token string (matching AuthService.hashToken pattern)
 * @param token - Token string to hash
 * @returns SHA256 hash as hex string
 */
export function createMockTokenHash(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

/**
 * Creates mock token metadata
 * @param overrides - Partial metadata to override defaults
 * @returns TokenMeta object
 */
export function createMockTokenMeta(
  overrides: Partial<TokenMeta> = {},
): TokenMeta {
  return {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ipAddress: "192.168.1.1",
    ...overrides,
  };
}

/**
 * Creates mock access token payload
 * @param overrides - Partial payload to override defaults
 * @returns AccessPayload object
 */
export function createMockAccessPayload(
  overrides: Partial<AccessPayload> = {},
): AccessPayload {
  return {
    sub: "user-123e4567-e89b-12d3-a456-426614174000",
    type: "access",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
    ...overrides,
  };
}

/**
 * Creates mock refresh token payload
 * @param overrides - Partial payload to override defaults
 * @returns RefreshPayload object
 */
export function createMockRefreshPayload(
  overrides: Partial<RefreshPayload> = {},
): RefreshPayload {
  return {
    sub: "user-123e4567-e89b-12d3-a456-426614174000",
    type: "refresh",
    jti: "token-id-123e4567-e89b-12d3-a456-426614174000",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 2592000, // 30 days
    ...overrides,
  };
}

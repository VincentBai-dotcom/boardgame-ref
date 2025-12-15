import { mock } from "bun:test";

export interface MockJwtPlugin {
  sign: ReturnType<typeof mock>;
  verify: ReturnType<typeof mock>;
}

export interface JwtPayload {
  sub: string;
  type: "access" | "refresh";
  jti?: string;
  exp?: number;
  iat?: number;
}

export interface JwtPluginConfig {
  signResult?: string | ((payload: JwtPayload) => string);
  verifyResult?: JwtPayload | false | ((token: string) => JwtPayload | false);
}

/**
 * Creates a mock JWT plugin with sign and verify methods
 * @param config - Configuration for mock behavior
 * @param config.signResult - Custom sign result or function
 * @param config.verifyResult - Custom verify result or function
 * @returns MockJwtPlugin object with sign and verify mocks
 */
export function createMockJwtPlugin(
  config: JwtPluginConfig = {},
): MockJwtPlugin {
  const sign = mock(async (payload: JwtPayload): Promise<string> => {
    if (typeof config.signResult === "function") {
      return config.signResult(payload);
    }
    if (config.signResult) {
      return config.signResult;
    }
    // Default: create a mock token based on payload
    return `mock_jwt_${payload.type}_${payload.sub}`;
  });

  const verify = mock(async (token: string): Promise<JwtPayload | false> => {
    if (typeof config.verifyResult === "function") {
      return config.verifyResult(token);
    }
    if (config.verifyResult !== undefined) {
      return config.verifyResult;
    }
    // Default: return a basic valid payload
    return { sub: "user-123", type: "access" };
  });

  return { sign, verify };
}

/**
 * Creates a mock access JWT plugin pre-configured for access tokens
 * @returns MockJwtPlugin configured for access tokens
 */
export function createMockAccessJwt(): MockJwtPlugin {
  return createMockJwtPlugin({
    signResult: (payload) => `mock_access_token_${payload.sub}_${Date.now()}`,
    verifyResult: {
      sub: "user-123e4567-e89b-12d3-a456-426614174000",
      type: "access",
    },
  });
}

/**
 * Creates a mock refresh JWT plugin pre-configured for refresh tokens
 * @returns MockJwtPlugin configured for refresh tokens
 */
export function createMockRefreshJwt(): MockJwtPlugin {
  return createMockJwtPlugin({
    signResult: (payload) => `mock_refresh_token_${payload.sub}_${payload.jti}`,
    verifyResult: {
      sub: "user-123e4567-e89b-12d3-a456-426614174000",
      type: "refresh",
      jti: "token-id-123e4567-e89b-12d3-a456-426614174000",
    },
  });
}

/**
 * Creates a mock JWT context for Elysia route testing
 * @param overrides - Partial context to override defaults
 * @returns Object with accessJwt and refreshJwt mocks
 */
export function mockJwtContext(
  overrides: {
    accessJwt?: MockJwtPlugin;
    refreshJwt?: MockJwtPlugin;
  } = {},
): {
  accessJwt: MockJwtPlugin;
  refreshJwt: MockJwtPlugin;
} {
  return {
    accessJwt: overrides.accessJwt || createMockAccessJwt(),
    refreshJwt: overrides.refreshJwt || createMockRefreshJwt(),
  };
}

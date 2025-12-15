/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "bun:test";

let originalHash: typeof Bun.password.hash | undefined;
let originalVerify: typeof Bun.password.verify | undefined;

export interface BunPasswordMockConfig {
  hashResult?: string;
  verifyResult?: boolean;
}

/**
 * Mocks Bun.password.hash and Bun.password.verify for testing
 * @param config - Configuration for mock behavior
 * @param config.hashResult - Custom hash result (default: "hashed_{password}")
 * @param config.verifyResult - Custom verify result (default: true)
 */
export function mockBunPassword(config: BunPasswordMockConfig = {}): void {
  // Store original implementations
  originalHash = Bun.password.hash;
  originalVerify = Bun.password.verify;

  // Replace with mocks
  (Bun.password as any).hash = mock(
    async (password: string, options?: any): Promise<string> => {
      return config.hashResult || `hashed_${password}`;
    },
  );

  (Bun.password as any).verify = mock(
    async (password: string, hash: string): Promise<boolean> => {
      return config.verifyResult ?? true;
    },
  );
}

/**
 * Restores original Bun.password.hash and Bun.password.verify implementations
 */
export function restoreBunPassword(): void {
  if (originalHash) {
    Bun.password.hash = originalHash;
  }
  if (originalVerify) {
    Bun.password.verify = originalVerify;
  }
}

/**
 * Creates a spy for Bun.password.hash with a custom return value
 * @param returnValue - Value to return from hash (default: "hashed_password_123")
 * @returns Mock function
 */
export function createHashSpy(returnValue?: string): ReturnType<typeof mock> {
  return mock(async (password: string) => {
    return returnValue || "hashed_password_123";
  });
}

/**
 * Creates a spy for Bun.password.verify with a custom return value
 * @param returnValue - Value to return from verify (default: true)
 * @returns Mock function
 */
export function createVerifySpy(
  returnValue?: boolean,
): ReturnType<typeof mock> {
  return mock(async (password: string, hash: string) => {
    return returnValue ?? true;
  });
}

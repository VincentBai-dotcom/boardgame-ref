import { mock } from "bun:test";

/**
 * Creates a mock Bun SQL client
 * @returns Mock SQL client with connection methods
 */
export function createMockSQLClient() {
  return {
    connect: mock(() => Promise.resolve()),
    close: mock(() => Promise.resolve()),
    execute: mock(() => Promise.resolve({ rows: [] })),
  };
}

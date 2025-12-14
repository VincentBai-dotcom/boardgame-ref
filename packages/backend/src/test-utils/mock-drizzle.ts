/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "bun:test";

/**
 * Creates a mock SELECT query builder with chainable methods
 * @param returnValue - The data to return when the query executes
 * @returns Mock SELECT query builder
 */
export function createMockSelectBuilder(returnValue: any[] = []) {
  const builder: any = {
    from: mock(() => builder),
    where: mock(() => builder),
    limit: mock(() => builder),
    offset: mock(() => builder),
    orderBy: mock(() => builder),
    $dynamic: mock(() => builder),
    // Make the builder promise-like so it can be awaited
    then: mock((resolve: any) => resolve(returnValue)),
  };
  return builder;
}

/**
 * Creates a mock INSERT query builder with chainable methods
 * @param returnValue - The data to return when the query executes
 * @returns Mock INSERT query builder
 */
export function createMockInsertBuilder(returnValue: any[] = []) {
  const builder: any = {
    values: mock(() => builder),
    returning: mock(() => builder),
    // Make the builder promise-like so it can be awaited
    then: mock((resolve: any) => resolve(returnValue)),
  };
  return builder;
}

/**
 * Creates a mock UPDATE query builder with chainable methods
 * @param returnValue - The data to return when the query executes
 * @returns Mock UPDATE query builder
 */
export function createMockUpdateBuilder(returnValue: any[] = []) {
  const builder: any = {
    set: mock(() => builder),
    where: mock(() => builder),
    returning: mock(() => builder),
    // Make the builder promise-like so it can be awaited
    then: mock((resolve: any) => resolve(returnValue)),
  };
  return builder;
}

/**
 * Creates a mock DELETE query builder with chainable methods
 * @returns Mock DELETE query builder
 */
export function createMockDeleteBuilder() {
  const builder: any = {
    where: mock(() => builder),
    // Make the builder promise-like so it can be awaited
    then: mock((resolve: any) => resolve()),
  };
  return builder;
}

/**
 * Creates a mock Drizzle database instance
 * @returns Mock database with mocked query methods
 */
export function createMockDb() {
  return {
    execute: mock(() => Promise.resolve()),
    select: mock(() => createMockSelectBuilder()),
    insert: mock(() => createMockInsertBuilder()),
    update: mock(() => createMockUpdateBuilder()),
    delete: mock(() => createMockDeleteBuilder()),
  } as any;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { user } from "../../db/schema";
import {
  createMockDb,
  createMockSelectBuilder,
  createMockInsertBuilder,
  createMockUpdateBuilder,
  createMockDeleteBuilder,
} from "../../../test-utils/mock-drizzle";
import {
  createMockNewUser,
  createMockUser,
  createMockDeletedUser,
} from "../../../test-utils/user-fixtures";

describe("UserService", () => {
  let userService: import("../service").UserService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockDbService: { getDb: ReturnType<typeof mock> };

  beforeEach(async () => {
    mockDb = createMockDb();
    mockDbService = {
      getDb: mock(() => mockDb),
    };

    // Create UserService instance with mocked dbService
    const { UserService } = await import("../service");
    userService = new UserService(mockDbService as any);
  });

  afterEach(() => {
    mock.restore();
  });

  test("create inserts a new user when email is unique", async () => {
    const newUser = createMockNewUser({ email: "unique@example.com" });
    const createdUser = createMockUser({ email: newUser.email });

    const selectBuilder = createMockSelectBuilder([]);
    mockDb.select.mockReturnValue(selectBuilder);

    const insertBuilder = createMockInsertBuilder([createdUser]);
    mockDb.insert.mockReturnValue(insertBuilder);

    const result = await userService.create(newUser);

    expect(mockDbService.getDb).toHaveBeenCalled();
    expect(mockDb.select).toHaveBeenCalled();
    expect(selectBuilder.where).toHaveBeenCalled();
    expect(insertBuilder.values).toHaveBeenCalledWith(newUser);
    expect(insertBuilder.returning).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalledWith(user);
    expect(result).toEqual(createdUser);
  });

  test("create throws when a user with the email already exists", async () => {
    const newUser = createMockNewUser({ email: "duplicate@example.com" });
    const existingUser = createMockUser({ email: newUser.email });

    const selectBuilder = createMockSelectBuilder([existingUser]);
    mockDb.select.mockReturnValue(selectBuilder);

    await expect(userService.create(newUser)).rejects.toThrow(
      `User already exists with email: ${newUser.email}`,
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  test("findById returns the user when found", async () => {
    const expectedUser = createMockUser({ id: "user-123" });
    const selectBuilder = createMockSelectBuilder([expectedUser]);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.findById("user-123");

    expect(mockDb.select).toHaveBeenCalled();
    expect(selectBuilder.where).toHaveBeenCalled();
    expect(selectBuilder.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(expectedUser);
  });

  test("findById returns null when user does not exist", async () => {
    const selectBuilder = createMockSelectBuilder([]);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.findById("missing-id");

    expect(result).toBeNull();
  });

  test("findByEmail returns the user when found", async () => {
    const expectedUser = createMockUser({ email: "lookup@example.com" });
    const selectBuilder = createMockSelectBuilder([expectedUser]);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.findByEmail(expectedUser.email);

    expect(selectBuilder.where).toHaveBeenCalled();
    expect(result).toEqual(expectedUser);
  });

  test("findByOAuthProvider returns null when no match exists", async () => {
    const selectBuilder = createMockSelectBuilder([]);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.findByOAuthProvider(
      "google",
      "nonexistent",
    );

    expect(result).toBeNull();
    expect(selectBuilder.where).toHaveBeenCalled();
  });

  test("list applies default filters and pagination", async () => {
    const users = [createMockUser({ id: "user-1" })];
    const selectBuilder = createMockSelectBuilder(users);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.list();

    expect(selectBuilder.where).toHaveBeenCalled();
    expect(selectBuilder.orderBy).toHaveBeenCalled();
    expect(selectBuilder.limit).toHaveBeenCalledWith(100);
    expect(selectBuilder.offset).not.toHaveBeenCalled();
    expect(result).toEqual(users);
  });

  test("list can include deleted users without filtering", async () => {
    const users = [
      createMockUser({ id: "user-1" }),
      createMockDeletedUser({ id: "user-2" }),
    ];
    const selectBuilder = createMockSelectBuilder(users);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.list({ includeDeleted: true });

    expect(selectBuilder.where).not.toHaveBeenCalled();
    expect(result).toEqual(users);
  });

  test("update returns the updated user when a record is found", async () => {
    const updatedUser = createMockUser({ id: "user-123", email: "new@mail" });
    const updateBuilder = createMockUpdateBuilder([updatedUser]);
    mockDb.update.mockReturnValue(updateBuilder);

    const result = await userService.update("user-123", {
      email: updatedUser.email,
    });

    expect(mockDb.update).toHaveBeenCalledWith(user);
    expect(updateBuilder.set).toHaveBeenCalledWith({
      email: updatedUser.email,
      updatedAt: expect.any(Date),
    });
    expect(updateBuilder.returning).toHaveBeenCalled();
    expect(result).toEqual(updatedUser);
  });

  test("update returns null when no record is updated", async () => {
    const updateBuilder = createMockUpdateBuilder([]);
    mockDb.update.mockReturnValue(updateBuilder);

    const result = await userService.update("missing", { email: "none" });

    expect(result).toBeNull();
  });

  test("updateLastLogin sets lastLoginAt for the given user", async () => {
    const updateBuilder = createMockUpdateBuilder([]);
    mockDb.update.mockReturnValue(updateBuilder);

    await userService.updateLastLogin("user-123");

    expect(mockDb.update).toHaveBeenCalledWith(user);
    expect(updateBuilder.set).toHaveBeenCalledWith({
      lastLoginAt: expect.any(Date),
    });
    expect(updateBuilder.where).toHaveBeenCalled();
  });

  test("softDelete marks the user as deleted", async () => {
    const updateBuilder = createMockUpdateBuilder([]);
    mockDb.update.mockReturnValue(updateBuilder);

    await userService.softDelete("user-123");

    expect(updateBuilder.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
    });
    expect(updateBuilder.where).toHaveBeenCalled();
  });

  test("restore clears deletedAt and returns the restored user", async () => {
    const restoredUser = createMockUser({ deletedAt: null });
    const updateBuilder = createMockUpdateBuilder([restoredUser]);
    mockDb.update.mockReturnValue(updateBuilder);

    const result = await userService.restore("user-123");

    expect(updateBuilder.set).toHaveBeenCalledWith({ deletedAt: null });
    expect(updateBuilder.returning).toHaveBeenCalled();
    expect(result).toEqual(restoredUser);
  });

  test("hardDelete removes the user record", async () => {
    const deleteBuilder = createMockDeleteBuilder();
    mockDb.delete.mockReturnValue(deleteBuilder);

    await userService.hardDelete("user-123");

    expect(mockDb.delete).toHaveBeenCalledWith(user);
    expect(deleteBuilder.where).toHaveBeenCalled();
  });

  test("count returns the number of users", async () => {
    const countBuilder = createMockSelectBuilder([{ count: 5 }]);
    mockDb.select.mockReturnValue(countBuilder);

    const result = await userService.count();

    expect(countBuilder.where).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  test("count supports role filtering without deleted filter", async () => {
    const countBuilder = createMockSelectBuilder([{ count: 2 }]);
    mockDb.select.mockReturnValue(countBuilder);

    const result = await userService.count({
      includeDeleted: true,
      role: "admin",
    });

    expect(countBuilder.where).toHaveBeenCalled();
    expect(result).toBe(2);
  });

  test("existsByEmail returns true when a user is found", async () => {
    const expectedUser = createMockUser({ email: "exists@example.com" });
    const selectBuilder = createMockSelectBuilder([expectedUser]);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.existsByEmail(expectedUser.email);

    expect(result).toBe(true);
  });

  test("existsByEmail returns false when no user is found", async () => {
    const selectBuilder = createMockSelectBuilder([]);
    mockDb.select.mockReturnValue(selectBuilder);

    const result = await userService.existsByEmail("missing@example.com");

    expect(result).toBe(false);
  });
});

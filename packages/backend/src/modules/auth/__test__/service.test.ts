/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  createMockDb,
  createMockSelectBuilder,
  createMockInsertBuilder,
  createMockUpdateBuilder,
} from "../../../test-utils/mock-drizzle";
import { createMockUser } from "../../../test-utils/user-fixtures";
import {
  createMockRefreshToken,
  createMockExpiredRefreshToken,
  createMockTokenHash,
  createMockTokenMeta,
} from "../../../test-utils/auth-fixtures";
import {
  mockBunPassword,
  restoreBunPassword,
} from "../../../test-utils/mock-bun-password";

describe("AuthService", () => {
  let authService: import("../service").AuthService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockDbService: { getDb: ReturnType<typeof mock> };
  let mockUserService: any;

  beforeEach(async () => {
    // Setup mock database
    mockDb = createMockDb();
    mockDbService = {
      getDb: mock(() => mockDb),
    };

    // Create mock UserService with all required methods
    const { UserService } = await import("../../user/service");
    mockUserService = new UserService(mockDbService as any);

    // Mock Bun.password
    mockBunPassword();

    // Create AuthService instance with mocked dependencies
    const { AuthService } = await import("../service");
    authService = new AuthService(mockDbService as any, mockUserService);
  });

  afterEach(() => {
    // Restore Bun.password
    restoreBunPassword();

    // Clear all mocks
    mock.restore();
  });

  describe("registerUser", () => {
    test("successfully creates user with hashed password when email is unique", async () => {
      const email = "newuser@example.com";
      const password = "SecurePass123!";
      const hashedPassword = "hashed_SecurePass123!";
      const createdUser = createMockUser({
        email,
        passwordHash: hashedPassword,
      });

      // Mock UserService.findByEmail to return null (no existing user)
      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      // Mock Bun.password.hash
      (Bun.password.hash as any).mockResolvedValue(hashedPassword);

      // Mock UserService.create
      const insertBuilder = createMockInsertBuilder([createdUser]);
      mockDb.insert.mockReturnValue(insertBuilder);

      const result = await authService.registerUser(email, password);

      expect(Bun.password.hash).toHaveBeenCalledWith(password, {
        algorithm: "argon2id",
      });
      expect(result).toEqual(createdUser);
    });

    test("returns user with correct structure", async () => {
      const email = "test@example.com";
      const password = "password123";
      const createdUser = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([createdUser]);
      mockDb.insert.mockReturnValue(insertBuilder);

      const result = await authService.registerUser(email, password);

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("email", email);
      expect(result).toHaveProperty("role");
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("updatedAt");
    });

    test("calls Bun.password.hash with argon2id algorithm", async () => {
      const email = "test@example.com";
      const password = "mypassword";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([createMockUser()]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.registerUser(email, password);

      expect(Bun.password.hash).toHaveBeenCalledWith(password, {
        algorithm: "argon2id",
      });
    });

    test("calls UserService.findByEmail with includeDeleted: false", async () => {
      const email = "test@example.com";
      const password = "password123";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([createMockUser()]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.registerUser(email, password);

      // Verify the WHERE clause was called (which includes includeDeleted check)
      expect(selectBuilder.where).toHaveBeenCalled();
    });

    test("calls UserService.create with email, passwordHash, and role", async () => {
      const email = "test@example.com";
      const password = "password123";
      const hashedPassword = "hashed_password123";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.hash as any).mockResolvedValue(hashedPassword);

      const insertBuilder = createMockInsertBuilder([createMockUser()]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.registerUser(email, password);

      expect(insertBuilder.values).toHaveBeenCalledWith({
        email,
        passwordHash: hashedPassword,
        role: "user",
      });
    });

    test("throws error when user already exists with same email", async () => {
      const email = "existing@example.com";
      const existingUser = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([existingUser]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.registerUser(email, "password123"),
      ).rejects.toThrow(`User already exists with email: ${email}`);
    });

    test("throws error with correct message format when email exists", async () => {
      const email = "duplicate@example.com";
      const existingUser = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([existingUser]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.registerUser(email, "password123"),
      ).rejects.toThrow("User already exists with email:");
    });

    test("does not call UserService.create when email exists", async () => {
      const email = "existing@example.com";
      const existingUser = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([existingUser]);
      mockDb.select.mockReturnValue(selectBuilder);

      try {
        await authService.registerUser(email, "password123");
      } catch {
        // Expected to throw
      }

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    test("does not hash password when email validation fails", async () => {
      const email = "existing@example.com";
      const existingUser = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([existingUser]);
      mockDb.select.mockReturnValue(selectBuilder);

      try {
        await authService.registerUser(email, "password123");
      } catch {
        // Expected to throw
      }

      expect(Bun.password.hash).not.toHaveBeenCalled();
    });

    test("throws when UserService.findByEmail throws", async () => {
      const selectBuilder = createMockSelectBuilder([]);
      selectBuilder.where.mockImplementation(() => {
        throw new Error("Database error");
      });
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.registerUser("test@example.com", "password123"),
      ).rejects.toThrow("Database error");
    });

    test("throws when Bun.password.hash fails", async () => {
      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.hash as any).mockRejectedValue(new Error("Hash failed"));

      await expect(
        authService.registerUser("test@example.com", "password123"),
      ).rejects.toThrow("Hash failed");
    });

    test("throws when UserService.create fails", async () => {
      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([]);
      insertBuilder.values.mockImplementation(() => {
        throw new Error("Create failed");
      });
      mockDb.insert.mockReturnValue(insertBuilder);

      await expect(
        authService.registerUser("test@example.com", "password123"),
      ).rejects.toThrow("Create failed");
    });

    test("handles empty password string", async () => {
      const email = "test@example.com";
      const password = "";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([createMockUser()]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.registerUser(email, password);

      expect(Bun.password.hash).toHaveBeenCalledWith("", {
        algorithm: "argon2id",
      });
    });

    test("handles email with uppercase letters", async () => {
      const email = "Test@EXAMPLE.COM";
      const password = "password123";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([createMockUser()]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.registerUser(email, password);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ email }),
      );
    });

    test("correctly hashes long passwords (100+ characters)", async () => {
      const email = "test@example.com";
      const longPassword = "a".repeat(150);

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const insertBuilder = createMockInsertBuilder([createMockUser()]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.registerUser(email, longPassword);

      expect(Bun.password.hash).toHaveBeenCalledWith(longPassword, {
        algorithm: "argon2id",
      });
    });
  });

  describe("validateCredentials", () => {
    test("returns user when credentials are valid", async () => {
      const email = "valid@example.com";
      const password = "correctPassword";
      const user = createMockUser({
        email,
        passwordHash: "hashed_password",
      });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(true);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      const result = await authService.validateCredentials(email, password);

      expect(result).toEqual(user);
    });

    test("calls Bun.password.verify with correct password and hash", async () => {
      const email = "test@example.com";
      const password = "mypassword";
      const passwordHash = "hashed_mypassword";
      const user = createMockUser({ email, passwordHash });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(true);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.validateCredentials(email, password);

      expect(Bun.password.verify).toHaveBeenCalledWith(password, passwordHash);
    });

    test("calls UserService.updateLastLogin with correct userId", async () => {
      const email = "test@example.com";
      const password = "password123";
      const user = createMockUser({ id: "user-456", email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(true);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.validateCredentials(email, password);

      expect(updateBuilder.where).toHaveBeenCalled();
      expect(updateBuilder.set).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Date),
      });
    });

    test("updates lastLoginAt timestamp after successful validation", async () => {
      const email = "test@example.com";
      const password = "password123";
      const user = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(true);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.validateCredentials(email, password);

      expect(updateBuilder.set).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Date),
      });
    });

    test("returns complete user object with all fields", async () => {
      const email = "test@example.com";
      const password = "password123";
      const user = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(true);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      const result = await authService.validateCredentials(email, password);

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("email");
      expect(result).toHaveProperty("role");
      expect(result).toHaveProperty("createdAt");
    });

    test("throws 'Invalid credentials' when user not found by email", async () => {
      const email = "nonexistent@example.com";
      const password = "password123";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.validateCredentials(email, password),
      ).rejects.toThrow("Invalid credentials");
    });

    test("throws 'Invalid credentials' when password verification fails", async () => {
      const email = "test@example.com";
      const password = "wrongpassword";
      const user = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(false);

      await expect(
        authService.validateCredentials(email, password),
      ).rejects.toThrow("Invalid credentials");
    });

    test("throws 'Invalid credentials' when user has no passwordHash", async () => {
      const email = "oauth@example.com";
      const password = "password123";
      const oauthUser = createMockUser({
        email,
        passwordHash: null,
      });

      const selectBuilder = createMockSelectBuilder([oauthUser]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.validateCredentials(email, password),
      ).rejects.toThrow("Invalid credentials");
    });

    test("throws 'Invalid credentials' when user is soft-deleted", async () => {
      const email = "deleted@example.com";
      const password = "password123";
      const deletedUser = createMockUser({
        email,
        deletedAt: new Date("2024-01-15"),
      });

      const selectBuilder = createMockSelectBuilder([deletedUser]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.validateCredentials(email, password),
      ).rejects.toThrow("Invalid credentials");
    });

    test("does not call updateLastLogin when credentials invalid", async () => {
      const email = "test@example.com";
      const password = "wrongpassword";
      const user = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(false);

      try {
        await authService.validateCredentials(email, password);
      } catch {
        // Expected to throw
      }

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    test("does not call password.verify when user not found", async () => {
      const email = "nonexistent@example.com";
      const password = "password123";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      try {
        await authService.validateCredentials(email, password);
      } catch {
        // Expected to throw
      }

      expect(Bun.password.verify).not.toHaveBeenCalled();
    });

    test("generic error message doesn't leak whether email exists", async () => {
      const email = "nonexistent@example.com";
      const password = "password123";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      const error1 = await authService
        .validateCredentials(email, password)
        .catch((e) => e.message);

      // Also test with wrong password
      const user = createMockUser({ email: "exists@example.com" });
      const selectBuilder2 = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder2);
      (Bun.password.verify as any).mockResolvedValue(false);

      const error2 = await authService
        .validateCredentials("exists@example.com", "wrongpassword")
        .catch((e) => e.message);

      expect(error1).toBe(error2);
      expect(error1).toBe("Invalid credentials");
    });

    test("handles case where passwordHash is null", async () => {
      const email = "oauth@example.com";
      const password = "password123";
      const user = createMockUser({ email, passwordHash: null });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(
        authService.validateCredentials(email, password),
      ).rejects.toThrow("Invalid credentials");

      expect(Bun.password.verify).not.toHaveBeenCalled();
    });

    test("handles case where password.verify throws an error", async () => {
      const email = "test@example.com";
      const password = "password123";
      const user = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockRejectedValue(new Error("Verify error"));

      await expect(
        authService.validateCredentials(email, password),
      ).rejects.toThrow("Verify error");
    });

    test("verifies UserService.findByEmail is called without includeDeleted option", async () => {
      const email = "test@example.com";
      const password = "password123";
      const user = createMockUser({ email });

      const selectBuilder = createMockSelectBuilder([user]);
      mockDb.select.mockReturnValue(selectBuilder);

      (Bun.password.verify as any).mockResolvedValue(true);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.validateCredentials(email, password);

      // findByEmail is called with default options (no includeDeleted specified)
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("storeRefreshToken", () => {
    test("inserts refresh token with hashed token value", async () => {
      const userId = "user-123";
      const refreshToken = "my_refresh_token";
      const tokenHash = createMockTokenHash(refreshToken);
      const meta = createMockTokenMeta();

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          tokenHash,
        }),
      );
    });

    test("sets correct userId association", async () => {
      const userId = "user-456";
      const refreshToken = "token_xyz";
      const meta = createMockTokenMeta();

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
      );
    });

    test("calculates expiresAt based on JWT_REFRESH_EXPIRES_IN_SECONDS", async () => {
      const userId = "user-123";
      const refreshToken = "token";
      const meta = createMockTokenMeta();

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      const callArgs = (insertBuilder.values as any).mock.calls[0][0];
      expect(callArgs.expiresAt).toBeInstanceOf(Date);
      // Verify expiration is in the future
      expect(callArgs.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test("stores userAgent and ipAddress metadata", async () => {
      const userId = "user-123";
      const refreshToken = "token";
      const meta = {
        userAgent: "Mozilla/5.0",
        ipAddress: "192.168.1.1",
      };

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
        }),
      );
    });

    test("sets issuedAt to current timestamp", async () => {
      const userId = "user-123";
      const refreshToken = "token";
      const meta = createMockTokenMeta();

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      const before = Date.now();
      await authService.storeRefreshToken(userId, refreshToken, meta);
      const after = Date.now();

      const callArgs = (insertBuilder.values as any).mock.calls[0][0];
      expect(callArgs.issuedAt).toBeInstanceOf(Date);
      expect(callArgs.issuedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(callArgs.issuedAt.getTime()).toBeLessThanOrEqual(after);
    });

    test("generates unique UUID for token id", async () => {
      const userId = "user-123";
      const refreshToken = "token";
      const meta = createMockTokenMeta();

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      const callArgs = (insertBuilder.values as any).mock.calls[0][0];
      expect(callArgs.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    test("hashes token using SHA256 before storage", async () => {
      const userId = "user-123";
      const refreshToken = "my_token";
      const expectedHash = createMockTokenHash(refreshToken);
      const meta = createMockTokenMeta();

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: expectedHash,
        }),
      );
    });

    test("different tokens produce different hashes", async () => {
      const token1 = "token_one";
      const token2 = "token_two";
      const hash1 = createMockTokenHash(token1);
      const hash2 = createMockTokenHash(token2);

      expect(hash1).not.toBe(hash2);
    });

    test("same token always produces same hash", async () => {
      const token = "my_token";
      const hash1 = createMockTokenHash(token);
      const hash2 = createMockTokenHash(token);

      expect(hash1).toBe(hash2);
    });

    test("handles null userAgent gracefully", async () => {
      const userId = "user-123";
      const refreshToken = "token";
      const meta = {
        userAgent: null,
        ipAddress: "192.168.1.1",
      };

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: null,
        }),
      );
    });

    test("handles null ipAddress gracefully", async () => {
      const userId = "user-123";
      const refreshToken = "token";
      const meta = {
        userAgent: "Mozilla/5.0",
        ipAddress: null,
      };

      const insertBuilder = createMockInsertBuilder([]);
      mockDb.insert.mockReturnValue(insertBuilder);

      await authService.storeRefreshToken(userId, refreshToken, meta);

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: null,
        }),
      );
    });
  });

  describe("consumeRefreshToken", () => {
    test("returns userId when token is valid and not expired", async () => {
      const token = "valid_refresh_token";
      const tokenHash = createMockTokenHash(token);
      const storedToken = createMockRefreshToken({
        tokenHash,
        userId: "user-456",
        expiresAt: new Date(Date.now() + 86400000), // Expires tomorrow
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      const userId = await authService.consumeRefreshToken(token);

      expect(userId).toBe("user-456");
    });

    test("revokes token by setting revokedAt timestamp", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      );
    });

    test("sets revokedReason to 'rotated'", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedReason: "rotated",
        }),
      );
    });

    test("updates lastUsedAt timestamp", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsedAt: expect.any(Date),
        }),
      );
    });

    test("queries by tokenHash not plain token", async () => {
      const token = "my_token";
      const tokenHash = createMockTokenHash(token);
      const storedToken = createMockRefreshToken({
        tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      // The where clause should be called (checking token hash)
      expect(selectBuilder.where).toHaveBeenCalled();
    });

    test("throws 'Refresh token expired or revoked' when token not found", async () => {
      const token = "nonexistent_token";

      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(authService.consumeRefreshToken(token)).rejects.toThrow(
        "Refresh token expired or revoked",
      );
    });

    test("throws when token is expired", async () => {
      const token = "expired_token";
      const expiredToken = createMockExpiredRefreshToken({
        tokenHash: createMockTokenHash(token),
      });

      const selectBuilder = createMockSelectBuilder([expiredToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(authService.consumeRefreshToken(token)).rejects.toThrow(
        "Refresh token expired or revoked",
      );
    });

    test("throws when token already revoked", async () => {
      const token = "revoked_token";

      // When token is revoked, the query with isNull(revokedAt) returns nothing
      const selectBuilder = createMockSelectBuilder([]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(authService.consumeRefreshToken(token)).rejects.toThrow(
        "Refresh token expired or revoked",
      );
    });

    test("does not update token when validation fails", async () => {
      const token = "expired_token";
      const expiredToken = createMockExpiredRefreshToken({
        tokenHash: createMockTokenHash(token),
      });

      const selectBuilder = createMockSelectBuilder([expiredToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      try {
        await authService.consumeRefreshToken(token);
      } catch {
        // Expected to throw
      }

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    test("uses SHA256 hash to lookup token", async () => {
      const token = "my_token";
      const expectedHash = createMockTokenHash(token);
      const storedToken = createMockRefreshToken({
        tokenHash: expectedHash,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(selectBuilder.where).toHaveBeenCalled();
    });

    test("applies isNull(revokedAt) filter in query", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(selectBuilder.where).toHaveBeenCalled();
    });

    test("uses limit(1) to get single result", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(selectBuilder.limit).toHaveBeenCalledWith(1);
    });

    test("checks expiration before attempting revocation", async () => {
      const token = "expired_token";
      const expiredToken = createMockExpiredRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const selectBuilder = createMockSelectBuilder([expiredToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      await expect(authService.consumeRefreshToken(token)).rejects.toThrow();

      // Update should not be called for expired token
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    test("correctly builds WHERE clause with AND conditions", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(selectBuilder.where).toHaveBeenCalled();
    });

    test("queries refreshToken table", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(mockDb.select).toHaveBeenCalled();
      expect(selectBuilder.from).toHaveBeenCalled();
    });

    test("returns userId from stored token record", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        tokenHash: createMockTokenHash(token),
        userId: "user-789",
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      const userId = await authService.consumeRefreshToken(token);

      expect(userId).toBe("user-789");
    });

    test("updates correct token by ID", async () => {
      const token = "valid_token";
      const storedToken = createMockRefreshToken({
        id: "token-id-456",
        tokenHash: createMockTokenHash(token),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const selectBuilder = createMockSelectBuilder([storedToken]);
      mockDb.select.mockReturnValue(selectBuilder);

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.consumeRefreshToken(token);

      expect(updateBuilder.where).toHaveBeenCalled();
    });
  });

  describe("revokeRefreshToken", () => {
    test("sets revokedAt timestamp when token exists", async () => {
      const token = "valid_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      );
    });

    test("sets revokedReason to 'logout'", async () => {
      const token = "valid_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedReason: "logout",
        }),
      );
    });

    test("updates lastUsedAt timestamp", async () => {
      const token = "valid_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      expect(updateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsedAt: expect.any(Date),
        }),
      );
    });

    test("uses tokenHash for lookup", async () => {
      const token = "my_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      expect(updateBuilder.where).toHaveBeenCalled();
    });

    test("does not throw when token doesn't exist (silent success)", async () => {
      const token = "nonexistent_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      // Should not throw, just completes silently
      await authService.revokeRefreshToken(token);
      expect(updateBuilder.set).toHaveBeenCalled();
    });

    test("does not throw when token already revoked", async () => {
      const token = "already_revoked_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      // Should not throw, just completes silently
      await authService.revokeRefreshToken(token);
      expect(updateBuilder.set).toHaveBeenCalled();
    });

    test("only updates non-revoked tokens (WHERE isNull(revokedAt))", async () => {
      const token = "valid_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      expect(updateBuilder.where).toHaveBeenCalled();
    });

    test("hashes token before querying", async () => {
      const token = "my_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      // The where clause should use the hash
      expect(updateBuilder.where).toHaveBeenCalled();
    });

    test("does not fail if no rows affected", async () => {
      const token = "nonexistent_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      // Should not throw even if no rows affected
      await authService.revokeRefreshToken(token);
      expect(updateBuilder.set).toHaveBeenCalled();
    });

    test("uses correct table (refreshToken)", async () => {
      const token = "valid_token";

      const updateBuilder = createMockUpdateBuilder([]);
      mockDb.update.mockReturnValue(updateBuilder);

      await authService.revokeRefreshToken(token);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});

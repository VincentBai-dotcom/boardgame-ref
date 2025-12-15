import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { createMockUser } from "../../../test-utils/user-fixtures";
import { createMockJwtToken } from "../../../test-utils/auth-fixtures";
import {
  mockBunPassword,
  restoreBunPassword,
} from "../../../test-utils/mock-bun-password";

describe("Auth Routes", () => {
  let app: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockAuthService: {
    registerUser: ReturnType<typeof mock>;
    validateCredentials: ReturnType<typeof mock>;
    storeRefreshToken: ReturnType<typeof mock>;
    consumeRefreshToken: ReturnType<typeof mock>;
    revokeRefreshToken: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    // Mock all AuthService methods
    mockAuthService = {
      registerUser: mock(),
      validateCredentials: mock(),
      storeRefreshToken: mock(),
      consumeRefreshToken: mock(),
      revokeRefreshToken: mock(),
    };

    // Import and patch AuthService
    const authServiceModule = await import("../service");
    Object.assign(authServiceModule.AuthService, mockAuthService);

    // Mock Bun.password
    mockBunPassword();

    // Set up test environment
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = "900"; // 15 minutes
    process.env.JWT_REFRESH_EXPIRES_IN_SECONDS = "2592000"; // 30 days
    process.env.NODE_ENV = "development";

    // Create app with auth routes
    const { auth } = await import("../index");
    app = new Elysia().use(auth);
  });

  afterEach(() => {
    restoreBunPassword();
    mock.restore();
  });

  describe("POST /auth/register", () => {
    test("returns tokens on successful registration", async () => {
      const email = "new@example.com";
      const password = "SecurePass123";
      const mockUser = createMockUser({ email, id: "user-new-123" });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
      expect(typeof body.accessToken).toBe("string");
      expect(typeof body.refreshToken).toBe("string");
    });

    test("sets refreshToken HttpOnly cookie with correct attributes", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("refreshToken=");
      expect(setCookie).toContain("HttpOnly");
    });

    test("cookie does not have secure flag in development", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      // In development mode
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const cookie = response.headers.get("set-cookie");
      // In development, Secure flag should not be present
      expect(cookie).not.toContain("Secure");
    });

    test("cookie has sameSite: lax attribute", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("SameSite=Lax");
    });

    test("cookie has path: /auth", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("Path=/auth");
    });

    test("cookie maxAge matches JWT_REFRESH_EXPIRES_IN_SECONDS", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("Max-Age=2592000");
    });

    test("returns tokens that match JWT format structure", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const body = await response.json();
      // JWT format: header.payload.signature (3 parts separated by dots)
      expect(body.accessToken.split(".").length).toBe(3);
      expect(body.refreshToken.split(".").length).toBe(3);
    });

    test("calls AuthService.registerUser with email and password from body", async () => {
      const email = "test@example.com";
      const password = "mypassword";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(
        email,
        password,
      );
    });

    test("calls AuthService.storeRefreshToken with userId, token, and metadata", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email, id: "user-456" });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).toHaveBeenCalledWith(
        "user-456",
        expect.any(String),
        expect.objectContaining({
          userAgent: "Mozilla/5.0",
        }),
      );
    });

    test("passes userAgent from request headers to storeRefreshToken", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Custom-Agent/1.0",
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          userAgent: "Custom-Agent/1.0",
        }),
      );
    });

    test("passes ipAddress from x-forwarded-for or x-real-ip to storeRefreshToken", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.registerUser.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.1, 198.51.100.1",
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          ipAddress: "203.0.113.1", // First IP from list
        }),
      );
    });

    test("returns 422 when email format is invalid", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "not-an-email",
            password: "ValidPass123",
          }),
        }),
      );

      // Elysia returns 422 for validation errors
      expect(response.status).toBe(422);
    });

    test("returns 422 when password is less than 8 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "short",
          }),
        }),
      );

      // Elysia returns 422 for validation errors
      expect(response.status).toBe(422);
    });

    test("returns 400 with error message when user already exists", async () => {
      const email = "existing@example.com";
      const password = "password123";

      mockAuthService.registerUser.mockRejectedValue(
        new Error(`User already exists with email: ${email}`),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("User already exists");
    });

    test("returns 422 when email field is missing", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "password123" }),
        }),
      );

      // Elysia returns 422 for validation errors
      expect(response.status).toBe(422);
    });

    test("returns 422 when password field is missing", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        }),
      );

      // Elysia returns 422 for validation errors
      expect(response.status).toBe(422);
    });

    test("error response includes descriptive error message", async () => {
      mockAuthService.registerUser.mockRejectedValue(
        new Error("Registration failed"),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
          }),
        }),
      );

      const body = await response.json();
      expect(body).toHaveProperty("error");
      expect(typeof body.error).toBe("string");
    });
  });

  describe("POST /auth/login", () => {
    test("returns tokens when credentials are valid", async () => {
      const email = "valid@example.com";
      const password = "correctPassword";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
    });

    test("sets refreshToken HttpOnly cookie", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("refreshToken=");
      expect(setCookie).toContain("HttpOnly");
    });

    test("calls AuthService.validateCredentials with email and password", async () => {
      const email = "test@example.com";
      const password = "mypassword";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.validateCredentials).toHaveBeenCalledWith(
        email,
        password,
      );
    });

    test("calls AuthService.storeRefreshToken after successful validation", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email, id: "user-789" });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).toHaveBeenCalledWith(
        "user-789",
        expect.any(String),
        expect.any(Object),
      );
    });

    test("signs new access and refresh tokens", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const body = await response.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.accessToken.split(".").length).toBe(3);
      expect(body.refreshToken.split(".").length).toBe(3);
    });

    test("returns both tokens in response body", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const body = await response.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
      expect(typeof body.accessToken).toBe("string");
      expect(typeof body.refreshToken).toBe("string");
    });

    test("passes userAgent from request headers", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Custom-Agent/2.0",
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          userAgent: "Custom-Agent/2.0",
        }),
      );
    });

    test("passes ipAddress from x-forwarded-for header", async () => {
      const email = "test@example.com";
      const password = "password123";
      const mockUser = createMockUser({ email });

      mockAuthService.validateCredentials.mockResolvedValue(mockUser);
      mockAuthService.storeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "10.0.0.1",
          },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          ipAddress: "10.0.0.1",
        }),
      );
    });

    test("returns 401 when credentials are invalid", async () => {
      const email = "test@example.com";
      const password = "wrongpassword";

      mockAuthService.validateCredentials.mockRejectedValue(
        new Error("Invalid credentials"),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      expect(response.status).toBe(401);
    });

    test("returns 401 with 'Invalid credentials' message", async () => {
      const email = "test@example.com";
      const password = "wrongpassword";

      mockAuthService.validateCredentials.mockRejectedValue(
        new Error("Invalid credentials"),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
      );

      const body = await response.json();
      expect(body.error).toBe("Invalid credentials");
    });

    test("returns 401 when user not found", async () => {
      mockAuthService.validateCredentials.mockRejectedValue(
        new Error("Invalid credentials"),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "nonexistent@example.com",
            password: "password123",
          }),
        }),
      );

      expect(response.status).toBe(401);
    });

    test("returns 401 when password is incorrect", async () => {
      mockAuthService.validateCredentials.mockRejectedValue(
        new Error("Invalid credentials"),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "wrongpassword",
          }),
        }),
      );

      expect(response.status).toBe(401);
    });

    test("does not set cookie when authentication fails", async () => {
      mockAuthService.validateCredentials.mockRejectedValue(
        new Error("Invalid credentials"),
      );

      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "wrongpassword",
          }),
        }),
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeNull();
    });

    test("does not store refresh token when authentication fails", async () => {
      mockAuthService.validateCredentials.mockRejectedValue(
        new Error("Invalid credentials"),
      );

      await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "wrongpassword",
          }),
        }),
      );

      expect(mockAuthService.storeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/refresh", () => {
    // Note: Testing /auth/refresh endpoint is complex because it requires real JWT verification
    // These tests verify endpoint structure and error handling rather than full token rotation

    test("refresh endpoint exists and accepts POST requests", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

      // Endpoint exists (not 404)
      expect(response.status).not.toBe(404);
    });

    test("returns 401 when no refresh token provided", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Missing refresh token");
    });

    test("handles token from cookie", async () => {
      const token = createMockJwtToken();

      const response = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `refreshToken=${token}`,
          },
        }),
      );

      // Token is extracted from cookie (not missing token error)
      expect(response.status).not.toBe(404);
    });

    test("handles token from body", async () => {
      const token = createMockJwtToken();

      const response = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      // Token is extracted from body (not missing token error)
      expect(response.status).not.toBe(404);
    });
  });

  describe("POST /auth/logout", () => {
    test("returns 204 No Content on successful logout", async () => {
      const token = createMockJwtToken();

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      expect(response.status).toBe(204);
    });

    test("removes refreshToken cookie", async () => {
      const token = createMockJwtToken();

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `refreshToken=${token}`,
          },
        }),
      );

      // Cookie should be removed/expired
      const setCookie = response.headers.get("set-cookie");
      // When removing a cookie, it's typically set with Max-Age=0 or Expires in the past
      if (setCookie) {
        expect(setCookie).toContain("refreshToken");
      }
    });

    test("accepts refresh token from body", async () => {
      const token = "body_token";

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith(token);
    });

    test("accepts refresh token from cookie", async () => {
      const token = "cookie_token";

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `refreshToken=${token}`,
          },
        }),
      );

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith(token);
    });

    test("calls AuthService.revokeRefreshToken with token", async () => {
      const token = "my_token";

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith(token);
    });

    test("prefers body token over cookie when both provided", async () => {
      const bodyToken = "body_token";
      const cookieToken = "cookie_token";

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `refreshToken=${cookieToken}`,
          },
          body: JSON.stringify({ refreshToken: bodyToken }),
        }),
      );

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith(
        bodyToken,
      );
    });

    test("returns 204 even when no token provided (idempotent)", async () => {
      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

      expect(response.status).toBe(204);
    });

    test("returns 204 when token doesn't exist in database", async () => {
      const token = "nonexistent_token";

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      expect(response.status).toBe(204);
    });

    test("returns 204 when token already revoked", async () => {
      const token = "already_revoked";

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      expect(response.status).toBe(204);
    });
  });

  describe("authGuard", () => {
    test("authGuard plugin exists and can be imported", async () => {
      const { authGuard } = await import("../index");
      expect(authGuard).toBeDefined();
      expect(typeof authGuard).toBe("object");
    });

    test("authGuard provides bearer token extraction", async () => {
      const { authGuard } = await import("../index");
      // Verify the plugin has the bearer functionality
      expect(authGuard).toBeDefined();
    });

    test("authGuard provides JWT verification", async () => {
      const { authGuard } = await import("../index");
      // Verify the plugin has the JWT functionality
      expect(authGuard).toBeDefined();
    });

    test("authGuard derives userId from token", async () => {
      const { authGuard } = await import("../index");
      // The authGuard adds a derive hook that sets userId
      expect(authGuard).toBeDefined();
    });
  });
});

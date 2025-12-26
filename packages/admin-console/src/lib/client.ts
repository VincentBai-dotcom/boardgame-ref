import { treaty } from "@elysiajs/eden";
import type { App } from "../../../backend/src/index.js";

// Module-level token storage for synchronous access by Eden Treaty headers function
let currentAccessToken: string | null = null;

/**
 * Updates the access token used for API authentication.
 * Should be called by AuthContext whenever the token changes.
 */
export function setAccessToken(token: string | null) {
  currentAccessToken = token;
}

/**
 * Gets the current access token.
 * Used internally by the Eden Treaty headers function.
 */
export function getAccessToken(): string | null {
  return currentAccessToken;
}

export const client = treaty<App>("localhost:3000", {
  fetch: {
    credentials: "include",
  },
  headers(path): Record<string, string> {
    const token = getAccessToken();

    // Don't inject token for auth endpoints (they don't need it)
    if (path.startsWith("/auth")) {
      return {};
    }

    // Inject Bearer token for all other endpoints
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
      };
    }

    return {};
  },
});

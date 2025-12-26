import { client } from "./client";
import { setAccessToken } from "./client";

// Shared promise to prevent concurrent refresh calls
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempts to refresh the access token using the HTTP-only refresh token cookie.
 * Multiple concurrent calls will share the same refresh promise to prevent race conditions.
 *
 * @returns The new access token, or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  // If refresh is already in progress, return the existing promise
  if (refreshPromise) {
    return refreshPromise;
  }

  // Create new refresh promise
  refreshPromise = (async () => {
    try {
      const response = await client.auth.refresh.post({});

      if (response.data?.accessToken) {
        const newToken = response.data.accessToken;
        setAccessToken(newToken);
        return newToken;
      }

      // Refresh failed - clear token
      setAccessToken(null);
      return null;
    } catch (error) {
      console.error("Token refresh failed:", error);
      setAccessToken(null);
      return null;
    } finally {
      // Clear the promise after completion
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

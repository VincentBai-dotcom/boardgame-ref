import { useAuth } from "./useAuth";
import type { Treaty } from "@elysiajs/eden";

/**
 * Hook providing utilities for making protected API calls with automatic token refresh.
 *
 * Usage:
 * ```tsx
 * const { withRetry } = useProtectedApi();
 *
 * const result = await withRetry(async () => {
 *   return await client.local.ingestion.game.post({...});
 * });
 * ```
 */
export function useProtectedApi() {
  const { refresh } = useAuth();

  /**
   * Wraps an Eden Treaty API call with automatic retry on 401 errors.
   * If the call returns 401, attempts to refresh the token and retries once.
   *
   * @param apiCall - The Eden Treaty API call function to execute
   * @param maxRetries - Maximum number of retries (default: 1)
   * @returns The Eden Treaty response object (with data or error)
   */
  async function withRetry<Res extends Record<number, unknown>>(
    apiCall: () => Promise<Treaty.TreatyResponse<Res>>,
    maxRetries = 2,
  ): Promise<Treaty.TreatyResponse<Res>> {
    const response = await apiCall();

    // Check if this is a 401 error and we haven't exhausted retries
    if (maxRetries > 0 && response.error?.status === 401) {
      console.log("Got 401, attempting token refresh...");

      const refreshed = await refresh();

      if (refreshed) {
        console.log("Token refreshed, retrying request...");
        // Retry the call with the new token (decrement retries)
        return withRetry(apiCall, maxRetries - 1);
      }

      // Refresh failed, user needs to re-authenticate
      console.error("Token refresh failed, user must log in again");
    }

    // Return the response as-is (either success or error)
    return response;
  }

  return { withRetry };
}

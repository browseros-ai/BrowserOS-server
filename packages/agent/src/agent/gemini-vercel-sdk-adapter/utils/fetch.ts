/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Custom fetch utilities for provider-specific error handling
 */

/**
 * Creates a fetch function that extracts detailed error messages from OpenRouter-style APIs.
 *
 * OpenRouter (and BrowserOS which uses it internally) wraps provider errors in a generic
 * "Provider returned error" message, with actual details hidden in metadata.raw.
 * This fetch intercepts HTTP errors and extracts the real error message.
 *
 * @example
 * // OpenRouter error format:
 * // { "error": { "message": "Provider returned error", "code": 429, "metadata": { "raw": "Rate limited..." } } }
 * // Extracted as: "[429] Provider returned error (Rate limited...)"
 */
export function createOpenRouterCompatibleFetch(): typeof fetch {
  return (async (url: RequestInfo | URL, options?: RequestInit) => {
    const response = await globalThis.fetch(url, options);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = await response.clone().text();
        const parsed = JSON.parse(errorBody);
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
          if (parsed.error.code) {
            errorMessage = `[${parsed.error.code}] ${errorMessage}`;
          }
          if (parsed.error.metadata?.raw) {
            errorMessage += ` (${JSON.stringify(parsed.error.metadata.raw)})`;
          }
        }
      } catch {
        // Keep default error message if parsing fails
      }
      throw new Error(errorMessage);
    }

    return response;
  }) as typeof fetch;
}

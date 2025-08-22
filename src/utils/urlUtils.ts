/**
 * Utility functions for parsing URL parameters and hash fragments
 */

export interface AuthUrlParams {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  expires_in?: string;
  token_type?: string;
  type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Parse URL hash parameters (used with hash-based routing)
 * Handles cases where there are multiple hash fragments like: #/reset-password#access_token=...
 */
export function parseHashParams(): AuthUrlParams {
  const fullHash = window.location.hash.substring(1); // Remove the first # symbol
  const params: AuthUrlParams = {};

  if (fullHash) {
    // Check if there are multiple hash fragments (e.g., #/reset-password#access_token=...)
    const hashFragments = fullHash.split('#');

    // Look for auth parameters in any of the hash fragments
    for (const fragment of hashFragments) {
      if (fragment.includes('access_token') || fragment.includes('type=')) {
        // This fragment contains auth parameters
        const pairs = fragment.split('&');
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[key as keyof AuthUrlParams] = decodeURIComponent(value);
          }
        }
        break; // Found auth parameters, no need to check other fragments
      }
    }
  }

  return params;
}

/**
 * Parse URL search parameters (used with regular routing)
 */
export function parseSearchParams(): AuthUrlParams {
  const search = window.location.search.substring(1); // Remove the ? symbol
  const params: AuthUrlParams = {};

  if (search) {
    const pairs = search.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[key as keyof AuthUrlParams] = decodeURIComponent(value);
      }
    }
  }

  return params;
}

/**
 * Check if the current URL contains auth parameters
 */
export function hasAuthParams(): boolean {
  const hashParams = parseHashParams();
  const searchParams = parseSearchParams();

  return !!(hashParams.access_token || searchParams.access_token);
}

/**
 * Check if the current URL contains password recovery parameters
 */
export function hasRecoveryParams(): boolean {
  const hashParams = parseHashParams();
  const searchParams = parseSearchParams();

  return (
    (hashParams.type === 'recovery' || searchParams.type === 'recovery') &&
    !!(hashParams.access_token || searchParams.access_token)
  );
}

/**
 * Clear auth parameters from the URL
 */
export function clearAuthParams(): void {
  // Clear hash parameters
  if (window.location.hash) {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  }

  // Clear search parameters
  if (window.location.search) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

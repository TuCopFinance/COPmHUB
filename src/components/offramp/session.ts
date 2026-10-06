const TOKEN_KEY = "offramp_session_v1";

/**
 * The session token lives in sessionStorage: it survives the trip to
 * Bridge's KYC page and back in the same tab, and is gone when the tab
 * closes. Storage can be blocked, in which case the person simply confirms
 * their email again after a reload.
 */
export function readSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do: the token stays in memory for this page view.
  }
}

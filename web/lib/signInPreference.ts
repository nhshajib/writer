export type SignInMethod = "google" | "discord" | "email";
export const LAST_SIGN_IN_KEY = "typewit:last-sign-in:v1";
const PENDING_KEY = "typewit:pending-sign-in:v1";
const METHODS: readonly string[] = ["google", "discord", "email"];

/** Only a method name is saved: no email, token or account identifier. */
export function lastSignInMethod(): SignInMethod | null {
  try {
    const value = localStorage.getItem(LAST_SIGN_IN_KEY);
    return value && METHODS.includes(value) ? value as SignInMethod : null;
  } catch {
    return null;
  }
}

export function rememberSignIn(method: SignInMethod): void {
  try {
    localStorage.setItem(LAST_SIGN_IN_KEY, method);
  } catch {
    // This preference must never prevent sign-in in a private/restricted browser.
  }
}

export function clearPendingSignIn(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Authentication still works without browser storage.
  }
}

export function beginSocialSignIn(method: "google" | "discord"): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ method, at: Date.now() }));
  } catch {
    // Authentication still works without this optional hint.
  }
}

/** Commit the OAuth hint only after Supabase returns an authenticated session. */
export function finishSocialSignIn(): void {
  try {
    const pending: unknown = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
    clearPendingSignIn();
    if (!pending || typeof pending !== "object") return;
    const value = pending as { method?: unknown; at?: unknown };
    if ((value.method === "google" || value.method === "discord") &&
      typeof value.at === "number" && value.at <= Date.now() && Date.now() - value.at < 15 * 60_000) {
      rememberSignIn(value.method);
    }
  } catch {
    clearPendingSignIn();
  }
}

import { requireEnv } from "./env.ts";
import { HttpError } from "./http.ts";
import type { GoogleClientConfig } from "./providers/google.ts";

export interface OAuthState {
  uid: string;
  exp: number;
  nonce: string;
  redirect_to: string | null;
}

/** Google OAuth client credentials; a 503 tells callers Google isn't set up yet. */
export function googleClientConfig(): GoogleClientConfig {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new HttpError(503, "Google sign-in is not configured yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

export function googleRedirectUri(): string {
  return Deno.env.get("GOOGLE_REDIRECT_URI") ?? `${requireEnv("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
}

/**
 * Only allows redirects back to the app's own origin (APP_URL), so the OAuth
 * flow can't be used as an open redirect. Returns null when not allowed.
 */
export function allowedRedirect(candidate: string | null, appUrl = Deno.env.get("APP_URL")): string | null {
  if (!candidate || !appUrl) return null;
  try {
    const target = new URL(candidate);
    return target.origin === new URL(appUrl).origin ? target.toString() : null;
  } catch {
    return null;
  }
}

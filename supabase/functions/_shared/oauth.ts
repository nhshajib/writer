import { requireEnv } from "./env.ts";

export interface OAuthState {
  uid: string;
  exp: number;
  nonce: string;
  redirect_to: string | null;
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

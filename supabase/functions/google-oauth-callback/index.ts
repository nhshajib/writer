// Google redirects here after consent. Exchanges the code for tokens, stores
// them encrypted, then forwards the browser to the app (or shows a short page).
// Deployed with verify_jwt = false: the signed `state` identifies the user.

import { encrypt, verify } from "../_shared/crypto.ts";
import { adminClient, encryptionKey, requireEnv } from "../_shared/env.ts";
import { serve } from "../_shared/http.ts";
import { googleRedirectUri, type OAuthState } from "../_shared/oauth.ts";
import { exchangeCode, fetchGoogleEmail } from "../_shared/providers/google.ts";

serve(async (req) => {
  const params = new URL(req.url).searchParams;
  const key = await encryptionKey();

  const state = await verify<OAuthState>(params.get("state") ?? "", key);
  if (!state || state.exp < Date.now() / 1000) {
    return finish(null, "error", "This sign-in link is invalid or has expired. Please try again.");
  }

  const oauthError = params.get("error");
  const code = params.get("code");
  if (oauthError || !code) {
    return finish(
      state.redirect_to,
      "error",
      oauthError === "access_denied" ? "Google access was not granted." : "Google sign-in failed.",
    );
  }

  const tokens = await exchangeCode(code, googleRedirectUri(), {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  });
  if (!tokens.refresh_token) {
    return finish(state.redirect_to, "error", "Google did not return a refresh token. Please try connecting again.");
  }

  const email = await fetchGoogleEmail(tokens.access_token);
  const { error } = await adminClient()
    .from("provider_connections")
    .upsert({
      user_id: state.uid,
      provider: "google",
      account_email: email,
      refresh_token_enc: await encrypt(tokens.refresh_token, key),
      access_token_enc: await encrypt(tokens.access_token, key),
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope ?? null,
    }, { onConflict: "user_id,provider,account_email" });
  if (error) {
    console.error("Failed to store Google connection", error.message);
    return finish(state.redirect_to, "error", "Could not save the Google connection.");
  }

  return finish(state.redirect_to, "connected", "Google account connected. You can close this tab.");
});

function finish(redirectTo: string | null, status: "connected" | "error", message: string): Response {
  if (redirectTo) {
    const url = new URL(redirectTo);
    url.searchParams.set("google", status);
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  }
  const escaped = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Writer</title><p style="font-family:sans-serif">${escaped}</p>`,
    { status: status === "connected" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

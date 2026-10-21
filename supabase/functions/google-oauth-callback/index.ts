// Google returns here without a JWT. GET forwards the code in a fragment to
// the app; it NEVER exchanges the code or links an account. The initiating
// tab then POSTs its locally stored verifier as the authenticated TypeWit user.
import { requireUser } from "../_shared/auth.ts";
import { encrypt, verify } from "../_shared/crypto.ts";
import { adminClient, encryptionKey } from "../_shared/env.ts";
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import {
  allowedRedirect,
  googleClientConfig,
  googleRedirectUri,
  type OAuthState,
  pkceChallenge,
} from "../_shared/oauth.ts";
import { exchangeCode, fetchGoogleEmail } from "../_shared/providers/google.ts";

serve(async (req) => {
  const key = await encryptionKey();
  const params = new URL(req.url).searchParams;
  const body = req.method === "POST" ? await readJson<{ state?: string; code?: string; verifier?: string }>(req) : null;
  const signed = body?.state ?? params.get("state") ?? "";
  if (typeof signed !== "string") throw new HttpError(400, "Invalid Google connection link. Please connect again.");
  const state = await verify<OAuthState>(signed, key);
  if (!state || !state.uid || !state.nonce || !Number.isFinite(state.exp) || state.exp < Date.now() / 1000) {
    if (body) throw new HttpError(400, "This Google connection link expired. Connect again from your dashboard.");
    return finish(null, "error", "This sign-in link is invalid or has expired. Please try again.");
  }
  const redirect = allowedRedirect(state.redirect_to);
  const db = adminClient();
  if (req.method === "GET") {
    const { data, error } = await db.from("google_oauth_nonces").update({ returned_at: new Date().toISOString() })
      .eq("nonce", state.nonce).eq("user_id", state.uid).is("returned_at", null).is("used_at", null)
      .gt("expires_at", new Date().toISOString()).select("nonce");
    if (error || !data?.length) {
      return finish(redirect, "error", "This connection link was already used or expired. Please try again.");
    }
    const code = params.get("code");
    if (params.get("error") || !code) {
      return finish(
        redirect,
        "error",
        params.get("error") === "access_denied" ? "Google access was not granted." : "Google sign-in failed.",
      );
    }
    if (!redirect) return finish(null, "error", "Return to your dashboard and connect Google again.");
    const url = new URL(redirect);
    url.hash = new URLSearchParams({ google_connect: signed, google_code: code }).toString();
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
  if (!body || req.method !== "POST") throw new HttpError(405, "Method not allowed.");
  const user = await requireUser(req);
  if (
    user.id !== state.uid || typeof body.verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier) ||
    typeof body.code !== "string" || !body.code || body.code.length > 4096
  ) {
    throw new HttpError(400, "Complete Google connect in the same browser tab that started it.");
  }
  const { data: consumed, error: nonceError } = await db.rpc("consume_google_oauth_nonce", {
    owner: user.id,
    flow: state.nonce,
    verifier_hash: await pkceChallenge(body.verifier),
  });
  if (nonceError || consumed !== true) {
    throw new HttpError(400, "This Google connection expired or belongs to another browser. Please try again.");
  }
  try {
    const tokens = await exchangeCode(body.code, googleRedirectUri(), googleClientConfig(), fetch, body.verifier);
    if (!(tokens.scope ?? "").split(/\s+/).includes("https://www.googleapis.com/auth/drive.file")) {
      throw new Error("Google did not grant document access. Connect again and allow access to the files you choose.");
    }
    if (!tokens.refresh_token) throw new Error("Google did not return offline access. Please connect again.");
    const email = await fetchGoogleEmail(tokens.access_token);
    // Never upsert a NULL identity: PostgreSQL unique constraints permit
    // multiple nulls. An unidentified grant is not safe to save or revoke.
    if (!email) throw new Error("Google could not identify the connected account. Please try connecting again.");
    const { error } = await db.from("provider_connections").upsert({
      user_id: user.id,
      provider: "google",
      account_email: email.toLowerCase(),
      refresh_token_enc: await encrypt(tokens.refresh_token, key),
      access_token_enc: await encrypt(tokens.access_token, key),
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope,
    }, { onConflict: "user_id,provider,account_email" });
    if (error) throw new Error("Could not save the Google connection. Please try again.");
    return json({ connected: true });
  } catch (error) {
    console.error("Google connect could not complete", error instanceof Error ? error.name : "Error");
    // Never return raw token endpoint messages or a generic 500 to the browser.
    throw new HttpError(400, "Google connect could not finish. Try again and allow access to the files you choose.");
  }
});

function finish(redirectTo: string | null, status: "connected" | "error", message: string): Response {
  if (redirectTo) {
    const url = new URL(redirectTo);
    url.searchParams.set("google", status);
    if (status === "error") url.searchParams.set("google_message", message);
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
  const escaped = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>TypeWit</title><p style="font-family:sans-serif">${escaped}</p>`,
    { status: status === "connected" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

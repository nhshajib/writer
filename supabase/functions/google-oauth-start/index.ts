// Returns the Google consent URL for connecting a Google account.
//
//   GET /google-oauth-start?redirect_to=<url>   →   { url }
//
// The frontend sends the user to `url`; Google redirects back to
// google-oauth-callback, which stores the tokens and forwards to `redirect_to`.

import { requireUser } from "../_shared/auth.ts";
import { sign } from "../_shared/crypto.ts";
import { adminClient, encryptionKey } from "../_shared/env.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES } from "../_shared/providers/google.ts";
import { allowedRedirect, googleClientConfig, googleRedirectUri, type OAuthState } from "../_shared/oauth.ts";
import { rateLimit } from "../_shared/rateLimit.ts";

const STATE_TTL_SECONDS = 10 * 60;

serve(async (req) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed.");
  const user = await requireUser(req);
  const { clientId } = googleClientConfig();
  const redirectTo = allowedRedirect(new URL(req.url).searchParams.get("redirect_to"));

  const challenge = new URL(req.url).searchParams.get("browser_challenge");
  if (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    throw new HttpError(400, "Start Google connect from your dashboard in this browser.");
  }
  await rateLimit(user.id, "googleConnect");
  const state: OAuthState = {
    uid: user.id,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomUUID(),
    redirect_to: redirectTo,
  };

  const { error } = await adminClient().from("google_oauth_nonces").insert({
    nonce: state.nonce,
    user_id: user.id,
    browser_hash: challenge,
    expires_at: new Date(state.exp * 1000).toISOString(),
  });
  if (error) throw new HttpError(503, "Google connect could not start. Please try again.");
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: await sign(state, await encryptionKey()),
  }).toString();

  return json({ url: url.toString(), flow_id: state.nonce });
});

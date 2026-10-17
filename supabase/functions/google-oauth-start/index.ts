// Returns the Google consent URL for connecting a Google account.
//
//   GET /google-oauth-start?redirect_to=<url>   →   { url }
//
// The frontend sends the user to `url`; Google redirects back to
// google-oauth-callback, which stores the tokens and forwards to `redirect_to`.

import { requireUser } from "../_shared/auth.ts";
import { sign } from "../_shared/crypto.ts";
import { encryptionKey, requireEnv } from "../_shared/env.ts";
import { json, serve } from "../_shared/http.ts";
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES } from "../_shared/providers/google.ts";
import { allowedRedirect, googleRedirectUri, type OAuthState } from "../_shared/oauth.ts";

const STATE_TTL_SECONDS = 10 * 60;

serve(async (req) => {
  const user = await requireUser(req);
  const redirectTo = allowedRedirect(new URL(req.url).searchParams.get("redirect_to"));

  const state: OAuthState = {
    uid: user.id,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomUUID(),
    redirect_to: redirectTo,
  };

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: await sign(state, await encryptionKey()),
  }).toString();

  return json({ url: url.toString() });
});

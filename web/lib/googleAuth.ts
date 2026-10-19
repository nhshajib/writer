import { supabase } from "./supabase";
import { safeNext } from "./nextPath";
import { CURRENT_TERMS_VERSION } from "./terms";

const PENDING_KEY = "typewit:agreed-before-google";

/**
 * Starts "Continue with Google". When the person ticked the agreement on the
 * sign-up page first, we remember that and record it once they are back
 * (Google sign-in can't carry it in the sign-up metadata).
 */
export async function continueWithGoogle(options: { agreed: boolean; next?: string }): Promise<string | null> {
  try {
    if (options.agreed) sessionStorage.setItem(PENDING_KEY, CURRENT_TERMS_VERSION);
  } catch {
    // Storage blocked: the dashboard will ask for the agreement instead.
  }
  const next = safeNext(options.next);
  const { error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${next}` },
  });
  return error ? error.message : null;
}

/** Records an agreement the person gave on the sign-up page before using Google. Returns true if recorded. */
export async function recordPendingAgreement(): Promise<boolean> {
  let version: string | null = null;
  try {
    version = sessionStorage.getItem(PENDING_KEY);
  } catch {
    return false;
  }
  if (version !== CURRENT_TERMS_VERSION) return false;
  const { error } = await supabase().rpc("agree_to_terms", { version });
  if (error) return false;
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
  return true;
}

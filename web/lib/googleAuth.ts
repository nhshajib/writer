import { supabase } from "./supabase";
import { safeNext } from "./nextPath";
import { CURRENT_TERMS_VERSION } from "./terms";

const PENDING_KEY = "typewit:agreed-before-google";
const PENDING_AGE_KEY = "typewit:age-before-google";

/** Age answers from the Join form, recorded once the person is back from Google. */
export interface AgeAnswers {
  country: string;
  birth_year: number;
  birth_month: number;
  guardian_agreed: boolean;
}

/**
 * Starts "Continue with Google". When the person ticked the agreement on the
 * sign-up page first, we remember that and record it once they are back
 * (Google sign-in can't carry it in the sign-up metadata).
 */
export async function continueWithGoogle(options: { agreed: boolean; next?: string; age?: AgeAnswers }): Promise<string | null> {
  try {
    if (options.agreed) sessionStorage.setItem(PENDING_KEY, CURRENT_TERMS_VERSION);
    if (options.age) sessionStorage.setItem(PENDING_AGE_KEY, JSON.stringify(options.age));
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

export type AgeResult = "ok" | "guardian_needed" | "too_young";

/** Records age answers through the server's check. "too_young" means the account was deleted. */
export async function confirmAge(age: AgeAnswers): Promise<AgeResult> {
  const { data, error } = await supabase().rpc("confirm_age", {
    country: age.country,
    birth_year: age.birth_year,
    birth_month: age.birth_month,
    guardian: age.guardian_agreed,
  });
  if (error) throw new Error(error.message);
  return data as AgeResult;
}

/** Records age answers given on the Join form before using Google, if any. Returns null when there were none. */
export async function recordPendingAge(): Promise<AgeResult | null> {
  let age: AgeAnswers | null = null;
  try {
    age = JSON.parse(sessionStorage.getItem(PENDING_AGE_KEY) ?? "null");
  } catch {
    return null;
  }
  if (!age) return null;
  try {
    const result = await confirmAge(age);
    sessionStorage.removeItem(PENDING_AGE_KEY);
    return result;
  } catch {
    return null;
  }
}

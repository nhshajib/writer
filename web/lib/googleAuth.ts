import { supabase } from "./supabase";
import { safeNext } from "./nextPath";
import { CURRENT_TERMS_VERSION } from "./terms";

const PENDING_KEY = "typewit:agreed-before-google";
const PENDING_AGE_KEY = "typewit:age-before-google";

/** Age answers from the Join form, recorded once the person is back from social sign-in. */
export interface AgeAnswers {
  country: string;
  birth_year: number;
  birth_month: number;
  guardian_agreed: boolean;
}

export type SocialProvider = "google" | "discord";
type SignInOptions = { agreed: boolean; next?: string; age?: AgeAnswers };

/**
 * Starts social sign-in with Google or Discord. When the person ticked the agreement on the
 * sign-up page first, we remember that and record it once they are back
 * (OAuth sign-in cannot carry it in the sign-up metadata).
 */
export async function continueWithProvider(provider: SocialProvider, options: SignInOptions): Promise<string | null> {
  try {
    if (options.agreed) sessionStorage.setItem(PENDING_KEY, CURRENT_TERMS_VERSION);
    if (options.age) sessionStorage.setItem(PENDING_AGE_KEY, JSON.stringify(options.age));
  } catch {
    // Storage blocked: the dashboard will ask for the agreement instead.
  }
  const next = safeNext(options.next);
  try {
    const { error } = await supabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    return error ? error.message : null;
  } catch {
    return `${provider === "discord" ? "Discord" : "Google"} sign-in could not start. Check your connection and try again.`;
  }

}

/** Existing callers keep the same Google entry point and pending-storage keys. */
export function continueWithGoogle(options: SignInOptions): Promise<string | null> {
  return continueWithProvider("google", options);
}

/** Records an agreement the person gave on the sign-up page before social sign-in. Returns true if recorded. */
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

/** Records the first age answer. Ineligible accounts use the normal cleanup path. */
export async function confirmAge(age: AgeAnswers): Promise<AgeResult> {
  const { data, error } = await supabase().rpc("confirm_age", {
    country: age.country,
    birth_year: age.birth_year,
    birth_month: age.birth_month,
    guardian: age.guardian_agreed,
  });
  if (error) {
    // Two refreshes/tabs may finish onboarding together. The server refuses
    // a second answer; use its existing result without changing any age data.
    if (error.message.includes("Your age has already been confirmed.")) {
      const { data: profile, error: profileError } = await supabase().from("profiles")
        .select("age_confirmed_at, eligibility_blocked_at").maybeSingle();
      if (!profileError && profile?.age_confirmed_at) return profile.eligibility_blocked_at ? "too_young" : "ok";
    }
    throw new Error(error.message);
  }
  return data as AgeResult;
}

/** Records age answers given on the Join form before social sign-in, if any. Returns null when there were none. */
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

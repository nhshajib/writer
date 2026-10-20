"use client";

import { useState } from "react";
import { AboutYou, type AboutYouValue, aboutYouCheck, EMPTY_ABOUT_YOU } from "@/components/AboutYou";
import { LegalDialog } from "@/components/LegalDialog";
import { rememberAgeBlock } from "@/lib/age";
import { confirmAge } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

/**
 * Shown before the dashboard when the account hasn't accepted the current
 * Responsible Use Agreement, or hasn't answered the age questions yet (for
 * example after joining with Google, or for accounts from before the check).
 */
export function AgreementGate({ needsAgreement, needsAge, onDone }: {
  needsAgreement: boolean;
  needsAge: boolean;
  onDone: (update: { agreed_terms_version?: string; age_confirmed_at?: string }) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [about, setAbout] = useState<AboutYouValue>(EMPTY_ABOUT_YOU);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);

  async function confirm() {
    setError(null);
    const check = needsAge ? aboutYouCheck(about) : "ok";
    if (!check) return setError("Choose your country and the month and year you were born.");
    if (check === "guardian" && !about.guardian) return setError("Please tick the box to confirm a parent or guardian agrees.");
    if (needsAgreement && !agreed) return setError("Please tick the box to agree to the Responsible Use Agreement.");
    setBusy(true);
    try {
      const update: { agreed_terms_version?: string; age_confirmed_at?: string } = {};
      if (needsAge) {
        const result = await confirmAge({
          country: about.country,
          birth_year: Number(about.year),
          birth_month: Number(about.month),
          guardian_agreed: check === "guardian" && about.guardian,
        });
        if (result === "too_young") {
          // The server has deleted the account.
          rememberAgeBlock();
          await supabase().auth.signOut();
          setRefused(true);
          return;
        }
        if (result === "guardian_needed") throw new Error("Please tick the box to confirm a parent or guardian agrees.");
        update.age_confirmed_at = new Date().toISOString();
      }
      if (needsAgreement) {
        const { error: rpcError } = await supabase().rpc("agree_to_terms", { version: CURRENT_TERMS_VERSION });
        if (rpcError) throw new Error(rpcError.message);
        update.agreed_terms_version = CURRENT_TERMS_VERSION;
      }
      onDone(update);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (refused) {
    return (
      <main id="main" className="auth" tabIndex={-1}>
        <section className="auth-box" role="status" aria-labelledby="gate-title">
          <h1 id="gate-title">Sorry, you can&apos;t use TypeWit yet</h1>
          <p className="sub">Your account has been removed, along with everything stored for it.</p>
          <p className="center mt-6"><a href="/" className="btn btn-secondary">Back to the home page</a></p>
        </section>
      </main>
    );
  }

  return (
    <main id="main" className="auth" tabIndex={-1}>
      <section className="auth-box" aria-labelledby="gate-title">
        <h1 id="gate-title">One last step</h1>
        <p className="sub">
          {needsAge ? "Tell us a little about you" : "Please accept the Responsible Use Agreement"} to continue.
        </p>
        <div className="auth-form">
          {needsAge && <AboutYou value={about} onChange={setAbout} idPrefix="gate" />}
          {needsAgreement && (
            <div className="agree-row">
              <label className="check" htmlFor="gate-agree">
                <input id="gate-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I agree to the Responsible Use&nbsp;Agreement</span>
              </label>
              <LegalDialog doc="agreement" onAgree={() => setAgreed(true)}>Read it</LegalDialog>
            </div>
          )}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={confirm}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </section>
    </main>
  );
}

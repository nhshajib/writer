"use client";

import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
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

  async function confirm() {
    setError(null);
    const check = needsAge ? aboutYouCheck(about) : "ok";
    if (!check) {
      setError("Choose your country and the month and year you were born.");
      document.getElementById(!about.country ? "gate-country" : !about.month ? "gate-month" : "gate-year")?.focus();
      return;
    }
    if (check === "guardian" && !about.guardian) {
      setError("Please tick the box to confirm a parent or guardian agrees.");
      document.getElementById("gate-guardian")?.focus();
      return;
    }
    if (needsAgreement && !agreed) {
      setError("Please tick the box to agree to the Responsible Use Agreement.");
      document.getElementById("gate-agree")?.focus();
      return;
    }
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
          // The server blocks this account; it must never reach the dashboard.
          rememberAgeBlock();
          await supabase().auth.signOut();
          window.location.assign("/signup/");
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


  return (
    <main id="main" className="auth onboarding" tabIndex={-1}>
      <section className="auth-box" aria-labelledby="gate-title">
        <Link href="/" className="onboarding-brand" aria-label="TypeWit home"><Logo /><Wordmark /></Link>
        {needsAge && <p className="onboarding-step">Account created · Step 2 of 2</p>}
        <h1 id="gate-title">One last step</h1>
        <p className="sub">
          {needsAge ? "When were you born? We use your country and birthday to check who can use TypeWit." : "Please accept the Responsible Use Agreement to continue."}
        </p>
        <form className="auth-form" onSubmit={e => { e.preventDefault(); if (!busy) void confirm(); }} noValidate>
          {needsAge && <AboutYou value={about} onChange={v => { setAbout(v); setError(null); }} idPrefix="gate" legend="Your birthday" />}
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
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
        <p className="onboarding-exit"><button type="button" className="link-btn" disabled={busy} onClick={() => supabase().auth.signOut().then(() => window.location.assign("/login/"))}>Sign out</button></p>
      </section>
    </main>
  );
}

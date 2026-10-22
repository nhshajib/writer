"use client";

import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { AboutYou, type AboutYouValue, aboutYouCheck, EMPTY_ABOUT_YOU } from "@/components/AboutYou";
import { GoogleMark, Icon } from "@/components/Icons";
import { LegalDialog } from "@/components/LegalDialog";
import { ageBlocked, rememberAgeBlock } from "@/lib/age";
import { emailProblem } from "@/lib/emailPolicy";
import { safeNext } from "@/lib/nextPath";
import { continueWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

type Problems = Partial<Record<"age" | "email" | "password" | "agree", string>>;

/** Where focus goes for each problem, in the order they appear on the form. */
const FOCUS: [keyof Problems, string][] = [["age", "about-country"], ["email", "email"], ["password", "password"], ["agree", "agree"]];

function SignupForm() {
  const router = useRouter();
  const [next, setNext] = useState("/app/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [about, setAbout] = useState<AboutYouValue>(EMPTY_ABOUT_YOU);
  const [refused, setRefused] = useState(false);
  const check = aboutYouCheck(about);
  const ineligible = check === "too_young";
  // Eligible answers, complete enough to send with the sign-up.
  const ageReady = check === "ok" || (check === "guardian" && about.guardian);

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
    if (ageBlocked()) setRefused(true);
  }, []);

  // Checked as soon as all three answers are in. A wrong pick can still be corrected now,
  // but the refusal is remembered in this browser, so a reload doesn't simply reopen the form.
  useEffect(() => {
    if (!ineligible) return;
    rememberAgeBlock();
    setProblems({});
  }, [ineligible]);

  const ageAnswers = {
    country: about.country,
    birth_year: Number(about.year),
    birth_month: Number(about.month),
    guardian_agreed: check === "guardian" && about.guardian,
  };

  function ageProblem(): string | undefined {
    if (!check) return "Choose your country and the month and year you were born.";
    if (check === "guardian" && !about.guardian) return "Tick the box to confirm a parent or guardian agrees.";
    return undefined;
  }

  /** Shows every problem under its field and moves focus to the first. */
  function report(found: Problems): boolean {
    setProblems(found);
    const first = FOCUS.find(([key]) => found[key]);
    if (!first) return false;
    const target = first[0] === "age" && check === "guardian" ? "about-guardian" : first[1];
    requestAnimationFrame(() => document.getElementById(target)?.focus());
    return true;
  }

  async function resend() {
    if (resending) return;
    setResending(true);
    setResent(null);
    try {
      const { error: resendError } = await supabase().auth.resend({
        type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}${next}` },
      });
      setResent(resendError ? resendError.message : "Sent again. It can take a minute; check your spam folder too.");
    } catch { setResent("Could not send the email. Check your connection and try again."); }
    finally { setResending(false); }
  }

  /** Google works on the first tap. Answers already given go with it; anything missing is asked once after sign-in. */
  async function google() {
    if (ineligible) return;
    setError(null);
    setBusy(true);
    const problem = await continueWithGoogle({ agreed, next, age: ageReady ? ageAnswers : undefined });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (ineligible) return;
    setError(null);
    const found: Problems = {
      age: ageProblem(),
      email: emailProblem(email) ?? undefined,
      password: password.length < 8 ? "Use at least 8 characters." : undefined,
      agree: agreed ? undefined : "Tick the box to accept the Terms and Responsible Use Agreement.",
    };
    if (report(found)) return;

    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { agreed_terms_version: CURRENT_TERMS_VERSION, ...ageAnswers },
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      });
      if (signUpError) {
        if (/can't create a TypeWit account/i.test(signUpError.message)) {
          rememberAgeBlock();
          setRefused(true);
          return;
        }
        setError(signUpError.message);
        return;
      }
      if (data.session) router.push(next);
      else setSent(true);
    } catch {
      setError("Could not create your account. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="auth">
        <div className="auth-box" role="status">
          <h1>Check your email</h1>
          <p className="sub">We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.</p>
          <div className="auth-form">
            <button type="button" className="btn btn-block" onClick={resend} disabled={resending}>{resending ? "Sending…" : "Send the email again"}</button>
            <button type="button" className="link-btn" onClick={() => { setSent(false); setResent(null); }}>Use a different email</button>
            {resent && <p className="alert alert-info">{resent}</p>}
            <p className="small muted center">Already confirmed? <Link href="/login/">Sign in</Link></p>
          </div>
        </div>
      </div>
    );
  }

  if (refused) {
    return (
      <div className="auth">
        <div className="auth-box" role="status">
          <h1>Sorry, you can&apos;t join yet</h1>
          <p className="sub">
            TypeWit isn&apos;t available to you at the moment. If you think this is a mistake, a parent, guardian or teacher can
            email us from the <Link href="/support/">help page</Link>.
          </p>
          <p className="center mt-6"><Link href="/" className="btn btn-secondary">Back to the home page</Link></p>
        </div>
      </div>
    );
  }

  const strong = password.length >= 8;
  return (
    <div className="auth">
      <div className="auth-box">
        <h1 id="signup-title">Create your account</h1>
        <p className="sub">Free plan, no card needed.</p>

        <form className="auth-form signup" onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
          <div className="signup-about" data-invalid={problems.age ? true : undefined}>
            <AboutYou value={about} onChange={(v) => { setAbout(v); setProblems((p) => ({ ...p, age: undefined })); }} legend="About you" />
            <div aria-live="polite">
              {ineligible ? (
                <div className="signup-refusal" role="alert">
                  <strong>Sorry, you can&apos;t join TypeWit yet.</strong>
                  <p>What you can do:</p>
                  <ul>
                    <li>Picked the wrong month or year? Change it above.</li>
                    <li>Otherwise, a parent, guardian or teacher can email us from the <Link href="/support/">help page</Link>.</li>
                  </ul>
                </div>
              ) : ageReady ? (
                <p className="signup-ok"><Icon.check /> You can join</p>
              ) : problems.age ? <p className="error-text">{problems.age}</p> : null}
            </div>
          </div>

          <fieldset className="signup-account" disabled={ineligible || busy}>
            <legend className="sr-only">Your account</legend>
            <button type="button" className="btn btn-google btn-lg btn-block" onClick={google}>
              <GoogleMark /> Continue with Google
            </button>
            <p className="or">or with email</p>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" inputMode="email" required value={email} placeholder="you@gmail.com"
                onChange={(e) => { setEmail(e.target.value); if (problems.email) setProblems((p) => ({ ...p, email: undefined })); }}
                onBlur={() => email && setProblems((p) => ({ ...p, email: emailProblem(email) ?? undefined }))}
                aria-invalid={problems.email ? "true" : undefined} aria-describedby={problems.email ? "email-error" : "email-hint"} />
              {problems.email
                ? <span id="email-error" className="error-text">{problems.email}</span>
                : <span id="email-hint" className="hint">A personal address, such as Gmail, Outlook or iCloud.</span>}
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <PasswordField id="password" autoComplete="new-password" required minLength={8} value={password}
                onChange={(e) => { setPassword(e.target.value); if (problems.password) setProblems((p) => ({ ...p, password: undefined })); }}
                aria-invalid={problems.password ? "true" : undefined} aria-describedby={problems.password ? "password-error" : "password-hint"} />
              {problems.password
                ? <span id="password-error" className="error-text">{problems.password}</span>
                : <span id="password-hint" className={`hint signup-rule${strong ? " met" : ""}`}>{strong && <Icon.check />}At least 8 characters</span>}
            </div>
            <div className="signup-agree" data-invalid={problems.agree ? true : undefined}>
              <label className="check" htmlFor="agree">
                <input id="agree" type="checkbox" checked={agreed} aria-invalid={problems.agree ? "true" : undefined}
                  aria-describedby={problems.agree ? "agree-error" : "agree-note"}
                  onChange={(e) => { setAgreed(e.target.checked); setProblems((p) => ({ ...p, agree: undefined })); }} />
                <span>I agree to the Terms and Responsible Use Agreement, and I&apos;ve read the Privacy Policy.</span>
              </label>
              <p className="signup-legal">
                Read: <LegalDialog doc="terms">Terms</LegalDialog> · <LegalDialog doc="agreement" onAgree={() => { setAgreed(true); setProblems((p) => ({ ...p, agree: undefined })); }}>Responsible Use</LegalDialog> · <LegalDialog doc="privacy">Privacy</LegalDialog>
              </p>
              {problems.agree
                ? <p id="agree-error" className="error-text">{problems.agree}</p>
                : <p id="agree-note" className="hint">For authorized use only. Academic cheating and false claims of authorship aren&apos;t allowed.</p>}
            </div>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg btn-block">
              {busy ? "Creating account…" : "Create free account"}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <SignupForm />;
}

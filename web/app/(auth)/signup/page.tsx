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

const AGREE_FIRST = "Please tick the box to agree to the Responsible Use Agreement first.";

function SignupForm() {
  const router = useRouter();
  const [next, setNext] = useState("/app/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [about, setAbout] = useState<AboutYouValue>(EMPTY_ABOUT_YOU);
  const [accountStep, setAccountStep] = useState(false);
  const [step, setStep] = useState<"form" | "refused">("form");
  const check = aboutYouCheck(about);
  // The account options open only once the age answers allow joining.
  const unlocked = check === "ok" || (check === "guardian" && about.guardian);

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
    if (ageBlocked()) setStep("refused");
  }, []);

  useEffect(() => {
    if (check === "too_young") {
      rememberAgeBlock();
      setStep("refused");
    }
  }, [check]);

  /** The age answers again, as a safety net: the locked fields can't normally be reached. */
  function ageProblem(): string | null {
    if (!check) return "Choose your country and the month and year you were born.";
    if (check === "guardian" && !about.guardian) return "Please tick the box to confirm a parent or guardian agrees.";
    return null;
  }

  const ageAnswers = {
    country: about.country,
    birth_year: Number(about.year),
    birth_month: Number(about.month),
    guardian_agreed: aboutYouCheck(about) === "guardian" && about.guardian,
  };

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

  async function google() {
    setError(ageProblem());
    if (ageProblem()) return;
    if (!agreed) {
      setError(AGREE_FIRST);
      return;
    }
    setBusy(true);
    const problem = await continueWithGoogle({ agreed: true, next, age: ageAnswers });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(ageProblem());
    if (ageProblem()) return;
    const problem = emailProblem(email);
    setEmailError(problem);
    if (problem) return;
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (!agreed) {
      setError(AGREE_FIRST);
      return;
    }

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
      setBusy(false);
      if (signUpError) {
        if (/can't create a TypeWit account/i.test(signUpError.message)) {
          rememberAgeBlock();
          setStep("refused");
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

  if (step === "refused") {
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

  return (
    <div className="auth">
      <div className="auth-box">
        <h1 id="signup-title">Create your account</h1>
        <p className="sub">Free plan, no card needed.</p>

        <form className="auth-form signup-form" onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
          {!accountStep ? <>
            <p className="hint">Step 1 of 2 · Eligibility</p>
            <AboutYou value={about} onChange={setAbout} legend="First, your age" />
            <button type="button" className="btn btn-primary btn-block" disabled={!unlocked} onClick={() => setAccountStep(true)}>Continue</button>
          </> : <div className="row"><span className="hint">Step 2 of 2 · Account</span><button type="button" className="link-btn" onClick={() => setAccountStep(false)}>Edit age details</button></div>}

          <div className="signup-locked" hidden={!accountStep} data-locked={!unlocked || undefined}>
            <div className="signup-fields" inert={!unlocked}>
              <div className="agree-row">
                <label className="check" htmlFor="agree">
                  <input id="agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>I accept the Terms and Responsible Use Agreement and acknowledge the Privacy Policy</span>
                </label>
                <LegalDialog doc="agreement" onAgree={() => setAgreed(true)}>Read agreement</LegalDialog>
                <LegalDialog doc="terms">Terms</LegalDialog>
                <LegalDialog doc="privacy">Privacy</LegalDialog>
              </div>
              <p className="hint">For authorized testing only. Academic cheating and deceptive claims of authorship are prohibited.</p>
              <button type="button" className="btn btn-google btn-lg btn-block" onClick={google} disabled={busy}>
                <GoogleMark /> Continue with Google
              </button>
              <p className="or">or with email</p>
              <div className="field">
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" autoComplete="email" required value={email} placeholder="Personal email, e.g. you@gmail.com"
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => email && setEmailError(emailProblem(email))}
                  aria-invalid={emailError ? "true" : undefined} aria-describedby="email-hint email-error" />
                <span id="email-hint" className="sr-only">Use a personal address, such as Gmail, Outlook, Yahoo or iCloud.</span>
                {emailError && <span id="email-error" className="error-text">{emailError}</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="password">Password</label>
                <PasswordField id="password" autoComplete="new-password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)} aria-describedby="password-hint" placeholder="At least 8 characters" />
                <span id="password-hint" className="sr-only">At least 8 characters.</span>
              </div>
              {error && <p className="alert alert-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                {busy ? "Creating account…" : "Create free account"}
              </button>
            </div>
            {!unlocked && (
              <p className="signup-lock-note"><Icon.lock /> {check === "guardian" ? "Tick the parent or guardian box to continue" : "Answer the questions above to continue"}</p>
            )}
          </div>
          <p className="sr-only" role="status">{unlocked ? "Account options are now available." : ""}</p>
          <p className="hint center">
            By joining you also accept the <LegalDialog doc="terms">Terms</LegalDialog> and <LegalDialog doc="privacy">Privacy Policy</LegalDialog>.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <SignupForm />;
}

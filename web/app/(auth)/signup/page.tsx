"use client";

import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { LegalDialog } from "@/components/LegalDialog";
import { ageBlocked, rememberAgeBlock } from "@/lib/age";
import { emailProblem } from "@/lib/emailPolicy";
import { safeNext } from "@/lib/nextPath";
import { continueWithProvider, type SocialProvider } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

type Problems = Partial<Record<"email" | "password" | "agree", string>>;

/** Where focus goes for each problem, in the order they appear on the form. */
const FOCUS: [keyof Problems, string][] = [["email", "email"], ["password", "password"], ["agree", "agree"]];

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
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
    if (ageBlocked()) setRefused(true);
  }, []);

  /** Shows every problem under its field and moves focus to the first. */
  function report(found: Problems): boolean {
    setProblems(found);
    const first = FOCUS.find(([key]) => found[key]);
    if (!first) return false;
    const target = first[1];
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

  /** All signup methods ask age after authentication, before dashboard access. */
  async function social(provider: SocialProvider) {
    setError(null);
    setBusy(true);
    const problem = await continueWithProvider(provider, { agreed, next });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const found: Problems = {
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
          data: { agreed_terms_version: CURRENT_TERMS_VERSION },
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
          <p className="sub">We sent a confirmation link to <strong>{email}</strong>. Open it, then confirm your age to finish setting up.</p>
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
        <p className="sub">A little less typing. A little more time for you.</p>
        <p className="signup-step">1 · Create account <span aria-hidden="true">→</span> 2 · Confirm your age</p>

        <form className="auth-form signup" onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
          <fieldset className="signup-account" disabled={busy}>
            <legend className="sr-only">Your account</legend>
            <SocialSignInButtons busy={busy} onContinue={social} />
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
        <p className="signup-reassurance">Free to start. No card needed.</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <SignupForm />;
}

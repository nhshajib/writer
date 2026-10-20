"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { AgreementDialog } from "@/components/AgreementDialog";
import { GoogleMark } from "@/components/Icons";
import { emailProblem } from "@/lib/emailPolicy";
import { safeNext } from "@/lib/nextPath";
import { continueWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const AGREE_FIRST = "Please tick the box to agree to the Responsible Use Agreement first.";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState<string | null>(null);

  async function resend() {
    setResent(null);
    const { error: resendError } = await supabase().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });
    setResent(resendError ? resendError.message : "Sent again. It can take a minute; check your spam folder too.");
  }

  async function google() {
    setError(null);
    if (!agreed) {
      setError(AGREE_FIRST);
      return;
    }
    setBusy(true);
    const problem = await continueWithGoogle({ agreed: true, next });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
    const { data, error: signUpError } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { agreed_terms_version: CURRENT_TERMS_VERSION },
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) router.push(next);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="auth">
        <div className="auth-box" role="status">
          <h1>Check your email</h1>
          <p className="sub">We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.</p>
          <div className="auth-form">
            <button type="button" className="btn btn-block" onClick={resend}>Send the email again</button>
            <button type="button" className="link-btn" onClick={() => { setSent(false); setResent(null); }}>Use a different email</button>
            {resent && <p className="alert alert-info">{resent}</p>}
            <p className="small muted center">Already confirmed? <Link href="/login/">Sign in</Link></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth-box">
        <h1 id="signup-title">Create your account</h1>
        <p className="sub">Free plan, no card needed.</p>
        <form className="auth-form" onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
          <div className="agree-row">
            <label className="check" htmlFor="agree">
              <input id="agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I agree to the Responsible Use&nbsp;Agreement</span>
            </label>
            <AgreementDialog onAgree={() => setAgreed(true)} />
          </div>

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
            <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} aria-describedby="password-hint" placeholder="At least 8 characters" />
            <span id="password-hint" className="sr-only">At least 8 characters.</span>
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? "Creating account…" : "Create free account"}
          </button>
          <p className="small muted center">
            Already have an account? <Link href="/login/">Sign in</Link>
            <span className="hint block">You also accept the <Link href="/terms/">Terms</Link> and <Link href="/privacy/">Privacy Policy</Link>.</span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Agreement } from "@/components/Agreement";
import { GoogleMark } from "@/components/Icons";
import { emailProblem } from "@/lib/emailPolicy";
import { continueWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const AGREE_FIRST = "Please read the Responsible Use Agreement and tick the box to agree first.";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
        emailRedirectTo: `${window.location.origin}/app`,
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
      <div className="auth-card" role="status">
        <h1>Check your email</h1>
        <p className="subtitle">We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <form className="form" onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
        <div>
          <h1 id="signup-title">Create your account</h1>
          <p className="subtitle">Free forever. Upgrade to Pro only if you need more.</p>
        </div>

        <div className="field">
          <h2 style={{ fontSize: "1.1rem", margin: 0 }} id="agreement-title">1. Read and accept the agreement</h2>
          <p className="hint" style={{ margin: 0 }}>Please read it in full. You can scroll it with the keyboard.</p>
          <Agreement id="agreement" compact />
          <label className="choice" htmlFor="agree">
            <input id="agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
              aria-describedby="agreement" />
            <span>I have read the Responsible Use Agreement and agree to follow it.</span>
          </label>
        </div>

        <h2 style={{ fontSize: "1.1rem", margin: 0 }}>2. Choose how to sign up</h2>
        <button type="button" className="button google block large" onClick={google} disabled={busy}>
          <GoogleMark />
          Continue with Google
        </button>

        <p className="divider">or use email</p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && setEmailError(emailProblem(email))}
            aria-invalid={emailError ? "true" : undefined}
            aria-describedby="email-hint email-error"
          />
          <span id="email-hint" className="hint">Personal email from Gmail, Outlook, Yahoo, iCloud or similar.</span>
          {emailError && <span id="email-error" className="error">{emailError}</span>}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
          />
          <span id="password-hint" className="hint">At least 8 characters.</span>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="button block large" disabled={busy}>
          {busy ? "Creating account…" : "Create account with email"}
        </button>
        <p className="muted" style={{ textAlign: "center", margin: 0 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
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

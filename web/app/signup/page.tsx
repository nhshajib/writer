"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Agreement } from "@/components/Agreement";
import { emailProblem } from "@/lib/emailPolicy";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
      setError("Please read the Responsible Use Agreement and tick the box to agree.");
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
    if (data.session) {
      router.push(params.get("next") ?? "/app");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="form" role="status">
        <h1>Check your email</h1>
        <p>We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
      <h1 id="signup-title">Create your account</h1>

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

      <div className="field">
        <h2 style={{ fontSize: "1.15rem", margin: 0 }} id="agreement-title">Responsible Use Agreement</h2>
        <p className="hint" style={{ margin: 0 }}>Please read it in full. You can scroll it with the keyboard.</p>
        <Agreement id="agreement" compact />
        <label className="choice" htmlFor="agree">
          <input id="agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            aria-describedby="agreement" />
          <span>I have read the Responsible Use Agreement and agree to follow it.</span>
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <button type="submit" className="button" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="muted">Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

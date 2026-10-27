"use client";

import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { continueWithProvider, type SocialProvider } from "@/lib/googleAuth";
import { safeNext } from "@/lib/nextPath";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [next, setNext] = useState("/app/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("error");
    if (message) setError(message);
    setNext(safeNext(params.get("next")));
  }, []);

  async function social(provider: SocialProvider) {
    setError(null);
    setBusy(true);
    const problem = await continueWithProvider(provider, { agreed: false, next });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setUnconfirmed(false);
    setBusy(true);
    const { error: signInError } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      if (/not confirmed/i.test(signInError.message)) {
        setUnconfirmed(true);
        setError("Confirm your email first: open the link we sent when you signed up.");
        return;
      }
      setError(signInError.message === "Invalid login credentials" ? "The email or password is incorrect." : signInError.message);
      return;
    }
    router.push(next);
  }

  async function resendConfirmation() {
    setError(null);
    const { error: resendError } = await supabase().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/app/` },
    });
    if (resendError) setError(resendError.message);
    else {
      setUnconfirmed(false);
      setNotice("We've sent a new confirmation link. Check your inbox and spam folder.");
    }
  }

  async function resetPassword() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email first, then choose “Forgot password”.");
      return;
    }
    const { error: resetError } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password/`,
    });
    if (resetError) setError(resetError.message);
    else setNotice("If that email has an account, we've sent a link to reset the password.");
  }

  return (
    <div className="auth">
      <div className="auth-box">
        <h1 id="login-title">Welcome back</h1>
        <p className="sub">Sign in to TypeWit.</p>
        <form className="auth-form" onSubmit={onSubmit} aria-labelledby="login-title">
          <SocialSignInButtons busy={busy} onContinue={social} />
          <p className="or">or with email</p>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="label" htmlFor="password">Password</label>
              <button type="button" className="link-btn" onClick={resetPassword}>Forgot password?</button>
            </div>
            <PasswordField id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {unconfirmed && (
            <button type="button" className="btn btn-block" onClick={resendConfirmation}>Send the confirmation email again</button>
          )}
          {notice && <p className="alert alert-info" role="status">{notice}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="small muted center">New to TypeWit? <Link href={next === "/app/" ? "/signup/" : `/signup/?next=${encodeURIComponent(next)}`}>Create a free account</Link></p>
        </form>
      </div>
    </div>
  );
}

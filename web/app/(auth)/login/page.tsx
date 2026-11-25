"use client";

import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
import { Icon } from "@/components/Icons";
import { SignInArtwork } from "@/components/auth/SignInArtwork";
import { clearPendingSignIn, lastSignInMethod, rememberSignIn, type SignInMethod } from "@/lib/signInPreference";
import { PasswordField } from "@/components/PasswordField";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { continueWithProvider, type SocialProvider } from "@/lib/googleAuth";
import { safeNext } from "@/lib/nextPath";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [lastUsed, setLastUsed] = useState<SignInMethod | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const emailChoice = useRef<HTMLButtonElement>(null);
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
    setLastUsed(lastSignInMethod());
  }, []);

  useEffect(() => {
    if (emailOpen) emailInput.current?.focus();
  }, [emailOpen]);

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
    clearPendingSignIn();
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
    rememberSignIn("email");
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

  function showOptions() {
    setEmailOpen(false);
    setError(null);
    setNotice(null);
    requestAnimationFrame(() => emailChoice.current?.focus());
  }

  const signupHref = next === "/app/" ? "/signup/" : `/signup/?next=${encodeURIComponent(next)}`;

  return (
    <div className="signin-flow" data-step={emailOpen ? "email" : "options"} aria-busy={busy}>
      <header className="signin-header">
        <Link href="/" className="signin-brand" aria-label="TypeWit home"><Logo /><Wordmark /></Link>
      </header>
      <section className="signin-content" aria-labelledby="login-title">
        {/* A single illustration replaces the old decorative panel and carousel. */}
        {!emailOpen && <SignInArtwork />}
        {emailOpen && (
          <button type="button" className="signin-back" onClick={showOptions} disabled={busy}>
            <Icon.arrowRight />Other sign-in options
          </button>
        )}
        <div className="signin-intro">
          <h1 id="login-title">{emailOpen ? "Sign in with email" : "Sign in to TypeWit"}</h1>
          <p>{emailOpen ? "Use the email address on your account." : "Continue your writing sessions."}</p>
        </div>
        {/* Progressive disclosure keeps the first screen to three clear choices. */}
        {!emailOpen ? (
          <div className="signin-options">
            <SocialSignInButtons busy={busy} onContinue={social} prominent lastUsed={lastUsed} />
            <p className="signin-divider">or</p>
            <button ref={emailChoice} type="button" className="btn btn-block signin-email" disabled={busy}
              onClick={() => { setEmailOpen(true); setError(null); setNotice(null); }}
              aria-description={lastUsed === "email" ? "Last used on this device" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
              <span>Continue with Email</span>
              {lastUsed === "email" && <span className="signin-last-used" aria-hidden="true">Last used</span>}
            </button>
            {busy && <p className="signin-feedback" role="status">Connecting…</p>}
          </div>
        ) : (
          <form className="signin-form" onSubmit={onSubmit} aria-labelledby="login-title">
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input ref={emailInput} id="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            </div>
            <div className="field">
              <div className="signin-password-label">
                <label className="label" htmlFor="password">Password</label>
                <button type="button" className="link-btn" onClick={resetPassword} disabled={busy}>Forgot password?</button>
              </div>
              <PasswordField id="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            </div>
            {unconfirmed && (
              <button type="button" className="btn btn-block signin-email" onClick={resendConfirmation} disabled={busy}>
                Send the confirmation email again
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-block signin-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
        {error && <p className="alert alert-error signin-feedback" role="alert">{error}</p>}
        {notice && <p className="alert alert-info signin-feedback" role="status">{notice}</p>}
        <p className="signin-join">New to TypeWit? <Link href={signupHref}>Create an account</Link></p>
      </section>
    </div>
  );
}

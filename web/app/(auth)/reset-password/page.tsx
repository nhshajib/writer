"use client";

import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import { type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stage = "checking" | "ready" | "expired" | "done";

/** Where the "reset your password" email link lands: choose a new password. */
export default function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const linkError = hash.get("error_description") ?? new URLSearchParams(window.location.search).get("error_description");
    if (linkError) {
      setError(linkError);
      setStage("expired");
      return;
    }
    const client = supabase();
    // The client reads the token from the link and signs the person in for this reset.
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setStage((s) => (s === "checking" ? "ready" : s));
    });
    client.auth.getSession().then(({ data: current }) => {
      if (current.session) setStage((s) => (s === "checking" ? "ready" : s));
    });
    // No session after a few seconds means the link was used already or has expired.
    const timer = window.setTimeout(() => setStage((s) => (s === "checking" ? "expired" : s)), 5000);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStage("done");
  }

  return (
    <div className="auth">
      <div className="auth-box">
        <h1 id="reset-title">Choose a new password</h1>
        {stage === "checking" && <p className="sub" role="status">Checking your reset link…</p>}
        {stage === "expired" && (
          <div role="alert">
            <p className="sub">This reset link has expired or was already used.</p>
            {error && <p className="alert alert-error">{error}</p>}
            <p className="center mt-6">
              <Link className="btn btn-primary" href="/login/">Send a new link</Link>
            </p>
          </div>
        )}
        {stage === "done" && (
          <div role="status">
            <p className="sub">Your password is changed and you&apos;re signed in.</p>
            <p className="center mt-6">
              <Link className="btn btn-primary" href="/app/">Go to your dashboard</Link>
            </p>
          </div>
        )}
        {stage === "ready" && (
          <form className="auth-form" onSubmit={onSubmit} aria-labelledby="reset-title" noValidate>
            <div className="field">
              <label className="label" htmlFor="new-password">New password</label>
              <PasswordField id="new-password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="new-password-hint" />
              <p className="hint" id="new-password-hint">At least 8 characters.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="confirm-password">Repeat new password</label>
              <PasswordField id="confirm-password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

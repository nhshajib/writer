"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { GoogleMark } from "@/components/Icons";
import { continueWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) setError(message);
  }, []);

  async function google() {
    setError(null);
    setBusy(true);
    const problem = await continueWithGoogle({ agreed: false });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "The email or password is incorrect." : signInError.message);
      return;
    }
    router.push("/app");
  }

  async function resetPassword() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email first, then choose “Forgot password”.");
      return;
    }
    const { error: resetError } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account`,
    });
    if (resetError) setError(resetError.message);
    else setNotice("If that email has an account, we've sent a link to reset the password.");
  }

  return (
    <div className="auth-card">
      <form className="form" onSubmit={onSubmit} aria-labelledby="login-title">
        <div>
          <h1 id="login-title">Welcome back</h1>
          <p className="subtitle">Sign in to TypeWit.</p>
        </div>
        <button type="button" className="button google block large" onClick={google} disabled={busy}>
          <GoogleMark />
          Continue with Google
        </button>
        <p className="divider">or use email</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <button type="submit" className="button block large" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="button quiet block" onClick={resetPassword}>Forgot password</button>
        <p className="muted" style={{ textAlign: "center", margin: 0 }}>
          New to TypeWit? <Link href="/signup">Create a free account</Link>
        </p>
      </form>
    </div>
  );
}

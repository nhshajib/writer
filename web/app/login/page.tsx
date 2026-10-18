"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <form className="form" onSubmit={onSubmit} aria-labelledby="login-title">
      <h1 id="login-title">Sign in</h1>
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
      <button type="submit" className="button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <button type="button" className="button secondary" onClick={resetPassword}>Forgot password</button>
      <p className="muted">New to TypeWit? <Link href="/signup">Create an account</Link></p>
    </form>
  );
}

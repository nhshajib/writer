"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useRequireSession } from "@/lib/useRequireSession";

interface Profile {
  plan: "free" | "pro";
  subscription_status: string | null;
  email_notifications: boolean;
}

const STATUS_TEXT: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment problem: please update your card",
  canceled: "Canceled",
};

export default function AccountPage() {
  const session = useRequireSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [checkout, setCheckout] = useState<string | null>(null);

  async function loadProfile() {
    const { data, error: loadError } = await supabase()
      .from("profiles")
      .select("plan, subscription_status, email_notifications")
      .maybeSingle();
    if (loadError) setError(loadError.message);
    else setProfile(data as Profile | null);
  }

  useEffect(() => {
    if (session) loadProfile();
  }, [session]);

  useEffect(() => {
    setCheckout(new URLSearchParams(window.location.search).get("checkout"));
  }, []);

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("billing/portal", { method: "POST", body: {} });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open billing.");
      setBusy(false);
    }
  }

  async function toggleEmails(next: boolean) {
    if (!session) return;
    setError(null);
    const { error: updateError } = await supabase()
      .from("profiles")
      .update({ email_notifications: next })
      .eq("user_id", session.user.id);
    if (updateError) setError(updateError.message);
    else {
      setProfile((p) => (p ? { ...p, email_notifications: next } : p));
      setNotice(next ? "Email notifications are on." : "Email notifications are off.");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    const { error: passwordError } = await supabase().auth.updateUser({ password });
    if (passwordError) setError(passwordError.message);
    else {
      setPassword("");
      setNotice("Your password has been changed.");
    }
  }

  if (!session) return <p role="status">Loading…</p>;
  if (!profile) return error ? <p className="error" role="alert">{error}</p> : <p role="status">Loading your account…</p>;

  const isPro = profile.plan === "pro";

  return (
    <>
      <h1>Account</h1>
      <p className="muted">Signed in as {session.user.email}</p>

      {checkout === "success" && (
        <p className="notice" role="status">
          Thank you! Your plan can take a moment to update. <button type="button" className="button secondary small" onClick={loadProfile}>Refresh</button>
        </p>
      )}
      {notice && <p className="notice success" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="stack">
        <section className="card" aria-labelledby="plan-title">
          <h2 id="plan-title" style={{ fontSize: "1.3rem" }}>Your plan</h2>
          <p>
            <span className={isPro ? "pill pro" : "pill"}>{isPro ? "Pro" : "Free"}</span>
            {profile.subscription_status && <> · {STATUS_TEXT[profile.subscription_status] ?? profile.subscription_status}</>}
          </p>
          {isPro
            ? (
              <button type="button" className="button secondary" onClick={openPortal} disabled={busy}>
                {busy ? "Opening…" : "Manage billing"}
              </button>
            )
            : (
              <div className="upsell" style={{ marginTop: "0.5rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem" }}>Upgrade to Pro</h3>
                  <p>Unlimited words, sessions up to a week and 3 documents at once. Free for 7 days.</p>
                </div>
                <Link href="/pricing" className="button pro">Start free trial</Link>
              </div>
            )}
        </section>

        <section className="card" aria-labelledby="email-title">
          <h2 id="email-title" style={{ fontSize: "1.3rem" }}>Notifications</h2>
          <label className="choice" htmlFor="emails">
            <input
              id="emails"
              type="checkbox"
              checked={profile.email_notifications}
              onChange={(e) => toggleEmails(e.target.checked)}
            />
            <span>Email me when a session finishes or stops because of an error.</span>
          </label>
        </section>

        <section className="card" aria-labelledby="password-title">
          <h2 id="password-title" style={{ fontSize: "1.3rem" }}>Change password</h2>
          <form onSubmit={changePassword} className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} aria-describedby="new-password-hint" />
            <span id="new-password-hint" className="hint">At least 8 characters.</span>
            <button type="submit" className="button secondary" style={{ justifySelf: "start" }}>Change password</button>
          </form>
        </section>
      </div>
    </>
  );
}

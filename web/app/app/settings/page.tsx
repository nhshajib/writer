"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { formatDate, useDashboard } from "@/lib/dashboard";
import { SUPPORT_EMAIL } from "@/lib/site";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function SettingsPage() {
  const { session, profile, connections, drips, notifications, displayName, setProfile, refresh } = useDashboard();
  const user = session.user;
  const providers = ((user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider ?? "email"]);
  const hasPassword = providers.includes("email");

  const [name, setName] = useState(displayName);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const finishedCount = drips.filter((d) => ["completed", "canceled", "failed"].includes(d.status)).length;
  const [confirmClear, setConfirmClear] = useState(false);

  async function clearFinished() {
    setBusy("clear");
    try {
      const res = await api<{ deleted: number }>("drips/clear", { method: "POST", body: {} });
      await refresh();
      setConfirmClear(false);
      done(`Deleted ${res.deleted} finished session${res.deleted === 1 ? "" : "s"} and their saved text.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete sessions.");
    } finally {
      setBusy(null);
    }
  }

  function done(message: string) {
    setError(null);
    setNotice(message);
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return setError("Enter a name.");
    setBusy("name");
    const { error: updateError } = await supabase().auth.updateUser({ data: { full_name: trimmed } });
    setBusy(null);
    if (updateError) setError(updateError.message);
    else done("Your name has been saved.");
  }

  async function toggleEmails(next: boolean) {
    const { error: updateError } = await supabase()
      .from("profiles")
      .update({ email_notifications: next })
      .eq("user_id", user.id);
    if (updateError) return setError(updateError.message);
    setProfile({ email_notifications: next });
    done(next ? "Email notifications are on." : "Email notifications are off.");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy("password");
    const { error: passwordError } = await supabase().auth.updateUser({ password });
    setBusy(null);
    if (passwordError) return setError(passwordError.message);
    setPassword("");
    done("Your password has been changed.");
  }

  function downloadData() {
    const data = {
      exported_at: new Date().toISOString(),
      account: { email: user.email, name: displayName, created_at: user.created_at, sign_in_methods: providers },
      plan: { plan: profile.plan, subscription_status: profile.subscription_status },
      preferences: { email_notifications: profile.email_notifications },
      responsible_use_agreement: profile.agreed_terms_version,
      google_accounts: connections.map((c) => ({ email: c.account_email, connected: c.connected !== false })),
      sessions: drips.map((d) => ({
        document: d.document_title,
        document_url: d.document_url,
        status: d.status,
        words_entered: d.progress.words_written,
        words_total: d.progress.words_total,
        insertion_unit: d.insertion_unit,
        mode: d.mode,
        approved_at: d.approved_at,
        created_at: d.created_at,
      })),
      notifications: notifications.map((n) => ({ title: n.title, body: n.body, created_at: n.created_at })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "typewit-my-data.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const deleteHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Delete my TypeWit account")}&body=${
    encodeURIComponent(`Please delete my TypeWit account (${user.email}) and its data.`)
  }`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your profile, notifications, security and data.</p>
        </div>
      </div>

      {(notice || error) && (
        <div style={{ marginBottom: "1.25rem" }}>
          {notice && <p className="alert alert-success" role="status">{notice}</p>}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
        </div>
      )}

      <div className="settings">
        <section className="setting" aria-labelledby="profile-title">
          <div><h2 id="profile-title">Profile</h2><p>How TypeWit greets you.</p></div>
          <div className="stack">
            <div className="row">
              <span className="avatar lg" aria-hidden="true">{(name.trim() || displayName).charAt(0).toUpperCase()}</span>
              <div>
                <strong>{name.trim() || displayName}</strong>
                <div className="small muted">Member since {formatDate(user.created_at)}</div>
              </div>
            </div>
            <form onSubmit={saveName} className="field" style={{ maxWidth: 420 }}>
              <label className="label" htmlFor="name">Name</label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input id="name" type="text" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
                <button type="submit" className="btn btn-secondary" disabled={busy === "name"}>{busy === "name" ? "Saving…" : "Save"}</button>
              </div>
            </form>
            <dl className="kv">
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Sign-in</dt><dd>{providers.map((p) => (p === "google" ? "Google" : "Email and password")).join(", ")}</dd>
            </dl>
          </div>
        </section>

        <section className="setting" aria-labelledby="notify-title">
          <div><h2 id="notify-title">Notifications</h2><p>Updates always appear on your Overview.</p></div>
          <label className="check" htmlFor="emails">
            <input id="emails" type="checkbox" checked={profile.email_notifications} onChange={(e) => toggleEmails(e.target.checked)} />
            <span>Email me when a session finishes or stops because of an error.</span>
          </label>
        </section>

        <section className="setting" aria-labelledby="security-title">
          <div><h2 id="security-title">Security</h2><p>Keep your account safe.</p></div>
          {hasPassword
            ? (
              <form onSubmit={changePassword} className="field" style={{ maxWidth: 420 }}>
                <label className="label" htmlFor="new-password">New password</label>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password}
                    onChange={(e) => setPassword(e.target.value)} aria-describedby="new-password-hint" />
                  <button type="submit" className="btn btn-secondary" disabled={busy === "password"}>{busy === "password" ? "Saving…" : "Update"}</button>
                </div>
                <span id="new-password-hint" className="hint">At least 8 characters.</span>
              </form>
            )
            : <p className="small muted">You sign in with Google, so there&apos;s no TypeWit password. Manage security in your Google Account.</p>}
        </section>

        <section className="setting" aria-labelledby="agreement-title">
          <div><h2 id="agreement-title">Responsible use</h2><p>The agreement everyone accepts.</p></div>
          <p className="small" style={{ color: "var(--text-2)" }}>
            {profile.agreed_terms_version === CURRENT_TERMS_VERSION ? <>You accepted version {CURRENT_TERMS_VERSION}. </> : <>You haven&apos;t accepted the current version. </>}
            <Link href="/responsible-use">Read the agreement</Link>
          </p>
        </section>

        <section className="setting" aria-labelledby="data-title">
          <div><h2 id="data-title">Your data</h2><p>What TypeWit keeps, and clearing it.</p></div>
          <div className="stack" style={{ gap: "0.75rem", justifyItems: "start" }}>
            <ul className="small muted" style={{ paddingLeft: "1.1rem" }}>
              <li>Each session&apos;s approved text, its split into steps and its schedule are stored in TypeWit&apos;s database (Supabase), readable only by your account.</li>
              <li>The activity log stores times, counts and outcomes, not your text.</li>
              <li>Your Google access token is stored encrypted and is never sent to your browser. TypeWit can only open documents it created (Google&apos;s <code>drive.file</code> permission).</li>
              <li>This browser remembers only your pace settings and announcement preference.</li>
            </ul>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadData}>Download my data</button>
            {!confirmClear
              ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)} disabled={finishedCount === 0}>
                  Delete finished sessions ({finishedCount})
                </button>
              )
              : (
                <div className="confirm" role="alertdialog" aria-labelledby="clear-title" onKeyDown={(e) => e.key === "Escape" && setConfirmClear(false)}>
                  <p id="clear-title">Delete {finishedCount} finished session{finishedCount === 1 ? "" : "s"}?</p>
                  <p className="small muted">Their saved text, schedules and logs are removed from TypeWit. Unfinished sessions and your Google Docs are not touched.</p>
                  <div className="row">
                    <button type="button" className="btn btn-danger-solid btn-sm" onClick={clearFinished} disabled={busy === "clear"} autoFocus>Delete</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>Keep</button>
                  </div>
                </div>
              )}
          </div>
        </section>

        <section className="setting" aria-labelledby="danger-title">
          <div><h2 id="danger-title">Delete account</h2><p>Permanent and can&apos;t be undone.</p></div>
          <div className="stack" style={{ gap: "0.75rem", justifyItems: "start" }}>
            <p className="small muted">
              We&apos;ll delete your account, sessions and activity log within 30 days.
              {profile.plan === "pro" && <> Cancel Pro in <Link href="/app/billing">Plan &amp; billing</Link> first.</>}
            </p>
            <a className="btn btn-danger btn-sm" href={deleteHref}>Request deletion</a>
            <p className="hint">Opens an email to {SUPPORT_EMAIL}.</p>
          </div>
        </section>
      </div>
    </>
  );
}

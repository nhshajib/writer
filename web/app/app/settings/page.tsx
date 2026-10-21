"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Icon } from "@/components/Icons";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { formatDate, useDashboard } from "@/lib/dashboard";
import { SUPPORT_EMAIL } from "@/lib/site";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const SECTIONS = [
  ["profile", "Profile", Icon.user],
  ["notifications", "Notifications", Icon.bell],
  ["security", "Security", Icon.lock],
  ["privacy", "Data & privacy", Icon.shield],
  ["danger", "Delete account", Icon.trash],
] as const;

export default function SettingsPage() {
  const { session, profile, connections, drips, notifications, displayName, setProfile, refresh } = useDashboard();
  const user = session.user;
  const providers = ((user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider ?? "email"]);
  const hasPassword = providers.includes("email");

  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
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
    toast(message);
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

  // email_notifications is the master switch; each box turns one kind of email on or off.
  const emailOn = {
    completed: profile.email_notifications && profile.email_on_completed !== false,
    attention: profile.email_notifications && profile.email_on_attention !== false,
  };

  async function toggleEmail(kind: "completed" | "attention", next: boolean) {
    const before = {
      email_notifications: profile.email_notifications,
      email_on_completed: profile.email_on_completed,
      email_on_attention: profile.email_on_attention,
    };
    const other = kind === "completed" ? emailOn.attention : emailOn.completed;
    const patch = {
      email_on_completed: kind === "completed" ? next : emailOn.completed,
      email_on_attention: kind === "attention" ? next : emailOn.attention,
      email_notifications: next || other,
    };
    setBusy(`email-${kind}`);
    setProfile(patch);
    const { error: updateError } = await supabase().from("profiles").update(patch).eq("user_id", user.id);
    setBusy(null);
    if (updateError) {
      setProfile(before);
      return setError(`Couldn't save that: ${updateError.message}`);
    }
    done(next ? "Saved. We'll email you about that." : "Saved. We won't email you about that.");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword) return setError("Enter your current password.");
    if (password.length < 8) return setError("Use a new password with at least 8 characters.");
    setBusy("password");
    // Check the current password first, so an unattended signed-in screen can't be used to take over the account.
    const { error: checkError } = await supabase().auth.signInWithPassword({ email: user.email ?? "", password: currentPassword });
    if (checkError) {
      setBusy(null);
      return setError("Your current password isn't right.");
    }
    const { error: passwordError } = await supabase().auth.updateUser({ password });
    setBusy(null);
    if (passwordError) return setError(passwordError.message);
    setPassword("");
    setCurrentPassword("");
    done("Your password has been changed.");
  }

  async function setFirstPassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy("password");
    const { error: passwordError } = await supabase().auth.updateUser({ password });
    setBusy(null);
    if (passwordError) return setError(passwordError.message);
    setPassword("");
    done("Password set. You can now sign in with your email and this password, for example in Word.");
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    const next = newEmail.trim();
    if (!next || next.toLowerCase() === (user.email ?? "").toLowerCase()) return setError("Enter the new email address.");
    setBusy("email");
    const { error: emailError } = await supabase().auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/app/settings/` },
    );
    setBusy(null);
    if (emailError) return setError(emailError.message);
    setNewEmail("");
    done(`Check ${next} (and your current inbox) for a link to confirm the change.`);
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setBusy("delete");
    try {
      await api("drips/account/delete", { method: "POST", body: { confirm_email: deleteEmail } });
      await supabase().auth.signOut();
      router.push("/?account=deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the account.");
      setBusy(null);
    }
  }

  function downloadData() {
    const data = {
      exported_at: new Date().toISOString(),
      account: { email: user.email, name: displayName, created_at: user.created_at, sign_in_methods: providers },
      plan: { plan: profile.plan, subscription_status: profile.subscription_status },
      preferences: {
        email_notifications: profile.email_notifications,
        email_when_finished: emailOn.completed,
        email_when_attention_needed: emailOn.attention,
      },
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

      {error && <p className="alert alert-error mb-5" role="alert">{error}</p>}

      <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        <ul>
          {SECTIONS.map(([id, label, SectionIcon]) => (
            <li key={id}><a href={`#${id}`}><SectionIcon />{label}</a></li>
          ))}
        </ul>
      </nav>
      <div className="settings">
        <section className="setting" id="profile" aria-labelledby="profile-title">
          <div><h2 id="profile-title">Profile</h2><p>How TypeWit greets you.</p></div>
          <div className="stack">
            <div className="row">
              <span className="avatar lg" aria-hidden="true">{(name.trim() || displayName).charAt(0).toUpperCase()}</span>
              <div>
                <strong>{name.trim() || displayName}</strong>
                {!Number.isNaN(Date.parse(user.created_at)) && <div className="small muted">Member since {formatDate(user.created_at)}</div>}
              </div>
            </div>
            <form onSubmit={saveName} className="field" style={{ maxWidth: 420 }}>
              <label className="label" htmlFor="name">Name</label>
              <div className="row input-row">
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

        <section className="setting" id="notifications" aria-labelledby="notify-title">
          <div><h2 id="notify-title">Notifications</h2><p>Updates always appear under the bell at the top of every page.</p></div>
          <div className="stack" style={{ gap: 0 }}>
            <label className="check" htmlFor="email-completed">
              <input id="email-completed" type="checkbox" role="switch" checked={emailOn.completed} disabled={busy === "email-completed"}
                onChange={(e) => toggleEmail("completed", e.target.checked)} />
              <span>Email me when a session finishes.</span>
            </label>
            <label className="check" htmlFor="email-attention">
              <input id="email-attention" type="checkbox" role="switch" checked={emailOn.attention} disabled={busy === "email-attention"}
                onChange={(e) => toggleEmail("attention", e.target.checked)} />
              <span>Email me when a session pauses and needs me (for example, the document can&apos;t be reached).</span>
            </label>
          </div>
        </section>

        <section className="setting" id="security" aria-labelledby="security-title">
          <div><h2 id="security-title">Security</h2><p>Keep your account safe.</p></div>
          {hasPassword
            ? (
              <div className="stack" style={{ maxWidth: 420 }}>
                <form onSubmit={changePassword} className="stack" style={{ gap: "0.75rem" }} aria-label="Change password">
                  <input type="email" autoComplete="username" value={user.email ?? ""} readOnly hidden />
                  <div className="field">
                    <label className="label" htmlFor="current-password">Current password</label>
                    <input id="current-password" type="password" autoComplete="current-password" value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="new-password">New password</label>
                    <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password}
                      onChange={(e) => setPassword(e.target.value)} aria-describedby="new-password-hint" />
                    <span id="new-password-hint" className="hint">At least 8 characters.</span>
                  </div>
                  <div><button type="submit" className="btn btn-secondary" disabled={busy === "password"}>{busy === "password" ? "Saving…" : "Change password"}</button></div>
                </form>
                <form onSubmit={changeEmail} className="field" aria-label="Change email">
                  <label className="label" htmlFor="new-email">New email address</label>
                  <div className="row input-row">
                    <input id="new-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} aria-describedby="new-email-hint" />
                    <button type="submit" className="btn btn-secondary" disabled={busy === "email"}>{busy === "email" ? "Sending…" : "Change"}</button>
                  </div>
                  <span id="new-email-hint" className="hint">We&apos;ll send a confirmation link. Your email stays {user.email} until you confirm.</span>
                </form>
              </div>
            )
            : (
              <form onSubmit={setFirstPassword} className="field" style={{ maxWidth: 420 }} aria-label="Set a password">
                <p className="small muted" style={{ marginBottom: "0.5rem" }}>
                  You sign in with Google. To use the TypeWit add-in in Microsoft Word, which can&apos;t show Google&apos;s
                  sign-in, set a TypeWit password too. Google sign-in keeps working.
                </p>
                <label className="label" htmlFor="first-password">Password</label>
                <div className="row input-row">
                  <input id="first-password" type="password" autoComplete="new-password" minLength={8} value={password}
                    onChange={(e) => setPassword(e.target.value)} aria-describedby="first-password-hint" />
                  <button type="submit" className="btn btn-secondary" disabled={busy === "password"}>{busy === "password" ? "Saving…" : "Set password"}</button>
                </div>
                <span id="first-password-hint" className="hint">At least 8 characters. Sign in to Word with {user.email} and this password.</span>
              </form>
            )}
        </section>

        <section className="setting" id="privacy" aria-labelledby="agreement-title">
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
              <li>Your Google access token is stored encrypted. A short-lived copy is sent to your browser only while Google&apos;s file picker is open. TypeWit can only open documents it created or that you chose in that picker (Google&apos;s <code>drive.file</code> permission).</li>
              <li>Word sessions run in the TypeWit add-in inside Word, which edits only the document it is open in. TypeWit stores no Microsoft password or token.</li>
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

        <section className="setting danger-zone" id="danger" aria-labelledby="danger-title">
          <div><h2 id="danger-title">Delete account</h2><p>Permanent and can&apos;t be undone.</p></div>
          <div className="stack" style={{ gap: "0.75rem", justifyItems: "start" }}>
            <p className="small muted">
              Deletes your account, every session&apos;s saved text, schedule and activity log, your notifications and
              your Google connection, straight away. Unfinished sessions stop. Your documents are not touched.
              {profile.plan === "pro" && <> Cancel Pro in <Link href="/app/billing">Plan &amp; usage</Link> first.</>}
            </p>
            {!deleteOpen
              ? <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteOpen(true)}>Delete my account…</button>
              : (
                <form className="confirm" role="alertdialog" aria-labelledby="delete-title" onSubmit={deleteAccount}
                  onKeyDown={(e) => e.key === "Escape" && setDeleteOpen(false)}>
                  <p id="delete-title">Delete your TypeWit account permanently?</p>
                  <div className="field">
                    <label className="label" htmlFor="delete-email">Type {user.email} to confirm</label>
                    <input id="delete-email" type="email" autoComplete="off" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} autoFocus />
                  </div>
                  <div className="row">
                    <button type="submit" className="btn btn-danger-solid btn-sm"
                      disabled={busy === "delete" || deleteEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()}>
                      {busy === "delete" ? "Deleting…" : "Delete account"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteOpen(false)}>Keep my account</button>
                  </div>
                </form>
              )}
            <p className="hint">Questions first? Email <a href={deleteHref}>{SUPPORT_EMAIL}</a>.</p>
          </div>
        </section>
      </div>
      </div>
    </>
  );
}

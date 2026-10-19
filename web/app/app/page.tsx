"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionRow } from "@/components/app/SessionRow";
import { Icon } from "@/components/Icons";
import { ACTIVE_STATUSES, connectGoogleDocs, formatRelative, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { dailyResetTime } from "@/lib/time";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const { profile, connections, drips, notifications, wordsToday, displayName, markAllRead, markRead } = useDashboard();
  const [hello, setHello] = useState("Welcome");
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    setHello(greeting());
    setGoogleStatus(new URLSearchParams(window.location.search).get("google"));
  }, []);

  const isPro = profile.plan === "pro";
  const limits = PLAN_LIMITS[profile.plan];
  const active = drips.filter((d) => ACTIVE_STATUSES.has(d.status));
  const recent = drips.filter((d) => !ACTIVE_STATUSES.has(d.status)).slice(0, 5);
  const totalWords = drips.reduce((sum, d) => sum + d.progress.words_written, 0);
  const googleConnected = connections.some((c) => c.provider === "google" && c.connected !== false);
  const unread = notifications.filter((n) => !n.read_at).length;
  const usage = limits.dailyWords ? Math.min(100, Math.round((wordsToday / limits.dailyWords) * 100)) : 0;
  const isNew = !googleConnected || drips.length === 0;

  async function connect() {
    setConnectError(null);
    try {
      await connectGoogleDocs("/app");
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Couldn't start connecting to Google.");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{hello}, {displayName.split(" ")[0]}</h1>
          <p>{active.length ? `${active.length} session${active.length === 1 ? "" : "s"} in progress.` : "Here's your writing at a glance."}</p>
        </div>
      </div>

      {googleStatus === "connected" && <p className="alert alert-success" role="status" style={{ marginBottom: "1.25rem" }}>Your Google account is connected.</p>}
      {googleStatus === "error" && <p className="alert alert-error" role="alert" style={{ marginBottom: "1.25rem" }}>We couldn&apos;t connect your Google account. Please try again.</p>}

      {isNew && (
        <section className="card" aria-labelledby="setup-title" style={{ marginBottom: "1.5rem" }}>
          <div className="card-head">
            <h2 id="setup-title">Get started</h2>
            <span className="small muted">Takes about two minutes</span>
          </div>
          <ol className="setup" style={{ listStyle: "none" }}>
            <li className={`setup-step${googleConnected ? " done" : ""}`}>
              <span className="n" aria-hidden="true">{googleConnected ? <Icon.check /> : 1}</span>
              <strong>Connect Google Docs{googleConnected && <span className="sr-only"> (done)</span>}</strong>
              <span>Lets TypeWit create documents and add your text.</span>
              {!googleConnected && <button type="button" className="btn btn-primary btn-sm" onClick={connect}>Connect</button>}
            </li>
            <li className={`setup-step${drips.length ? " done" : ""}`}>
              <span className="n" aria-hidden="true">{drips.length ? <Icon.check /> : 2}</span>
              <strong>Start your first session</strong>
              <span>Paste your text, approve it, choose the pace.</span>
              {!drips.length && <Link href="/app/new" className={`btn btn-sm ${googleConnected ? "btn-primary" : "btn-secondary"}`}>New session</Link>}
            </li>
            <li className={`setup-step${isPro ? " done" : ""}`}>
              <span className="n" aria-hidden="true">{isPro ? <Icon.check /> : 3}</span>
              <strong>Writing something long?</strong>
              <span>Pro has no daily limit. Free for 7 days.</span>
              {!isPro && <Link href="/app/billing" className="btn btn-secondary btn-sm">See Pro</Link>}
            </li>
          </ol>
          {connectError && <p className="alert alert-error" role="alert" style={{ marginTop: "1rem" }}>{connectError}</p>}
        </section>
      )}

      {drips.length > 0 && (
        <dl className="stats">
          <div>
            <dt>Words today</dt>
            <dd>
              {wordsToday.toLocaleString()} <small>{limits.dailyWords ? `/ ${limits.dailyWords}` : "· unlimited"}</small>
              {limits.dailyWords && <div className={`progress${usage >= 90 ? " warn" : ""}`} aria-hidden="true"><span style={{ width: `${usage}%` }} /></div>}
            </dd>
          </div>
          <div><dt>In progress</dt><dd>{active.length} <small>/ {limits.activeSessions}</small></dd></div>
          <div><dt>Words entered</dt><dd>{totalWords.toLocaleString()}</dd></div>
          <div><dt>Finished</dt><dd>{drips.filter((d) => d.status === "completed").length}</dd></div>
        </dl>
      )}

      {!isPro && limits.dailyWords && wordsToday >= limits.dailyWords * 0.8 && (
        <p className="alert alert-info" style={{ marginBottom: "1.5rem" }}>
          <span>You&apos;ve used most of today&apos;s {limits.dailyWords.toLocaleString()} words. They reset at {dailyResetTime()}; Pro has no limit. <Link href="/app/billing">Try Pro free</Link></span>
        </p>
      )}

      {(drips.length > 0 || notifications.length > 0) && (
        <div className="grid-2">
          <section className="card card-flush" aria-labelledby="active-title">
            <div className="card-head">
              <h2 id="active-title">{active.length ? "In progress" : "Recent sessions"}</h2>
              <Link href="/app/sessions" className="small">View all</Link>
            </div>
            {(active.length ? active : recent).length === 0
              ? <div className="empty"><p>No sessions yet.</p></div>
              : <ul className="list">{(active.length ? active : recent).map((d) => <li key={d.id}><SessionRow drip={d} /></li>)}</ul>}
          </section>

          <section className="card card-flush" aria-labelledby="updates-title">
            <div className="card-head">
              <h2 id="updates-title">Updates{unread > 0 && <span className="sr-only"> ({unread} unread)</span>}</h2>
              {unread > 0 && <button type="button" className="link-btn" onClick={markAllRead}>Mark all as read</button>}
            </div>
            {notifications.length === 0
              ? <div className="empty"><p>We&apos;ll let you know here when a session finishes.</p></div>
              : (
                <ul className="list">
                  {notifications.slice(0, 6).map((n) => (
                    <li key={n.id}>
                      <div className="list-item" style={{ alignItems: "flex-start" }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, flex: "none", background: n.read_at ? "transparent" : "var(--accent)" }} />
                        <div className="main">
                          {n.drip_id
                            ? <Link href={`/app/session?id=${n.drip_id}`} className="title" onClick={() => markRead(n.id)}>{n.title}</Link>
                            : <span className="title">{n.title}</span>}
                          <div className="meta">{n.body}</div>
                          <div className="meta">{formatRelative(n.created_at)}{!n.read_at && <span className="sr-only"> (unread)</span>}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </section>
        </div>
      )}
    </>
  );
}

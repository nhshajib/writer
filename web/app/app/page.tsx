"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionRow } from "@/components/app/SessionRow";
import { Icon } from "@/components/Icons";
import { ACTIVE_STATUSES, connectGoogleDocs, formatRelative, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
  const finished = drips.filter((d) => d.status === "completed").length;
  const totalWords = drips.reduce((sum, d) => sum + d.progress.words_written, 0);
  const googleConnected = connections.some((c) => c.provider === "google" && c.connected !== false);
  const unread = notifications.filter((n) => !n.read_at).length;
  const usagePercent = limits.dailyWords ? Math.min(100, Math.round((wordsToday / limits.dailyWords) * 100)) : 0;

  const steps = [
    { done: googleConnected, label: "Connect Google Docs", action: "connect" as const },
    { done: drips.length > 0, label: "Start your first session", action: "/app/new" },
    ...(isPro ? [] : [{ done: false, label: "Try Pro free for 7 days", action: "/app/billing" }]),
  ];
  const showSetup = !googleConnected || drips.length === 0;

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
      <div className="dash-head">
        <div>
          <h1>{hello}, {displayName.split(" ")[0]}</h1>
          <p>{active.length ? `${active.length} session${active.length === 1 ? "" : "s"} in progress.` : "Here's your writing at a glance."}</p>
        </div>
      </div>

      {googleStatus === "connected" && <p className="notice success" role="status">Your Google account is connected.</p>}
      {googleStatus === "error" && <p className="notice error" role="alert">We couldn't connect your Google account. Please try again.</p>}

      {showSetup && (
        <section className="panel" aria-labelledby="setup-title" style={{ marginBottom: "1.25rem" }}>
          <div className="panel-head">
            <h2 id="setup-title">Get set up</h2>
            <span className="row-sub">{steps.filter((s) => s.done).length} of {steps.length} done</span>
          </div>
          <ol className="checklist">
            {steps.map((step) => (
              <li key={step.label} className={step.done ? "done" : undefined}>
                <span className="tick" aria-hidden="true"><Icon.check /></span>
                <span className="label">{step.label}{step.done && <span className="sr-only"> (done)</span>}</span>
                {!step.done && (step.action === "connect"
                  ? <button type="button" className="button small" onClick={connect}>Connect</button>
                  : <Link href={step.action} className={step.action === "/app/billing" ? "button small pro" : "button small"}>
                    {step.action === "/app/billing" ? "Start trial" : "Start"}
                  </Link>)}
              </li>
            ))}
          </ol>
          {connectError && <p className="error" role="alert" style={{ marginTop: "0.75rem" }}>{connectError}</p>}
        </section>
      )}

      {drips.length > 0 && <dl className="stat-grid">
        <div className="stat">
          <dt>Words today</dt>
          <dd>
            {wordsToday.toLocaleString()}
            <small> {limits.dailyWords ? `of ${limits.dailyWords}` : "· unlimited"}</small>
          </dd>
          {limits.dailyWords && (
            <div className={`meter${usagePercent >= 90 ? " warn" : ""}`} aria-hidden="true"><span style={{ width: `${usagePercent}%` }} /></div>
          )}
        </div>
        <div className="stat">
          <dt>Active sessions</dt>
          <dd>{active.length}<small> of {limits.activeSessions}</small></dd>
        </div>
        <div className="stat">
          <dt>Words entered</dt>
          <dd>{totalWords.toLocaleString()}</dd>
        </div>
        <div className="stat">
          <dt>Finished sessions</dt>
          <dd>{finished}</dd>
        </div>
      </dl>}

      {!isPro && limits.dailyWords && wordsToday >= limits.dailyWords * 0.8 && (
        <section className="upsell" aria-labelledby="limit-title" style={{ marginBottom: "1.25rem" }}>
          <div>
            <h2 id="limit-title">You're close to today's limit</h2>
            <p>Free resets at midnight UTC. Pro has no daily limit.</p>
          </div>
          <Link href="/app/billing" className="button pro">Try Pro free</Link>
        </section>
      )}

      {(drips.length > 0 || notifications.length > 0) && (
      <div className="dash-grid cols-2">
        <section className="panel" aria-labelledby="active-title">
          <div className="panel-head">
            <h2 id="active-title">In progress</h2>
            <Link href="/app/sessions">All sessions</Link>
          </div>
          {active.length === 0
            ? (
              <div className="empty">
                <span className="icon-badge"><Icon.list /></span>
                <p>Nothing in progress.</p>
                <Link href="/app/new" className="button small">Start a session</Link>
              </div>
            )
            : (
              <ul className="row-list">
                {active.map((drip) => <li key={drip.id}><SessionRow drip={drip} /></li>)}
              </ul>
            )}
        </section>

        <section className="panel" aria-labelledby="updates-title">
          <div className="panel-head">
            <h2 id="updates-title">Updates{unread > 0 && <span className="sr-only"> ({unread} unread)</span>}</h2>
            {unread > 0 && <button type="button" className="link-button" onClick={markAllRead}>Mark all as read</button>}
          </div>
          {notifications.length === 0
            ? (
              <div className="empty">
                <span className="icon-badge"><Icon.bell /></span>
                <p>We'll let you know here when a session finishes.</p>
              </div>
            )
            : (
              <ul className="row-list">
                {notifications.slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                      <span className={`dot${n.read_at ? " read" : ""}`} aria-hidden="true" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        {n.drip_id
                          ? <Link href={`/app/session?id=${n.drip_id}`} className="row-title" onClick={() => markRead(n.id)}>{n.title}</Link>
                          : <strong>{n.title}</strong>}
                        <div className="row-sub">{n.body}</div>
                        <div className="row-sub">{formatRelative(n.created_at)}{!n.read_at && <span className="sr-only"> (unread)</span>}</div>
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

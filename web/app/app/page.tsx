"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart } from "@/components/app/Charts";
import { AttentionCard, LiveHero, statusLine, titleOf } from "@/components/app/SessionCards";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Icon } from "@/components/Icons";
import { ACTIVE_STATUSES, connectGoogleDocs, formatRelative, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { useNow, useSessionControl } from "@/lib/sessionActions";
import { clock, dailyResetTime, when } from "@/lib/time";
import { type Drip, stateOf } from "@/lib/types";

const DAY = 86_400_000;

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const dayKey = (t: number | string) => new Date(t).toDateString();

interface Moment { at: number; label: string; drip: Drip }

/** What happens today: starts, breaks and finishes, earliest first. */
function todayMoments(drips: Drip[], now: number): Moment[] {
  const list: Moment[] = [];
  const add = (iso: string | null | undefined, label: string, drip: Drip) => {
    if (!iso) return;
    const at = Date.parse(iso);
    if (dayKey(at) === dayKey(now) || (at > now && at - now < DAY)) list.push({ at, label, drip });
  };
  for (const d of drips) {
    const p = d.progress;
    if (d.status === "completed") add(p.finish_at, "Finished", d);
    if (!ACTIVE_STATUSES.has(d.status)) continue;
    if (d.session_started_at && Date.parse(d.session_started_at) > now && p.chunks_written === 0) add(d.session_started_at, "Starts", d);
    if (p.current_break) add(p.current_break.end, "Break ends", d);
    if (p.next_break) add(p.next_break.start, "Planned break", d);
    if (d.status !== "paused") add(p.finish_at, "Expected to finish", d);
  }
  return list.sort((a, b) => a.at - b.at).slice(0, 7);
}

export default function HomePage() {
  const { profile, connections, drips, wordsToday, displayName } = useDashboard();
  const control = useSessionControl();
  const now = useNow();
  const [hello, setHello] = useState("Welcome");
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    setHello(greeting());
    setGoogleStatus(new URLSearchParams(window.location.search).get("google"));
  }, []);

  const limits = PLAN_LIMITS[profile.plan];
  // Running sessions come first, so the main card shows one that is moving.
  const live = drips.filter((d) => ACTIVE_STATUSES.has(d.status) && !d.attention)
    .sort((a, b) => Number(a.status === "paused") - Number(b.status === "paused"));
  const needsYou = drips.filter((d) =>
    (d.status === "paused" && d.attention) || (d.status === "failed" && now - Date.parse(d.created_at) < 7 * DAY));
  const recent = drips.filter((d) => !ACTIVE_STATUSES.has(d.status)).slice(0, 4);
  const googleConnected = connections.some((c) => c.provider === "google" && c.connected !== false);
  const googleAccounts = connections.filter((c) => c.provider === "google");
  // Word is only shown as connected when a Word session has actually been run.
  const wordUsed = connections.some((c) => c.provider === "microsoft") || drips.some((d) => d.provider === "microsoft");
  const active = drips.filter((d) => ACTIVE_STATUSES.has(d.status)).length;
  const isNew = !googleConnected || drips.length === 0;
  const usage = limits.dailyWords ? Math.min(100, Math.round((wordsToday / limits.dailyWords) * 100)) : 0;

  // Words entered in the sessions started on each of the last 7 days.
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - (6 - i) * DAY);
      return {
        key: dayKey(date.getTime()),
        label: i === 6 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" }),
        full: date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
        value: 0,
      };
    });
    for (const d of drips) {
      const day = days.find((x) => x.key === dayKey(d.created_at));
      if (day) day.value += d.progress.words_written;
    }
    return days;
  }, [drips, dayKey(now)]); // recount when the list changes or the date rolls over, not every second
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const finishedThisMonth = drips.filter((d) => d.status === "completed" && Date.parse(d.created_at) >= monthStart).length;
  const moments = todayMoments(drips, now);

  const nextPart = live
    .map((d) => (d.progress.next_chunk_at ? Date.parse(d.progress.next_chunk_at) : Infinity))
    .reduce((a, b) => Math.min(a, b), Infinity);
  const running = live.filter((d) => d.status !== "paused").length;
  const subline = needsYou.length
    ? `${needsYou.length} session${needsYou.length === 1 ? " needs" : "s need"} you.`
    : running
    ? `${running} session${running === 1 ? "" : "s"} running${Number.isFinite(nextPart) ? ` · next part in ${clock(Math.max(0, Math.ceil((nextPart - now) / 1000)))}` : ""}.`
    : drips.length ? "Your writing, at your pace." : "Let's get your first session going.";

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
          <p>{subline}</p>
        </div>
      </div>

      <div className="home">
      {googleStatus === "connected" && <p className="alert alert-success mb-5" role="status">Your Google account is connected.</p>}
      {googleStatus === "error" && <p className="alert alert-error mb-5" role="alert">We couldn&apos;t connect your Google account. Please try again.</p>}

      {isNew && (
        <section className="card mb-6 home-setup" aria-labelledby="setup-title">
          <div className="card-head">
            <h2 id="setup-title">Get started</h2>
            <span className="small muted">Takes about two minutes</span>
          </div>
          <ol className="setup">
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
            <li className="setup-step">
              <span className="n" aria-hidden="true">3</span>
              <strong>Using Word?</strong>
              <span>Add the TypeWit add-in to run sessions in Word documents.</span>
              <Link href="/app/documents" className="btn btn-secondary btn-sm">Set up Word</Link>
            </li>
          </ol>
          {connectError && <p className="alert alert-error mt-4" role="alert">{connectError}</p>}
        </section>
      )}

      {needsYou.length > 0 && (
        <section className="needs-you mb-6 home-needs" aria-labelledby="needs-title">
          <h2 id="needs-title" className="section-title"><Icon.alert />Needs your attention</h2>
          <ul>{needsYou.map((d) => <AttentionCard key={d.id} drip={d} control={control} />)}</ul>
        </section>
      )}

      {drips.length > 0 && (
        <div className="home-board">
          <div className="home-col">
            <section className="card home-live" aria-labelledby="live-title">
              <div className="card-head">
                <h2 id="live-title">{live.length > 1 ? "Live sessions" : "Live session"}{live.length > 1 && <span className="count-pill">{live.length}</span>}</h2>
                <span className="small muted">Automated text entry</span>
              </div>
              {live.length === 0
                ? (
                  <div className="empty compact">
                    <div className="icon"><Icon.play /></div>
                    <h3>Nothing running</h3>
                    <p>Start a session and it shows up here with its progress and controls.</p>
                    <Link href="/app/new" className="btn btn-primary btn-sm"><Icon.plus /> New session</Link>
                  </div>
                )
                : (
                  <>
                    <LiveHero drip={live[0]} now={now} control={control} />
                    {live.length > 1 && (
                      <ul className="live-more" aria-label="Other live sessions">
                        {live.slice(1).map((d) => (
                          <li key={d.id}>
                            <Link href={`/app/session?id=${d.id}`} className="title">{titleOf(d)}</Link>
                            <span className="meta">{statusLine(d, now)}</span>
                            <span className="progress" role="progressbar" aria-label={`Progress for ${titleOf(d)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.progress.percent}>
                              <span style={{ width: `${d.progress.percent}%` }} />
                            </span>
                            <span className="pct">{d.progress.percent}%</span>
                            {d.status === "paused"
                              ? (
                                <button type="button" className="btn btn-secondary btn-sm" disabled={control.busyId === d.id} onClick={() => control.run(d.id, "resume")}>
                                  <Icon.play />Resume<span className="sr-only"> {titleOf(d)}</span>
                                </button>
                              )
                              : (
                                <button type="button" className="btn btn-secondary btn-sm" disabled={control.busyId === d.id} onClick={() => control.run(d.id, "pause")}>
                                  <Icon.pause />Pause<span className="sr-only"> {titleOf(d)}</span>
                                </button>
                              )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
            </section>

            {live.length > 0 && <Link href="/app/new/" className="btn btn-primary btn-lg btn-block mobile-only home-new"><Icon.plus /> New session</Link>}

            <section className="card home-week" aria-labelledby="week-title">
              <div className="card-head">
                <h2 id="week-title">Words this week</h2>
                <span className="small muted">Grouped by session start date</span>
              </div>
              <p className="week-total">{weekTotal.toLocaleString()}</p>
              <p className="small muted week-note">Total words entered, last 7 days</p>
              <BarChart data={week} unit="words" caption="Words entered in sessions started each day, last 7 days" />
            </section>
          </div>

          <div className="home-col">
            <section className="card home-glance" aria-labelledby="glance-title">
              <h2 id="glance-title" className="card-title">Today at a glance</h2>
              <ul className="glance">
                <li>
                  <span className="glance-icon" aria-hidden="true"><Icon.doc /></span>
                  <span className="glance-label">
                    Words entered
                    <small>
                      {limits.dailyWords
                        ? usage >= 80
                          ? <>Today, of {limits.dailyWords} · resets at {dailyResetTime()} · <Link href="/app/billing">No limit with Pro</Link></>
                          : `Today, of ${limits.dailyWords} · resets at ${dailyResetTime()}`
                        : "Today · no daily limit"}
                    </small>
                  </span>
                  <span className="glance-value">{wordsToday.toLocaleString()}</span>
                </li>
                <li>
                  <span className="glance-icon" aria-hidden="true"><Icon.bolt /></span>
                  <span className="glance-label">Active sessions<small>{running} running{needsYou.length ? ` · ${needsYou.length} need${needsYou.length === 1 ? "s" : ""} you` : ""}</small></span>
                  <span className="glance-value">{active} <span className="of">/ {limits.activeSessions}</span></span>
                </li>
                <li>
                  <span className="glance-icon" aria-hidden="true"><Icon.chart /></span>
                  <span className="glance-label">Words this week<small>Last 7 days</small></span>
                  <span className="glance-value">{weekTotal.toLocaleString()}</span>
                </li>
                <li>
                  <span className="glance-icon" aria-hidden="true"><Icon.checkCircle /></span>
                  <span className="glance-label">Completed this month<small>{drips.filter((d) => d.status === "completed").length} in total</small></span>
                  <span className="glance-value">{finishedThisMonth}</span>
                </li>
              </ul>
            </section>

            <section className="card card-flush home-recent" aria-labelledby="recent-title">
              <div className="card-head">
                <h2 id="recent-title">Recent sessions</h2>
                <Link href="/app/sessions" className="small">View all</Link>
              </div>
              {recent.length === 0
                ? <p className="small muted pad">Finished sessions appear here.</p>
                : (
                  <ul className="rows">
                    {recent.map((d) => (
                      <li key={d.id} className="doc-row">
                        <span className={`doc-icon ${d.provider === "microsoft" ? "word" : "gdoc"}`} aria-hidden="true"><Icon.doc /></span>
                        <span className="doc-main">
                          <Link href={`/app/session?id=${d.id}`} className="title">{titleOf(d)}</Link>
                          <span className="meta">{d.provider === "microsoft" ? "Word" : "Google Docs"} · {formatRelative(d.created_at)}</span>
                        </span>
                        <span className="doc-words">{d.progress.words_written.toLocaleString()} words</span>
                        <StatusBadge state={stateOf(d)} />
                      </li>
                    ))}
                  </ul>
                )}
            </section>

            <section className="card card-flush home-docs" aria-labelledby="docs-title">
              <div className="card-head">
                <h2 id="docs-title">Connected documents</h2>
                <Link href="/app/documents" className="small">Manage</Link>
              </div>
              <ul className="rows">
                {googleAccounts.map((c) => (
                  <li key={c.id}>
                    <Link href="/app/documents" className="doc-row link-row">
                      <span className="doc-icon gdoc" aria-hidden="true"><Icon.doc /></span>
                      <span className="doc-main"><span className="title">Google Docs</span><span className="meta">{c.account_email ?? "Google account"}</span></span>
                      {c.connected === false
                        ? <span className="tag warn">Reconnect</span>
                        : <span className="tag good">Connected</span>}
                      <Icon.chevronRight />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/app/documents#word" className="doc-row link-row">
                    <span className="doc-icon word" aria-hidden="true"><Icon.doc /></span>
                    <span className="doc-main">
                      <span className="title">Word add-in</span>
                      <span className="meta">{wordUsed ? "Used from Microsoft Word" : "Runs inside Word · how to add it"}</span>
                    </span>
                    {wordUsed ? <span className="tag good">Connected</span> : <span className="tag">Not set up</span>}
                    <Icon.chevronRight />
                  </Link>
                </li>
              </ul>
            </section>

            {moments.length > 0 && (
              <section className="card home-today" aria-labelledby="today-title">
                <div className="card-head">
                  <h2 id="today-title">Coming up today</h2>
                  <span className="small muted">{new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
                </div>
                <ol className="timeline">
                  {moments.map((m) => (
                    <li key={`${m.drip.id}-${m.label}`} data-past={m.at < now}>
                      <time dateTime={new Date(m.at).toISOString()}>{when(m.at)}</time>
                      <span>
                        <strong>{m.label}</strong>
                        <Link href={`/app/session?id=${m.drip.id}`}>{titleOf(m.drip)}</Link>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

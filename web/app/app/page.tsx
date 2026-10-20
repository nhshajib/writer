"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart, ProgressRing, Sparkline } from "@/components/app/Charts";
import { AttentionCard, LiveSessionCard, titleOf } from "@/components/app/SessionCards";
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
  const live = drips.filter((d) => ACTIVE_STATUSES.has(d.status) && !d.attention);
  const needsYou = drips.filter((d) =>
    (d.status === "paused" && d.attention) || (d.status === "failed" && now - Date.parse(d.created_at) < 7 * DAY));
  const recent = drips.filter((d) => !ACTIVE_STATUSES.has(d.status)).slice(0, 4);
  const googleConnected = connections.some((c) => c.provider === "google" && c.connected !== false);
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
    : drips.length ? "Nothing running right now." : "Let's get your first session going.";

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

      {googleStatus === "connected" && <p className="alert alert-success mb-5" role="status">Your Google account is connected.</p>}
      {googleStatus === "error" && <p className="alert alert-error mb-5" role="alert">We couldn&apos;t connect your Google account. Please try again.</p>}

      {isNew && (
        <section className="card mb-6" aria-labelledby="setup-title">
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
        <section className="needs-you mb-6" aria-labelledby="needs-title">
          <h2 id="needs-title" className="section-title"><Icon.alert />Needs your attention</h2>
          <ul>{needsYou.map((d) => <AttentionCard key={d.id} drip={d} control={control} />)}</ul>
        </section>
      )}

      {drips.length > 0 && (
        <section aria-label="At a glance" className="kpis mb-6">
          <div className="kpi">
            <div className="kpi-text">
              <p className="kpi-label">Words today</p>
              <p className="kpi-value">{wordsToday.toLocaleString()}<small>{limits.dailyWords ? ` / ${limits.dailyWords}` : ""}</small></p>
              <p className="kpi-note">
                {limits.dailyWords
                  ? usage >= 80
                    ? <>Resets at {dailyResetTime()} · <Link href="/app/billing">No limit with Pro</Link></>
                    : `${(limits.dailyWords - wordsToday).toLocaleString()} left · resets at ${dailyResetTime()}`
                  : "No daily limit on Pro"}
              </p>
            </div>
            {limits.dailyWords && <ProgressRing value={usage} tone={usage >= 90 ? "warn" : "accent"} label={`${usage}% of today's words used`} />}
          </div>
          <div className="kpi">
            <div className="kpi-text">
              <p className="kpi-label">Active sessions</p>
              <p className="kpi-value">{drips.filter((d) => ACTIVE_STATUSES.has(d.status)).length}<small> / {limits.activeSessions}</small></p>
              <p className="kpi-note">{running} running{needsYou.length ? ` · ${needsYou.length} need${needsYou.length === 1 ? "s" : ""} you` : ""}</p>
            </div>
            <span className="kpi-icon" aria-hidden="true"><Icon.activity /></span>
          </div>
          <div className="kpi">
            <div className="kpi-text">
              <p className="kpi-label">Words this week</p>
              <p className="kpi-value">{weekTotal.toLocaleString()}</p>
              <p className="kpi-note">Last 7 days</p>
            </div>
            <Sparkline values={week.map((d) => d.value)} />
          </div>
          <div className="kpi">
            <div className="kpi-text">
              <p className="kpi-label">Finished this month</p>
              <p className="kpi-value">{finishedThisMonth}</p>
              <p className="kpi-note">{drips.filter((d) => d.status === "completed").length} in total</p>
            </div>
            <span className="kpi-icon good" aria-hidden="true"><Icon.check /></span>
          </div>
        </section>
      )}

      {drips.length > 0 && (
        <div className="home-grid">
          <div className="stack-6">
            <section aria-labelledby="live-title">
              <div className="block-head">
                <h2 id="live-title" className="section-title">Live now{live.length > 0 && <span className="count-pill">{live.length}</span>}</h2>
                <Link href="/app/sessions" className="small">All sessions</Link>
              </div>
              {live.length === 0
                ? (
                  <div className="card empty compact">
                    <div className="icon"><Icon.play /></div>
                    <h3>Nothing running</h3>
                    <p>Start a session and it shows up here with its progress and controls.</p>
                    <Link href="/app/new" className="btn btn-primary btn-sm"><Icon.plus /> New session</Link>
                  </div>
                )
                : <div className="live-grid">{live.map((d) => <LiveSessionCard key={d.id} drip={d} now={now} control={control} />)}</div>}
            </section>

            <section className="card" aria-labelledby="week-title">
              <div className="card-head">
                <div>
                  <h2 id="week-title">Words entered, last 7 days</h2>
                  <p className="small muted">By the day each session started</p>
                </div>
                <span className="kpi-value sm">{weekTotal.toLocaleString()}</span>
              </div>
              <BarChart data={week} unit="words" caption="Words entered in sessions started each day, last 7 days" />
            </section>
          </div>

          <aside className="rail stack-6" aria-label="Today and recent">
            <section className="card" aria-labelledby="today-title">
              <div className="card-head">
                <h2 id="today-title">Today</h2>
                <span className="small muted">{new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
              </div>
              {moments.length === 0
                ? <p className="small muted">Nothing scheduled. Starts, breaks and finish times appear here.</p>
                : (
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
                )}
            </section>

            <section className="card card-flush" aria-labelledby="recent-title">
              <div className="card-head">
                <h2 id="recent-title">Recent</h2>
                <Link href="/app/sessions" className="small">View all</Link>
              </div>
              {recent.length === 0
                ? <p className="small muted pad">Finished sessions appear here.</p>
                : (
                  <ul className="list">
                    {recent.map((d) => (
                      <li key={d.id}>
                        <div className="list-item">
                          <div className="main">
                            <Link href={`/app/session?id=${d.id}`} className="title">{titleOf(d)}</Link>
                            <div className="meta">{d.progress.words_written.toLocaleString()} words · {formatRelative(d.created_at)}</div>
                          </div>
                          <StatusBadge state={stateOf(d)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </section>

          </aside>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { PausedSessionEditor } from "@/components/app/PausedSessionEditor";
import { SessionPlayback } from "@/components/app/SessionPlayback";
import { Skeleton } from "@/components/app/Skeleton";
import { useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { readAnnounceProgress } from "@/lib/announce";
import { supabase } from "@/lib/supabase";
import { ConnectionReport } from "@/components/app/ConnectionReport";
import { ScheduleStrip } from "@/components/app/ScheduleStrip";
import { ProgressRing } from "@/components/app/Charts";
import { PlanLock } from "@/components/app/PlanLock";
import { Popover } from "@/components/app/Popover";
import { Problem } from "@/components/app/Problem";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs } from "@/components/app/Tabs";
import { Icon } from "@/components/Icons";
import { clock, span, when } from "@/lib/time";
import {
  type AccessReport,
  ACTIVITY_LABEL,
  type Attention,
  ATTENTION_TITLE,
  type Drip,
  type DripEvent,
  STATE_LABEL,
  stateOf,
  UNIT_LABEL,
} from "@/lib/types";
import { useRequireSession } from "@/lib/useRequireSession";
import { describe, type Detail, num, str } from "@/lib/sessionLog";

const ACTIVE = new Set(["scheduled", "running"]);
const MILESTONE = 10;

function SessionView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  // "Edit text & settings" in a session's menu links here with &edit=1.
  const wantsEdit = params.get("edit") === "1";
  const editHandled = useRef(false);
  const session = useRequireSession();
  const dashboard = useDashboard();
  const progressHeading = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [drip, setDrip] = useState<Drip | null>(null);
  const [events, setEvents] = useState<DripEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<AccessReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [announceProgress, setAnnounceProgress] = useState(true);
  const [activityView, setActivityView] = useState<"log" | "timeline">("log");
  const announceRef = useRef(true);
  const lastMilestone = useRef<number | null>(null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    const on = readAnnounceProgress();
    setAnnounceProgress(on);
    announceRef.current = on;
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ drip: Drip; events: DripEvent[] }>(`drips/${id}`);
      setDrip(res.drip);
      setEvents(res.events);
      setError(null);
      setOffline(false);

      // Screen readers hear about milestones and state changes, never each insertion.
      const { progress } = res.drip;
      const state = stateOf(res.drip);
      const milestone = Math.floor(progress.percent / MILESTONE) * MILESTONE;
      const stateChanged = lastStatus.current !== null && state !== lastStatus.current;
      if (stateChanged) {
        setAnnouncement(
          state === "completed"
            ? `Completed. All ${progress.words_total} words are in the document.`
            : state === "paused" && res.drip.attention
            ? `Paused by TypeWit: ${ATTENTION_TITLE[res.drip.attention]}.`
            : `Session state: ${STATE_LABEL[state]}.`,
        );
      } else if (
        announceRef.current && lastMilestone.current !== null && milestone > lastMilestone.current && state !== "completed"
      ) {
        setAnnouncement(`${milestone}% entered: ${progress.chunks_written} of ${progress.chunks_total} parts.`);
      }
      lastMilestone.current = milestone;
      lastStatus.current = state;
    } catch (e) {
      // Keep showing the last known state; the session itself runs on TypeWit's servers.
      if (e instanceof ApiError && e.status !== 0 && e.status < 500 && e.status !== 401) {
        setError(e.message);
      } else {
        setOffline(true);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;
    load();
    const client = supabase();
    const channel = client
      .channel(`drip-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "drip_events", filter: `drip_id=eq.${id}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 30_000);
    const online = () => load();
    window.addEventListener("online", online);
    return () => {
      clearInterval(poll);
      window.removeEventListener("online", online);
      client.removeChannel(channel);
    };
  }, [session, id, load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  async function control(action: "pause" | "resume" | "cancel", body: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(true);
    setConfirmStop(false);
    setError(null);
    try {
      await api(`drips/${id}/${action}`, { method: "POST", body });
      setNeedsConfirm(false);
      await Promise.all([load(), dashboard.refresh()]);
      setAnnouncement(action === "pause" ? "Session paused." : action === "resume" ? "Session resumed." : "Session stopped.");
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.attention === "confirm_last_part") setNeedsConfirm(true);
      setError(e instanceof Error ? e.message : "That didn't work. Please try again.");
      return false;
    } finally {
      setBusy(false);
      // The buttons that had focus may be gone now; keep keyboard users in place.
      progressHeading.current?.focus();
    }
  }

  // Opened from "Edit text & settings": a paused session opens its editor; a running one points to "Pause to edit".
  useEffect(() => {
    if (!wantsEdit || editHandled.current || !drip) return;
    editHandled.current = true;
    if (drip.status === "paused" && dashboard.profile.plan === "pro" && !drip.attention && !drip.progress.temporary_edit_active) setEditing(true);
    else requestAnimationFrame(() => document.getElementById("edit-session")?.focus());
  }, [wantsEdit, drip, dashboard.profile.plan]);

  /** Pro: open the editor, pausing a running session first. */
  async function pauseToEdit() {
    if (drip?.status !== "paused" && !await control("pause")) return;
    setEditing(true);
  }

  async function testConnection() {
    setChecking(true);
    setReport(null);
    try {
      const res = await api<{ report: AccessReport }>(`drips/${id}/check`, { method: "POST", body: {} });
      setReport(res.report);
      setAnnouncement(res.report.ok ? "Connection works." : `Connection problem: ${res.report.message}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't test the connection.");
    } finally {
      setChecking(false);
    }
  }

  async function deleteSession() {
    setBusy(true);
    try {
      await api(`drips/${id}/delete`, { method: "POST", body: {} });
      await dashboard.refresh();
      router.push("/app/sessions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the session.");
      setBusy(false);
    }
  }

  function closeStop() {
    setConfirmStop(false);
    // Stop lives in the "More actions" menu; return focus to that button.
    requestAnimationFrame(() => actionsRef.current?.querySelector<HTMLElement>("[aria-label='More actions']")?.focus());
  }

  function onConfirmKey(event: KeyboardEvent) {
    if (event.key === "Escape") closeStop();
  }

  function downloadLog() {
    if (!drip) return;
    const header = ["time", "event", "part", "planned_at", "actual_at", "late_seconds", "details"];
    const rows = [...events].reverse().map((e) => {
      const d = e.detail as Detail;
      const { text, sub } = describe(e);
      return [e.created_at, text, String(num(d.written) ?? ""), str(d.planned_at) ?? "", str(d.actual_at) ?? "",
        String(num(d.late_seconds) ?? ""), sub ?? ""];
    });
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `typewit-session-log-${drip.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!session) return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />Loading…</div>;
  if (!id) {
    return (
      <div className="card empty" role="alert">
        <h3>No session was chosen</h3>
        <p>Pick one from your list of sessions.</p>
        <Link href="/app/sessions" className="btn btn-primary btn-sm">See sessions</Link>
      </div>
    );
  }
  if (error && !drip) {
    return (
      <div className="card empty" role="alert">
        <h3>This session can&apos;t be shown</h3>
        <p>{error}</p>
        <Link href="/app/sessions" className="btn btn-primary btn-sm">Back to sessions</Link>
      </div>
    );
  }
  if (!drip) return <Skeleton label="Loading session…" />;

  const { progress } = drip;
  const activity = progress.activity ?? (ACTIVE.has(drip.status) ? "waiting" : drip.status === "paused" ? "paused" : "done");
  const finished = ["completed", "canceled", "failed"].includes(drip.status);
  const active = ACTIVE.has(drip.status);
  const paused = drip.status === "paused";
  const attention = paused ? drip.attention ?? null : null;
  const countdown = progress.next_chunk_at ? Math.max(0, Math.ceil((Date.parse(progress.next_chunk_at) - now) / 1000)) : null;
  const title = drip.document_title ?? "Untitled document";
  const unit = UNIT_LABEL[drip.insertion_unit];
  const startMs = drip.session_started_at ? Date.parse(drip.session_started_at) + (drip.schedule_shift_seconds ?? 0) * 1000 : undefined;
  const completed = events.find((e) => e.kind === "completed");
  const revisions = completed?.detail.provider_revisions as
    | { count?: number; in_window?: number; unavailable?: string }
    | undefined;

  const isPro = dashboard.profile?.plan === "pro";
  // Remaining text and settings can change while paused; a running Google session can be paused first.
  const editable = (paused || drip.status === "running" || drip.status === "scheduled") && !attention && drip.provider !== "microsoft"
    && !drip.progress.temporary_edit_active;
  const etaLabel = drip.status === "completed" ? "Finished" : paused ? "Finish if resumed now" : "Expected completion";
  const eta = drip.status === "completed" && progress.finish_at ? when(progress.finish_at)
    : paused && progress.finish_if_resumed_now ? when(progress.finish_if_resumed_now)
    : progress.finish_at && !finished ? when(progress.finish_at) : "—";
  const docName = drip.provider === "microsoft" ? "Word" : "Google Docs";

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/app/sessions">Sessions</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="row mt-2" style={{ gap: "0.6rem" }}>
            <StatusBadge state={stateOf(drip)} />
            <span className="small muted">
              {drip.mode === "as_soon_as_possible"
                ? "All at once"
                : `${unit.title}, ${drip.timing_mode === "speed" ? `${drip.pacing?.wpm ?? "?"} WPM, about` : "over"} ${span(drip.duration_seconds * 1000)}`}
              {" "}·{" "}
              {drip.session_started_at && Date.parse(drip.session_started_at) > now && drip.progress.chunks_written === 0
                ? <>starts {when(drip.session_started_at)}</>
                : <>started {when(drip.created_at)}</>}
            </span>
          </div>
        </div>
        <div className="row" ref={actionsRef}>
          {drip.document_url && (
            <a href={drip.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              Open in {docName} <Icon.external /><span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {active && <button type="button" className="btn btn-secondary btn-sm desktop-only" onClick={() => control("pause")} disabled={busy}><Icon.pause /> Pause</button>}
          {paused && !attention && <button type="button" className="btn btn-primary btn-sm desktop-only" onClick={() => control("resume")} disabled={busy || editing}><Icon.play /> Resume</button>}
          {finished && drip.provider !== "microsoft" && (
            <Link href={`/app/new?from=${drip.id}`} className="btn btn-primary btn-sm"><Icon.refresh /> Run again…</Link>
          )}
          {(drip.provider !== "microsoft" || active || paused) && (
            <Popover label="More actions" buttonClass="btn btn-secondary btn-sm btn-icon" button={<Icon.more />}>
              {(close) => (
                <ul className="menu-list">
                  {drip.provider !== "microsoft" && (
                    <li>
                      <button type="button" disabled={checking} onClick={() => { close(); testConnection(); }}>
                        <Icon.refresh />{checking ? "Testing…" : "Test connection"}
                      </button>
                    </li>
                  )}
                  {(active || paused) && (
                    <>
                      <li><hr /></li>
                      <li><button type="button" className="danger" disabled={busy} onClick={() => { close(); setConfirmStop(true); }}><Icon.stop />Stop</button></li>
                    </>
                  )}
                </ul>
              )}
            </Popover>
          )}
        </div>
      </div>

      {/* Polite live region: status changes and progress milestones only. */}
      <p id="session-announcer" className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      {progress.temporary_edit_active && paused && <p className="alert alert-info mb-5" role="status">Paused during a simulated edit. Temporary text remains in the document until correction resumes; review it before sharing.</p>}
      <div className="stack-4 mb-6" hidden={!(confirmStop || error || offline || attention || drip.status === "failed" || report)}>
        {confirmStop && (
          <div className="confirm" role="alertdialog" aria-modal="false" aria-labelledby="stop-title" aria-describedby="stop-desc" onKeyDown={onConfirmKey} style={{ marginTop: 0 }}>
            <p id="stop-title">Stop this session?</p>
            <p id="stop-desc" className="small muted">Stopping cancels every insertion still planned. Text already entered stays in your document, and the session can&apos;t be resumed. If a simulated correction is in progress, temporary words or mistakes may remain; review the document.</p>
            <div className="row">
              <button type="button" className="btn btn-danger-solid btn-sm" onClick={() => control("cancel")} autoFocus>Stop session</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeStop}>Keep going</button>
            </div>
          </div>
        )}
        {attention && <AttentionPanel attention={attention} message={drip.last_error} nextPart={progress.next_part ?? null}
          needsConfirm={needsConfirm || attention === "confirm_last_part"} busy={busy} onResume={(body) => control("resume", body)}
          onShowChanges={drip.provider === "microsoft" ? undefined : testConnection} checking={checking} />}
        <div aria-live="polite">
          {report && (
            <ConnectionReport report={report}>
              {report.location && active && (
                <div className="row mt-2">
                  <span className="small">TypeWit pauses on its own before the next part. Pause now to fix it straight away:</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => control("pause")} disabled={busy}>Pause to fix it</button>
                </div>
              )}
            </ConnectionReport>
          )}
        </div>
        {drip.status === "failed" && drip.last_error && <div className="alert alert-error" role="alert"><span>Writing stopped. <Problem message={drip.last_error} /></span></div>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {offline && <p className="alert alert-info" role="status">Can&apos;t reach TypeWit right now. Showing the last known state; this page retries on its own. The session keeps running on the server.</p>}
      </div>

      {editable && !editing && (
        isPro
          ? (
            <p className="mb-6">
              <button id="edit-session" type="button" className="btn btn-secondary" disabled={busy} onClick={pauseToEdit} aria-describedby={paused ? undefined : "edit-session-hint"}>
                <Icon.sliders />{paused ? "Edit remaining text & settings" : "Edit text & settings"}
              </button>
              {!paused && <span id="edit-session-hint" className="hint"> The session pauses while you edit.</span>}
            </p>
          )
          : (
            <p id="edit-session" tabIndex={-1} className="hint mb-6 edit-locked">
              Editing a paused session&apos;s text and settings is part of Pro.<PlanLock plan={dashboard.profile.plan} feature="pausedEdit" />{" "}
              <Link href="/app/billing/">Compare plans</Link>
            </p>
          )
      )}
      {paused && editing && <PausedSessionEditor drip={drip} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); await Promise.all([load(), dashboard.refresh()]); setAnnouncement("Changes saved. The session is still paused. Resume when ready."); }} />}
      <div className="session-grid">
        <div className="stack-6">
          <section className="card session-hero" aria-labelledby="progress-title">
            <h2 id="progress-title" ref={progressHeading} tabIndex={-1} className="sr-only">Progress</h2>
            <div className="hero-top">
              <div className="ring-wrap">
                <ProgressRing value={progress.percent} size={112} stroke={10} tone={drip.status === "completed" ? "good" : "accent"} />
                <span className="ring-num lg">{progress.percent}%</span>
              </div>
              <div className="hero-main">
                <p className="activity">
                  <span className="sr-only">Current activity: </span>
                  <strong>{progress.temporary_edit_active ? "Automated simulated drafting active" : ACTIVITY_LABEL[activity]}</strong>
                  {progress.temporary_edit_active && <span className="muted">A temporary edit is awaiting correction. Pausing or stopping can leave it in the document.</span>}
                  {activity === "on_break" && progress.current_break && <span className="muted">until {when(progress.current_break.end, true)}</span>}
                  {activity === "waiting" && progress.next_chunk_at && <span className="muted">next insertion at {when(progress.next_chunk_at, true)}</span>}
                </p>
                {progress.next_chunk_at && countdown !== null && (
                  <p className="countdown" aria-hidden="true">
                    {activity === "on_break" ? "Back from break" : (progress.edits_total ?? progress.chunks_total) !== progress.chunks_total ? "Next automated edit planned" : `Part ${progress.chunks_written + 1} planned`} {countdown === 0 ? "any moment" : <>in <strong>{clock(countdown)}</strong></>}
                  </p>
                )}
                <div className="progress lg" role="progressbar" aria-label="Text confirmed in the document" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={progress.percent} aria-valuetext={`${progress.percent}%: ${progress.chunks_written} of ${progress.chunks_total} parts, ${progress.words_written} of ${progress.words_total} words`}>
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
                {(active || (paused && !attention)) && (
                  <div className="session-primary mobile-only">
                    {active
                      ? <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => control("pause")} disabled={busy}><Icon.pause /> Pause</button>
                      : <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => control("resume")} disabled={busy || editing}><Icon.play /> Resume</button>}
                  </div>
                )}
                <dl className="hero-facts">
                  <div><dt>Parts entered</dt><dd>{progress.chunks_written} <small>/ {progress.chunks_total} {unit.many}</small></dd></div>
                  <div><dt>Words</dt><dd>{progress.words_written.toLocaleString()} <small>/ {progress.words_total.toLocaleString()}</small></dd></div>
                  <div><dt>{etaLabel}</dt><dd>{eta}</dd></div>
                </dl>
              </div>
            </div>
            {drip.schedule && drip.schedule.length > 1 && (
              <ScheduleStrip offsets={drip.schedule} breaks={drip.breaks} startMs={startMs} done={progress.edits_written ?? progress.chunks_written} nowMs={active ? now : undefined}
                label={`Schedule: ${progress.edits_total ?? progress.chunks_total} document edits and ${drip.breaks?.length ?? 0} breaks; ${progress.edits_written ?? progress.chunks_written} confirmed.`} />
            )}
            {progress.next_break && (
              <p className="hint">Next break: after part {progress.next_break.after_part}, about {when(progress.next_break.start)} to {when(progress.next_break.end)}.</p>
            )}
            {!finished && <p className="hint">The finish time is a target. If {docName} is slow or unavailable, TypeWit moves the rest of the schedule later rather than rushing.</p>}
          </section>

          <section className="card" aria-label="Session details">
            <Tabs label="Session details" tabs={[
              {
                title: <><Icon.list />Activity</>,
                content: (
                  <>
                    <div className="tab-head">
                      <p className="small muted">
                        TypeWit&apos;s own record: when each part was planned and entered, pauses, retries and problems.
                        {` It's separate from ${docName} version history, which groups edits, so the two won't match one to one.`}
                      </p>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={downloadLog}><Icon.download />Download CSV</button>
                    </div>
                    {completed && revisions && (
                      <p className="alert alert-info small mb-3">
                        {revisions.unavailable
                          ? `TypeWit couldn't read Google's revision list for comparison (${revisions.unavailable}).`
                          : `For comparison: Google Drive listed ${revisions.in_window} revision${revisions.in_window === 1 ? "" : "s"} during this session for ${progress.chunks_total} insertions.`}
                      </p>
                    )}
                    <div className="seg view-switch" role="group" aria-label="Show activity as" style={{ "--n": 2, "--i": activityView === "log" ? 0 : 1 } as React.CSSProperties}>
                      <button type="button" aria-pressed={activityView === "log"} onClick={() => setActivityView("log")}>Log</button>
                      <button type="button" aria-pressed={activityView === "timeline"} onClick={() => setActivityView("timeline")}>Timeline</button>
                    </div>
                    <div hidden={activityView !== "timeline"}>{(() => {
                  const insertions = [...events].reverse().filter((e) => e.kind === "chunk_written");
                  const createdEv = [...events].reverse().find((e) => e.kind === "created");
                  const pauseEvents = [...events].reverse().filter((e) => e.kind === "paused" || e.kind === "resumed");
                  const allTimed = [...(createdEv ? [createdEv] : []), ...insertions,
                    ...pauseEvents, ...(completed ? [completed] : [])].sort(
                    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
                  );
                  return (
                    <div className="timeline-wrap">
                      {drip.provider === "google" && <p className="small muted mb-3">Google controls grouping and retention in version history. Open File &gt; Version history in your document to inspect the recorded edits.</p>}
                      {allTimed.length === 0 && (
                        <p className="small muted">No activity recorded yet.</p>
                      )}
                      <ol className="session-timeline" aria-label="Session timeline">
                        {allTimed.map((e, i) => {
                          const d = e.detail as Detail;
                          let label = "";
                          let sub = "";
                          let dot = "dot";
                          if (e.kind === "created") {
                            label = "Session created";
                            sub = str(d.starts_at) ? `Scheduled to start ${when(str(d.starts_at)!)}` : "Starts immediately";
                          } else if (e.kind === "chunk_written") {
                            const written = num(d.written) ?? 0;
                            const total2 = num(d.total) ?? progress.chunks_total;
                            const chars = num(d.chars) ?? 0;
                            const pct = total2 > 0 ? Math.round(written / total2 * 100) : 0;
                            label = `Insertion ${written} of ${total2}`;
                            sub = `${chars} characters · ${pct}%`;
                            dot = written === total2 ? "dot dot-complete" : "dot";
                          } else if (e.kind === "paused") {
                            label = d.by === "system" ? "Paused by TypeWit" : "Paused by you";
                            dot = "dot dot-pause";
                          } else if (e.kind === "resumed") {
                            label = "Resumed";
                          } else if (e.kind === "completed") {
                            label = "Session completed";
                            dot = "dot dot-complete";
                          }
                          return (
                            <li key={`tl-${i}`}>
                              <span className={dot} aria-hidden="true" />
                              <div>
                                <time dateTime={e.created_at} className="small muted">{when(e.created_at, true)}</time>
                                <p>{label}</p>
                                {sub && <p className="small muted">{sub}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })()}</div>
                    <ol className="log" aria-label="Session log, newest first" tabIndex={0} hidden={activityView !== "log"}>
                      {events.map((event, i) => {
                        const { text, sub, late } = describe(event);
                        return (
                          <li key={`${event.created_at}-${i}`} className={late ? "late" : undefined}>
                            <time dateTime={event.created_at}>{when(event.created_at, true)}</time>
                            <span>{text}{sub && <span className="sub"><Problem message={sub} /></span>}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </>
                ),
              },
              {
                title: <><Icon.doc />Text</>,
                content: (
                  <div className="grid-2">
                    <div>
                      <h3 className="drawer-sub">Entered so far</h3>
                      <div className="preview" tabIndex={0} role="region" aria-label="Entered text">
                        {progress.written_text ? progress.written_text : <span className="pending">Nothing has been entered yet.</span>}
                      </div>
                    </div>
                    <div>
                      <h3 className="drawer-sub">Still to come</h3>
                      <div className="preview" tabIndex={0} role="region" aria-label="Remaining text">
                        {progress.remaining_text ? progress.remaining_text : <span className="pending">Nothing left to enter.</span>}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                title: <><Icon.gear />Details</>,
                content: (
                  <div className="stack-6">
                    <p className="small muted">
                      Progress announcements for screen readers are {announceProgress ? "on" : "off"}.{" "}
                      <Link href="/app/settings/#accessibility">Change in Settings</Link>
                    </p>
                    {finished
                      ? (
                        <div>
                          <h3 className="drawer-sub">Saved data for this session</h3>
                          <p className="small muted">
                            TypeWit keeps this session&apos;s text, schedule and log so you can review them. Deleting removes them from
                            TypeWit. Your document is not changed.
                          </p>
                          {!confirmDelete
                            ? <button type="button" className="btn btn-danger btn-sm mt-3" onClick={() => setConfirmDelete(true)} disabled={busy}><Icon.trash />Delete this session</button>
                            : (
                              <div className="confirm" role="alertdialog" aria-labelledby="delete-title" onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}>
                                <p id="delete-title">Delete this session&apos;s saved text and log?</p>
                                <div className="row">
                                  <button type="button" className="btn btn-danger-solid btn-sm" onClick={deleteSession} autoFocus disabled={busy}>Delete</button>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Keep</button>
                                </div>
                              </div>
                            )}
                        </div>
                      )
                      : <p className="small muted">Once the session has finished or been stopped, you can delete its saved text and log here.</p>}
                  </div>
                ),
              },
              { title: <><Icon.play />Playback</>, lazy: true, content: <SessionPlayback id={drip.id} pro={isPro} recorded={drip.progress.chunks_written} /> },
            ]} />
          </section>
        </div>

        <aside className="stack-6" aria-label="About this session">
          <div className="automation" role="note" aria-label="Automated text entry">
            <span className="badge badge-blue"><span className="dot" aria-hidden="true" />Automated</span>
            <div>
              <strong>
                {active ? "Automated text entry in progress" : paused ? "Automated text entry paused" : "Automated text entry session"}
              </strong>
              {drip.provider === "microsoft"
                ? (
                  <>
                    TypeWit enters your approved text into this Word document at scheduled times, through the TypeWit add-in in
                    Word. It runs only while the document and the TypeWit panel are open in Word; while they&apos;re closed,
                    nothing is entered and the rest of the schedule moves later.
                  </>
                )
                : (
                  <>
                    TypeWit enters your approved text into this Google Doc at scheduled times, through the Google Docs API, using
                    your Google account. It runs on TypeWit&apos;s servers: you can close this page or let your computer sleep.
                  </>
                )}
            </div>
          </div>

          <section className="card" aria-labelledby="about-title">
            <h2 id="about-title" className="card-title">About this session</h2>
            <dl className="facts one">
              <div><dt>Document</dt><dd>{drip.document_url ? <a href={drip.document_url} target="_blank" rel="noopener noreferrer">{title}<span className="sr-only"> (opens in a new tab)</span></a> : title} <span className="muted">· {docName}</span></dd></div>
              <div><dt>Steps</dt><dd>{drip.mode === "as_soon_as_possible" ? "All at once" : `${unit.title} (${progress.chunks_total})`}</dd></div>
              <div><dt>Timing</dt><dd>{drip.timing_mode === "speed" ? `Typing speed, ${drip.pacing?.wpm ?? "?"} WPM` : drip.mode === "as_soon_as_possible" ? "As soon as possible" : `Over ${span(drip.duration_seconds * 1000)}`}</dd></div>
              {drip.work_window && <div><dt>Writing hours</dt><dd>{drip.work_window.start}–{drip.work_window.end} · {drip.work_window.time_zone}</dd></div>}
              {drip.access_expires_at && <div><dt>Pass session access</dt><dd>Until {when(drip.access_expires_at)}</dd></div>}
              {drip.pacing?.drafting?.revision_sweep && <div><dt>Final revision pass</dt><dd>Enabled · exact approved text restored</dd></div>}
              <div><dt>Breaks</dt><dd>{drip.breaks?.length ? `${drip.breaks.length} planned` : "None"}</dd></div>
              {drip.approved_at && <div><dt>Text approved</dt><dd>{when(drip.approved_at)}</dd></div>}
              <div><dt>Created</dt><dd>{when(drip.created_at)}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function AttentionPanel({ attention, message, nextPart, needsConfirm, busy, onResume, onShowChanges, checking }: {
  attention: Attention;
  message: string | null;
  nextPart: string | null;
  needsConfirm: boolean;
  busy: boolean;
  onResume: (body: Record<string, unknown>) => void;
  /** Runs Test connection, which shows how the document's end differs from what TypeWit entered. */
  onShowChanges?: () => void;
  checking?: boolean;
}) {
  return (
    <section className="attention" role="alert" aria-labelledby="attention-title">
      <h2 id="attention-title">{ATTENTION_TITLE[attention]}</h2>
      <p className="small"><Problem message={message} /></p>
      {needsConfirm && nextPart && (
        <>
          <p className="small" style={{ marginTop: "0.5rem" }}>Look at the end of the document for this part:</p>
          <div className="preview" style={{ marginTop: "0.35rem", maxHeight: 120 }} tabIndex={0} role="region" aria-label="The part to check">{nextPart}</div>
        </>
      )}
      <div className="row">
        {needsConfirm
          ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onResume({ last_part: "present" })}>It&apos;s there: continue with the next part</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onResume({ last_part: "absent" })}>It&apos;s missing: enter it again</button>
            </>
          )
          : attention === "document_changed"
          ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onResume({})}>I&apos;ve fixed it: check and resume</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onResume({ continue_from_current_end: true })}>Continue after the document&apos;s current end</button>
              {onShowChanges && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={checking} onClick={onShowChanges}>
                  {checking ? "Checking…" : "Show what changed"}
                </button>
              )}
            </>
          )
          : attention === "access_expired"
          ? <><Link href="/app/billing/" className="btn btn-primary btn-sm">Renew Day Pass or upgrade</Link><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onResume({})}>Resume after renewing</button></>
          : attention === "reconnect"
          ? (
            <>
              <Link href="/app/connections" className="btn btn-secondary btn-sm">Reconnect Google</Link>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onResume({})}>Resume</button>
            </>
          )
          : <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onResume({})}>Resume</button>}
      </div>
      <p className="small muted" style={{ marginTop: "0.5rem" }}>When you resume, the rest of the schedule moves later by the time the session was paused. Nothing is entered in a rush to catch up.</p>
    </section>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <SessionView />
    </Suspense>
  );
}

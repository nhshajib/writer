"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { ConnectionReport } from "@/components/app/ConnectionReport";
import { ScheduleStrip } from "@/components/app/ScheduleStrip";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Icon } from "@/components/Icons";
import { clock, span, when } from "@/lib/time";
import {
  type AccessReport,
  ACTIVITY_LABEL,
  type Attention,
  ATTENTION_TITLE,
  type Drip,
  type DripEvent,
  EVENT_LABEL,
  STATE_LABEL,
  stateOf,
  UNIT_LABEL,
} from "@/lib/types";
import { useRequireSession } from "@/lib/useRequireSession";

const ACTIVE = new Set(["scheduled", "running"]);
const MILESTONE = 10;
const ANNOUNCE_KEY = "typewit.announceProgress";

type Detail = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** One line of the session log, in plain words. */
function describe(event: DripEvent): { text: string; sub?: string; late?: boolean } {
  const d = event.detail as Detail;
  const label = EVENT_LABEL[event.kind] ?? event.kind;
  switch (event.kind) {
    case "chunk_written": {
      const part = `Part ${num(d.written)} of ${num(d.total)} entered (${num(d.chars)} characters)`;
      if (d.recovered) return { text: `${part}, confirmed from the document after an interruption`, sub: `Planned ${when(str(d.planned_at)!, true)}` };
      const late = num(d.late_seconds) ?? 0;
      return {
        text: part,
        sub: `Planned ${when(str(d.planned_at)!, true)} · entered ${when(str(d.actual_at)!, true)}${late >= 1 ? ` · ${late} s late` : ""}`,
        late: late >= 15,
      };
    }
    case "schedule_shifted":
      return { text: label, sub: `Moved ${span((num(d.by_seconds) ?? 0) * 1000)} later · now finishing ${when(str(d.finish_at)!)}`, late: true };
    case "paused":
      return { text: d.by === "system" ? "Paused by TypeWit" : "Paused by you" };
    case "resumed": {
      const finish = str(d.finish_at);
      return {
        text: label,
        sub: `After ${span((num(d.paused_seconds) ?? 0) * 1000)} paused, the rest moved later${finish ? ` · now finishing ${when(finish)}` : ""}` +
          (d.continued_from_current_end ? " · continuing after the document's current end" : ""),
      };
    }
    case "attention":
      return { text: label, sub: str(d.message) ?? undefined, late: true };
    case "retry_scheduled":
      return { text: label, sub: `Attempt ${num(d.attempts)}, retrying in ${span((num(d.delay_seconds) ?? 0) * 1000)}: ${str(d.error) ?? ""}`, late: true };
    case "connection_checked":
      return d.ok
        ? { text: label, sub: "The document opened and is editable. Nothing was changed." }
        : { text: "Connection check failed before the first insertion", sub: str(d.problem) ?? undefined, late: true };
    case "insertion_uncertain":
      return {
        text: `Part ${(num(d.index) ?? 0) + 1}: ${label.toLowerCase()}`,
        sub: "TypeWit checks the document before continuing, so the part is neither repeated nor skipped.",
        late: true,
      };
    case "created":
      return { text: label, sub: str(d.finish_at) ? `Planned to finish ${when(str(d.finish_at)!)}` : undefined };
    case "completed":
      return {
        text: label,
        sub: d.text_at_end_matches === true
          ? "Checked: the document ends with exactly the approved text."
          : d.text_at_end_matches === false
          ? "Warning: the end of the document doesn't match the approved text."
          : undefined,
      };
    default:
      return { text: label };
  }
}

function SessionView() {
  const id = useSearchParams().get("id") ?? "";
  const session = useRequireSession();
  const dashboard = useDashboard();
  const progressHeading = useRef<HTMLHeadingElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const [drip, setDrip] = useState<Drip | null>(null);
  const [events, setEvents] = useState<DripEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<AccessReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [announceProgress, setAnnounceProgress] = useState(true);
  const announceRef = useRef(true);
  const lastMilestone = useRef<number | null>(null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    try {
      const on = localStorage.getItem(ANNOUNCE_KEY) !== "off";
      setAnnounceProgress(on);
      announceRef.current = on;
    } catch { /* storage unavailable: keep the default */ }
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

  function setAnnounce(on: boolean) {
    setAnnounceProgress(on);
    announceRef.current = on;
    try {
      localStorage.setItem(ANNOUNCE_KEY, on ? "on" : "off");
    } catch { /* storage unavailable */ }
  }

  async function control(action: "pause" | "resume" | "cancel", body: Record<string, unknown> = {}) {
    setBusy(true);
    setConfirmStop(false);
    setError(null);
    try {
      await api(`drips/${id}/${action}`, { method: "POST", body });
      setNeedsConfirm(false);
      await Promise.all([load(), dashboard.refresh()]);
      setAnnouncement(action === "pause" ? "Session paused." : action === "resume" ? "Session resumed." : "Session stopped.");
    } catch (e) {
      if (e instanceof ApiError && e.attention === "confirm_last_part") setNeedsConfirm(true);
      setError(e instanceof Error ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
      // The buttons that had focus may be gone now; keep keyboard users in place.
      progressHeading.current?.focus();
    }
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
    requestAnimationFrame(() => stopButton.current?.focus());
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
  if (!drip) return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />Loading session…</div>;

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

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/app/sessions">Sessions</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="row" style={{ marginTop: "0.5rem", gap: "0.6rem" }}>
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
        <div className="row">
          {drip.document_url && (
            <a href={drip.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              Open in {drip.provider === "microsoft" ? "Word" : "Google Docs"} <Icon.external /><span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {active && <button type="button" className="btn btn-secondary btn-sm" onClick={() => control("pause")} disabled={busy}><Icon.pause /> Pause</button>}
          {paused && !attention && <button type="button" className="btn btn-primary btn-sm" onClick={() => control("resume")} disabled={busy}>Resume</button>}
          {(active || paused) && !confirmStop && (
            <button type="button" ref={stopButton} className="btn btn-danger btn-sm" onClick={() => setConfirmStop(true)} disabled={busy}>Stop</button>
          )}
          {drip.provider !== "microsoft" && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={testConnection} disabled={checking}>
              {checking ? "Testing…" : "Test connection"}
            </button>
          )}
          {finished && drip.provider !== "microsoft" && (
            <Link href={`/app/new?from=${drip.id}`} className="btn btn-secondary btn-sm">Run again…</Link>
          )}
        </div>
      </div>

      <p className="activity">
        <span className="sr-only">Current activity: </span>
        <strong>{ACTIVITY_LABEL[activity]}</strong>
        {activity === "on_break" && progress.current_break && <span className="muted">until {when(progress.current_break.end, true)}</span>}
        {activity === "waiting" && progress.next_chunk_at && <span className="muted">next insertion at {when(progress.next_chunk_at, true)}</span>}
      </p>
      <div aria-live="polite">{report && <ConnectionReport report={report} />}</div>

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

      {/* Polite live region: status changes and progress milestones only. */}
      <p id="session-announcer" className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      <div className="stack" style={{ marginBottom: confirmStop || error || offline || attention || drip.status === "failed" ? "1.25rem" : 0 }}>
        {confirmStop && (
          <div className="confirm" role="alertdialog" aria-modal="false" aria-labelledby="stop-title" aria-describedby="stop-desc" onKeyDown={onConfirmKey} style={{ marginTop: 0 }}>
            <p id="stop-title">Stop this session?</p>
            <p id="stop-desc" className="small muted">Stopping cancels every insertion still planned. Text already entered stays in your document, and the session can&apos;t be resumed.</p>
            <div className="row">
              <button type="button" className="btn btn-danger-solid btn-sm" onClick={() => control("cancel")} autoFocus>Stop session</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeStop}>Keep going</button>
            </div>
          </div>
        )}
        {attention && <AttentionPanel attention={attention} message={drip.last_error} nextPart={progress.next_part ?? null}
          needsConfirm={needsConfirm || attention === "confirm_last_part"} busy={busy} onResume={(body) => control("resume", body)} />}
        {drip.status === "failed" && drip.last_error && <p className="alert alert-error" role="alert">Writing stopped: {drip.last_error}</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {offline && <p className="alert alert-info" role="status">Can&apos;t reach TypeWit right now. Showing the last known state; this page retries on its own. The session keeps running on the server.</p>}
      </div>

      <section aria-labelledby="progress-title" style={{ marginBottom: "1.5rem" }}>
        <h2 id="progress-title" ref={progressHeading} tabIndex={-1} className="sr-only">Progress</h2>
        <dl className="stats">
          <div>
            <dt>Confirmed in the document</dt>
            <dd>
              {progress.percent}%
              <div className="progress" role="progressbar" aria-label="Text confirmed in the document" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={progress.percent} aria-valuetext={`${progress.percent}%: ${progress.chunks_written} of ${progress.chunks_total} parts, ${progress.words_written} of ${progress.words_total} words`}>
                <span style={{ width: `${progress.percent}%` }} />
              </div>
            </dd>
          </div>
          <div><dt>Parts entered</dt><dd>{progress.chunks_written} <small>/ {progress.chunks_total} {unit.many}</small></dd></div>
          <div>
            <dt>Next scheduled action</dt>
            {progress.next_chunk_at
              ? (
                <>
                  <dd style={{ fontSize: "1.0625rem", marginTop: "0.6rem" }}>
                    {activity === "on_break" ? "Back from break " : "Insert part " + (progress.chunks_written + 1) + " at "}
                    {when(progress.next_chunk_at, true)}
                  </dd>
                  <dd className="muted" aria-hidden="true" style={{ marginTop: 0, fontSize: "0.875rem", fontWeight: 450 }}>{countdown === 0 ? "any moment" : `in ${clock(countdown!)}`}</dd>
                </>
              )
              : <dd>—</dd>}
          </div>
          <div>
            <dt>{drip.status === "completed" ? "Finished" : paused ? "Finish if resumed now" : "Expected completion"}</dt>
            <dd style={{ fontSize: "1.0625rem", marginTop: "0.6rem" }}>
              {drip.status === "completed" && progress.finish_at ? when(progress.finish_at) : paused && progress.finish_if_resumed_now
                ? when(progress.finish_if_resumed_now)
                : progress.finish_at
                ? when(progress.finish_at)
                : "—"}
            </dd>
          </div>
        </dl>
        {drip.schedule && drip.schedule.length > 1 && (
          <ScheduleStrip offsets={drip.schedule} breaks={drip.breaks} startMs={startMs} done={progress.chunks_written} nowMs={active ? now : undefined}
            label={`Schedule: ${progress.chunks_total} insertions and ${drip.breaks?.length ?? 0} breaks; ${progress.chunks_written} entered.`} />
        )}
        {progress.next_break && (
          <p className="hint">Next break: after part {progress.next_break.after_part}, about {when(progress.next_break.start)} to {when(progress.next_break.end)}.</p>
        )}
        <p className="hint">The finish time is a target. Google Docs outages or delays can push it later; TypeWit moves the rest of the schedule rather than rushing.</p>
        <label className="check small" style={{ marginTop: "0.5rem" }}>
          <input type="checkbox" checked={announceProgress} onChange={(e) => setAnnounce(e.target.checked)} />
          <span>Announce progress every {MILESTONE}% to screen readers (status changes are always announced)</span>
        </label>
      </section>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <section className="card" aria-labelledby="entered-title">
          <div className="card-head"><h2 id="entered-title">Text entered so far</h2></div>
          <div className="preview" tabIndex={0} role="region" aria-label="Entered text">
            {progress.written_text ? progress.written_text : <span className="pending">Nothing has been entered yet.</span>}
          </div>
        </section>
        <section className="card" aria-labelledby="remaining-title">
          <div className="card-head"><h2 id="remaining-title">Still to come</h2></div>
          <div className="preview" tabIndex={0} role="region" aria-label="Remaining text">
            {progress.remaining_text ? progress.remaining_text : <span className="pending">Nothing left to enter.</span>}
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="log-title">
        <div className="card-head">
          <h2 id="log-title">Session log</h2>
          <button type="button" className="link-btn" onClick={downloadLog}>Download CSV</button>
        </div>
        <p className="small muted" style={{ marginBottom: "0.75rem" }}>
          TypeWit&apos;s own record of this session: when each part was planned and actually entered, pauses, retries and
          problems. It is separate from Google Docs version history (File → Version history), which Google groups and may
          merge, so it won&apos;t match these entries one to one.
        </p>
        {completed && revisions && (
          <p className="alert alert-info small" style={{ marginBottom: "0.75rem" }}>
            {revisions.unavailable
              ? `TypeWit couldn't read Google's revision list for comparison (${revisions.unavailable}).`
              : `For comparison: Google Drive listed ${revisions.in_window} revision${revisions.in_window === 1 ? "" : "s"} during this session for ${progress.chunks_total} insertions.`}
          </p>
        )}
        <ol className="log" aria-label="Session log, newest first" tabIndex={0}>
          {events.map((event, i) => {
            const { text, sub, late } = describe(event);
            return (
              <li key={`${event.created_at}-${i}`} className={late ? "late" : undefined}>
                <time dateTime={event.created_at}>{when(event.created_at, true)}</time>
                <span>{text}{sub && <span className="sub">{sub}</span>}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {finished && (
        <section className="card" aria-labelledby="data-title" style={{ marginTop: "1.5rem" }}>
          <div className="card-head"><h2 id="data-title">Saved data for this session</h2></div>
          <p className="small muted">
            TypeWit keeps this session&apos;s text, schedule and log so you can review them. Deleting removes them from
            TypeWit. Your Google Doc is not changed.
          </p>
          {!confirmDelete
            ? <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: "0.75rem" }} onClick={() => setConfirmDelete(true)} disabled={busy}>Delete this session</button>
            : (
              <div className="confirm" role="alertdialog" aria-labelledby="delete-title" onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}>
                <p id="delete-title">Delete this session&apos;s saved text and log?</p>
                <div className="row">
                  <button type="button" className="btn btn-danger-solid btn-sm" onClick={deleteSession} autoFocus disabled={busy}>Delete</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Keep</button>
                </div>
              </div>
            )}
        </section>
      )}
    </>
  );
}

function AttentionPanel({ attention, message, nextPart, needsConfirm, busy, onResume }: {
  attention: Attention;
  message: string | null;
  nextPart: string | null;
  needsConfirm: boolean;
  busy: boolean;
  onResume: (body: Record<string, unknown>) => void;
}) {
  return (
    <section className="attention" role="alert" aria-labelledby="attention-title">
      <h2 id="attention-title">{ATTENTION_TITLE[attention]}</h2>
      <p className="small">{message}</p>
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
            </>
          )
          : attention === "reconnect"
          ? (
            <>
              <Link href="/app/documents" className="btn btn-secondary btn-sm">Reconnect Google</Link>
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

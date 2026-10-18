"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/Icons";
import { type Drip, type DripEvent, EVENT_LABEL, STATUS_LABEL } from "@/lib/types";
import { useRequireSession } from "@/lib/useRequireSession";

const ACTIVE = new Set(["scheduled", "running"]);

function clock(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Time of day, plus the date when it isn't today (long sessions span days). */
function when(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}

function describe(event: DripEvent): string {
  const label = EVENT_LABEL[event.kind] ?? event.kind;
  const { written, total } = event.detail as { written?: number; total?: number };
  return event.kind === "chunk_written" && written && total ? `${label} (${written} of ${total})` : label;
}

function SessionView() {
  const id = useSearchParams().get("id") ?? "";
  const session = useRequireSession();
  const dashboard = useDashboard();
  const progressHeading = useRef<HTMLHeadingElement>(null);
  const [drip, setDrip] = useState<Drip | null>(null);
  const [events, setEvents] = useState<DripEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const lastChunk = useRef<number | null>(null);
  const lastStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ drip: Drip; events: DripEvent[] }>(`drips/${id}`);
      setDrip(res.drip);
      setEvents(res.events);
      setError(null);

      // Tell screen readers about real changes only, not every second.
      const { progress, status } = res.drip;
      if (lastChunk.current !== null && progress.chunks_written !== lastChunk.current) {
        setAnnouncement(`${progress.words_written} of ${progress.words_total} words have been entered.`);
      } else if (lastStatus.current !== null && status !== lastStatus.current) {
        setAnnouncement(`Session status: ${STATUS_LABEL[status]}.`);
      }
      lastChunk.current = progress.chunks_written;
      lastStatus.current = status;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this session.");
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
    return () => {
      clearInterval(poll);
      client.removeChannel(channel);
    };
  }, [session, id, load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  async function control(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    setConfirmStop(false);
    try {
      await api(`drips/${id}/${action}`, { method: "POST", body: {} });
      await Promise.all([load(), dashboard.refresh()]);
      setAnnouncement(action === "pause" ? "Session paused." : action === "resume" ? "Session resumed." : "Session stopped.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
      // The buttons that had focus may be gone now; keep keyboard users in place.
      progressHeading.current?.focus();
    }
  }

  function downloadLog() {
    if (!drip) return;
    const rows = [["time", "event"], ...[...events].reverse().map((e) => [e.created_at, describe(e)])];
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `typewit-activity-${drip.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!session) return <p role="status">Loading…</p>;
  if (!id) {
    return (
      <div className="panel empty" role="alert">
        <p>No session was chosen.</p>
        <Link href="/app/sessions" className="button small">See all sessions</Link>
      </div>
    );
  }
  if (error && !drip) return <p className="notice error" role="alert">{error}</p>;
  if (!drip) return <div className="app-loading" role="status"><span className="spinner" aria-hidden="true" />Loading session…</div>;

  const { progress } = drip;
  const active = ACTIVE.has(drip.status);
  const countdown = progress.next_chunk_at
    ? Math.max(0, Math.ceil((Date.parse(progress.next_chunk_at) - now) / 1000))
    : null;
  const finish = progress.finish_at ? when(progress.finish_at) : null;
  const title = drip.document_title ?? "Untitled document";

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/app/sessions">Sessions</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <div className="dash-head">
        <div>
          <h1>{title}</h1>
          <p>
            <span className={`pill ${drip.status}`}>{STATUS_LABEL[drip.status]}</span>
            <span className="row-sub" style={{ marginLeft: "0.6rem" }}>Started {when(drip.created_at)}</span>
          </p>
        </div>
        {drip.document_url && (
          <a href={drip.document_url} target="_blank" rel="noopener noreferrer" className="button quiet">
            Open in Google Docs <Icon.external /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>

      {/* Polite live region: announces each part entered and each status change. */}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      {drip.status === "failed" && drip.last_error && (
        <p className="notice error" role="alert">Writing stopped: {drip.last_error}</p>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}

      <section className="panel" aria-labelledby="progress-title" style={{ marginBottom: "1.25rem" }}>
        <div className="panel-head">
          <h2 id="progress-title" ref={progressHeading} tabIndex={-1}>Progress</h2>
          <span className="row-sub">{progress.percent}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Words entered"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-valuetext={`${progress.words_written} of ${progress.words_total} words`}
          style={{ height: 10 }}
        >
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <dl className="stats">
          <div><dt>Words entered</dt><dd>{progress.words_written} <small className="row-sub">of {progress.words_total}</small></dd></div>
          <div><dt>Steps done</dt><dd>{progress.chunks_written} <small className="row-sub">of {progress.chunks_total}</small></dd></div>
          {countdown !== null && (
            <div>
              <dt>Next step in</dt>
              <dd aria-hidden="true">{countdown === 0 ? "Any moment" : clock(countdown)}</dd>
              <dd className="sr-only">at {when(progress.next_chunk_at!)}</dd>
            </div>
          )}
          {finish && <div><dt>{drip.status === "completed" ? "Finished" : "Expected to finish"}</dt><dd style={{ fontSize: "1.1rem" }}>{finish}</dd></div>}
        </dl>

        {(active || drip.status === "paused") && (
          <div className="controls" role="group" aria-label="Session controls">
            {active && <button type="button" className="button" onClick={() => control("pause")} disabled={busy}><Icon.pause /> Pause</button>}
            {drip.status === "paused" && (
              <button type="button" className="button" onClick={() => control("resume")} disabled={busy}>Resume</button>
            )}
            {!confirmStop && (
              <button type="button" className="button danger" onClick={() => setConfirmStop(true)} disabled={busy}>Stop</button>
            )}
          </div>
        )}

        {confirmStop && (
          <div className="confirm" role="alertdialog" aria-labelledby="stop-title" aria-describedby="stop-desc">
            <p id="stop-title" style={{ fontWeight: 650, margin: "0 0 0.25rem" }}>Stop this session?</p>
            <p id="stop-desc" className="muted">Nothing more will be entered. What's already in your document stays.</p>
            <div className="controls" style={{ marginTop: "0.5rem" }}>
              <button type="button" className="button danger small" onClick={() => control("cancel")} autoFocus>Yes, stop</button>
              <button type="button" className="button quiet small" onClick={() => setConfirmStop(false)}>Keep going</button>
            </div>
          </div>
        )}
      </section>

      <div className="dash-grid cols-2">
        <section className="panel" aria-labelledby="entered-title">
          <div className="panel-head"><h2 id="entered-title">Text entered so far</h2></div>
          <div className="preview" tabIndex={0} role="region" aria-label="Entered text">
            {progress.written_text ? progress.written_text : <span className="pending">Nothing has been entered yet.</span>}
          </div>
        </section>

        <section className="panel" aria-labelledby="log-title">
          <div className="panel-head">
            <h2 id="log-title">Activity log</h2>
            <button type="button" className="link-button" onClick={downloadLog}>Download CSV</button>
          </div>
          <ol className="log">
            {events.map((event, i) => (
              <li key={`${event.created_at}-${i}`}>
                <time dateTime={event.created_at}>{when(event.created_at)}</time>
                <span>{describe(event)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <SessionView />
    </Suspense>
  );
}

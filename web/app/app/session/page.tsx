"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { type Drip, type DripEvent, EVENT_LABEL, STATUS_LABEL } from "@/lib/types";
import { useRequireSession } from "@/lib/useRequireSession";

const ACTIVE = new Set(["scheduled", "running"]);

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function describe(event: DripEvent): string {
  const label = EVENT_LABEL[event.kind] ?? event.kind;
  const { written, total } = event.detail as { written?: number; total?: number };
  return event.kind === "chunk_written" && written && total ? `${label} (${written} of ${total})` : label;
}

function SessionView() {
  const id = useSearchParams().get("id") ?? "";
  const session = useRequireSession();
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
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
  if (!id) return <p className="error" role="alert">No session was chosen. <Link href="/app">Go to your dashboard</Link>.</p>;
  if (error && !drip) return <p className="error" role="alert">{error}</p>;
  if (!drip) return <p role="status">Loading session…</p>;

  const { progress } = drip;
  const active = ACTIVE.has(drip.status);
  const countdown = progress.next_chunk_at
    ? Math.max(0, Math.ceil((Date.parse(progress.next_chunk_at) - now) / 1000))
    : null;
  const finish = progress.finish_at ? new Date(progress.finish_at).toLocaleTimeString() : null;

  return (
    <>
      <p><Link href="/app">← Back to dashboard</Link></p>
      <h1>{drip.document_title ?? "Untitled document"}</h1>
      <p>
        <span className={`pill ${drip.status}`}>{STATUS_LABEL[drip.status]}</span>
        {drip.document_url && (
          <>
            {" "}
            <a href={drip.document_url} target="_blank" rel="noopener noreferrer">
              Open the document <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        )}
      </p>

      {/* Polite live region: announces each part entered and each status change. */}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      {drip.status === "failed" && drip.last_error && (
        <p className="notice error" role="alert">Writing stopped: {drip.last_error}</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card" aria-labelledby="progress-title">
        <h2 id="progress-title" style={{ fontSize: "1.3rem" }}>Progress</h2>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Words entered"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-valuetext={`${progress.words_written} of ${progress.words_total} words`}
        >
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <dl className="stats">
          <div><dt>Words entered</dt><dd>{progress.words_written} of {progress.words_total}</dd></div>
          <div><dt>Parts entered</dt><dd>{progress.chunks_written} of {progress.chunks_total}</dd></div>
          {countdown !== null && (
            <div>
              <dt>Next part in</dt>
              <dd aria-hidden="true">{clock(countdown)}</dd>
              <dd className="sr-only">at {new Date(progress.next_chunk_at!).toLocaleTimeString()}</dd>
            </div>
          )}
          {finish && <div><dt>{drip.status === "completed" ? "Finished at" : "Expected to finish"}</dt><dd>{finish}</dd></div>}
        </dl>

        <div className="controls" role="group" aria-label="Session controls">
          {active && <button type="button" className="button" onClick={() => control("pause")} disabled={busy}>Pause</button>}
          {drip.status === "paused" && (
            <button type="button" className="button" onClick={() => control("resume")} disabled={busy}>Resume</button>
          )}
          {(active || drip.status === "paused") && !confirmStop && (
            <button type="button" className="button danger" onClick={() => setConfirmStop(true)} disabled={busy}>Stop</button>
          )}
        </div>

        {confirmStop && (
          <div className="notice" role="alertdialog" aria-labelledby="stop-title" aria-describedby="stop-desc">
            <p id="stop-title"><strong>Stop this session?</strong></p>
            <p id="stop-desc" className="muted">
              Nothing more will be entered. What's already in your document stays there.
            </p>
            <div className="controls">
              <button type="button" className="button danger" onClick={() => control("cancel")} autoFocus>
                Yes, stop
              </button>
              <button type="button" className="button secondary" onClick={() => setConfirmStop(false)}>
                Keep going
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="entered-title">
        <h2 id="entered-title" style={{ fontSize: "1.3rem" }}>Text entered so far</h2>
        <div className="preview" tabIndex={0} role="region" aria-label="Entered text">
          {progress.written_text
            ? progress.written_text
            : <span className="pending">Nothing has been entered yet.</span>}
        </div>
      </section>

      <section className="section" aria-labelledby="log-title">
        <h2 id="log-title" style={{ fontSize: "1.3rem" }}>Activity log</h2>
        <p className="muted">A record of your approval and every step TypeWit took, newest first.</p>
        <ol className="log">
          {events.map((event, i) => (
            <li key={`${event.created_at}-${i}`}>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString()}</time>
              <span>{describe(event)}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="button secondary small" onClick={downloadLog} style={{ marginTop: "1rem" }}>
          Download the log (CSV)
        </button>
      </section>
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

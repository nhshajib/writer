"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProgressRing } from "@/components/app/Charts";
import { statusLine, titleOf } from "@/components/app/SessionCards";
import { Problem } from "@/components/app/Problem";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dashboard";
import { useNow, useSessionControl } from "@/lib/sessionActions";
import { describe } from "@/lib/sessionLog";
import { when } from "@/lib/time";
import { type Drip, type DripEvent, stateOf, UNIT_LABEL } from "@/lib/types";

/** A side panel with a session's key facts and latest activity, without leaving the list. */
export function SessionPreview({ drip, onClose, control }: {
  drip: Drip | null;
  onClose: () => void;
  control: ReturnType<typeof useSessionControl>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [events, setEvents] = useState<DripEvent[] | null>(null);
  const now = useNow();

  useEffect(() => {
    if (drip && !dialog.current?.open) dialog.current?.showModal();
    if (!drip && dialog.current?.open) dialog.current.close();
  }, [drip]);

  useEffect(() => {
    if (!drip) return;
    let cancelled = false;
    setEvents(null);
    api<{ events: DripEvent[] }>(`drips/${drip.id}`)
      .then((res) => !cancelled && setEvents(res.events))
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, [drip?.id, drip?.progress.chunks_written, drip?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = drip?.progress;
  const busy = drip ? control.busyId === drip.id : false;

  return (
    <dialog ref={dialog} className="drawer" aria-labelledby="preview-title" onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
      {drip && p && (
        <div className="drawer-inner">
          <div className="drawer-head">
            <div>
              <p className="small muted">Session preview</p>
              <h2 id="preview-title">{titleOf(drip)}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} autoFocus>
              <Icon.close /><span className="sr-only">Close preview</span>
            </button>
          </div>

          <div className="drawer-hero">
            <div className="ring-wrap">
              <ProgressRing value={p.percent} size={88} stroke={8} tone={drip.status === "completed" ? "good" : "accent"} />
              <span className="ring-num">{p.percent}%</span>
            </div>
            <div className="stack-2">
              <StatusBadge state={stateOf(drip)} />
              <p className="small">{statusLine(drip, now)}</p>
              <p className="small muted">{p.words_written.toLocaleString()} of {p.words_total.toLocaleString()} words · {p.chunks_written} of {p.chunks_total} {UNIT_LABEL[drip.insertion_unit].many}</p>
            </div>
          </div>

          <div className="row">
            {(drip.status === "running" || drip.status === "scheduled") && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => control.run(drip.id, "pause")}><Icon.pause />Pause</button>
            )}
            {drip.status === "paused" && !drip.attention && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => control.run(drip.id, "resume")}><Icon.play />Resume</button>
            )}
            <Link href={`/app/session?id=${drip.id}`} className={`btn btn-sm ${drip.attention ? "btn-primary" : "btn-secondary"}`}>
              {drip.attention ? "Review and fix" : "Open full session"}
            </Link>
            {drip.document_url && (
              <a href={drip.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                {drip.provider === "microsoft" ? "Word" : "Google Docs"} <Icon.external /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>

          <dl className="facts">
            <div><dt>Started</dt><dd>{formatDate(drip.created_at)}, {when(drip.created_at)}</dd></div>
            <div><dt>{drip.status === "completed" ? "Finished" : "Expected to finish"}</dt><dd>{p.finish_at ? when(p.finish_at) : "—"}</dd></div>
            <div><dt>Steps</dt><dd>{drip.mode === "as_soon_as_possible" ? "All at once" : UNIT_LABEL[drip.insertion_unit].title}</dd></div>
            <div><dt>Breaks</dt><dd>{drip.breaks?.length ? `${drip.breaks.length} planned` : "None"}</dd></div>
          </dl>

          <section aria-labelledby="preview-log">
            <h3 id="preview-log" className="drawer-sub">Latest activity</h3>
            {events === null
              ? <p className="small muted" role="status">Loading…</p>
              : events.length === 0
              ? <p className="small muted">No activity yet.</p>
              : (
                <ol className="log">
                  {events.slice(0, 6).map((event, i) => {
                    const { text, sub, late } = describe(event);
                    return (
                      <li key={`${event.created_at}-${i}`} className={late ? "late" : undefined}>
                        <time dateTime={event.created_at}>{when(event.created_at, true)}</time>
                        <span>{text}{sub && <span className="sub"><Problem message={sub} compact /></span>}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
          </section>
        </div>
      )}
    </dialog>
  );
}

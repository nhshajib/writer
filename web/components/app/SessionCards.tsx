"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Problem } from "@/components/app/Problem";
import { StatusBadge } from "@/components/app/StatusBadge";
import { friendlyError } from "@/lib/errors";
import { Icon } from "@/components/Icons";
import { useSessionControl } from "@/lib/sessionActions";
import { clock, when } from "@/lib/time";
import { ACTIVITY_LABEL, ATTENTION_TITLE, type Drip, stateOf, UNIT_LABEL } from "@/lib/types";

/** What a session is doing right now, in a few words. */
export function statusLine(drip: Drip, now: number): string {
  const p = drip.progress;
  if (drip.status === "paused") {
    if (drip.attention) return ATTENTION_TITLE[drip.attention];
    return p.finish_if_resumed_now ? `Paused · would finish ${when(p.finish_if_resumed_now)} if resumed now` : "Paused";
  }
  if (drip.status === "completed") return p.finish_at ? `Finished ${when(p.finish_at)}` : "Finished";
  if (drip.status === "canceled") return "Stopped";
  if (drip.status === "failed") return drip.last_error ? `Stopped: ${friendlyError(drip.last_error)?.title ?? drip.last_error}` : "Stopped by an error";
  if (drip.session_started_at && Date.parse(drip.session_started_at) > now && p.chunks_written === 0) {
    return `Starts ${when(drip.session_started_at)}`;
  }
  if (p.activity === "on_break" && p.current_break) return `On a planned break until ${when(p.current_break.end)}`;
  if (p.next_chunk_at) {
    const s = Math.max(0, Math.ceil((Date.parse(p.next_chunk_at) - now) / 1000));
    return s === 0 ? "Next part due any moment" : `Next part planned in ${clock(s)}`;
  }
  return p.activity ? ACTIVITY_LABEL[p.activity] : "Waiting";
}

export const titleOf = (drip: Drip) => drip.document_title ?? "Untitled document";

/** A session that needs the person, with the quickest fix offered right here. */
export function AttentionCard({ drip, control }: { drip: Drip; control: ReturnType<typeof useSessionControl> }) {
  const title = titleOf(drip);
  const busy = control.busyId === drip.id;
  const failed = drip.status === "failed";
  const error = control.error?.id === drip.id ? control.error.message : null;
  // Fixes that need the person to look at the document first go to the session page.
  const needsReview = drip.attention === "document_changed" || drip.attention === "confirm_last_part";
  return (
    <li className="attention-card">
      <span className="attention-icon" aria-hidden="true"><Icon.alert /></span>
      <div className="attention-body">
        <p className="attention-title">
          <Link href={`/app/session?id=${drip.id}`}>{title}</Link>
          <span>{failed ? "Stopped by an error" : drip.attention ? ATTENTION_TITLE[drip.attention] : "Paused"}</span>
        </p>
        {drip.last_error && <p className="small muted"><Problem message={drip.last_error} /></p>}
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      <div className="attention-actions">
        {failed
          ? <Link href={`/app/new?from=${drip.id}`} className="btn btn-secondary btn-sm">Run again…<span className="sr-only"> {title}</span></Link>
          : needsReview
          ? <Link href={`/app/session?id=${drip.id}`} className="btn btn-primary btn-sm">Review and fix<span className="sr-only"> {title}</span></Link>
          : (
            <>
              {drip.attention === "reconnect" && <Link href="/app/connections" className="btn btn-secondary btn-sm">Reconnect Google</Link>}
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => control.run(drip.id, "resume")}>
                Resume<span className="sr-only"> {title}</span>
              </button>
            </>
          )}
      </div>
    </li>
  );
}

/** The main live session on Home: large progress, what happens next, and its controls. */
export function LiveHero({ drip, now, control, menu }: { drip: Drip; now: number; control: ReturnType<typeof useSessionControl>; menu?: ReactNode }) {
  const [confirmStop, setConfirmStop] = useState(false);
  const p = drip.progress;
  const title = titleOf(drip);
  const busy = control.busyId === drip.id;
  const running = drip.status === "running" || drip.status === "scheduled";
  const word = drip.provider === "microsoft";
  const error = control.error?.id === drip.id ? control.error.message : null;
  return (
    <article className="live-hero" aria-labelledby={`hero-${drip.id}`}>
      <div className="lh-top">
        <span className={`doc-icon lg ${word ? "word" : "gdoc"}`} aria-hidden="true"><Icon.doc /></span>
        <div className="lh-title">
          <Link id={`hero-${drip.id}`} href={`/app/session?id=${drip.id}`} className="title">{title}</Link>
          <span className="meta">
            {word ? "Microsoft Word" : "Google Docs"} · {drip.mode === "as_soon_as_possible" ? "All at once" : UNIT_LABEL[drip.insertion_unit].title}
          </span>
        </div>
        <StatusBadge state={stateOf(drip)} />
        {menu && <span className="lh-menu">{menu}</span>}
      </div>
      <div className="lh-figures">
        <p className="lh-pct" aria-hidden="true">{p.percent}<span>%</span></p>
        <div className="lh-facts">
          <p><strong>{p.words_written.toLocaleString()}</strong> of {p.words_total.toLocaleString()} words entered</p>
          <p className="muted">{statusLine(drip, now)}</p>
        </div>
      </div>
      <div className="progress xl" role="progressbar" aria-label={`Progress for ${title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent}>
        <span style={{ width: `${p.percent}%` }} />
      </div>
      <div className="lh-actions">
        {running && (
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => control.run(drip.id, "pause")}>
            <Icon.pause />Pause<span className="sr-only"> {title}</span>
          </button>
        )}
        {drip.status === "paused" && !drip.attention && (
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => control.run(drip.id, "resume")}>
            <Icon.play />Resume<span className="sr-only"> {title}</span>
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => setConfirmStop(true)} aria-expanded={confirmStop}>
          <Icon.stop />Stop<span className="sr-only"> {title}</span>
        </button>
        {drip.document_url && (
          <a className="btn btn-ghost btn-lg lh-open" href={drip.document_url} target="_blank" rel="noopener noreferrer">
            Open in {word ? "Word" : "Google Docs"}<Icon.external /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {confirmStop && (
        <div className="confirm" role="alertdialog" aria-labelledby={`stop-${drip.id}`} aria-describedby={`stopd-${drip.id}`}
          onKeyDown={(e) => e.key === "Escape" && setConfirmStop(false)}>
          <p id={`stop-${drip.id}`}>Stop this session?</p>
          <p id={`stopd-${drip.id}`} className="small muted">Stopping cancels every insertion still planned. Text already entered stays in your document, and the session can&apos;t be resumed.</p>
          <div className="row">
            <button type="button" className="btn btn-danger-solid btn-sm" autoFocus disabled={busy}
              onClick={async () => { await control.run(drip.id, "cancel"); setConfirmStop(false); }}>Stop session</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmStop(false)}>Keep going</button>
          </div>
        </div>
      )}
      {error && <p className="alert alert-error small" role="alert">{error}</p>}
    </article>
  );
}

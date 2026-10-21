import { type DraftActionKind, executionText } from "./drafting.ts";
import { countWords } from "./chunker.ts";
import type { PlannedBreak } from "./pacing.ts";
import { MIN_GAP_SECONDS, plannedAt } from "./schedule.ts";

/**
 * Session states, as the user sees them. Idle (no session yet) only exists in
 * the client.
 *
 *   preparing  — saved with its full schedule; the first insertion isn't due yet
 *   running    — entering text or waiting for the next planned insertion or break
 *   paused     — by the user, or by TypeWit when it needs the user (see attention)
 *   recovering — checking the document after an interruption, or retrying
 *   completed / cancelled / failed
 */
export type SessionState = "preparing" | "running" | "paused" | "recovering" | "completed" | "cancelled" | "failed";

/** What is happening right now. */
export type Activity = "entering" | "waiting" | "on_break" | "paused" | "recovering" | "done";

/** Within this long of an insertion, the session counts as entering text. */
const ENTERING_WINDOW_MS = 5_000;

export interface ProgressInput {
  status: string;
  chunks: string[];
  chunk_deletions?: number[] | null;
  action_kinds?: DraftActionKind[] | null;
  source_chunks?: string[] | null;
  source_unit_ends?: number[] | null;
  chunks_written: number;
  total_chunks: number;
  word_count: number;
  schedule: number[];
  session_started_at: string | null;
  schedule_shift_seconds: number;
  paused_at: string | null;
  last_written_at: string | null;
  next_run_at: string | null;
  completed_at: string | null;
  breaks?: PlannedBreak[];
  pending_index?: number | null;
  retry_at?: string | null;
  attempts?: number;
}

export interface Progress {
  state: SessionState;
  activity: Activity;
  /** The break in progress, or the next one, with times shifted like the schedule. */
  current_break: { after_part: number; start: string; end: string } | null;
  next_break: { after_part: number; start: string; end: string } | null;
  /** 0-100, by characters confirmed in the document. */
  percent: number;
  words_written: number;
  words_total: number;
  chars_written: number;
  chars_total: number;
  chunks_written: number;
  chunks_total: number;
  /** When the next unit is planned; null once finished, paused or stopped. */
  next_chunk_at: string | null;
  seconds_until_next_chunk: number | null;
  /** When the last unit is planned, or when it landed; null if stopped. */
  finish_at: string | null;
  /** While paused: when the session would finish if resumed right now. */
  finish_if_resumed_now: string | null;
  /** The text that is confirmed in the document. */
  written_text: string;
  /** The approved text not entered yet. */
  remaining_text: string;
  /** The next unit to be entered (or the one an interrupted insertion was entering). */
  next_part: string | null;
  /** A simulated wrong character/word may currently be visible; approved progress excludes it. */
  temporary_edit_active: boolean;
  edit_action: DraftActionKind | null;
  /** Execution edit cursor, distinct from fully confirmed source units. */
  edits_written: number;
  edits_total: number;
}

const ACTIVE = new Set(["scheduled", "running"]);

/** Derives everything a progress view needs from a drip row. */
export function computeProgress(drip: ProgressInput, now: Date): Progress {
  const written = Math.min(drip.chunks_written, drip.chunks.length);
  const source = drip.source_chunks ?? drip.chunks;
  const sourceWritten = drip.source_unit_ends ? drip.source_unit_ends.filter((end) => end <= written).length : written;
  const writtenText = source.slice(0, sourceWritten).join("");
  const remainingText = source.slice(sourceWritten).join("");
  const completedSourceBoundary = drip.source_unit_ends?.[sourceWritten - 1] ?? 0;
  const draftTail = drip.chunk_deletions && written > completedSourceBoundary
    ? executionText(drip.chunks, drip.chunk_deletions, completedSourceBoundary, written)
    : "";
  const withinSource = written > completedSourceBoundary && written < drip.total_chunks;
  const temporary = withinSource && draftTail.length > 0 && !(source[sourceWritten] ?? "").startsWith(draftTail);
  const sourceAt = (executionCount: number) =>
    drip.source_unit_ends ? drip.source_unit_ends.filter((end) => end <= executionCount).length : executionCount;
  const charsTotal = writtenText.length + remainingText.length;
  const remaining = drip.total_chunks - written;
  const scheduled = drip.session_started_at !== null && drip.schedule.length === drip.total_chunks;
  const active = ACTIVE.has(drip.status) && remaining > 0;

  let nextAt: number | null = null;
  let finishAt: string | null = null;
  let finishIfResumed: string | null = null;

  if (drip.status === "completed") {
    finishAt = drip.completed_at;
  } else if (scheduled && remaining > 0) {
    const session = {
      session_started_at: drip.session_started_at!,
      schedule: drip.schedule,
      schedule_shift_seconds: drip.schedule_shift_seconds,
    };
    if (active) {
      const earliest = drip.last_written_at ? Date.parse(drip.last_written_at) + MIN_GAP_SECONDS * 1000 : 0;
      nextAt = Math.max(plannedAt(session, written), earliest);
      // A retry after a failure waits for its backoff.
      if (drip.retry_at && Date.parse(drip.retry_at) > nextAt) nextAt = Date.parse(drip.retry_at);
      finishAt = new Date(Math.max(plannedAt(session, drip.total_chunks - 1), nextAt)).toISOString();
    } else if (drip.status === "paused") {
      const pausedFor = drip.paused_at ? Math.max(0, now.getTime() - Date.parse(drip.paused_at)) : 0;
      finishIfResumed = new Date(plannedAt(session, drip.total_chunks - 1) + pausedFor).toISOString();
    }
  }

  const now_ = now.getTime();
  const shift = drip.schedule_shift_seconds * 1000;
  const start = drip.session_started_at ? Date.parse(drip.session_started_at) : 0;
  const breakTimes = (drip.breaks ?? []).map((b) => ({
    after_part: b.after_index + 1,
    startMs: start + shift + b.start_ms,
    endMs: start + shift + b.start_ms + b.duration_ms,
  }));
  const fmt = (b: { after_part: number; startMs: number; endMs: number } | undefined) =>
    b
      ? {
        after_part: sourceAt(b.after_part),
        start: new Date(b.startMs).toISOString(),
        end: new Date(b.endMs).toISOString(),
      }
      : null;
  // Only breaks after units already entered can be in progress; later ones are upcoming.
  const current = active
    ? breakTimes.find((b) => b.after_part <= written && b.startMs <= now_ && now_ < b.endMs)
    : undefined;
  const upcoming = active ? breakTimes.find((b) => b.after_part > written || b.startMs > now_) : undefined;

  const recovering = active &&
    (drip.pending_index != null || (drip.retry_at != null && Date.parse(drip.retry_at) > now_) ||
      (drip.attempts ?? 0) > 0);
  let state: SessionState;
  if (drip.status === "completed") state = "completed";
  else if (drip.status === "canceled") state = "cancelled";
  else if (drip.status === "failed") state = "failed";
  else if (drip.status === "paused") state = "paused";
  else if (recovering) state = "recovering";
  else if (written === 0 && (nextAt === null || nextAt - now_ > ENTERING_WINDOW_MS)) state = "preparing";
  else state = "running";

  let activity: Activity;
  if (state === "completed" || state === "cancelled" || state === "failed") activity = "done";
  else if (state === "paused") activity = "paused";
  else if (state === "recovering") activity = "recovering";
  else if (current) activity = "on_break";
  else if (nextAt !== null && nextAt - now_ <= ENTERING_WINDOW_MS) activity = "entering";
  else activity = "waiting";

  return {
    state,
    activity,
    current_break: fmt(current),
    next_break: current ? null : fmt(upcoming),
    percent: charsTotal > 0 ? Math.min(100, Math.floor((writtenText.length / charsTotal) * 100)) : 0,
    words_written: countWords(writtenText),
    words_total: drip.word_count,
    chars_written: writtenText.length,
    chars_total: charsTotal,
    chunks_written: sourceWritten,
    chunks_total: source.length,
    next_chunk_at: nextAt === null ? null : new Date(nextAt).toISOString(),
    seconds_until_next_chunk: nextAt === null ? null : Math.max(0, Math.ceil((nextAt - now.getTime()) / 1000)),
    finish_at: finishAt,
    finish_if_resumed_now: finishIfResumed,
    written_text: writtenText,
    remaining_text: remainingText,
    next_part: sourceWritten < source.length ? source[sourceWritten] : null,
    temporary_edit_active: temporary,
    edit_action: drip.action_kinds?.[Math.min(written, drip.total_chunks - 1)] ?? null,
    edits_written: written,
    edits_total: drip.total_chunks,
  };
}

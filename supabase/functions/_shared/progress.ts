import { countWords } from "./chunker.ts";
import { MIN_GAP_SECONDS, plannedAt } from "./schedule.ts";

export interface ProgressInput {
  status: string;
  chunks: string[];
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
}

export interface Progress {
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
}

const ACTIVE = new Set(["scheduled", "running"]);

/** Derives everything a progress view needs from a drip row. */
export function computeProgress(drip: ProgressInput, now: Date): Progress {
  const written = Math.min(drip.chunks_written, drip.chunks.length);
  const writtenText = drip.chunks.slice(0, written).join("");
  const remainingText = drip.chunks.slice(written).join("");
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
      if (drip.next_run_at && Date.parse(drip.next_run_at) > nextAt && drip.status === "scheduled") {
        nextAt = Date.parse(drip.next_run_at);
      }
      finishAt = new Date(Math.max(plannedAt(session, drip.total_chunks - 1), nextAt)).toISOString();
    } else if (drip.status === "paused") {
      const pausedFor = drip.paused_at ? Math.max(0, now.getTime() - Date.parse(drip.paused_at)) : 0;
      finishIfResumed = new Date(plannedAt(session, drip.total_chunks - 1) + pausedFor).toISOString();
    }
  }

  return {
    percent: charsTotal > 0 ? Math.min(100, Math.floor((writtenText.length / charsTotal) * 100)) : 0,
    words_written: countWords(writtenText),
    words_total: drip.word_count,
    chars_written: writtenText.length,
    chars_total: charsTotal,
    chunks_written: written,
    chunks_total: drip.total_chunks,
    next_chunk_at: nextAt === null ? null : new Date(nextAt).toISOString(),
    seconds_until_next_chunk: nextAt === null ? null : Math.max(0, Math.ceil((nextAt - now.getTime()) / 1000)),
    finish_at: finishAt,
    finish_if_resumed_now: finishIfResumed,
    written_text: writtenText,
    remaining_text: remainingText,
    next_part: written < drip.chunks.length ? drip.chunks[written] : null,
  };
}

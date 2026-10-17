import { countWords } from "./chunker.ts";

export interface ProgressInput {
  status: string;
  chunks: string[];
  chunks_written: number;
  total_chunks: number;
  interval_seconds: number;
  word_count: number;
  next_run_at: string | null;
  completed_at: string | null;
}

export interface Progress {
  /** 0-100, by words written. */
  percent: number;
  words_written: number;
  words_total: number;
  chunks_written: number;
  chunks_total: number;
  /** When the next chunk lands; null once finished, paused or stopped. */
  next_chunk_at: string | null;
  seconds_until_next_chunk: number | null;
  /** When the last chunk should land, or when it did; null if paused or stopped. */
  finish_at: string | null;
  /** The text that is already in the document. */
  written_text: string;
}

const ACTIVE = new Set(["scheduled", "running"]);

/** Derives everything a progress view needs from a drip row. */
export function computeProgress(drip: ProgressInput, now: Date): Progress {
  const written = Math.min(drip.chunks_written, drip.chunks.length);
  const writtenText = drip.chunks.slice(0, written).join("");
  const wordsWritten = countWords(writtenText);
  const remaining = drip.total_chunks - drip.chunks_written;
  const active = ACTIVE.has(drip.status) && remaining > 0 && drip.next_run_at !== null;

  let finishAt: string | null = null;
  if (drip.status === "completed") {
    finishAt = drip.completed_at;
  } else if (active) {
    finishAt = new Date(Date.parse(drip.next_run_at!) + (remaining - 1) * drip.interval_seconds * 1000).toISOString();
  }

  return {
    percent: drip.word_count > 0 ? Math.min(100, Math.round((wordsWritten / drip.word_count) * 100)) : 0,
    words_written: wordsWritten,
    words_total: drip.word_count,
    chunks_written: drip.chunks_written,
    chunks_total: drip.total_chunks,
    next_chunk_at: active ? drip.next_run_at : null,
    seconds_until_next_chunk: active
      ? Math.max(0, Math.ceil((Date.parse(drip.next_run_at!) - now.getTime()) / 1000))
      : null,
    finish_at: finishAt,
    written_text: writtenText,
  };
}

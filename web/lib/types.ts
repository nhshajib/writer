export interface Connection {
  id: string;
  provider: "google" | "microsoft" | "test";
  account_email: string | null;
  /** False once disconnected (or Google access was revoked); history is kept. */
  connected?: boolean;
  created_at?: string;
}

export interface Progress {
  percent: number;
  words_written: number;
  words_total: number;
  chars_written?: number;
  chars_total?: number;
  chunks_written: number;
  chunks_total: number;
  next_chunk_at: string | null;
  seconds_until_next_chunk: number | null;
  finish_at: string | null;
  finish_if_resumed_now?: string | null;
  written_text?: string;
  remaining_text?: string;
  next_part?: string | null;
}

export type DripStatus = "scheduled" | "running" | "paused" | "completed" | "failed" | "canceled";

export type InsertionUnit = "sentence" | "paragraph" | "word" | "character" | "chunk";

/** Why TypeWit paused a session itself; null when the user paused it. */
export type Attention =
  | "document_changed"
  | "confirm_last_part"
  | "reconnect"
  | "document_unavailable"
  | "unreachable"
  | "insert_rejected";

export interface Drip {
  id: string;
  provider: Connection["provider"];
  connection_id: string;
  document_id: string;
  document_title: string | null;
  document_url: string | null;
  word_count: number;
  total_chunks: number;
  duration_seconds: number;
  status: DripStatus;
  insertion_unit: InsertionUnit;
  mode: "scheduled" | "as_soon_as_possible";
  last_error: string | null;
  created_at: string;
  approved_at: string | null;
  session_started_at?: string | null;
  schedule_shift_seconds?: number;
  paused_at?: string | null;
  attention?: Attention | null;
  pending_index?: number | null;
  /** Offsets in ms from session_started_at (detail view only). */
  schedule?: number[];
  progress: Progress;
}

export interface DripEvent {
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface PlanProblem {
  code: string;
  message: string;
}

/** POST /drips/plan: the checked plan for a text, step size and duration. */
export interface SessionPlan {
  ok: boolean;
  problems: PlanProblem[];
  unit: InsertionUnit;
  words: number;
  chars: number;
  unit_count: number;
  unit_lengths: number[];
  schedule: number[];
  stats: { first_offset_ms: number; last_offset_ms: number; min_gap_ms: number; median_gap_ms: number; max_gap_ms: number } | null;
  seed: number;
  duration_seconds: number;
  minimum_duration_seconds: number;
  min_gap_seconds: number;
  options: { unit: InsertionUnit; units: number; minimum_duration_seconds: number; fits: boolean }[];
}

export const STATUS_LABEL: Record<DripStatus, string> = {
  scheduled: "Starting",
  running: "Entering text",
  paused: "Paused",
  completed: "Finished",
  failed: "Stopped by an error",
  canceled: "Stopped",
};

export const UNIT_LABEL: Record<InsertionUnit, { one: string; many: string; title: string }> = {
  sentence: { one: "sentence", many: "sentences", title: "Sentences" },
  paragraph: { one: "paragraph", many: "paragraphs", title: "Paragraphs" },
  word: { one: "word", many: "words", title: "Words" },
  character: { one: "character", many: "characters", title: "Characters" },
  chunk: { one: "part", many: "parts", title: "Even parts" },
};

export const ATTENTION_TITLE: Record<Attention, string> = {
  document_changed: "The end of the document changed",
  confirm_last_part: "Check the last part",
  reconnect: "Reconnect Google",
  document_unavailable: "The document can't be opened",
  unreachable: "Google Docs couldn't be reached",
  insert_rejected: "Google Docs refused an insertion",
};

export const EVENT_LABEL: Record<string, string> = {
  approved: "You approved the text",
  created: "Session started with its full schedule",
  chunk_written: "Entered into the document",
  schedule_shifted: "Running late: the rest of the schedule moved later",
  paused: "Paused",
  resumed: "Resumed",
  canceled: "Stopped",
  completed: "All text entered",
  retry_scheduled: "Couldn't reach Google Docs, will retry",
  attention: "Paused by TypeWit: needs you",
  failed: "Stopped by an error",
};

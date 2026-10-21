export interface Connection {
  id: string;
  provider: "google" | "microsoft" | "test";
  account_email: string | null;
  /** False once disconnected (or Google access was revoked); history is kept. */
  connected?: boolean;
  created_at?: string;
}

/** Explicit session states. Idle (no session yet) only exists in the client. */
export type SessionState = "preparing" | "running" | "paused" | "recovering" | "completed" | "cancelled" | "failed";
export type Activity = "entering" | "waiting" | "on_break" | "paused" | "recovering" | "done";

export interface BreakWindow {
  after_part: number;
  start: string;
  end: string;
}

export interface Progress {
  state?: SessionState;
  activity?: Activity;
  current_break?: BreakWindow | null;
  next_break?: BreakWindow | null;
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
  temporary_edit_active?: boolean;
  edit_action?: DraftActionKind | null;
  edits_written?: number;
  edits_total?: number;
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
  | "insert_rejected"
  | "not_editable";

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
  updated_at?: string;
  approved_at: string | null;
  session_started_at?: string | null;
  schedule_shift_seconds?: number;
  paused_at?: string | null;
  attention?: Attention | null;
  pending_index?: number | null;
  timing_mode?: "duration" | "speed" | "asap";
  pacing?: PacingSettings | null;
  breaks?: PlannedBreak[];
  /** Offsets in ms from session_started_at (detail view only). */
  schedule?: number[];
  progress: Progress;
}

export interface DripEvent {
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export type TimingMode = "duration" | "speed";
export type BreakAlignment = "any" | "sentence" | "paragraph";

export type DraftActionKind = "insert" | "typo" | "false_start" | "backspace" | "correction";
export interface DraftingSettings {
  typo_rate_pct: number;
  false_start_rate_pct: number;
  sentence_pause_seconds: number;
  sentence_pause_variation_pct: number;
}

export interface PacingSettings {
  timing: TimingMode;
  duration_seconds?: number;
  wpm?: number;
  variation_pct: number;
  drafting?: DraftingSettings;
  breaks: {
    enabled: boolean;
    every_seconds: number;
    every_variation_pct: number;
    min_seconds: number;
    max_seconds: number;
    align: BreakAlignment;
  };
}

export interface PlannedBreak {
  after_index: number;
  start_ms: number;
  duration_ms: number;
}

export interface AccessReport {
  ok: boolean;
  problem: string | null;
  message: string;
  checks: { key: string; label: string; ok: boolean | null; detail: string }[];
  content_unchanged: boolean | null;
  checked_at: string;
  /** When the insertion point doesn't match: the end TypeWit expected and the end the document has. */
  location?: { expected_end: string; document_end: string };
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
  source_unit_count?: number;
  source_unit_lengths?: number[];
  source_unit_ends?: number[];
  unit_lengths: number[];
  schedule: number[];
  breaks: PlannedBreak[];
  warnings: PlanProblem[];
  pacing: PacingSettings | null;
  active_seconds: number;
  break_seconds: number;
  stats: { first_offset_ms: number; last_offset_ms: number; min_gap_ms: number; median_gap_ms: number; max_gap_ms: number } | null;
  seed: number;
  duration_seconds: number;
  minimum_duration_seconds: number;
  min_gap_seconds: number;
  options: { unit: InsertionUnit; units: number; minimum_duration_seconds: number; fits: boolean }[];
}

export const STATE_LABEL: Record<SessionState, string> = {
  preparing: "Preparing",
  running: "Running",
  paused: "Paused",
  recovering: "Recovering",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

export const ACTIVITY_LABEL: Record<Activity, string> = {
  entering: "Entering text",
  waiting: "Waiting for the next insertion",
  on_break: "On a planned break",
  paused: "Paused",
  recovering: "Recovering: checking the document before continuing",
  done: "Nothing more will be entered",
};

/** The state for drips from before explicit states existed. */
export function stateOf(drip: Pick<Drip, "status" | "progress">): SessionState {
  if (drip.progress.state) return drip.progress.state;
  return ({
    scheduled: "preparing",
    running: "running",
    paused: "paused",
    completed: "completed",
    canceled: "cancelled",
    failed: "failed",
  } as const)[drip.status];
}

export const STATUS_LABEL: Record<DripStatus, string> = {
  scheduled: "Preparing",
  running: "Running",
  paused: "Paused",
  completed: "Finished",
  failed: "Stopped by an error",
  canceled: "Cancelled",
};

export const UNIT_LABEL: Record<InsertionUnit, { one: string; many: string; title: string }> = {
  sentence: { one: "sentence", many: "sentences", title: "Sentences" },
  paragraph: { one: "paragraph", many: "paragraphs", title: "Paragraphs" },
  word: { one: "word group", many: "word groups", title: "Word groups" },
  character: { one: "character", many: "characters", title: "Characters" },
  chunk: { one: "part", many: "parts", title: "Even parts" },
};

export const ATTENTION_TITLE: Record<Attention, string> = {
  document_changed: "The end of the document changed",
  confirm_last_part: "Check the last part",
  reconnect: "Reconnect Google",
  document_unavailable: "The document can't be opened",
  unreachable: "The document couldn't be reached",
  insert_rejected: "The document refused an insertion",
  not_editable: "The document isn't editable",
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
  connection_checked: "Connection checked before the first insertion",
  insertion_uncertain: "Insertion uncertain: the answer from Google Docs was lost",
};

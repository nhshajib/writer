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
  chunks_written: number;
  chunks_total: number;
  next_chunk_at: string | null;
  seconds_until_next_chunk: number | null;
  finish_at: string | null;
  written_text?: string;
}

export type DripStatus = "scheduled" | "running" | "paused" | "completed" | "failed" | "canceled";

export interface Drip {
  id: string;
  provider: Connection["provider"];
  connection_id: string;
  document_id: string;
  document_title: string | null;
  document_url: string | null;
  word_count: number;
  status: DripStatus;
  insertion_unit: "chunk" | "sentence" | "paragraph";
  mode: "scheduled" | "as_soon_as_possible";
  last_error: string | null;
  created_at: string;
  approved_at: string | null;
  progress: Progress;
}

export interface DripEvent {
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export const STATUS_LABEL: Record<DripStatus, string> = {
  scheduled: "Starting",
  running: "Writing",
  paused: "Paused",
  completed: "Finished",
  failed: "Stopped by an error",
  canceled: "Stopped",
};

export const EVENT_LABEL: Record<string, string> = {
  approved: "You approved the text",
  created: "Session created",
  chunk_written: "Part entered into the document",
  paused: "Paused",
  resumed: "Resumed",
  canceled: "Stopped",
  completed: "All text entered",
  retry_scheduled: "Temporary problem, retrying",
  failed: "Stopped by an error",
};

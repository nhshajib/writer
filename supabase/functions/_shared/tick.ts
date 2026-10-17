import { addSeconds, backoffSeconds } from "./schedule.ts";
import { type DocProvider, ProviderError } from "./providers/types.ts";

export const MAX_ATTEMPTS = 5;

/** The subset of a `drips` row the worker needs. */
export interface DripRow {
  id: string;
  user_id: string;
  document_id: string;
  chunks: string[];
  total_chunks: number;
  chunks_written: number;
  interval_seconds: number;
  attempts: number;
}

export interface DripUpdate {
  chunks_written: number;
  status: "running" | "completed" | "failed";
  next_run_at: string | null;
  attempts: number;
  last_error: string | null;
  completed_at: string | null;
}

export interface DripEvent {
  kind: "chunk_written" | "completed" | "retry_scheduled" | "failed";
  detail: Record<string, unknown>;
}

export interface StepResult {
  update: DripUpdate;
  events: DripEvent[];
}

/**
 * Writes the next chunk of one drip and returns the row update to persist.
 * Pure apart from the provider call, so it can be tested with a fake provider.
 */
export async function runDripStep(drip: DripRow, provider: DocProvider, now: Date): Promise<StepResult> {
  const index = drip.chunks_written;

  if (index >= drip.total_chunks) {
    return {
      update: {
        chunks_written: drip.total_chunks,
        status: "completed",
        next_run_at: null,
        attempts: 0,
        last_error: null,
        completed_at: now.toISOString(),
      },
      events: [{ kind: "completed", detail: {} }],
    };
  }

  const chunk = drip.chunks[index];
  try {
    await provider.appendText(drip.document_id, chunk);
  } catch (error) {
    return failureResult(drip, error, now);
  }

  const written = index + 1;
  const done = written >= drip.total_chunks;
  const events: DripEvent[] = [{ kind: "chunk_written", detail: { index, chars: chunk.length } }];
  if (done) events.push({ kind: "completed", detail: {} });

  return {
    update: {
      chunks_written: written,
      status: done ? "completed" : "running",
      next_run_at: done ? null : addSeconds(now, drip.interval_seconds).toISOString(),
      attempts: 0,
      last_error: null,
      completed_at: done ? now.toISOString() : null,
    },
    events,
  };
}

function failureResult(drip: DripRow, error: unknown, now: Date): StepResult {
  const kind = error instanceof ProviderError ? error.kind : "transient";
  const message = error instanceof Error ? error.message : String(error);
  const attempts = drip.attempts + 1;

  if (kind === "transient" && attempts < MAX_ATTEMPTS) {
    const delay = backoffSeconds(attempts);
    return {
      update: {
        chunks_written: drip.chunks_written,
        status: "running",
        next_run_at: addSeconds(now, delay).toISOString(),
        attempts,
        last_error: message,
        completed_at: null,
      },
      events: [{ kind: "retry_scheduled", detail: { attempts, delay_seconds: delay, error: message } }],
    };
  }

  const reason = kind === "auth" ? `The document account needs to be reconnected: ${message}` : message;
  return {
    update: {
      chunks_written: drip.chunks_written,
      status: "failed",
      next_run_at: null,
      attempts,
      last_error: reason,
      completed_at: null,
    },
    events: [{ kind: "failed", detail: { attempts, kind, error: message } }],
  };
}

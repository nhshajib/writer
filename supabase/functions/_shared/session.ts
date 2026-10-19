/**
 * The insertion engine: runs one session for one worker window.
 *
 * Each insertion is a real document edit made at its scheduled time:
 *
 *   1. wait until the unit is due (never sooner than MIN_GAP after the last one)
 *   2. check the session is still running and this worker still holds it
 *   3. check the document still ends with the text TypeWit put there; if not,
 *      the insertion position is uncertain, so pause and ask the user
 *   4. record "about to write unit i at revision R" (write-ahead)
 *   5. insert at the end, refused by Google if the document changed after R
 *   6. record the unit as confirmed
 *
 * If the worker dies between 5 and 6, the write-ahead record lets the next run
 * work out from the document whether the unit landed, so nothing is written
 * twice or skipped. When the session falls behind (outage, retries), the rest
 * of the schedule moves later instead of catching up in a burst.
 *
 * Pure apart from the provider and store, so it is tested with fakes.
 */

import { type AccessProblem, checkAccess } from "./access.ts";
import { bodyContent, endsWithTail } from "./doctext.ts";
import { type DocProvider, type DocState, ProviderError } from "./providers/types.ts";
import { backoffSeconds, MIN_GAP_SECONDS, plannedAt } from "./schedule.ts";

export { bodyContent, endsWithTail };

export const MAX_ATTEMPTS = 6;
/** Running this much later than planned shifts the rest of the schedule. */
export const LATE_TOLERANCE_MS = 15_000;
/** Quick re-checks when the user is typing at the same moment as an insertion. */
export const CONFLICT_RETRIES = 3;
export const CONFLICT_RETRY_MS = 1_500;
/** Characters of the document kept as the anchor when the user continues after their own edits. */
export const RESYNC_TAIL_CHARS = 1_000;

/**
 * Worker timing. pg_cron ticks at the start of every minute; each tick claims
 * sessions due within the next minute, and the worker waits for each
 * insertion's exact time. Before leaving a unit to a later tick, the worker
 * checks that a tick will come before the unit is due (allowing for cron
 * jitter); if not, it waits and enters the unit itself. So no unit is late
 * because of tick boundaries. A run never goes past MAX_RUN_MS (the platform
 * stops workers at 150 s), and the lease outlasts it so no other tick claims
 * a session a live worker is still running.
 */
export const TICK_MS = 60_000;
export const TICK_JITTER_MS = 3_000;
export const CLAIM_LOOKAHEAD_SECONDS = 60;
export const MAX_RUN_MS = 135_000;
export const LEASE_SECONDS = 240;

/** The first tick that will certainly claim after `now`. */
export function nextTickAfter(now: number): number {
  return (Math.floor((now + TICK_JITTER_MS) / TICK_MS) + 1) * TICK_MS;
}

export type Attention =
  | "document_changed"
  | "confirm_last_part"
  | "reconnect"
  | "document_unavailable"
  | "unreachable"
  | "insert_rejected"
  | "not_editable";

export const ATTENTION_MESSAGE: Record<Attention, string> = {
  document_changed: "The end of the document no longer matches what TypeWit entered, so it can't tell where the " +
    "next part belongs. Undo or move the text that was added or changed after TypeWit's text, or choose to " +
    "continue after the document's current end.",
  confirm_last_part: "TypeWit was interrupted while entering a part and can't tell from the document whether it " +
    "landed. Check the end of the document and tell TypeWit whether the part is there.",
  reconnect: "Google access stopped working. Reconnect your Google account, then resume.",
  document_unavailable: "TypeWit can no longer open the document. It may have been deleted, or access was removed.",
  unreachable:
    "Google Docs couldn't be reached for a while. Nothing was entered while it was down. Resume to try again.",
  insert_rejected: "Google Docs refused the insertion.",
  not_editable: "The document isn't editable with this Google account (it may be view or comment only). " +
    "Ask for edit access, then resume.",
};

/** How a failed Test connection before the first insertion pauses the session. */
const PREFLIGHT_ATTENTION: Partial<Record<AccessProblem, Attention>> = {
  permission_missing: "reconnect",
  not_found: "document_unavailable",
  not_editable: "not_editable",
  location_uncertain: "document_changed",
};

/** The `drips` columns the engine reads. */
export interface SessionRow {
  id: string;
  user_id: string;
  document_id: string;
  chunks: string[];
  total_chunks: number;
  chunks_written: number;
  schedule: number[];
  session_started_at: string;
  schedule_shift_seconds: number;
  attempts: number;
  pending_index: number | null;
  pending_revision: string | null;
  pending_doc_length: number | null;
  retry_at: string | null;
  last_revision_id: string | null;
  last_written_at: string | null;
  resync_index: number;
  resync_tail: string;
  document_baseline_length: number | null;
  /** When the Test connection before the first insertion passed. */
  preflight_at: string | null;
}

export type SessionPatch = Partial<
  Omit<SessionRow, "id" | "user_id" | "document_id" | "chunks" | "total_chunks" | "schedule"> & {
    status: "running" | "paused" | "completed";
    next_run_at: string | null;
    lease_id: string | null;
    paused_at: string | null;
    completed_at: string | null;
    attention: Attention | null;
    last_error: string | null;
    deadline_at: string | null;
  }
>;

export interface SessionEvent {
  kind:
    | "chunk_written"
    | "schedule_shifted"
    | "retry_scheduled"
    | "attention"
    | "paused"
    | "completed"
    | "connection_checked"
    | "insertion_uncertain";
  detail: Record<string, unknown>;
}

export interface SessionStore {
  /** Fresh status and lease, read right before each write. */
  control(id: string): Promise<{ status: string; lease_id: string | null } | null>;
  /** Applies the patch only while `lease` is held and the session is running. */
  update(id: string, lease: string, patch: SessionPatch): Promise<boolean>;
  /**
   * Records a confirmed insertion. Guarded by chunks_written rather than the
   * lease: a unit that landed is recorded even if the user paused meanwhile.
   */
  confirm(id: string, expectedWritten: number, patch: SessionPatch): Promise<boolean>;
  log(row: SessionRow, events: SessionEvent[]): Promise<void>;
}

export interface EngineDeps {
  provider: DocProvider;
  store: SessionStore;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Epoch ms after which this run must not start waiting for another insertion. */
  deadline: number;
}

export type Outcome = "waiting" | "retrying" | "paused" | "completed" | "lost";

/** The text the document must end with before unit `upTo` is inserted. */
export function expectedTail(row: Pick<SessionRow, "chunks" | "resync_index" | "resync_tail">, upTo: number): string {
  return row.resync_tail + row.chunks.slice(row.resync_index, upTo).join("");
}

export type PendingVerdict = "written" | "not_written" | "ambiguous" | "changed";

/** Works out from the document whether an interrupted insertion landed. */
export function judgePending(
  row: Pick<SessionRow, "chunks" | "resync_index" | "resync_tail" | "pending_revision" | "pending_doc_length">,
  index: number,
  doc: { revisionId: string; text: string },
): PendingVerdict {
  // Nothing changed since we checked it: the write never happened.
  if (row.pending_revision !== null && doc.revisionId === row.pending_revision) return "not_written";
  const withUnit = endsWithTail(doc.text, expectedTail(row, index + 1));
  const withoutUnit = endsWithTail(doc.text, expectedTail(row, index));
  if (withUnit && !withoutUnit) return "written";
  if (withoutUnit && !withUnit) return "not_written";
  if (withUnit && withoutUnit) {
    // Both fit (always true before the first unit, or when a unit repeats
    // the text before it). The length decides unless something else changed too.
    const length = bodyContent(doc.text).length;
    if (row.pending_doc_length !== null) {
      if (length === row.pending_doc_length + row.chunks[index].length) return "written";
      if (length === row.pending_doc_length) return "not_written";
    }
    return "ambiguous";
  }
  return "changed";
}

const iso = (ms: number) => new Date(ms).toISOString();

export async function runSession(initial: SessionRow, lease: string, deps: EngineDeps): Promise<Outcome> {
  const { provider, store } = deps;
  const row: SessionRow = { ...initial, chunks: initial.chunks, schedule: initial.schedule };
  const total = row.total_chunks;
  let conflicts = 0;

  const log = (...events: SessionEvent[]) => store.log(row, events);

  const pause = async (attention: Attention, detail = ""): Promise<Outcome> => {
    const message = detail ? `${ATTENTION_MESSAGE[attention]} ${detail}` : ATTENTION_MESSAGE[attention];
    const ok = await store.update(row.id, lease, {
      status: "paused",
      paused_at: iso(deps.now()),
      next_run_at: null,
      lease_id: null,
      attention,
      last_error: message,
      pending_index: row.pending_index,
      pending_revision: row.pending_revision,
      pending_doc_length: row.pending_doc_length,
    });
    if (!ok) return "lost";
    await log(
      { kind: "attention", detail: { reason: attention, message, at_part: row.chunks_written + 1 } },
      { kind: "paused", detail: { by: "system", reason: attention } },
    );
    return "paused";
  };

  const fail = async (error: unknown): Promise<Outcome> => {
    const kind = error instanceof ProviderError ? error.kind : "transient";
    const message = error instanceof Error ? error.message : String(error);
    if (kind === "auth") return await pause("reconnect", message);
    if (kind === "permanent") {
      const status = error instanceof ProviderError ? error.status : undefined;
      return await pause(status === 404 || status === 403 ? "document_unavailable" : "insert_rejected", message);
    }
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      row.attempts = attempts;
      return await pause("unreachable", message);
    }
    const delay = backoffSeconds(attempts);
    const retryAt = iso(deps.now() + delay * 1000);
    const ok = await store.update(row.id, lease, {
      attempts,
      last_error: message,
      next_run_at: retryAt,
      retry_at: retryAt,
      lease_id: null,
      pending_index: row.pending_index,
      pending_revision: row.pending_revision,
    });
    if (!ok) return "lost";
    await log({ kind: "retry_scheduled", detail: { attempts, delay_seconds: delay, error: message } });
    return "retrying";
  };

  // Test connection before the first insertion: can the document be opened and
  // edited, without changing it?
  if (row.chunks_written === 0 && row.pending_index === null && row.preflight_at === null) {
    const report = await checkAccess(provider, row.document_id, expectedTail(row, 0));
    await log({
      kind: "connection_checked",
      detail: {
        ok: report.ok,
        problem: report.problem,
        revision_unchanged: report.revision_unchanged,
        checks: report.checks.map((c) => ({ key: c.key, ok: c.ok })),
      },
    });
    if (!report.ok) {
      const attention = PREFLIGHT_ATTENTION[report.problem!];
      if (attention) return await pause(attention, report.message);
      return await fail(new ProviderError("transient", report.message));
    }
    row.preflight_at = iso(deps.now());
    if (!(await store.update(row.id, lease, { preflight_at: row.preflight_at }))) return "lost";
  }

  while (true) {
    // An earlier run may have stopped between writing and recording a unit.
    if (row.pending_index !== null) {
      const index = row.pending_index;
      if (index !== row.chunks_written) {
        row.pending_index = null;
        row.pending_revision = null;
        row.pending_doc_length = null;
      } else {
        let doc;
        try {
          doc = await provider.readDocument(row.document_id);
        } catch (error) {
          return await fail(error);
        }
        const verdict = judgePending(row, index, doc);
        if (verdict === "ambiguous") return await pause("confirm_last_part");
        if (verdict === "changed") return await pause("document_changed");
        const now = deps.now();
        if (verdict === "written") {
          const patch: SessionPatch = {
            chunks_written: index + 1,
            pending_index: null,
            pending_revision: null,
            pending_doc_length: null,
            last_revision_id: doc.revisionId,
            last_written_at: iso(now),
            attempts: 0,
            last_error: null,
          };
          if (!(await store.confirm(row.id, index, patch))) return "lost";
          Object.assign(row, patch);
          await log({
            kind: "chunk_written",
            detail: {
              index,
              written: index + 1,
              total,
              chars: row.chunks[index].length,
              planned_at: iso(plannedAt(row, index)),
              actual_at: null,
              confirmed_at: iso(now),
              recovered: true,
              revision_id: doc.revisionId,
            },
          });
        } else {
          const clear = { pending_index: null, pending_revision: null, pending_doc_length: null };
          if (!(await store.update(row.id, lease, clear))) return "lost";
          Object.assign(row, clear);
        }
      }
    }

    const index = row.chunks_written;
    if (index >= total) return await complete(row, lease, deps);

    const due = plannedAt(row, index);
    const earliest = row.last_written_at ? Date.parse(row.last_written_at) + MIN_GAP_SECONDS * 1000 : 0;
    const target = Math.max(due, earliest, row.retry_at ? Date.parse(row.retry_at) : 0);
    // Leave it to a later tick only if one comes before it is due.
    if (target >= nextTickAfter(deps.now()) || target > deps.deadline) {
      const ok = await store.update(row.id, lease, {
        next_run_at: iso(target),
        lease_id: null,
        schedule_shift_seconds: row.schedule_shift_seconds,
      });
      return ok ? "waiting" : "lost";
    }
    const wait = target - deps.now();
    if (wait > 0) await deps.sleep(wait);

    const control = await store.control(row.id);
    if (!control || control.status !== "running" || control.lease_id !== lease) return "lost";

    // Where is the insertion point? The document must still end with exactly
    // the text TypeWit entered.
    let revisionId: string;
    let docLength: number;
    let baseline: number | null = row.document_baseline_length;
    try {
      const doc = await provider.readDocument(row.document_id);
      revisionId = doc.revisionId;
      docLength = bodyContent(doc.text).length;
      if (!endsWithTail(doc.text, expectedTail(row, index))) return await pause("document_changed");
      if (index === 0 && row.resync_index === 0 && baseline === null) baseline = docLength;
    } catch (error) {
      return await fail(error);
    }

    // Behind schedule: move the rest later rather than catching up in a burst.
    const now = deps.now();
    const late = now - due;
    if (late > LATE_TOLERANCE_MS) {
      const by = Math.ceil(late / 1000);
      row.schedule_shift_seconds += by;
      await log({
        kind: "schedule_shifted",
        detail: { by_seconds: by, reason: "behind_schedule", finish_at: iso(plannedAt(row, total - 1)) },
      });
    }

    row.pending_index = index;
    row.pending_revision = revisionId;
    row.pending_doc_length = docLength;
    row.document_baseline_length = baseline;
    const marked = await store.update(row.id, lease, {
      pending_index: index,
      pending_revision: revisionId,
      pending_doc_length: docLength,
      document_baseline_length: baseline,
      schedule_shift_seconds: row.schedule_shift_seconds,
      deadline_at: iso(plannedAt(row, total - 1)),
    });
    if (!marked) return "lost";

    let result: { revisionId: string | null };
    try {
      result = await provider.insertAtEnd(row.document_id, row.chunks[index], revisionId);
    } catch (error) {
      if (error instanceof ProviderError && error.kind !== "transient") {
        // Google refused it outright, so the unit is certainly not in the document.
        const clear = { pending_index: null, pending_revision: null, pending_doc_length: null };
        Object.assign(row, clear);
        if (!(await store.update(row.id, lease, clear))) return "lost";
      }
      if (error instanceof ProviderError && error.kind === "conflict") {
        // The user is typing at this moment. Check again shortly.
        if (++conflicts <= CONFLICT_RETRIES) {
          await deps.sleep(CONFLICT_RETRY_MS);
          continue;
        }
        const retryAt = iso(deps.now() + 15_000);
        const ok = await store.update(row.id, lease, { next_run_at: retryAt, retry_at: retryAt, lease_id: null });
        return ok ? "retrying" : "lost";
      }
      // A transient failure leaves the write-ahead record in place: the write
      // may or may not have landed, and the next run checks the document.
      await log({
        kind: "insertion_uncertain",
        detail: { index, written: index, total, error: error instanceof Error ? error.message : String(error) },
      });
      return await fail(error);
    }

    conflicts = 0;
    const actual = deps.now();
    const patch: SessionPatch = {
      chunks_written: index + 1,
      pending_index: null,
      pending_revision: null,
      pending_doc_length: null,
      retry_at: null,
      last_revision_id: result.revisionId,
      last_written_at: iso(actual),
      attempts: 0,
      last_error: null,
    };
    const confirmed = await store.confirm(row.id, index, patch);
    Object.assign(row, patch);
    await log({
      kind: "chunk_written",
      detail: {
        index,
        written: index + 1,
        total,
        chars: row.chunks[index].length,
        planned_at: iso(plannedAt(row, index)),
        actual_at: iso(actual),
        late_seconds: Math.round((actual - due) / 100) / 10,
        revision_id: result.revisionId,
        next_at: index + 1 < total ? iso(plannedAt(row, index + 1)) : null,
      },
    });
    if (!confirmed) return "lost";
  }
}

async function complete(row: SessionRow, lease: string, deps: EngineDeps): Promise<Outcome> {
  const fullTail = expectedTail(row, row.total_chunks);
  const detail: Record<string, unknown> = {};
  try {
    const doc = await deps.provider.readDocument(row.document_id);
    const content = bodyContent(doc.text);
    detail.text_at_end_matches = content.endsWith(fullTail);
    // Exactly what was there before plus exactly the approved text, nothing else.
    if (row.resync_index === 0 && row.document_baseline_length !== null) {
      detail.document_is_baseline_plus_text = content.length === row.document_baseline_length + fullTail.length &&
        detail.text_at_end_matches === true;
    }
  } catch (error) {
    detail.text_at_end_matches = null;
    detail.verify_error = error instanceof Error ? error.message : String(error);
  }

  const finished = deps.now();
  if (deps.provider.summarizeRevisions) {
    try {
      detail.provider_revisions = await deps.provider.summarizeRevisions(
        row.document_id,
        row.session_started_at,
        iso(finished),
      );
    } catch (error) {
      detail.provider_revisions = { unavailable: error instanceof Error ? error.message : String(error) };
    }
  }

  const ok = await deps.store.update(row.id, lease, {
    status: "completed",
    completed_at: iso(finished),
    next_run_at: null,
    lease_id: null,
    last_error: null,
    attention: null,
  });
  if (!ok) return "lost";
  await deps.store.log(row, [{ kind: "completed", detail }]);
  return "completed";
}

// ---------------------------------------------------------------------------
// Resuming
// ---------------------------------------------------------------------------

export interface ResumeOptions {
  /** Answer to "confirm_last_part": is the interrupted part in the document? */
  last_part?: "present" | "absent";
  /** After "document_changed": accept the document's current end as the new insertion point. */
  continue_from_current_end?: boolean;
}

export type ResumableRow =
  & Pick<
    SessionRow,
    | "chunks"
    | "total_chunks"
    | "chunks_written"
    | "schedule"
    | "schedule_shift_seconds"
    | "pending_index"
    | "pending_revision"
    | "pending_doc_length"
    | "resync_index"
    | "resync_tail"
  >
  & { session_started_at: string | null; paused_at: string | null; attention: string | null };

export type ResumeResult =
  | { ok: true; patch: Record<string, unknown>; detail: Record<string, unknown> }
  | { ok: false; attention: Attention; message: string };

/** Whether resuming needs a fresh look at the document first. */
export function resumeNeedsDocument(row: ResumableRow, options: ResumeOptions): boolean {
  return row.attention === "document_changed" || row.attention === "confirm_last_part" ||
    row.pending_index !== null || options.continue_from_current_end === true;
}

/**
 * Works out how to resume a paused session. The rest of the schedule moves
 * later by exactly the time it was paused, so the remaining spacing is kept
 * and nothing is crammed in. A session TypeWit paused itself is checked
 * against the document first (`doc`, required when resumeNeedsDocument).
 */
export function planResume(row: ResumableRow, now: number, doc: DocState | null, options: ResumeOptions): ResumeResult {
  let written = row.chunks_written;
  const patch: Record<string, unknown> = {};
  const detail: Record<string, unknown> = {};

  if (resumeNeedsDocument(row, options)) {
    if (!doc) throw new Error("planResume needs the document");

    // An interrupted insertion: decide from the document, or ask the user when it can't tell.
    if (row.pending_index !== null) {
      const verdict = row.pending_index === written ? judgePending(row, row.pending_index, doc) : "not_written";
      const answer = options.last_part;
      if (answer === "present" || (answer === undefined && verdict === "written")) {
        written = row.pending_index + 1;
      } else if (answer === undefined && verdict !== "not_written") {
        return { ok: false, attention: "confirm_last_part", message: ATTENTION_MESSAGE.confirm_last_part };
      }
      detail.last_part = answer ?? verdict;
      Object.assign(patch, {
        pending_index: null,
        pending_revision: null,
        pending_doc_length: null,
        chunks_written: written,
      });
    }

    if (options.continue_from_current_end) {
      Object.assign(patch, { resync_index: written, resync_tail: bodyContent(doc.text).slice(-RESYNC_TAIL_CHARS) });
      detail.continued_from_current_end = true;
    } else if (!endsWithTail(doc.text, expectedTail(row, written))) {
      return { ok: false, attention: "document_changed", message: ATTENTION_MESSAGE.document_changed };
    }
    patch.last_revision_id = doc.revisionId;
  }

  const pausedSeconds = row.paused_at ? Math.max(0, Math.ceil((now - Date.parse(row.paused_at)) / 1000)) : 0;
  const shift = row.schedule_shift_seconds + pausedSeconds;
  const scheduled = row.session_started_at !== null && row.schedule.length === row.total_chunks;
  const session = {
    session_started_at: row.session_started_at ?? "",
    schedule: row.schedule,
    schedule_shift_seconds: shift,
  };
  const nextAt = scheduled && written < row.total_chunks ? Math.max(now, plannedAt(session, written)) : now;
  const finishAt = scheduled ? iso(Math.max(nextAt, plannedAt(session, row.total_chunks - 1))) : null;

  Object.assign(patch, {
    status: "scheduled",
    paused_at: null,
    attention: null,
    last_error: null,
    attempts: 0,
    retry_at: null,
    lease_id: null,
    schedule_shift_seconds: shift,
    next_run_at: iso(nextAt),
    deadline_at: finishAt,
  });
  Object.assign(detail, {
    paused_seconds: pausedSeconds,
    shift_seconds: shift,
    next_at: written < row.total_chunks ? iso(nextAt) : null,
    finish_at: finishAt,
    after_attention: row.attention,
  });
  return { ok: true, patch, detail };
}

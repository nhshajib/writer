// Test doubles for the session engine: a document that behaves like Google
// Docs (revisions, refused conditional writes, a final newline), a store with
// the same lease rules as the drips table, and a simulated clock driven like
// the per-minute cron worker.

import type { DocInfo, DocProvider, DocState } from "../functions/_shared/providers/types.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";
import { planSession } from "../functions/_shared/plan.ts";
import type { InsertionUnit } from "../functions/_shared/chunker.ts";
import {
  CLAIM_LOOKAHEAD_SECONDS,
  LEASE_SECONDS,
  MAX_RUN_MS,
  type Outcome,
  planResume,
  resumeNeedsDocument,
  type ResumeOptions,
  runSession,
  type SessionEvent,
  type SessionPatch,
  type SessionRow,
  type SessionStore,
} from "../functions/_shared/session.ts";

export const T0 = Date.parse("2026-10-19T09:00:00Z");

/** Events scheduled at a point in simulated time (user edits, pauses, outages). */
export class Clock {
  now = T0;
  private actions: { at: number; run: () => void | Promise<void> }[] = [];

  at(time: number, run: () => void | Promise<void>) {
    this.actions.push({ at: time, run });
    this.actions.sort((a, b) => a.at - b.at);
  }

  /** Moves time forward to `target`, running any actions due on the way. */
  async advanceTo(target: number) {
    while (this.actions.length && this.actions[0].at <= target) {
      const action = this.actions.shift()!;
      this.now = Math.max(this.now, action.at);
      await action.run();
    }
    this.now = Math.max(this.now, target);
  }

  sleep = (ms: number) => this.advanceTo(this.now + ms);
}

type Failure = { error: ProviderError; applied?: boolean };

/** A Google Docs body: `content` plus the final paragraph mark. */
export class FakeDoc implements DocProvider {
  readonly name = "test" as const;
  content: string;
  revision = 1;
  writes: { at: number; text: string }[] = [];
  reads = 0;
  failures: Partial<Record<"read" | "write", Failure[]>> = {};
  editable = true;
  /** Simulated time each request takes. */
  latencyMs = 0;

  constructor(private clock: Clock, initial = "") {
    this.content = initial;
  }

  /** Someone else edits the document. */
  edit(next: string) {
    this.content = next;
    this.revision++;
  }

  private failure(op: "read" | "write"): Failure | undefined {
    return this.failures[op]?.shift();
  }

  createDoc(title: string): Promise<DocInfo> {
    return Promise.resolve({ id: "doc", title, url: null });
  }
  getDoc(id: string): Promise<DocInfo> {
    return Promise.resolve({ id, title: "Doc", url: null });
  }
  verifyAccount(): Promise<void> {
    return Promise.resolve();
  }
  /** Like Google's no-op replaceAllText: checks permission and revision, changes nothing. */
  probeEdit(_id: string, revisionId: string): Promise<{ revisionId: string }> {
    if (!this.editable) return Promise.reject(new ProviderError("permanent", "no edit access", 403));
    if (revisionId !== `r${this.revision}`) return Promise.reject(new ProviderError("conflict", "changed", 400));
    return Promise.resolve({ revisionId: `r${this.revision}` });
  }
  async readDocument(): Promise<DocState> {
    if (this.latencyMs) await this.clock.sleep(this.latencyMs);
    return await this.readNow();
  }
  private readNow(): Promise<DocState> {
    this.reads++;
    const f = this.failure("read");
    if (f) return Promise.reject(f.error);
    return Promise.resolve({ revisionId: `r${this.revision}`, text: `${this.content}\n` });
  }
  async insertAtEnd(_id: string, text: string, required?: string) {
    if (this.latencyMs) await this.clock.sleep(this.latencyMs / 2);
    const result = await this.insertNow(text, required);
    if (this.latencyMs) await this.clock.sleep(this.latencyMs / 2);
    return result;
  }
  private insertNow(text: string, required?: string): Promise<{ revisionId: string }> {
    const f = this.failure("write");
    if (f && !f.applied) return Promise.reject(f.error);
    if (required !== undefined && required !== `r${this.revision}`) {
      return Promise.reject(new ProviderError("conflict", "revision mismatch", 400));
    }
    this.content += text;
    this.revision++;
    this.writes.push({ at: this.clock.now, text });
    // Applied, but the answer never arrived (timeout, crash).
    if (f?.applied) return Promise.reject(f.error);
    return Promise.resolve({ revisionId: `r${this.revision}` });
  }
}

/** A drips row with the same lease and guard rules as the real table. */
export type Row = SessionRow & {
  status: string;
  lease_id: string | null;
  next_run_at: string | null;
  paused_at: string | null;
  attention: string | null;
  last_error: string | null;
  completed_at: string | null;
  deadline_at: string | null;
};

export class FakeStore implements SessionStore {
  events: (SessionEvent & { at: number })[] = [];
  /** Throw on the next N confirm calls (the worker dies after a write). */
  failConfirms = 0;

  constructor(public row: Row, private clock: Clock) {}

  control() {
    return Promise.resolve({ status: this.row.status, lease_id: this.row.lease_id });
  }
  update(_id: string, lease: string, patch: SessionPatch) {
    if (this.row.lease_id !== lease || this.row.status !== "running") return Promise.resolve(false);
    Object.assign(this.row, patch);
    return Promise.resolve(true);
  }
  confirm(_id: string, expected: number, patch: SessionPatch) {
    if (this.failConfirms > 0) {
      this.failConfirms--;
      return Promise.reject(new Error("worker crashed"));
    }
    if (this.row.chunks_written !== expected) return Promise.resolve(false);
    Object.assign(this.row, patch);
    return Promise.resolve(true);
  }
  log(_row: SessionRow, events: SessionEvent[]) {
    for (const e of events) this.events.push({ ...e, at: this.clock.now });
    return Promise.resolve();
  }

  kinds() {
    return this.events.map((e) => e.kind);
  }

  // What the drips API does for the user.
  pause() {
    if (!["scheduled", "running"].includes(this.row.status)) return false;
    Object.assign(this.row, {
      status: "paused",
      paused_at: new Date(this.clock.now).toISOString(),
      next_run_at: null,
      lease_id: null,
      attention: null,
    });
    return true;
  }
  cancel() {
    Object.assign(this.row, { status: "canceled", next_run_at: null, lease_id: null });
  }
  /** Like POST /drips/:id/resume: the document is read only when the checks need it. */
  async resume(doc: FakeDoc, options: ResumeOptions = {}) {
    const state = resumeNeedsDocument(this.row, options) ? await doc.readDocument() : null;
    const result = planResume(this.row, this.clock.now, state, options);
    if (result.ok) Object.assign(this.row, result.patch);
    return result;
  }
}

export function makeSession(
  text: string,
  opts: { unit?: InsertionUnit; minutes?: number; seed?: number; clock: Clock } & Partial<Row>,
): Row {
  const plan = planSession({
    text,
    unit: opts.unit ?? "sentence",
    durationSeconds: (opts.minutes ?? 60) * 60,
    seed: opts.seed ?? 7,
    plan: "pro",
  });
  if (!plan.ok) throw new Error(plan.problems.map((p) => p.message).join(" "));
  const started = new Date(opts.clock.now).toISOString();
  return {
    id: "d1",
    user_id: "u1",
    document_id: opts.document_id ?? "doc",
    chunks: plan.units,
    total_chunks: plan.units.length,
    chunks_written: 0,
    schedule: plan.schedule,
    session_started_at: started,
    schedule_shift_seconds: 0,
    attempts: 0,
    pending_index: null,
    pending_revision: null,
    pending_doc_length: null,
    retry_at: null,
    last_revision_id: null,
    last_written_at: null,
    resync_index: 0,
    resync_tail: "",
    document_baseline_length: null,
    preflight_at: null,
    status: "scheduled",
    lease_id: null,
    next_run_at: new Date(opts.clock.now + plan.schedule[0]).toISOString(),
    paused_at: null,
    attention: null,
    last_error: null,
    completed_at: null,
    deadline_at: null,
  };
}

/**
 * Drives the engine like pg_cron + drip-tick: a tick every minute claims the
 * session when it is due within the window and runs it until the window ends.
 * `crashAfterTick` makes a tick's worker die (its work stops, lease stays).
 */
export async function runWorker(
  store: FakeStore,
  doc: DocProvider,
  clock: Clock,
  until: number,
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  let tick = Math.ceil(clock.now / 60_000) * 60_000;
  let lease = 0;
  while (tick <= until) {
    await clock.advanceTo(tick);
    const row = store.row;
    if (
      ["scheduled", "running"].includes(row.status) && row.next_run_at &&
      Date.parse(row.next_run_at) <= tick + CLAIM_LOOKAHEAD_SECONDS * 1000
    ) {
      const id = `lease-${++lease}`;
      Object.assign(row, {
        status: "running",
        lease_id: id,
        next_run_at: new Date(tick + LEASE_SECONDS * 1000).toISOString(),
      });
      try {
        outcomes.push(
          await runSession(structuredClone(row), id, {
            provider: doc,
            store,
            now: () => clock.now,
            sleep: clock.sleep,
            deadline: tick + MAX_RUN_MS,
          }),
        );
      } catch {
        outcomes.push("lost"); // the worker died; its lease runs out
      }
    }
    if (["completed", "canceled"].includes(store.row.status)) break;
    tick = Math.max(tick + 60_000, Math.ceil(clock.now / 60_000) * 60_000);
  }
  return outcomes;
}

import {
  MAX_RUN_MS,
  type Outcome,
  runSession,
  type SessionRow,
  type SessionStore,
} from "../../supabase/functions/_shared/session.ts";
import type { DocProvider } from "../../supabase/functions/_shared/providers/types.ts";
import { api } from "./api";

/*
 * A Word session runs here, in the TypeWit add-in, with the same session
 * engine the server uses for Google Docs: Word is the document and TypeWit's
 * database (through POST /drips/:id/engine) is the store, with the same lease
 * and confirmation rules. Only while the add-in is open does anything run.
 */

function engine<T>(dripId: string, body: Record<string, unknown>): Promise<T> {
  return api<T>(`drips/${dripId}/engine`, { method: "POST", body });
}

export function engineStore(dripId: string): SessionStore {
  return {
    control: () => engine(dripId, { op: "control" }),
    update: async (_id, lease, patch) => (await engine<{ ok: boolean }>(dripId, { op: "update", lease, patch })).ok,
    confirm: async (_id, expected, patch) =>
      (await engine<{ ok: boolean }>(dripId, { op: "confirm", expected, patch })).ok,
    log: async (_row, events) => {
      if (events.length) await engine(dripId, { op: "log", events });
    },
  };
}

interface Claim {
  row: (SessionRow & { lease_id: string }) | null;
  status: string;
  next_run_at: string | null;
}

/** Rows written before the newer fields existed. */
function normalize(row: SessionRow): SessionRow {
  return {
    ...row,
    schedule: (row.schedule ?? []).map(Number),
    schedule_shift_seconds: row.schedule_shift_seconds ?? 0,
    resync_index: row.resync_index ?? 0,
    resync_tail: row.resync_tail ?? "",
    pending_doc_length: row.pending_doc_length ?? null,
    retry_at: row.retry_at ?? null,
    preflight_at: row.preflight_at ?? null,
  };
}

const FINISHED = new Set(["completed", "canceled", "failed"]);
const LOOKAHEAD_MS = 60_000;

/**
 * Keeps one session going while the add-in is open: claims it when an
 * insertion is due, runs the engine, and waits. Paused sessions are checked
 * every few seconds, so a resume from the website is picked up.
 */
export class WordRunner {
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wake: (() => void) | null = null;

  constructor(
    private readonly dripId: string,
    private readonly documentId: string,
    private readonly provider: DocProvider,
    /** Called after every claim attempt or run, so the pane can refresh. */
    private readonly onTick: (outcome: Outcome | null, error?: string) => void,
  ) {}

  start() {
    void this.loop();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.wake?.();
  }

  /** Check again now, e.g. right after Resume. */
  poke() {
    if (this.timer) clearTimeout(this.timer);
    this.wake?.();
  }

  private pause(ms: number) {
    return new Promise<void>((resolve) => {
      this.wake = resolve;
      this.timer = setTimeout(resolve, ms);
    });
  }

  private async loop() {
    const store = engineStore(this.dripId);
    while (!this.stopped) {
      let wait = 5_000;
      try {
        const claim = await engine<Claim>(this.dripId, { op: "claim", document_id: this.documentId });
        if (claim.row) {
          const outcome = await runSession(normalize(claim.row), claim.row.lease_id, {
            provider: this.provider,
            store,
            now: () => Date.now(),
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
            deadline: Date.now() + MAX_RUN_MS,
          });
          this.onTick(outcome);
          wait = outcome === "waiting" || outcome === "retrying" ? 0 : 3_000;
        } else {
          this.onTick(null);
          if (FINISHED.has(claim.status)) break;
          const due = claim.next_run_at ? Date.parse(claim.next_run_at) - LOOKAHEAD_MS - Date.now() : 5_000;
          wait = claim.status === "paused" ? 5_000 : Math.min(15_000, Math.max(1_000, due));
        }
      } catch (error) {
        this.onTick(null, error instanceof Error ? error.message : String(error));
        wait = 10_000;
      }
      if (wait > 0 && !this.stopped) await this.pause(wait);
    }
  }
}

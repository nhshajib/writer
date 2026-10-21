// Worker: called every minute by pg_cron. Claims sessions with an insertion due
// within the next minute and runs each one, waiting for every insertion's exact
// planned time (see "Worker timing" in _shared/session.ts). The HTTP call
// returns at once; the work continues as a background task.

import { type ConnectionRow, loadConnectionsByIds, providerFor } from "../_shared/connections.ts";
import type { InsertTarget } from "../_shared/providers/types.ts";
import { safeEqual } from "../_shared/crypto.ts";
import { adminClient, getSecret } from "../_shared/env.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import { housekeeping } from "../_shared/housekeeping.ts";
import { notifyUser } from "../_shared/notifyUser.ts";
import {
  CLAIM_LOOKAHEAD_SECONDS,
  LEASE_SECONDS,
  MAX_RUN_MS,
  type Outcome,
  runSession,
  type SessionEvent,
  type SessionPatch,
  type SessionRow,
  type SessionStore,
} from "../_shared/session.ts";

/** The worker RPC projects only engine state and the metadata needed for notifications. */
type ClaimedDrip = SessionRow & {
  connection_id: string;
  lease_id: string;
  document_title: string | null;
  document_url: string | null;
  word_count: number;
  insert_target: InsertTarget | null;
};

const BATCH_SIZE = 10;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

serve(async (req) => {
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) return await health();
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");

  const expected = await getSecret("TICK_SECRET", "tick_secret");
  if (!safeEqual(req.headers.get("x-tick-secret") ?? "", expected)) {
    throw new HttpError(401, "Unauthorized.");
  }

  const started = Date.now();
  const db = adminClient();
  const { data, error } = await db.rpc("claim_due_worker_drips", {
    max_rows: BATCH_SIZE,
    lease_seconds: LEASE_SECONDS,
    lookahead_seconds: CLAIM_LOOKAHEAD_SECONDS,
  });
  if (error) throw new Error(error.message);

  const drips = (data ?? []) as ClaimedDrip[];
  const connections = await loadConnectionsByIds([...new Set(drips.map((d) => d.connection_id))]);

  // Sessions spend most of a window waiting, so they run side by side.
  const work = Promise.all([
    housekeeping(drips.length, started),
    ...drips.map((drip) => processDrip(drip, connections.get(drip.connection_id), started + MAX_RUN_MS)),
  ]);
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(work);
    return json({ claimed: drips.length });
  }
  return json({ claimed: drips.length, results: (await work).slice(1) });
});

async function processDrip(drip: ClaimedDrip, connection: ConnectionRow | undefined, deadline: number) {
  let outcome: Outcome;
  const store = dbStore(deadline);
  try {
    if (!connection) throw new Error("The document account was disconnected.");
    outcome = await runSession(normalize(drip), drip.lease_id, {
      provider: providerFor(connection, drip.insert_target),
      store,
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      deadline,
    });
  } catch (error) {
    // Missing connections need attention; database/setup outages leave the
    // write-ahead record for lease recovery rather than blaming the document.
    const message = error instanceof Error ? error.message : String(error);
    console.error("Session run failed", drip.id, message);
    // A store outage is not a rejected document insertion. Keep the write-ahead
    // record and let the lease expire; the next tick reconciles it safely.
    if (connection) return { id: drip.id, outcome: "lost" as Outcome };
    const paused = await store.update(drip.id, drip.lease_id, {
      status: "paused",
      paused_at: new Date().toISOString(),
      next_run_at: null,
      lease_id: null,
      attention: connection ? "insert_rejected" : "reconnect",
      last_error: message,
    }).catch(() => false); // If the database is down too, the lease runs out and the next tick retries.
    if (paused) {
      await store.log(drip, [{ kind: "attention", detail: { reason: "worker_error", message } }, {
        kind: "paused",
        detail: { by: "system", reason: "worker_error" },
      }]);
    }
    outcome = paused ? "paused" : "lost";
  }

  if (outcome === "completed" || outcome === "paused") {
    await notifyUser(drip, outcome === "completed" ? "drip_completed" : "drip_attention");
  }
  return { id: drip.id, outcome };
}

/** Rows written before schedules existed may lack the newer fields. */
function normalize(drip: ClaimedDrip): SessionRow {
  return {
    ...drip,
    schedule: (drip.schedule ?? []).map(Number),
    schedule_shift_seconds: drip.schedule_shift_seconds ?? 0,
    session_started_at: drip.session_started_at ?? new Date().toISOString(),
    resync_index: drip.resync_index ?? 0,
    resync_tail: drip.resync_tail ?? "",
    pending_doc_length: drip.pending_doc_length ?? null,
    retry_at: drip.retry_at ?? null,
    preflight_at: drip.preflight_at ?? null,
    chunk_formats: drip.chunk_formats ?? null,
  };
}

function dbStore(deadline: number): SessionStore {
  const signal = () => AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now())));
  const db = adminClient();
  return {
    async control(id) {
      const { data, error } = await db.from("drips").select("status, lease_id, chunks_written, access_expires_at").eq(
        "id",
        id,
      )
        .abortSignal(signal()).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async update(id, lease, patch: SessionPatch) {
      const { data, error } = await db.from("drips").update(patch).eq("id", id).eq("lease_id", lease)
        .eq("status", "running").select("id").abortSignal(signal());
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async confirm(id, expectedWritten, patch: SessionPatch) {
      const { data, error } = await db.from("drips").update(patch).eq("id", id)
        .eq("chunks_written", expectedWritten).in("status", ["running", "paused"]).select("id").abortSignal(signal());
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async log(row, events: SessionEvent[]) {
      if (events.length === 0) return;
      const { error } = await db.from("drip_events").insert(
        events.map((e) => ({ drip_id: row.id, user_id: row.user_id, kind: e.kind, detail: e.detail })),
      ).abortSignal(signal());
      if (error) console.error("Failed to log session events", row.id, error.message);
    },
  };
}

/**
 * GET /drip-tick/health, for an uptime monitor: is the worker still being
 * called every minute? Reports times and yes/no flags only, never user data.
 */
async function health(): Promise<Response> {
  const { data, error } = await adminClient().from("worker_heartbeat").select("last_tick_at, last_cleanup_at")
    .eq("id", 1).maybeSingle();
  const lastTick = data?.last_tick_at ? Date.parse(data.last_tick_at) : null;
  const ageSeconds = lastTick === null ? null : Math.round((Date.now() - lastTick) / 1000);
  // pg_cron calls every 60 s; allow for a slow run before calling it stalled.
  const workerOk = !error && ageSeconds !== null && ageSeconds < 180;
  return json({
    ok: workerOk,
    worker: { last_tick_at: data?.last_tick_at ?? null, seconds_since_tick: ageSeconds },
    last_cleanup_at: data?.last_cleanup_at ?? null,
  }, workerOk ? 200 : 503);
}

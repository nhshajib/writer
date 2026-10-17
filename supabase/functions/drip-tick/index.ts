// Worker: called every minute by pg_cron. Claims due drips and writes the next
// chunk of each into its document.

import { loadConnectionsByIds, providerFor } from "../_shared/connections.ts";
import { safeEqual } from "../_shared/crypto.ts";
import { adminClient, getSecret } from "../_shared/env.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import { ProviderError } from "../_shared/providers/types.ts";
import { type DripRow, runDripStep, type StepResult } from "../_shared/tick.ts";

const BATCH_SIZE = 25;
const CONCURRENCY = 5;

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");

  const expected = await getSecret("TICK_SECRET", "tick_secret");
  if (!safeEqual(req.headers.get("x-tick-secret") ?? "", expected)) {
    throw new HttpError(401, "Unauthorized.");
  }

  const db = adminClient();
  const { data, error } = await db.rpc("claim_due_drips", { max_rows: BATCH_SIZE });
  if (error) throw new Error(error.message);

  const drips = (data ?? []) as (DripRow & { connection_id: string })[];
  const connections = await loadConnectionsByIds([...new Set(drips.map((d) => d.connection_id))]);

  const results: { id: string; status: string }[] = [];
  const queue = [...drips];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let drip = queue.shift(); drip; drip = queue.shift()) {
      results.push({ id: drip.id, status: await processDrip(drip, connections.get(drip.connection_id)) });
    }
  });
  await Promise.all(workers);

  return json({ processed: results.length, results });
});

async function processDrip(
  drip: DripRow & { connection_id: string },
  connection: Parameters<typeof providerFor>[0] | undefined,
): Promise<string> {
  const now = new Date();
  let result: StepResult;
  try {
    if (!connection) throw new ProviderError("auth", "The document account was disconnected.");
    result = await runDripStep(drip, providerFor(connection), now);
  } catch (error) {
    // providerFor itself failed (e.g. unsupported provider).
    const kind = error instanceof ProviderError ? error.kind : "permanent";
    const message = error instanceof Error ? error.message : String(error);
    result = {
      update: {
        chunks_written: drip.chunks_written,
        status: "failed",
        next_run_at: null,
        attempts: drip.attempts + 1,
        last_error: message,
        completed_at: null,
      },
      events: [{ kind: "failed", detail: { kind, error: message } }],
    };
  }

  await saveResult(drip, result);
  return result.update.status;
}

async function saveResult(drip: DripRow, result: StepResult): Promise<void> {
  const db = adminClient();

  // Only apply the new status if nobody paused or canceled the drip while the
  // chunk was being written.
  const { data, error } = await db
    .from("drips")
    .update(result.update)
    .eq("id", drip.id)
    .eq("status", "running")
    .select("id");
  if (error) console.error("Failed to save drip", drip.id, error.message);

  if (!error && (data ?? []).length === 0) {
    // Paused/canceled mid-step: keep that status but record the progress made.
    const { error: progressError } = await db
      .from("drips")
      .update({ chunks_written: result.update.chunks_written })
      .eq("id", drip.id);
    if (progressError) console.error("Failed to save drip progress", drip.id, progressError.message);
  }

  if (result.events.length > 0) {
    const { error: eventError } = await db.from("drip_events").insert(
      result.events.map((e) => ({ drip_id: drip.id, user_id: drip.user_id, kind: e.kind, detail: e.detail })),
    );
    if (eventError) console.error("Failed to log drip events", drip.id, eventError.message);
  }
}

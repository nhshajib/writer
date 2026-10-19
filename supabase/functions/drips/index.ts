// User-facing API for drips, document connections and documents.
//
//   GET  /drips                     list my drips (with progress)
//   POST /drips/plan                check text, step size and duration; preview the schedule
//   POST /drips                     create and start a drip with its full schedule
//   GET  /drips/:id                 one drip with progress, the text written so far, and recent events
//   POST /drips/:id/pause           pause
//   POST /drips/:id/resume          resume (shifts the rest of the schedule by the pause)
//   POST /drips/:id/cancel          cancel
//   GET  /drips/connections         my connected accounts
//   POST /drips/connections/test    create a test connection (dev only)
//   POST /drips/connections/:id/disconnect  revoke Google access, stop that account's active drips
//   POST /drips/documents           create a new document in a connected account

import { requireUser } from "../_shared/auth.ts";
import { INSERTION_UNITS, type InsertionUnit } from "../_shared/chunker.ts";
import { decrypt, sha256Hex } from "../_shared/crypto.ts";
import { loadConnection, providerFor } from "../_shared/connections.ts";
import { adminClient, encryptionKey, getSecret, requireEnv, testProviderEnabled } from "../_shared/env.ts";
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { checkCreateLimits, PLAN_LIMITS, type PlanTier } from "../_shared/limits.ts";
import { planSession, type SessionPlan } from "../_shared/plan.ts";
import { revokeGoogleToken } from "../_shared/providers/google.ts";
import { ProviderError } from "../_shared/providers/types.ts";
import { computeProgress, type ProgressInput } from "../_shared/progress.ts";
import { randomSeed } from "../_shared/schedule.ts";
import {
  nextTickAfter,
  planResume,
  type ResumableRow,
  resumeNeedsDocument,
  type ResumeOptions,
} from "../_shared/session.ts";
import { CURRENT_TERMS_VERSION } from "../_shared/terms.ts";

const ACTIVE_STATUSES = ["scheduled", "running", "paused"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Columns returned to clients (everything except the text and chunk array). */
const DRIP_COLUMNS =
  "id, connection_id, provider, document_id, document_title, document_url, word_count, total_chunks, " +
  "chunks_written, interval_seconds, duration_seconds, status, next_run_at, attempts, last_error, " +
  "created_at, updated_at, completed_at, insertion_unit, mode, text_sha256, approved_at, schedule, " +
  "schedule_shift_seconds, session_started_at, paused_at, deadline_at, last_written_at, attention, pending_index";

/** Everything the resume checks need on top of DRIP_COLUMNS. */
const RESUME_COLUMNS =
  `${DRIP_COLUMNS}, chunks, pending_revision, pending_doc_length, resync_index, resync_tail, last_revision_id`;

serve(async (req) => {
  const user = await requireUser(req);
  const parts = routeParts(req);
  const method = req.method;

  if (parts.length === 0) {
    if (method === "GET") return await listDrips(user.id);
    if (method === "POST") return await createDrip(user.id, req);
  }
  if (parts[0] === "plan" && parts.length === 1 && method === "POST") return await previewPlan(user.id, req);
  if (parts[0] === "connections") {
    if (parts.length === 1 && method === "GET") return await listConnections(user.id);
    if (parts[1] === "test" && method === "POST") return await createTestConnection(user.id, user.email);
    if (parts.length === 3 && UUID_RE.test(parts[1]) && parts[2] === "disconnect" && method === "POST") {
      return await disconnectConnection(user.id, parts[1]);
    }
  }
  if (parts[0] === "documents" && parts.length === 1 && method === "POST") {
    return await createDocument(user.id, req);
  }
  if (parts.length >= 1 && UUID_RE.test(parts[0])) {
    const id = parts[0];
    if (parts.length === 1 && method === "GET") return await getDrip(user.id, id);
    if (parts.length === 2 && method === "POST") {
      if (parts[1] === "pause") return await pauseDrip(user.id, id);
      if (parts[1] === "resume") return await resumeDrip(user.id, id, req);
      if (parts[1] === "cancel") return await cancelDrip(user.id, id);
    }
  }
  throw new HttpError(404, "Not found.");
});

/** Path segments after the function name, e.g. /functions/v1/drips/abc/pause → ["abc", "pause"]. */
function routeParts(req: Request): string[] {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const index = segments.indexOf("drips");
  return index === -1 ? [] : segments.slice(index + 1);
}

// ---------------------------------------------------------------------------
// Drips
// ---------------------------------------------------------------------------

interface CreateDripBody {
  connection_id?: string;
  document_id?: string;
  new_document_title?: string;
  text?: string;
  duration_minutes?: number;
  insertion_unit?: InsertionUnit;
  mode?: "scheduled" | "as_soon_as_possible";
  /** The seed of the schedule the user previewed, so the session follows that exact plan. */
  schedule_seed?: number;
  approval?: { confirmed?: boolean; text_sha256?: string };
}

interface PlanBody {
  text?: string;
  duration_minutes?: number;
  insertion_unit?: InsertionUnit;
  mode?: "scheduled" | "as_soon_as_possible";
  schedule_seed?: number;
}

function readPlanInput(body: PlanBody) {
  const text = typeof body.text === "string" ? body.text : "";
  const unit = body.insertion_unit ?? "sentence";
  const mode = body.mode ?? "scheduled";
  const durationMinutes = Number(body.duration_minutes);
  if (!INSERTION_UNITS.includes(unit)) {
    throw new HttpError(400, "insertion_unit must be sentence, paragraph, word, character or chunk.");
  }
  if (mode !== "scheduled" && mode !== "as_soon_as_possible") {
    throw new HttpError(400, "mode must be scheduled or as_soon_as_possible.");
  }
  if (mode === "scheduled" && (!Number.isFinite(durationMinutes) || durationMinutes < 1)) {
    throw new HttpError(400, "duration_minutes must be a number of at least 1.");
  }
  const seed = body.schedule_seed;
  if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff)) {
    throw new HttpError(400, "schedule_seed must be a 32-bit unsigned integer.");
  }
  return { text, unit, mode, durationSeconds: Math.round(durationMinutes * 60), seed: seed ?? randomSeed() };
}

async function userPlan(userId: string): Promise<{ plan: PlanTier; agreed: boolean }> {
  const { data, error } = await adminClient().from("profiles").select("plan, agreed_terms_version").eq(
    "user_id",
    userId,
  ).maybeSingle();
  if (error) throw new Error(error.message);
  return { plan: (data?.plan ?? "free") as PlanTier, agreed: data?.agreed_terms_version === CURRENT_TERMS_VERSION };
}

/** The plan as the client sees it: unit lengths instead of the units, so the response stays small. */
function planResponse(plan: SessionPlan) {
  const { units, ...rest } = plan;
  return { ...rest, unit_count: units.length, unit_lengths: units.map((u) => u.length) };
}

async function previewPlan(userId: string, req: Request): Promise<Response> {
  const input = readPlanInput(await readJson<PlanBody>(req));
  const { plan } = await userPlan(userId);
  return json({ plan: planResponse(planSession({ ...input, plan })) });
}

async function createDrip(userId: string, req: Request): Promise<Response> {
  const body = await readJson<CreateDripBody>(req);
  const input = readPlanInput(body);
  const { text } = input;

  if (!body.connection_id || !UUID_RE.test(body.connection_id)) {
    throw new HttpError(400, "connection_id is required.");
  }

  // The user has to approve this exact text. The hash ties the approval to it,
  // so editing the text after approval forces a new approval.
  if (body.approval?.confirmed !== true) {
    throw new HttpError(400, "Confirm that you have read and approve this exact text before TypeWit writes it.");
  }
  const textHash = await sha256Hex(text);
  if (body.approval.text_sha256 !== textHash) {
    throw new HttpError(409, "The text changed after you approved it. Review it again and confirm.");
  }
  if (!body.document_id && !body.new_document_title) {
    throw new HttpError(400, "Provide document_id or new_document_title.");
  }

  const db = adminClient();
  const connection = await loadConnection(body.connection_id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");

  const [{ plan: tier, agreed }, { count: activeDrips, error: countError }] = await Promise.all([
    userPlan(userId),
    db.from("drips").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ACTIVE_STATUSES),
  ]);
  if (countError) throw new Error(countError.message);
  if (!agreed) throw new HttpError(403, "Please read and agree to the Responsible Use Agreement before writing.");

  // Splits the text and builds the complete schedule before anything starts.
  const plan = planSession({ ...input, plan: tier });
  if (!plan.ok) return json({ error: plan.problems[0].message, problems: plan.problems }, 422);

  const limitError = checkCreateLimits({
    plan: tier,
    words: plan.words,
    textLength: text.length,
    durationSeconds: plan.duration_seconds,
    activeDrips: activeDrips ?? 0,
  });
  if (limitError) throw new HttpError(422, limitError);

  // Resolve the target document before reserving quota, so a bad document id
  // doesn't use up the day's words.
  const provider = providerFor(connection);
  const doc = await withProviderErrors(() =>
    body.document_id ? provider.getDoc(body.document_id) : provider.createDoc(body.new_document_title!.slice(0, 200))
  );

  const { data: reserved, error: reserveError } = await db.rpc("reserve_words", {
    target_user: userId,
    words: plan.words,
    daily_limit: PLAN_LIMITS[tier].dailyWords,
  });
  if (reserveError) throw new Error(reserveError.message);
  if (!reserved) throw new HttpError(422, `Your plan allows ${PLAN_LIMITS[tier].dailyWords} words per day.`);

  const started = new Date();
  const lastOffset = plan.schedule[plan.schedule.length - 1];
  const { data: drip, error } = await db
    .from("drips")
    .insert({
      user_id: userId,
      connection_id: connection.id,
      provider: connection.provider,
      document_id: doc.id,
      document_title: doc.title,
      document_url: doc.url,
      text,
      chunks: plan.units,
      word_count: plan.words,
      total_chunks: plan.units.length,
      // Kept for older clients: the typical gap between insertions.
      interval_seconds: Math.round((plan.stats?.median_gap_ms ?? 0) / 1000),
      duration_seconds: plan.duration_seconds,
      insertion_unit: input.unit,
      mode: input.mode,
      text_sha256: textHash,
      approved_at: started.toISOString(),
      schedule: plan.schedule,
      schedule_seed: plan.seed,
      session_started_at: started.toISOString(),
      deadline_at: new Date(started.getTime() + lastOffset).toISOString(),
      status: "scheduled",
      next_run_at: new Date(started.getTime() + plan.schedule[0]).toISOString(),
    })
    .select(DRIP_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  // DRIP_COLUMNS is a concatenated string, so supabase-js can't infer the row type.
  const dripId = (drip as unknown as { id: string }).id;
  await logEvent(dripId, userId, "approved", {
    text_sha256: textHash,
    words: plan.words,
    insertion_unit: input.unit,
    mode: input.mode,
  });
  await logEvent(dripId, userId, "created", {
    words: plan.words,
    chunks: plan.units.length,
    insertion_unit: input.unit,
    duration_seconds: plan.duration_seconds,
    schedule_seed: plan.seed,
    first_at: new Date(started.getTime() + plan.schedule[0]).toISOString(),
    finish_at: new Date(started.getTime() + lastOffset).toISOString(),
    min_gap_seconds: (plan.stats?.min_gap_ms ?? 0) / 1000,
    max_gap_seconds: (plan.stats?.max_gap_ms ?? 0) / 1000,
  });
  await kickWorkerIfDue(started.getTime() + plan.schedule[0]);
  return json({ drip }, 201);
}

/** A drip row plus its chunks (needed to derive progress), with `progress` attached. */
type DripWithChunks = ProgressInput & Record<string, unknown>;

function withProgress(row: DripWithChunks, includeText: boolean) {
  const { chunks: _chunks, schedule, ...drip } = row;
  const { written_text, remaining_text, next_part, ...progress } = computeProgress(row, new Date());
  return includeText
    ? { ...drip, schedule, progress: { ...progress, written_text, remaining_text, next_part } }
    : { ...drip, progress };
}

async function listDrips(userId: string): Promise<Response> {
  const { data, error } = await adminClient()
    .from("drips")
    .select(`${DRIP_COLUMNS}, chunks`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return json({ drips: (data as unknown as DripWithChunks[]).map((row) => withProgress(row, false)) });
}

async function getDrip(userId: string, id: string): Promise<Response> {
  const db = adminClient();
  const { data: row, error } = await db
    .from("drips")
    .select(`${DRIP_COLUMNS}, chunks`)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new HttpError(404, "Drip not found.");

  const { data: events } = await db
    .from("drip_events")
    .select("kind, detail, created_at")
    .eq("drip_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1000);
  return json({ drip: withProgress(row as unknown as DripWithChunks, true), events: events ?? [] });
}

async function pauseDrip(userId: string, id: string): Promise<Response> {
  return await transition(
    userId,
    id,
    ["scheduled", "running"],
    {
      status: "paused",
      paused_at: new Date().toISOString(),
      next_run_at: null,
      lease_id: null,
      attention: null,
    },
    "paused",
    { by: "user" },
  );
}

type ResumeRow = ResumableRow & { id: string; status: string; connection_id: string; document_id: string };

/**
 * Resumes a paused session; see planResume. Sessions TypeWit paused itself
 * are checked against the document first.
 */
async function resumeDrip(userId: string, id: string, req: Request): Promise<Response> {
  // The body is optional; a plain resume sends none.
  const options = (await req.json().catch(() => ({}))) as ResumeOptions;
  const db = adminClient();
  const { data, error } = await db.from("drips").select(RESUME_COLUMNS).eq("id", id).eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Drip not found.");
  const row = data as unknown as ResumeRow;
  if (row.status !== "paused") throw new HttpError(409, "Only a paused session can be resumed.");

  let doc = null;
  if (resumeNeedsDocument(row, options)) {
    const connection = await loadConnection(row.connection_id, userId);
    if (!connection) throw new HttpError(409, "Reconnect the document's account first.");
    doc = await withProviderErrors(() => providerFor(connection).readDocument(row.document_id));
  }

  const result = planResume(row, Date.now(), doc, options);
  if (!result.ok) return json({ error: result.message, attention: result.attention }, 409);

  const { data: updated, error: updateError } = await db.from("drips").update(result.patch).eq("id", id)
    .eq("user_id", userId).eq("status", "paused").eq("chunks_written", row.chunks_written).select(DRIP_COLUMNS)
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new HttpError(409, "The session changed while resuming. Try again.");

  // A later attention pause should notify again.
  await db.from("notifications").delete().eq("drip_id", id).eq("kind", "drip_attention");
  await logEvent(id, userId, "resumed", result.detail);
  await kickWorkerIfDue(Date.parse(String(result.patch.next_run_at)));
  return json({ drip: updated });
}

async function cancelDrip(userId: string, id: string): Promise<Response> {
  return await transition(
    userId,
    id,
    ACTIVE_STATUSES,
    { status: "canceled", next_run_at: null, lease_id: null },
    "canceled",
  );
}

async function transition(
  userId: string,
  id: string,
  from: string[],
  update: Record<string, unknown>,
  eventKind: string,
  detail: Record<string, unknown> = {},
): Promise<Response> {
  const db = adminClient();
  const { data, error } = await db
    .from("drips")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .in("status", from)
    .select(DRIP_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const { count } = await db.from("drips").select("id", { count: "exact", head: true }).eq("id", id).eq(
      "user_id",
      userId,
    );
    if (!count) throw new HttpError(404, "Drip not found.");
    throw new HttpError(409, `Drip can't be ${eventKind} from its current state.`);
  }

  const row = data as unknown as { chunks_written: number; total_chunks: number };
  await logEvent(id, userId, eventKind, { ...detail, written: row.chunks_written, total: row.total_chunks });
  return json({ drip: data });
}

// ---------------------------------------------------------------------------
// Connections & documents
// ---------------------------------------------------------------------------

async function listConnections(userId: string): Promise<Response> {
  const { data, error } = await adminClient()
    .from("provider_connections")
    .select("id, provider, account_email, scopes, created_at, refresh_token_enc")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(error.message);
  // Never return tokens; only whether the account can still be written to.
  const connections = (data ?? []).map(({ refresh_token_enc, ...c }) => ({
    ...c,
    connected: c.provider === "test" || Boolean(refresh_token_enc),
  }));
  return json({ connections });
}

/**
 * Disconnects an account without deleting history: stops its active drips,
 * revokes the Google grant, and forgets the tokens. Reconnecting the same
 * Google account later restores it.
 */
async function disconnectConnection(userId: string, id: string): Promise<Response> {
  const db = adminClient();
  const connection = await loadConnection(id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");

  const { data: stopped, error: stopError } = await db
    .from("drips")
    .update({ status: "canceled", next_run_at: null })
    .eq("user_id", userId)
    .eq("connection_id", id)
    .in("status", ACTIVE_STATUSES)
    .select("id");
  if (stopError) throw new Error(stopError.message);
  for (const drip of stopped ?? []) {
    await logEvent(drip.id, userId, "canceled", { reason: "account_disconnected" });
  }

  if (connection.provider === "google" && connection.refresh_token_enc) {
    try {
      await revokeGoogleToken(await decrypt(connection.refresh_token_enc, await encryptionKey()));
    } catch (error) {
      console.error("Couldn't revoke Google token", error);
    }
  }

  const { error } = await db
    .from("provider_connections")
    .update({ refresh_token_enc: null, access_token_enc: null, access_token_expires_at: null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  return json({ disconnected: true, stopped_sessions: (stopped ?? []).length });
}

async function createTestConnection(userId: string, email: string | null): Promise<Response> {
  if (!testProviderEnabled()) throw new HttpError(404, "Not found.");
  const { data, error } = await adminClient()
    .from("provider_connections")
    .upsert(
      { user_id: userId, provider: "test", account_email: email ?? "test" },
      { onConflict: "user_id,provider,account_email" },
    )
    .select("id, provider, account_email, created_at")
    .single();
  if (error) throw new Error(error.message);
  return json({ connection: data }, 201);
}

async function createDocument(userId: string, req: Request): Promise<Response> {
  const body = await readJson<{ connection_id?: string; title?: string }>(req);
  if (!body.connection_id || !UUID_RE.test(body.connection_id)) {
    throw new HttpError(400, "connection_id is required.");
  }
  const connection = await loadConnection(body.connection_id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");

  const title = (body.title ?? "Untitled document").slice(0, 200);
  const doc = await withProviderErrors(() => providerFor(connection).createDoc(title));
  return json({ document: doc }, 201);
}

// ---------------------------------------------------------------------------

async function withProviderErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.kind === "auth") throw new HttpError(401, `Reconnect your account: ${error.message}`);
      if (error.status === 404) throw new HttpError(404, "Document not found or not shared with TypeWit.");
      if (error.status === 403) throw new HttpError(403, "TypeWit doesn't have access to that document.");
      throw new HttpError(502, error.message);
    }
    throw error;
  }
}

/**
 * The worker runs on cron ticks at the start of each minute. When the next
 * insertion is due before the next tick, start a worker run now so it isn't
 * late. Best effort: the next tick picks the session up anyway.
 */
async function kickWorkerIfDue(dueAt: number): Promise<void> {
  if (!(dueAt < nextTickAfter(Date.now()))) return;
  try {
    const res = await fetch(`${requireEnv("SUPABASE_URL")}/functions/v1/drip-tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tick-secret": await getSecret("TICK_SECRET", "tick_secret") },
      body: "{}",
      signal: AbortSignal.timeout(5_000),
    });
    await res.body?.cancel();
  } catch (error) {
    console.error("Couldn't start the worker early", error);
  }
}

async function logEvent(dripId: string, userId: string, kind: string, detail: Record<string, unknown>) {
  const { error } = await adminClient().from("drip_events").insert({ drip_id: dripId, user_id: userId, kind, detail });
  if (error) console.error("Failed to log event", error.message);
}

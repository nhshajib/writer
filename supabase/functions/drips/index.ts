// User-facing API for drips, document connections and documents.
//
//   GET  /drips                     list my drips (with progress)
//   POST /drips/plan                check text, step size and duration; preview the schedule
//   POST /drips                     create and start a drip with its full schedule
//   GET  /drips/:id                 one drip with progress, the text written so far, and recent events
//   POST /drips/:id/pause           pause
//   POST /drips/:id/resume          resume (shifts the rest of the schedule by the pause)
//   POST /drips/:id/cancel          cancel (stop; text already entered stays)
//   POST /drips/:id/check           Test connection for a session, incl. the insertion point
//   POST /drips/:id/delete          delete a finished session and its saved text and log
//   POST /drips/clear               delete all finished sessions
//   POST /drips/check               Test connection for an account and (optional) document
//   GET  /drips/connections         my connected accounts
//   POST /drips/connections/test    create a test connection (dev only)
//   POST /drips/connections/:id/disconnect  revoke Google access, stop that account's active drips
//   POST /drips/connections/:id/picker      short-lived token for Google Picker (choose a Drive document)
//   POST /drips/connections/microsoft       the Word add-in's connection (no Microsoft tokens are stored)
//   POST /drips/:id/engine          the Word add-in runs a Word session through this (claim, update, confirm, log)
//   POST /drips/documents           create a new document in a connected account

import { requireUser } from "../_shared/auth.ts";
import { INSERTION_UNITS, type InsertionUnit } from "../_shared/chunker.ts";
import { decrypt, sha256Hex } from "../_shared/crypto.ts";
import { googleAccessToken, loadConnection, providerFor } from "../_shared/connections.ts";
import { adminClient, encryptionKey, getSecret, requireEnv, testProviderEnabled } from "../_shared/env.ts";
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { checkAccess } from "../_shared/access.ts";
import { checkCreateLimits, PLAN_LIMITS, type PlanTier } from "../_shared/limits.ts";
import { type BreakAlignment, type PacingSettings } from "../_shared/pacing.ts";
import { planSession, type SessionPlan } from "../_shared/plan.ts";
import { revokeGoogleToken } from "../_shared/providers/google.ts";
import { ProviderError } from "../_shared/providers/types.ts";
import { textRevision } from "../_shared/providers/word.ts";
import { notifyUser } from "../_shared/notifyUser.ts";
import { rateLimit } from "../_shared/rateLimit.ts";
import { computeProgress, type ProgressInput } from "../_shared/progress.ts";
import { randomSeed } from "../_shared/schedule.ts";
import {
  CLAIM_LOOKAHEAD_SECONDS,
  expectedTail,
  LEASE_SECONDS,
  nextTickAfter,
  planResume,
  type ResumableRow,
  resumeNeedsDocument,
  type ResumeOptions,
} from "../_shared/session.ts";
import { CURRENT_TERMS_VERSION } from "../_shared/terms.ts";

const ACTIVE_STATUSES = ["scheduled", "running", "paused"];
const FINISHED_STATUSES = ["completed", "canceled", "failed"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Columns returned to clients (everything except the text and chunk array). */
const DRIP_COLUMNS =
  "id, connection_id, provider, document_id, document_title, document_url, word_count, total_chunks, " +
  "chunks_written, interval_seconds, duration_seconds, status, next_run_at, attempts, last_error, " +
  "created_at, updated_at, completed_at, insertion_unit, mode, text_sha256, approved_at, schedule, " +
  "schedule_shift_seconds, session_started_at, paused_at, deadline_at, last_written_at, attention, pending_index, " +
  "timing_mode, pacing, breaks, retry_at, preflight_at";

/** Everything the resume checks need on top of DRIP_COLUMNS. */
const RESUME_COLUMNS =
  `${DRIP_COLUMNS}, chunks, pending_revision, pending_doc_length, resync_index, resync_tail, last_revision_id`;

const WORD_ONLY_IN_ADDIN =
  "TypeWit's servers can't open Word documents. Run Test connection from the TypeWit add-in in Word.";

serve(async (req) => {
  const user = await requireUser(req);
  const parts = routeParts(req);
  const method = req.method;

  if (parts.length === 0) {
    if (method === "GET") return await listDrips(user.id);
    if (method === "POST") {
      await rateLimit(user.id, "start");
      return await createDrip(user.id, req);
    }
  }
  if (parts[0] === "plan" && parts.length === 1 && method === "POST") {
    await rateLimit(user.id, "plan");
    return await previewPlan(user.id, req);
  }
  if (parts[0] === "check" && parts.length === 1 && method === "POST") {
    await rateLimit(user.id, "check");
    return await checkConnection(user.id, req);
  }
  if (parts[0] === "clear" && parts.length === 1 && method === "POST") return await clearFinished(user.id);
  if (parts[0] === "connections") {
    if (parts.length === 1 && method === "GET") return await listConnections(user.id);
    if (parts[1] === "test" && method === "POST") return await createTestConnection(user.id, user.email);
    if (parts[1] === "microsoft" && parts.length === 2 && method === "POST") {
      return await createWordConnection(user.id, user.email);
    }
    if (parts.length === 3 && UUID_RE.test(parts[1]) && parts[2] === "picker" && method === "POST") {
      await rateLimit(user.id, "picker");
      return await pickerToken(user.id, parts[1]);
    }
    if (parts.length === 3 && UUID_RE.test(parts[1]) && parts[2] === "disconnect" && method === "POST") {
      return await disconnectConnection(user.id, parts[1]);
    }
  }
  if (parts[0] === "documents" && parts.length === 1 && method === "POST") {
    await rateLimit(user.id, "document");
    return await createDocument(user.id, req);
  }
  if (parts.length >= 1 && UUID_RE.test(parts[0])) {
    const id = parts[0];
    if (parts.length === 1 && method === "GET") return await getDrip(user.id, id);
    if (parts.length === 2 && method === "POST") {
      if (parts[1] === "pause") return await pauseDrip(user.id, id);
      if (parts[1] === "resume") return await resumeDrip(user.id, id, req);
      if (parts[1] === "cancel") return await cancelDrip(user.id, id);
      if (parts[1] === "check") {
        await rateLimit(user.id, "check");
        return await checkSession(user.id, id);
      }
      if (parts[1] === "delete") return await deleteDrip(user.id, id);
      if (parts[1] === "engine") return await engine(user.id, id, req);
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
  /** Word: the document's name (the id is its address). */
  document_title?: string;
  text?: string;
  duration_minutes?: number;
  insertion_unit?: InsertionUnit;
  mode?: "scheduled" | "as_soon_as_possible";
  /** The seed of the schedule the user previewed, so the session follows that exact plan. */
  schedule_seed?: number;
  pacing?: unknown;
  /** One id per Start press; repeating the request returns the same session. */
  request_id?: string;
  approval?: { confirmed?: boolean; text_sha256?: string };
}

interface PlanBody {
  text?: string;
  duration_minutes?: number;
  insertion_unit?: InsertionUnit;
  mode?: "scheduled" | "as_soon_as_possible";
  schedule_seed?: number;
  pacing?: unknown;
}

/** Reads pace settings from a request body; shape only, ranges are checked by the planner. */
function readPacing(raw: unknown): PacingSettings {
  if (typeof raw !== "object" || raw === null) throw new HttpError(400, "pacing must be an object.");
  const p = raw as Record<string, unknown>;
  const b = (typeof p.breaks === "object" && p.breaks !== null ? p.breaks : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const timing = p.timing === "speed" ? "speed" : p.timing === "duration" ? "duration" : null;
  if (!timing) throw new HttpError(400, "pacing.timing must be duration or speed.");
  return {
    timing,
    duration_seconds: timing === "duration" ? num(p.duration_seconds) : undefined,
    wpm: timing === "speed" ? num(p.wpm) : undefined,
    variation_pct: num(p.variation_pct),
    breaks: {
      enabled: b.enabled === true,
      every_seconds: num(b.every_seconds ?? 600),
      every_variation_pct: num(b.every_variation_pct ?? 0),
      min_seconds: num(b.min_seconds ?? 30),
      max_seconds: num(b.max_seconds ?? 30),
      align: (["any", "sentence", "paragraph"].includes(String(b.align)) ? b.align : "any") as BreakAlignment,
    },
  };
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
  const pacing = mode === "scheduled" && body.pacing !== undefined ? readPacing(body.pacing) : undefined;
  if (mode === "scheduled" && !pacing && (!Number.isFinite(durationMinutes) || durationMinutes < 1)) {
    throw new HttpError(400, "duration_minutes must be a number of at least 1.");
  }
  const seed = body.schedule_seed;
  if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff)) {
    throw new HttpError(400, "schedule_seed must be a 32-bit unsigned integer.");
  }
  return {
    text,
    unit,
    mode,
    pacing,
    durationSeconds: Math.round(durationMinutes * 60),
    seed: seed ?? randomSeed(),
  };
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
  if (body.document_id !== undefined && (typeof body.document_id !== "string" || body.document_id.length > 2000)) {
    throw new HttpError(400, "document_id must be a string of at most 2000 characters.");
  }

  if (body.request_id !== undefined && !UUID_RE.test(String(body.request_id))) {
    throw new HttpError(400, "request_id must be a UUID.");
  }

  const db = adminClient();
  const connection = await loadConnection(body.connection_id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");
  if (connection.provider === "microsoft" && !body.document_id) {
    throw new HttpError(400, "Open the Word document in Word and start the session from the TypeWit add-in.");
  }

  // A repeated Start (double click, retry after a lost response) returns the
  // session the first one made instead of starting another.
  if (body.request_id) {
    const { data: existing } = await db.from("drips").select(DRIP_COLUMNS).eq("user_id", userId)
      .eq("request_id", body.request_id).maybeSingle();
    if (existing) return json({ drip: existing, duplicate: true });
  }
  if (body.document_id) await assertNoActiveSession(connection.id, body.document_id);

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
    // The planner already checked the duration; a short speed-mode session is fine.
    durationSeconds: Math.max(60, plan.duration_seconds),
    activeDrips: activeDrips ?? 0,
  });
  if (limitError) throw new HttpError(422, limitError);

  if (body.request_id) {
    const { error: requestError } = await db.from("start_requests").insert({
      user_id: userId,
      request_id: body.request_id,
    });
    if (requestError) {
      if (requestError.code === "23505") throw new HttpError(409, "This session is already starting.");
      throw new Error(requestError.message);
    }
  }

  try {
    return await startSession(userId, body, input, plan, tier, connection, textHash);
  } catch (error) {
    // Let the same Start be retried after a failure.
    if (body.request_id) {
      await db.from("start_requests").delete().eq("user_id", userId).eq("request_id", body.request_id);
    }
    throw error;
  }
}

/** Creates the document if needed, reserves the words, and saves the session with its schedule. */
async function startSession(
  userId: string,
  body: CreateDripBody,
  input: ReturnType<typeof readPlanInput>,
  plan: SessionPlan,
  tier: PlanTier,
  connection: NonNullable<Awaited<ReturnType<typeof loadConnection>>>,
  textHash: string,
): Promise<Response> {
  const db = adminClient();
  const { text } = input;
  // Resolve the target document before reserving quota, so a bad document id
  // doesn't use up the day's words.
  // A Word document is identified by its address in Word; only the add-in running in it can write to it.
  const doc = connection.provider === "microsoft"
    ? {
      id: body.document_id!,
      title: (body.document_title?.trim() || wordTitle(body.document_id!)).slice(0, 200),
      url: /^https?:\/\//.test(body.document_id!) ? body.document_id! : null,
    }
    : await withProviderErrors(() => {
      const provider = providerFor(connection);
      return body.document_id
        ? provider.getDoc(body.document_id)
        : provider.createDoc(body.new_document_title!.slice(0, 200));
    });

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
      duration_seconds: Math.max(1, plan.duration_seconds),
      insertion_unit: input.unit,
      mode: input.mode,
      timing_mode: input.mode === "as_soon_as_possible" ? "asap" : plan.pacing!.timing,
      pacing: plan.pacing,
      breaks: plan.breaks,
      request_id: body.request_id ?? null,
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
  if (error) {
    const { error: releaseError } = await db.rpc("release_words", { target_user: userId, words: plan.words });
    if (releaseError) console.error("release_words failed", releaseError.message);
    if (error.code === "23505") {
      throw new HttpError(409, "This document already has an unfinished session. Stop it before starting another.");
    }
    // The database's own count, which also catches Starts sent at the same moment.
    const limit = /active_drip_limit:(\d+)/.exec(error.message);
    if (limit) {
      const max = Number(limit[1]);
      throw new HttpError(422, `Your plan allows ${max} active session${max === 1 ? "" : "s"} at a time.`);
    }
    throw new Error(error.message);
  }

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
    timing_mode: input.mode === "as_soon_as_possible" ? "asap" : plan.pacing!.timing,
    duration_seconds: plan.duration_seconds,
    active_seconds: plan.active_seconds,
    break_seconds: plan.break_seconds,
    breaks: plan.breaks.length,
    schedule_seed: plan.seed,
    first_at: new Date(started.getTime() + plan.schedule[0]).toISOString(),
    finish_at: new Date(started.getTime() + lastOffset).toISOString(),
    min_gap_seconds: (plan.stats?.min_gap_ms ?? 0) / 1000,
    max_gap_seconds: (plan.stats?.max_gap_ms ?? 0) / 1000,
  });
  if (connection.provider !== "microsoft") await kickWorkerIfDue(started.getTime() + plan.schedule[0]);
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

type ResumeRow = ResumableRow & {
  id: string;
  status: string;
  connection_id: string;
  document_id: string;
  provider: string;
};

/**
 * Resumes a paused session; see planResume. Sessions TypeWit paused itself
 * are checked against the document first.
 */
async function resumeDrip(userId: string, id: string, req: Request): Promise<Response> {
  // The body is optional; a plain resume sends none. The Word add-in sends the document's text,
  // because TypeWit's servers can't open a Word document themselves.
  const options = (await req.json().catch(() => ({}))) as ResumeOptions & { document?: { text?: unknown } };
  const db = adminClient();
  const { data, error } = await db.from("drips").select(RESUME_COLUMNS).eq("id", id).eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Drip not found.");
  const row = data as unknown as ResumeRow;
  if (row.status !== "paused") throw new HttpError(409, "Only a paused session can be resumed.");

  let doc = null;
  if (resumeNeedsDocument(row, options) && row.provider === "microsoft") {
    if (typeof options.document?.text !== "string") {
      throw new HttpError(
        409,
        "Open the document in Word and resume from the TypeWit add-in, so it can check the document first.",
      );
    }
    doc = { revisionId: textRevision(options.document.text), text: options.document.text };
  } else if (resumeNeedsDocument(row, options)) {
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

async function assertNoActiveSession(connectionId: string, documentId: string): Promise<void> {
  const { count, error } = await adminClient().from("drips").select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId).eq("document_id", documentId).in("status", ACTIVE_STATUSES);
  if (error) throw new Error(error.message);
  if (count) {
    throw new HttpError(409, "This document already has an unfinished session. Stop it before starting another.");
  }
}

/** Test connection before starting: the account, and the document if one is chosen. Changes nothing. */
async function checkConnection(userId: string, req: Request): Promise<Response> {
  const body = await readJson<{ connection_id?: string; document_id?: string }>(req);
  if (!body.connection_id || !UUID_RE.test(body.connection_id)) throw new HttpError(400, "connection_id is required.");
  const connection = await loadConnection(body.connection_id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");
  if (connection.provider === "microsoft") throw new HttpError(409, WORD_ONLY_IN_ADDIN);
  const report = await checkAccess(providerFor(connection), body.document_id ?? null);
  return json({ report });
}

/** Test connection for a session, including whether the document still ends with TypeWit's text. */
async function checkSession(userId: string, id: string): Promise<Response> {
  const { data, error } = await adminClient().from("drips")
    .select("connection_id, document_id, status, chunks, chunks_written, resync_index, resync_tail")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Drip not found.");
  const connection = await loadConnection(data.connection_id, userId);
  if (!connection) throw new HttpError(409, "Reconnect the document's account first.");
  if (connection.provider === "microsoft") throw new HttpError(409, WORD_ONLY_IN_ADDIN);
  const unfinished = ACTIVE_STATUSES.includes(data.status);
  const tail = unfinished
    ? expectedTail(data as { chunks: string[]; resync_index: number; resync_tail: string }, data.chunks_written)
    : null;
  const report = await checkAccess(providerFor(connection), data.document_id, tail);
  return json({ report });
}

/** Deletes a finished session: its saved text, schedule and activity log. The document is untouched. */
async function deleteDrip(userId: string, id: string): Promise<Response> {
  const { data, error } = await adminClient().from("drips").delete().eq("id", id).eq("user_id", userId)
    .in("status", FINISHED_STATUSES).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    const { count } = await adminClient().from("drips").select("id", { count: "exact", head: true }).eq("id", id)
      .eq("user_id", userId);
    if (!count) throw new HttpError(404, "Drip not found.");
    throw new HttpError(409, "Stop the session before deleting it.");
  }
  return json({ deleted: 1 });
}

/** Deletes every finished session of the user. Unfinished sessions are kept. */
async function clearFinished(userId: string): Promise<Response> {
  const db = adminClient();
  const { data, error } = await db.from("drips").delete().eq("user_id", userId).in("status", FINISHED_STATUSES)
    .select("id");
  if (error) throw new Error(error.message);
  await db.from("start_requests").delete().eq("user_id", userId);
  return json({ deleted: (data ?? []).length });
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
    connected: c.provider === "test" || c.provider === "microsoft" || Boolean(refresh_token_enc),
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

/** The Word add-in's connection. Word sessions edit the open document through Word itself, so no Microsoft tokens exist. */
async function createWordConnection(userId: string, email: string | null): Promise<Response> {
  const { data, error } = await adminClient()
    .from("provider_connections")
    .upsert(
      { user_id: userId, provider: "microsoft", account_email: email ?? "Word" },
      { onConflict: "user_id,provider,account_email" },
    )
    .select("id, provider, account_email, created_at")
    .single();
  if (error) throw new Error(error.message);
  return json({ connection: data }, 201);
}

/**
 * Google Picker runs in the browser and needs an access token from the same
 * OAuth client. Picking a document there gives TypeWit (drive.file) access to
 * that one document. The token is short-lived and only sent to its owner.
 */
async function pickerToken(userId: string, id: string): Promise<Response> {
  const connection = await loadConnection(id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");
  if (connection.provider !== "google") throw new HttpError(400, "Google Picker is only for Google accounts.");
  const accessToken = await withProviderErrors(() => googleAccessToken(connection));
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  return json({
    access_token: accessToken,
    expires_at: connection.access_token_expires_at,
    // Picker's app id is the Cloud project number, which starts every OAuth client id.
    app_id: Deno.env.get("GOOGLE_PROJECT_NUMBER") ?? clientId.match(/^(\d+)-/)?.[1] ?? null,
    api_key: Deno.env.get("GOOGLE_API_KEY") ?? null,
  });
}

/** Word documents are named after their file: ".../Essay.docx?web=1" is "Essay". */
function wordTitle(address: string): string {
  const last = address.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop() ?? "";
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch { /* keep it as it is */ }
  return name.replace(/\.(docx?|dotx?|docm)$/i, "") || "Word document";
}

// ---------------------------------------------------------------------------
// Word sessions: the add-in in Word runs the same session engine as the
// server worker, with Word as the document and this endpoint as its store.
// ---------------------------------------------------------------------------

/** The fields the engine may change, as SessionPatch. Everything else (text, units, schedule) is fixed at start. */
const ENGINE_FIELDS = new Set([
  "status",
  "next_run_at",
  "lease_id",
  "paused_at",
  "completed_at",
  "attention",
  "last_error",
  "deadline_at",
  "chunks_written",
  "schedule_shift_seconds",
  "attempts",
  "pending_index",
  "pending_revision",
  "pending_doc_length",
  "retry_at",
  "last_revision_id",
  "last_written_at",
  "resync_index",
  "resync_tail",
  "document_baseline_length",
  "preflight_at",
]);
const ENGINE_STATUSES = new Set(["running", "paused", "completed"]);
const ENGINE_EVENTS = new Set([
  "chunk_written",
  "schedule_shifted",
  "retry_scheduled",
  "attention",
  "paused",
  "completed",
  "connection_checked",
  "insertion_uncertain",
]);

function enginePatch(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new HttpError(400, "patch must be an object.");
  }
  const patch = raw as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    if (!ENGINE_FIELDS.has(key)) throw new HttpError(400, `The add-in can't change ${key}.`);
  }
  if ("status" in patch && !ENGINE_STATUSES.has(String(patch.status))) throw new HttpError(400, "Invalid status.");
  return patch;
}

interface EngineBody {
  op?: "claim" | "control" | "update" | "confirm" | "log";
  document_id?: string;
  lease?: string;
  expected?: number;
  patch?: unknown;
  events?: { kind?: unknown; detail?: unknown }[];
}

async function engine(userId: string, id: string, req: Request): Promise<Response> {
  const body = await readJson<EngineBody>(req);
  const db = adminClient();
  const { data: drip, error } = await db.from("drips")
    .select(
      "id, user_id, provider, document_id, document_title, document_url, status, lease_id, next_run_at, attention, " +
        "word_count, chunks_written, total_chunks",
    )
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!drip) throw new HttpError(404, "Drip not found.");
  const row = drip as unknown as {
    id: string;
    user_id: string;
    provider: string;
    document_id: string;
    document_title: string | null;
    document_url: string | null;
    status: string;
    lease_id: string | null;
    next_run_at: string | null;
    attention: string | null;
    word_count: number;
    chunks_written: number;
    total_chunks: number;
  };
  if (row.provider !== "microsoft") throw new HttpError(409, "This session runs on TypeWit's servers.");

  switch (body.op) {
    case "claim": {
      if (body.document_id !== row.document_id) {
        throw new HttpError(409, "This session belongs to a different Word document.");
      }
      const { data, error: claimError } = await db.rpc("claim_client_drip", {
        drip: id,
        owner: userId,
        document: row.document_id,
        lease_seconds: LEASE_SECONDS,
        lookahead_seconds: CLAIM_LOOKAHEAD_SECONDS,
      });
      if (claimError) throw new Error(claimError.message);
      const claimed = ((data ?? []) as Record<string, unknown>[])[0] ?? null;
      return json({ row: claimed, status: row.status, next_run_at: row.next_run_at, attention: row.attention });
    }
    case "control":
      return json({ status: row.status, lease_id: row.lease_id });
    case "update":
    case "confirm": {
      const patch = enginePatch(body.patch);
      let query = db.from("drips").update(patch).eq("id", id).eq("user_id", userId);
      if (body.op === "update") {
        if (typeof body.lease !== "string" || !UUID_RE.test(body.lease)) throw new HttpError(400, "lease is required.");
        query = query.eq("lease_id", body.lease).eq("status", "running");
      } else {
        if (!Number.isInteger(body.expected)) throw new HttpError(400, "expected is required.");
        query = query.eq("chunks_written", body.expected!);
      }
      const { data, error: updateError } = await query.select("id");
      if (updateError) throw new HttpError(400, updateError.message);
      const ok = (data ?? []).length > 0;
      if (ok && body.op === "update" && (patch.status === "completed" || patch.status === "paused")) {
        await notifyUser(row, patch.status === "completed" ? "drip_completed" : "drip_attention");
      }
      return json({ ok });
    }
    case "log": {
      const events = (Array.isArray(body.events) ? body.events : []).filter((e) =>
        ENGINE_EVENTS.has(String(e?.kind)) && typeof e.detail === "object" && e.detail !== null
      );
      if (events.length) {
        const { error: logError } = await db.from("drip_events").insert(
          events.slice(0, 20).map((e) => ({ drip_id: id, user_id: userId, kind: String(e.kind), detail: e.detail })),
        );
        if (logError) console.error("Failed to log session events", id, logError.message);
      }
      return json({ logged: events.length });
    }
  }
  throw new HttpError(400, "Unknown op.");
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

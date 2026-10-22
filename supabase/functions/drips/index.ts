import { customerSubscriptions, subscriptionHasNotEnded } from "../_shared/stripe.ts";
import { validateConfirmPatch, validateEngineEvents } from "../_shared/engineProtocol.ts";
import { parseFormatted, parseRichText, plainDocument, replaceFormattedTail } from "../_shared/markdown.ts";
// User-facing API for drips, document connections and documents.
//
//   GET  /drips[?before=<iso>]      list my drips (with progress), newest first, 100 at a time
//   POST /drips/plan                check text, step size and duration; preview the schedule
//   POST /drips                     create and start a drip with its full schedule
//   GET  /drips/:id                 one drip with progress, the text written so far, and recent events
//   POST /drips/:id/pause           pause
//   POST /drips/:id/resume          resume (shifts the rest of the schedule by the pause)
//   POST /drips/:id/settings        Pro: revise remaining text and settings while safely paused
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
//   GET  /drips/headings?connection_id=&document_id=  a Google document's headings (Pro: insert under a heading)
//   POST /drips/account/delete      delete my account and everything TypeWit stores for it

import { requireUser } from "../_shared/auth.ts";
import { countWords, INSERTION_UNITS, type InsertionUnit } from "../_shared/chunker.ts";
import { decrypt, sha256Hex } from "../_shared/crypto.ts";
import { googleAccessToken, loadConnection, providerFor } from "../_shared/connections.ts";
import { adminClient, encryptionKey, getSecret, requireEnv, testProviderEnabled } from "../_shared/env.ts";
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { checkAccess } from "../_shared/access.ts";
import { checkCreateLimits, effectivePlan, PLAN_LIMITS, type PlanTier, PRO_ONLY_MESSAGES } from "../_shared/limits.ts";
import { readWorkWindow } from "../_shared/workWindow.ts";
import { type BreakAlignment, type PacingSettings } from "../_shared/pacing.ts";
import { planSession, type SessionPlan } from "../_shared/plan.ts";
import { revokeGoogleToken } from "../_shared/providers/google.ts";
import { HEADING_MISSING, HEADING_NO_SPACE, type InsertTarget, ProviderError } from "../_shared/providers/types.ts";
import { textRevision } from "../_shared/providers/word.ts";
import { notifyUser } from "../_shared/notifyUser.ts";
import { rateLimit } from "../_shared/rateLimit.ts";
import { computeProgress, type ProgressInput } from "../_shared/progress.ts";
import { type EditableSession, replanPaused } from "../_shared/replan.ts";
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
  "timing_mode, pacing, breaks, retry_at, preflight_at, text_format, insert_target, work_window, access_expires_at";

/** Everything the resume checks need on top of DRIP_COLUMNS. */
const EXECUTION_COLUMNS = "chunks, chunk_deletions, action_kinds, source_chunks, source_unit_ends";
const RESUME_COLUMNS =
  `${DRIP_COLUMNS}, ${EXECUTION_COLUMNS}, chunk_formats, pending_revision, pending_doc_length, resync_index, resync_tail, last_revision_id`;

const WORD_ONLY_IN_ADDIN =
  "TypeWit's servers can't open Word documents. Run Test connection from the TypeWit add-in in Word.";

serve(async (req) => {
  const user = await requireUser(req);
  const parts = routeParts(req);
  const method = req.method;
  if (method === "POST") {
    const operation = parts.at(-1);
    const bucket = operation === "engine"
      ? "engine"
      : operation === "microsoft"
      ? "microsoft"
      : operation === "disconnect"
      ? "disconnect"
      : operation === "clear"
      ? "clear"
      : operation === "delete"
      ? "delete"
      : operation === "pause"
      ? "pause"
      : operation === "resume"
      ? "resume"
      : operation === "cancel"
      ? "cancel"
      : null;
    if (bucket) await rateLimit(user.id, bucket);
  }

  if (parts.length === 0) {
    if (method === "GET") return await listDrips(user.id, new URL(req.url).searchParams.get("before"));
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
  if (parts[0] === "account" && parts[1] === "delete" && parts.length === 2 && method === "POST") {
    return await deleteAccount(user.id, user.email, req);
  }
  if (parts[0] === "headings" && parts.length === 1 && method === "GET") {
    await rateLimit(user.id, "check");
    return await listHeadings(user.id, new URL(req.url).searchParams);
  }
  if (parts[0] === "documents" && parts.length === 1 && method === "POST") {
    await rateLimit(user.id, "document");
    return await createDocument(user.id, req);
  }
  if (parts.length >= 1 && UUID_RE.test(parts[0])) {
    const id = parts[0];
    if (parts.length === 1 && method === "GET") return await getDrip(user.id, id);
    if (parts.length === 2 && parts[1] === "playback" && method === "GET") return await getPlayback(user.id, id);
    if (parts.length === 2 && method === "POST") {
      if (parts[1] === "pause") return await pauseDrip(user.id, id);
      if (parts[1] === "settings") return await editPausedSettings(user.id, id, req);
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
  work_window?: unknown;
  revision_sweep?: boolean;
  rhythm?: "steady" | "natural" | "drafting" | "custom";
  connection_id?: string;
  /** Optional later start (ISO time, up to 7 days ahead); the schedule counts from it. */
  start_at?: string;
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
  text_format?: "plain" | "markdown" | "rich";
  /** Pro, Google Docs: add the text at the end of this heading's section. */
  insert_target?: { heading_id?: unknown; heading_text?: unknown; level?: unknown } | null;
}

interface PlanBody {
  work_window?: unknown;
  revision_sweep?: boolean;
  start_at?: string;
  rhythm?: "steady" | "natural" | "drafting" | "custom";
  text?: string;
  duration_minutes?: number;
  insertion_unit?: InsertionUnit;
  mode?: "scheduled" | "as_soon_as_possible";
  schedule_seed?: number;
  pacing?: unknown;
  text_format?: "plain" | "markdown" | "rich";
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
    ...(p.word_grouping === undefined ? {} : { word_grouping: p.word_grouping as PacingSettings["word_grouping"] }),
    ...(p.drafting === undefined ? {} : { drafting: p.drafting as PacingSettings["drafting"] }),
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
  if (body.revision_sweep !== undefined && typeof body.revision_sweep !== "boolean") {
    throw new HttpError(400, "Final revision pass must be on or off.");
  }
  let workWindow;
  try {
    workWindow = body.work_window === undefined ? undefined : readWorkWindow(body.work_window);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Check writing hours.");
  }
  if (body.rhythm !== undefined && !["steady", "natural", "drafting", "custom"].includes(body.rhythm)) {
    throw new HttpError(400, "Choose a supported writing rhythm.");
  }
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
  const pacing = body.pacing !== undefined ? readPacing(body.pacing) : undefined;
  if (mode === "scheduled" && !pacing && (!Number.isFinite(durationMinutes) || durationMinutes < 1)) {
    throw new HttpError(400, "duration_minutes must be a number of at least 1.");
  }
  const format = body.text_format ?? "plain";
  if (format !== "plain" && format !== "markdown" && format !== "rich") {
    throw new HttpError(400, "Unsupported text format.");
  }
  if (format === "rich") {
    try {
      parseRichText(text);
    } catch {
      throw new HttpError(400, "The formatted text could not be read. Paste it again.");
    }
  }
  const seed = body.schedule_seed;
  if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff)) {
    throw new HttpError(400, "schedule_seed must be a 32-bit unsigned integer.");
  }
  return {
    workWindow,
    revisionSweep: body.revision_sweep,
    startsAt: body.start_at ? (readStartAt(body.start_at)?.getTime() ?? Date.now()) : Date.now(),
    rhythm: body.rhythm,
    text,
    unit,
    mode,
    pacing,
    durationSeconds: Math.round(durationMinutes * 60),
    seed: seed ?? randomSeed(),
    format,
  } as const;
}

function readTarget(raw: CreateDripBody["insert_target"]): InsertTarget | null {
  if (raw === undefined || raw === null) return null;
  const id = raw.heading_id;
  const text = raw.heading_text;
  const level = raw.level;
  if (typeof id !== "string" || !/^[\w.-]{1,100}$/.test(id)) {
    throw new HttpError(400, "insert_target.heading_id is invalid.");
  }
  if (typeof text !== "string" || text.length > 200) throw new HttpError(400, "insert_target.heading_text is invalid.");
  if (!Number.isInteger(level) || (level as number) < 0 || (level as number) > 6) {
    throw new HttpError(400, "insert_target.level is invalid.");
  }
  return { heading_id: id, heading_text: text, level: level as number };
}

async function userPlan(userId: string): Promise<{ plan: PlanTier; agreed: boolean; expiresAt: string | null }> {
  const { data, error } = await adminClient().from("profiles").select("plan, agreed_terms_version, day_pass_expires_at")
    .eq(
      "user_id",
      userId,
    ).maybeSingle();
  if (error) throw new Error(error.message);
  return {
    plan: effectivePlan(data ?? {}),
    agreed: data?.agreed_terms_version === CURRENT_TERMS_VERSION,
    expiresAt: data?.day_pass_expires_at ?? null,
  };
}

/** The plan as the client sees it: unit lengths instead of the units, so the response stays small. */
function planResponse(plan: SessionPlan) {
  const { units, source_chunks, chunk_formats: _formats, ...rest } = plan;
  return {
    ...rest,
    unit_count: units.length,
    unit_lengths: units.map((u) => u.length),
    source_unit_count: source_chunks.length,
    source_unit_lengths: source_chunks.map((u) => u.length),
  };
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
  for (const key of ["document_title", "new_document_title"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") throw new HttpError(400, `${key} must be text.`);
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
  readStartAt(body.start_at);
  const target = readTarget(body.insert_target);
  if (target && !body.document_id) {
    throw new HttpError(400, "Choose an existing document to add text under one of its headings.");
  }

  const db = adminClient();
  const connection = await loadConnection(body.connection_id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");
  if (connection.provider === "microsoft" && !body.document_id) {
    throw new HttpError(400, "Open the Word document in Word and start the session from the TypeWit add-in.");
  }
  if (connection.provider === "microsoft" && (parseFormatted(text, input.format)?.plain ?? text).includes("\v")) {
    throw new HttpError(400, "Replace manual line breaks with paragraph breaks for Word.");
  }
  if (target && connection.provider === "microsoft") {
    throw new HttpError(400, "Adding text under a heading works with Google Docs for now.");
  }

  // A repeated Start (double click, retry after a lost response) returns the
  // session the first one made instead of starting another.
  if (body.request_id) {
    const { data: existing } = await db.from("drips").select(DRIP_COLUMNS).eq("user_id", userId)
      .eq("request_id", body.request_id).maybeSingle();
    if (existing) return json({ drip: existing, duplicate: true });
  }
  if (body.document_id) await assertNoActiveSession(connection.id, body.document_id);

  const [{ plan: tier, agreed, expiresAt }, { count: activeDrips, error: countError }] = await Promise.all([
    userPlan(userId),
    db.from("drips").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ACTIVE_STATUSES),
  ]);
  if (countError) throw new Error(countError.message);
  if (!agreed) throw new HttpError(403, "Please read and agree to the Responsible Use Agreement before writing.");
  if (tier !== "pro" && body.start_at) throw new HttpError(403, PRO_ONLY_MESSAGES.startLater);
  if (tier !== "pro" && target) throw new HttpError(403, PRO_ONLY_MESSAGES.headings);

  // Splits the text and builds the complete schedule before anything starts.
  const plan = planSession({ ...input, plan: tier });
  if (!plan.ok) return json({ error: plan.problems[0].message, problems: plan.problems }, 422);
  if (tier === "day_pass" && expiresAt && input.startsAt + (plan.schedule.at(-1) ?? 0) >= Date.parse(expiresAt)) {
    throw new HttpError(
      422,
      "This schedule finishes after your Day Pass expires. Choose a shorter session or upgrade to Pro.",
    );
  }

  const limitError = checkCreateLimits({
    plan: tier,
    words: plan.words,
    textLength: plan.chars,
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
    return await startSession(
      userId,
      body,
      input,
      plan,
      tier,
      connection,
      textHash,
      target,
      tier === "day_pass" ? expiresAt : null,
    );
  } catch (error) {
    // Let the same Start be retried after a failure.
    if (body.request_id) {
      await db.from("start_requests").delete().eq("user_id", userId).eq("request_id", body.request_id);
    }
    throw error;
  }
}

const MAX_START_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

/** A later start time from the request, or null to start now. A time already past (by under a minute) means now. */
function readStartAt(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const at = typeof raw === "string" ? Date.parse(raw) : NaN;
  if (!Number.isFinite(at)) throw new HttpError(400, "start_at must be a date and time.");
  const now = Date.now();
  if (at < now - 60_000) throw new HttpError(422, "The start time has already passed. Choose a later time.");
  if (at > now + MAX_START_DELAY_MS) throw new HttpError(422, "Sessions can be scheduled up to 7 days ahead.");
  return at <= now ? null : new Date(at);
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
  target: InsertTarget | null,
  accessExpiresAt: string | null = null,
): Promise<Response> {
  const db = adminClient();
  const { text } = input;
  // Validate before reserving quota. Provider calls can outlast a near-term
  // start time; in that case start when approval is saved, without charging
  // for a session that fails a second time-of-day validation.
  const requestedStart = readStartAt(body.start_at);
  const checkAccess = () => {
    if (
      accessExpiresAt &&
      Math.max(Date.now(), requestedStart?.getTime() ?? 0) + (plan.schedule.at(-1) ?? 0) >= Date.parse(accessExpiresAt)
    ) {
      throw new HttpError(
        422,
        "This session would finish after your Day Pass expires. Choose a shorter duration or upgrade to Pro.",
      );
    }
  };
  checkAccess();
  // Resolve the target document before reserving quota, so a bad document id
  // doesn't use up the day's words.
  // A Word document is identified by its address in Word; only the add-in running in it can write to it.
  const resolveDoc = async () =>
    connection.provider === "microsoft"
      ? {
        id: body.document_id!,
        title: (body.document_title?.trim() || wordTitle(body.document_id!)).slice(0, 200),
        url: /^https?:\/\//.test(body.document_id!) ? body.document_id! : null,
      }
      : await withProviderErrors(async () => {
        const provider = providerFor(connection, target);
        if (!body.document_id) return await provider.createDoc(body.new_document_title!.slice(0, 200));
        const info = await provider.getDoc(body.document_id);
        // Check the heading is there with room under it before anything is reserved.
        if (target) await provider.readDocument(body.document_id);
        return info;
      });
  let doc = body.document_id ? await resolveDoc() : null;

  const { data: reserved, error: reserveError } = await db.rpc("reserve_words", {
    target_user: userId,
    words: plan.words,
    daily_limit: PLAN_LIMITS[tier].dailyWords,
  });
  if (reserveError) throw new Error(reserveError.message);
  if (!reserved) throw new HttpError(422, `Your plan allows ${PLAN_LIMITS[tier].dailyWords} words per day.`);

  try {
    checkAccess();
    doc ??= await resolveDoc();
    checkAccess();
  } catch (error) {
    await db.rpc("release_words", { target_user: userId, words: plan.words });
    throw error;
  }
  const approvedAt = new Date();
  const started = requestedStart && requestedStart > approvedAt ? requestedStart : approvedAt;
  const lastOffset = plan.schedule[plan.schedule.length - 1];
  const { data: drip, error } = await db
    .from("drips")
    .insert({
      work_window: input.workWindow,
      access_expires_at: accessExpiresAt,
      user_id: userId,
      connection_id: connection.id,
      provider: connection.provider,
      document_id: doc.id,
      document_title: doc.title,
      document_url: doc.url,
      text,
      chunks: plan.units,
      chunk_deletions: plan.chunk_deletions,
      action_kinds: plan.action_kinds,
      source_chunks: plan.source_chunks,
      source_unit_ends: plan.source_unit_ends,
      text_format: plan.text_format,
      chunk_formats: plan.chunk_formats,
      insert_target: target,
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
      approved_at: approvedAt.toISOString(),
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
    text_format: plan.text_format,
    under_heading: target?.heading_text ?? null,
    simulated_drafting: plan.pacing?.drafting ?? null,
  });
  await logEvent(dripId, userId, "created", {
    starts_at: started > approvedAt ? started.toISOString() : null,
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
    source_units: plan.source_chunks.length,
    simulated_drafting: plan.pacing?.drafting ?? null,
    simulated_typos: plan.action_kinds.filter((k) => k === "typo").length,
    simulated_false_starts: plan.action_kinds.filter((k) => k === "false_start").length,
    min_gap_seconds: (plan.stats?.min_gap_ms ?? 0) / 1000,
    max_gap_seconds: (plan.stats?.max_gap_ms ?? 0) / 1000,
  });
  if (connection.provider !== "microsoft") await kickWorkerIfDue(started.getTime() + plan.schedule[0]);
  return json({ drip }, 201);
}

/** A drip row plus its chunks (needed to derive progress), with `progress` attached. */
type DripWithChunks = ProgressInput & Record<string, unknown>;

function withProgress(row: DripWithChunks, includeText: boolean) {
  const {
    chunks: _chunks,
    chunk_deletions: _deletions,
    action_kinds: _actions,
    source_chunks: _source,
    source_unit_ends: _ends,
    schedule,
    ...drip
  } = row;
  const { written_text, remaining_text, next_part, ...progress } = computeProgress(row, new Date());
  return includeText
    ? { ...drip, schedule, progress: { ...progress, written_text, remaining_text, next_part } }
    : { ...drip, progress };
}

const PAGE_SIZE = 100;

/** One page of sessions; `before` (a created_at time) continues after the last page. */
async function listDrips(userId: string, before: string | null): Promise<Response> {
  let query = adminClient()
    .from("drips")
    .select(`${DRIP_COLUMNS}, ${EXECUTION_COLUMNS}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) {
    if (!Number.isFinite(Date.parse(before))) throw new HttpError(400, "before must be a date and time.");
    query = query.lt("created_at", before);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data as unknown as DripWithChunks[];
  return json({
    drips: rows.slice(0, PAGE_SIZE).map((row) => withProgress(row, false)),
    has_more: rows.length > PAGE_SIZE,
  });
}

async function getDrip(userId: string, id: string): Promise<Response> {
  const db = adminClient();
  const { data: row, error } = await db
    .from("drips")
    .select(`${DRIP_COLUMNS}, ${EXECUTION_COLUMNS}`)
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

/** Read-only replay of this user's TypeWit actions, not Google's revision API. */
async function getPlayback(userId: string, id: string): Promise<Response> {
  if ((await userPlan(userId)).plan !== "pro") throw new HttpError(403, "Session playback is part of Pro.");
  const { data, error } = await adminClient().from("drips")
    .select("chunks,chunk_deletions,chunks_written,schedule,session_started_at,schedule_shift_seconds")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(503, "Playback could not be loaded. Please try again.");
  if (!data) throw new HttpError(404, "Session not found.");
  const written = Math.min(data.chunks_written, data.chunks.length);
  return json({
    playback: {
      chunks: data.chunks.slice(0, written),
      deletions: (data.chunk_deletions ?? []).slice(0, written),
      schedule: (data.schedule ?? []).slice(0, written),
      starts_at: data.session_started_at,
      recorded_actions: written,
      timing: "planned",
    },
  });
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
  if ((row as { access_expires_at?: string }).access_expires_at) {
    const entitlement = await userPlan(userId);
    if (entitlement.plan === "free") {
      throw new HttpError(403, "Your Day Pass has expired. Get another pass or upgrade to Pro to resume.");
    }
  }
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
    doc = await withProviderErrors(() =>
      providerFor(connection, (row as { insert_target?: InsertTarget | null }).insert_target ?? null)
        .readDocument(row.document_id)
    );
  }

  const result = planResume(row, Date.now(), doc, options);
  if (!result.ok) return json({ error: result.message, attention: result.attention }, 409);

  const { data: updated, error: updateError } = await db.from("drips").update(result.patch).eq("id", id)
    .eq("user_id", userId).eq("status", "paused").eq("chunks_written", row.chunks_written).select(DRIP_COLUMNS)
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new HttpError(409, "The session changed while resuming. Try again.");

  // Preserve fresh in-app attention notices. notifyUser throttles only repeat emails.
  await db.from("notifications").delete().eq("drip_id", id).eq("kind", "drip_attention");
  await logEvent(id, userId, "resumed", result.detail);
  await kickWorkerIfDue(Date.parse(String(result.patch.next_run_at)));
  return json({ drip: updated });
}

/** Pro users may replan only the unentered suffix of a safely paused session. */
async function editPausedSettings(userId: string, id: string, req: Request): Promise<Response> {
  await rateLimit(userId, "plan");
  const tier = await userPlan(userId);
  if (tier.plan !== "pro") throw new HttpError(403, "Editing paused session settings is a Pro feature.");
  if (!tier.agreed) throw new HttpError(403, "Accept the current Responsible Use Agreement first.");
  const body = await readJson<
    PlanBody & {
      confirmed?: boolean;
      updated_at?: string;
      remaining_text?: string;
      remaining_sha256?: string;
      remaining_text_format?: "plain" | "markdown" | "rich";
    }
  >(req);
  if (body.confirmed !== true) throw new HttpError(400, "Review and approve the changed settings first.");
  const db = adminClient();
  const { data, error } = await db.from("drips").select(`${RESUME_COLUMNS}, text, lease_id`)
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Session not found.");
  const row = data as unknown as EditableSession & { status: string; updated_at: string; lease_id: string | null };
  if (row.status !== "paused") throw new HttpError(409, "Pause the session before editing settings.");
  if (body.updated_at !== row.updated_at) throw new HttpError(409, "The session changed. Reload it before editing.");
  if (row.lease_id !== null) throw new HttpError(409, "The last edit is still finishing. Try again shortly.");
  const input = readPlanInput(body);
  if (input.mode === "as_soon_as_possible") {
    throw new HttpError(400, "Choose a duration or typing speed for the remaining text.");
  }
  let patch;
  try {
    if (body.remaining_text !== undefined && typeof body.remaining_text !== "string") {
      throw new Error("Remaining text must be text.");
    }
    if (body.remaining_text !== undefined && body.remaining_sha256 !== await sha256Hex(body.remaining_text)) {
      throw new Error("Approve the exact remaining text before saving.");
    }
    if (
      body.remaining_text_format !== undefined && !["plain", "markdown", "rich"].includes(body.remaining_text_format)
    ) throw new Error("Unsupported remaining text format.");
    patch = replanPaused(row, input, body.remaining_text, body.remaining_text_format);
  } catch (e) {
    throw new HttpError(422, e instanceof Error ? e.message : "These settings cannot be applied.");
  }
  const fullText = patch.source_chunks.join("");
  if (fullText.length > 200_000) throw new HttpError(422, "The whole session must stay within 200,000 characters.");
  const replacementDoc = body.remaining_text === undefined
    ? null
    : parseFormatted(body.remaining_text, body.remaining_text_format ?? "plain") ?? plainDocument(body.remaining_text);
  const keepStyles = (row.text_format ?? "plain") !== "plain" || body.remaining_text_format === "rich" ||
    body.remaining_text_format === "markdown";
  const savedSource = replacementDoc && keepStyles
    ? JSON.stringify(replaceFormattedTail(
      parseFormatted(row.text, row.text_format ?? "plain") ?? plainDocument(row.text),
      fullText.length - replacementDoc.plain.length,
      replacementDoc,
    ))
    : fullText;
  const textPatch = body.remaining_text === undefined ? {} : {
    text: savedSource,
    text_format: keepStyles ? "rich" : "plain",
    word_count: countWords(fullText),
    text_sha256: await sha256Hex(savedSource),
    approved_at: new Date().toISOString(),
  };
  const { data: updated, error: saveError } = await db.from("drips").update({ ...patch, ...textPatch })
    .eq("id", id).eq("user_id", userId).eq("status", "paused").eq("updated_at", row.updated_at)
    .eq("chunks_written", row.chunks_written).is("pending_index", null).select(DRIP_COLUMNS).maybeSingle();
  if (saveError) throw new Error(saveError.message);
  if (!updated) throw new HttpError(409, "The session changed while saving. Reload and try again.");
  await logEvent(id, userId, "settings_updated", {
    insertion_unit: patch.insertion_unit,
    pacing: patch.pacing,
    remaining_edits: patch.total_chunks - row.chunks_written,
    text_changed: body.remaining_text !== undefined,
    text_sha256: body.remaining_text !== undefined ? textPatch.text_sha256 : undefined,
    approved_at: body.remaining_text !== undefined ? textPatch.approved_at : undefined,
  });
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
    .select(
      "connection_id, document_id, status, chunks, chunk_deletions, chunks_written, resync_index, resync_tail, insert_target",
    )
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
  const report = await checkAccess(
    providerFor(connection, (data.insert_target ?? null) as InsertTarget | null),
    data.document_id,
    tail,
  );
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

  if (
    connection.provider === "google" && connection.refresh_token_enc &&
    !(await hasOtherGoogleGrant(connection.id, connection.account_email))
  ) {
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

/**
 * Deletes the account. Stops unfinished sessions, revokes Google access, then
 * deletes the user; the database removes their sessions, logs, notifications
 * and connections with it (trial_claims keeps an anonymous row so a trial
 * can't be claimed twice). Documents themselves are never touched.
 */
async function deleteAccount(userId: string, email: string | null, req: Request): Promise<Response> {
  const body = await readJson<{ confirm_email?: string }>(req);
  if (!email || (body.confirm_email ?? "").trim().toLowerCase() !== email.toLowerCase()) {
    throw new HttpError(400, "Type your account's email address to confirm.");
  }
  const db = adminClient();
  const { data: profile, error: profileError } = await db.from("profiles").select(
    "subscription_status, stripe_customer_id",
  ).eq(
    "user_id",
    userId,
  ).maybeSingle();
  if (profileError || !profile) throw new HttpError(503, "Your billing status could not be checked. Please try again.");
  const subscriptions = profile?.stripe_customer_id
    ? await customerSubscriptions(requireEnv("STRIPE_SECRET_KEY"), profile.stripe_customer_id)
    : [];
  if (
    subscriptions.some((s) => subscriptionHasNotEnded(s.status)) ||
    (!profile?.stripe_customer_id && subscriptionHasNotEnded(profile?.subscription_status))
  ) {
    throw new HttpError(409, "Cancel Pro in Plan & billing first, so you aren't charged again.");
  }

  const { error: stopError } = await db.from("drips").update({ status: "canceled", next_run_at: null })
    .eq("user_id", userId).in("status", ACTIVE_STATUSES);
  if (stopError) throw new Error(stopError.message);

  const { data: connections } = await db.from("provider_connections").select(
    "id, provider, account_email, refresh_token_enc",
  )
    .eq("user_id", userId);
  for (const connection of connections ?? []) {
    if (
      connection.provider !== "google" || !connection.refresh_token_enc ||
      await hasOtherGoogleGrant(connection.id, connection.account_email, userId)
    ) continue;
    try {
      await revokeGoogleToken(await decrypt(connection.refresh_token_enc, await encryptionKey()));
    } catch (error) {
      console.error("Couldn't revoke Google token", error);
    }
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return json({ deleted: true });
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
  "conflict_runs",
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
        "word_count, chunks_written, total_chunks, access_expires_at",
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
    access_expires_at?: string | null;
  };
  if (row.provider !== "microsoft") throw new HttpError(409, "This session runs on TypeWit's servers.");
  if (
    row.access_expires_at && Date.parse(row.access_expires_at) <= Date.now() && (await userPlan(userId)).plan === "free"
  ) {
    if (["running", "scheduled"].includes(row.status)) {
      await db.from("drips").update({
        status: "paused",
        paused_at: new Date().toISOString(),
        attention: "access_expired",
        next_run_at: null,
        lease_id: null,
        last_error: "Your Day Pass has expired. Renew access to resume.",
      }).eq("id", id).in("status", ["running", "scheduled"]);
    }
    if (body.op === "control" || body.op === "claim") {
      return json({ row: null, status: "paused", lease_id: null, attention: "access_expired" });
    }
    if (body.op !== "confirm" && body.op !== "log") {
      throw new HttpError(403, "Your Day Pass has expired. Renew access to resume.");
    }
  }

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
      return json({
        status: row.status,
        lease_id: row.lease_id,
        chunks_written: row.chunks_written,
        access_expires_at: row.access_expires_at,
      });
    case "update":
    case "confirm": {
      const patch = enginePatch(body.patch);
      let query = db.from("drips").update(patch).eq("id", id).eq("user_id", userId);
      if (body.op === "update") {
        if (typeof body.lease !== "string" || !UUID_RE.test(body.lease)) throw new HttpError(400, "lease is required.");
        query = query.eq("lease_id", body.lease).eq("status", "running");
      } else {
        validateConfirmPatch(patch, body.expected, row.total_chunks);
        query = query.eq("chunks_written", body.expected!).in("status", ["running", "paused"]);
      }
      const { data, error: updateError } = await query.select("id");
      if (updateError) {
        throw new HttpError(400, "The session changed or the update was not valid. Refresh and try again.");
      }
      const ok = (data ?? []).length > 0;
      if (ok && body.op === "update" && (patch.status === "completed" || patch.status === "paused")) {
        await notifyUser(row, patch.status === "completed" ? "drip_completed" : "drip_attention");
      }
      return json({ ok });
    }
    case "log": {
      const events = validateEngineEvents(body.events ?? []);
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

/** A Google document's headings, for choosing where the text goes (Pro). */
async function listHeadings(userId: string, params: URLSearchParams): Promise<Response> {
  const connectionId = params.get("connection_id") ?? "";
  const documentId = params.get("document_id") ?? "";
  if (!UUID_RE.test(connectionId)) throw new HttpError(400, "connection_id is required.");
  if (!documentId || documentId.length > 2000) throw new HttpError(400, "document_id is required.");
  const { plan } = await userPlan(userId);
  if (plan !== "pro") throw new HttpError(403, PRO_ONLY_MESSAGES.headings);
  const connection = await loadConnection(connectionId, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");
  if (connection.provider === "microsoft") {
    throw new HttpError(409, "Adding text under a heading works with Google Docs for now.");
  }
  const provider = providerFor(connection);
  if (!provider.listHeadings) return json({ headings: [] });
  const headings = await withProviderErrors(() => provider.listHeadings!(documentId));
  return json({ headings });
}

async function createDocument(userId: string, req: Request): Promise<Response> {
  const body = await readJson<{ connection_id?: string; title?: string }>(req);
  if (!body.connection_id || !UUID_RE.test(body.connection_id)) {
    throw new HttpError(400, "connection_id is required.");
  }
  const connection = await loadConnection(body.connection_id, userId);
  if (!connection) throw new HttpError(404, "Connection not found.");

  if (body.title !== undefined && typeof body.title !== "string") throw new HttpError(400, "title must be text.");
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
      if (error.code === HEADING_MISSING || error.code === HEADING_NO_SPACE) throw new HttpError(422, error.message);
      if (error.kind === "auth") throw new HttpError(401, "Reconnect your Google account, then try again.");
      if (error.status === 404) throw new HttpError(404, "Document not found or not shared with TypeWit.");
      if (error.status === 403) throw new HttpError(403, "TypeWit doesn't have access to that document.");
      throw new HttpError(502, "The document provider could not complete this request. Please try again.");
    }
    throw error;
  }
}

/**
 * The worker runs on cron ticks at the start of each minute. When the next
 * insertion is due before the next tick, start a worker run now so it isn't
 * late. Best effort: the next tick picks the session up anyway.
 */
let workerKick: Promise<void> | null = null;
let kickAgain = false;
async function kickWorkerIfDue(dueAt: number): Promise<void> {
  if (!(dueAt < nextTickAfter(Date.now()))) return;
  if (workerKick) {
    kickAgain = true;
    return await workerKick;
  }
  workerKick = (async () => {
    do {
      kickAgain = false;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await sendWorkerKick();
    } while (kickAgain);
  })().finally(() => {
    workerKick = null;
  });
  return await workerKick;
}
async function sendWorkerKick(): Promise<void> {
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

/** Revoking a Google grant affects every TypeWit account using that identity.
 * Unknown legacy identities are conservatively forgotten without revocation.
 */
async function hasOtherGoogleGrant(id: string, email: string | null, excludingUser?: string): Promise<boolean> {
  if (!email) return true;
  let query = adminClient().from("provider_connections").select("id", { count: "exact", head: true })
    .eq("provider", "google").ilike("account_email", email.replace(/[\\%_]/g, "\\$&"))
    .neq("id", id).or("refresh_token_enc.not.is.null,access_token_enc.not.is.null");
  if (excludingUser) query = query.neq("user_id", excludingUser);
  const { count, error } = await query;
  if (error) return true; // A failed lookup must never revoke someone else's working grant.
  return (count ?? 0) > 0;
}

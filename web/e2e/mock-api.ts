// Local stand-in for Supabase during browser tests: serves the static build
// from out/ and answers the API the pages call. Plans, progress and resumes use
// TypeWit's real server modules, so the browser sees exactly what the API
// would return. POST /__test/* endpoints move a session along.
//
// Run with: node --experimental-transform-types e2e/mock-api.ts

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { planSession } from "../../supabase/functions/_shared/plan.ts";
import { computeProgress } from "../../supabase/functions/_shared/progress.ts";
import { planResume } from "../../supabase/functions/_shared/session.ts";

const PORT = Number(process.env.MOCK_PORT ?? 54399);
const OUT = join(import.meta.dirname, "..", "out");
const TERMS = "2026-10-17";

interface Row {
  id: string;
  user_id: string;
  connection_id: string;
  provider: "google" | "microsoft";
  document_id: string;
  document_title: string;
  document_url: string;
  status: string;
  insertion_unit: string;
  mode: string;
  word_count: number;
  total_chunks: number;
  duration_seconds: number;
  chunks: string[];
  chunks_written: number;
  schedule: number[];
  session_started_at: string;
  schedule_shift_seconds: number;
  paused_at: string | null;
  last_written_at: string | null;
  next_run_at: string | null;
  completed_at: string | null;
  created_at: string;
  approved_at: string;
  attention: string | null;
  last_error: string | null;
  pending_index: number | null;
  pending_revision: string | null;
  pending_doc_length: number | null;
  resync_index: number;
  resync_tail: string;
  /** What the mock Google Doc contains. */
  doc: string;
  breaks: { after_index: number; start_ms: number; duration_ms: number }[];
  timing_mode: string;
  pacing: unknown;
  retry_at: string | null;
  attempts: number;
  request_id: string | null;
  lease_id: string | null;
  preflight_at: string | null;
  document_baseline_length: number | null;
  last_revision_id: string | null;
  [field: string]: unknown;
}

/** What the Word add-in may change through POST /drips/:id/engine, as on the server. */
const ENGINE_FIELDS = new Set([
  "status", "next_run_at", "lease_id", "paused_at", "completed_at", "attention", "last_error", "deadline_at",
  "chunks_written", "schedule_shift_seconds", "attempts", "pending_index", "pending_revision", "pending_doc_length",
  "retry_at", "last_revision_id", "last_written_at", "resync_index", "resync_tail", "document_baseline_length",
  "preflight_at",
]);

const drips = new Map<string, Row>();
const events = new Map<string, { kind: string; detail: Record<string, unknown>; created_at: string }[]>();
/** Requests the pages made, for assertions. */
const requests: { method: string; path: string; body: unknown }[] = [];

function log(id: string, kind: string, detail: Record<string, unknown> = {}) {
  events.get(id)!.unshift({ kind, detail, created_at: new Date().toISOString() });
}

function view(row: Row, includeText: boolean) {
  const { chunks: _c, schedule, ...rest } = row;
  const { written_text, remaining_text, next_part, ...progress } = computeProgress(row, new Date());
  return includeText
    ? { ...rest, schedule, progress: { ...progress, written_text, remaining_text, next_part } }
    : { ...rest, progress };
}

function planFrom(body: Record<string, unknown>, seed: number) {
  return planSession({
    text: String(body.text ?? ""),
    unit: (body.insertion_unit ?? "sentence") as never,
    mode: body.mode as never,
    pacing: body.pacing as never,
    durationSeconds: Math.round(Number(body.duration_minutes) * 60),
    seed,
    plan: "pro",
  });
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function api(req: IncomingMessage, res: ServerResponse, path: string) {
  const method = req.method ?? "GET";
  const body = method === "POST" || method === "PATCH" ? await readBody(req) : {};
  requests.push({ method, path, body });

  if (path.startsWith("/rest/v1/profiles")) {
    const profile = {
      plan: "pro",
      subscription_status: "active",
      email_notifications: true,
      agreed_terms_version: TERMS,
      words_used_today: 0,
      usage_date: "",
    };
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    return send(res, 200, single ? profile : [profile]);
  }
  if (path.startsWith("/rest/v1/")) return send(res, 200, []);
  if (path.startsWith("/auth/v1/")) return send(res, 200, {});

  const parts = path.replace(/^\/functions\/v1\/drips\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "connections" && parts[1] === "microsoft") {
    return send(res, 201, { connection: { id: "m1", provider: "microsoft", account_email: "me@gmail.com" } });
  }
  if (parts[0] === "connections" && parts[2] === "picker") {
    return send(res, 200, { access_token: "picker-token", app_id: "654277390095", api_key: null });
  }
  if (parts[0] === "connections") {
    return send(res, 200, { connections: [{ id: "c1", provider: "google", account_email: "me@gmail.com", connected: true }] });
  }
  if (parts.length === 0 && method === "GET") {
    return send(res, 200, { drips: [...drips.values()].map((d) => view(d, false)) });
  }
  if (parts[0] === "plan") {
    const plan = planFrom(body, typeof body.schedule_seed === "number" ? body.schedule_seed : Math.floor(Math.random() * 2 ** 32));
    const { units, ...rest } = plan;
    return send(res, 200, { plan: { ...rest, unit_count: units.length, unit_lengths: units.map((u) => u.length) } });
  }
  if (parts[0] === "check") {
    const report = {
      ok: true,
      problem: null,
      message: "Connection works. Nothing in the document was changed.",
      checks: [
        { key: "account", label: "Google account", ok: true, detail: "Access works." },
        body.document_id
          ? { key: "document", label: "Document", ok: true, detail: "Opened." }
          : { key: "document", label: "Document", ok: null, detail: "A new document is created when you start." },
      ],
      content_unchanged: true,
      checked_at: new Date().toISOString(),
    };
    return send(res, 200, { report });
  }
  if (parts[0] === "clear") {
    let deleted = 0;
    for (const [id, row] of drips) {
      if (["completed", "canceled", "failed"].includes(row.status)) {
        drips.delete(id);
        deleted++;
      }
    }
    return send(res, 200, { deleted });
  }
  if (parts.length === 0 && method === "POST") {
    const existing = [...drips.values()].find((d) => body.request_id && d.request_id === body.request_id);
    if (existing) return send(res, 200, { drip: view(existing, false), duplicate: true });
    const plan = planFrom(body, Number(body.schedule_seed ?? 1));
    if (!plan.ok) return send(res, 422, { error: plan.problems[0].message, problems: plan.problems });
    const id = `00000000-0000-4000-8000-${String(drips.size + 1).padStart(12, "0")}`;
    const now = new Date().toISOString();
    const word = body.connection_id === "m1";
    const row: Row = {
      id,
      user_id: "u1",
      connection_id: word ? "m1" : "c1",
      provider: word ? "microsoft" : "google",
      document_id: word ? String(body.document_id) : "doc1",
      document_title: String(body.document_title ?? body.new_document_title ?? "Essay"),
      document_url: word ? String(body.document_id) : "https://docs.google.com/document/d/doc1/edit",
      status: "scheduled",
      insertion_unit: String(body.insertion_unit ?? "sentence"),
      mode: String(body.mode ?? "scheduled"),
      word_count: plan.words,
      total_chunks: plan.units.length,
      duration_seconds: plan.duration_seconds,
      chunks: plan.units,
      chunks_written: 0,
      schedule: plan.schedule,
      session_started_at: now,
      schedule_shift_seconds: 0,
      paused_at: null,
      last_written_at: null,
      next_run_at: now,
      completed_at: null,
      created_at: now,
      approved_at: now,
      attention: null,
      last_error: null,
      pending_index: null,
      pending_revision: null,
      pending_doc_length: null,
      resync_index: 0,
      resync_tail: "",
      doc: "",
      breaks: plan.breaks,
      timing_mode: body.mode === "as_soon_as_possible" ? "asap" : plan.pacing?.timing ?? "duration",
      pacing: plan.pacing,
      retry_at: null,
      attempts: 0,
      request_id: (body.request_id as string) ?? null,
      lease_id: null,
      preflight_at: null,
      document_baseline_length: null,
      last_revision_id: null,
    };
    drips.set(id, row);
    events.set(id, []);
    log(id, "approved");
    log(id, "created", { finish_at: new Date(Date.now() + plan.schedule.at(-1)!).toISOString() });
    return send(res, 201, { drip: view(row, false) });
  }

  const row = drips.get(parts[0]);
  if (!row) return send(res, 404, { error: "Drip not found." });
  if (parts.length === 1) return send(res, 200, { drip: view(row, true), events: events.get(row.id) });

  const now = Date.now();
  switch (parts[1]) {
    case "pause":
      Object.assign(row, { status: "paused", paused_at: new Date(now).toISOString(), attention: null });
      log(row.id, "paused", { by: "user" });
      return send(res, 200, { drip: view(row, false) });
    case "check":
      return send(res, 200, {
        report: {
          ok: true,
          problem: null,
          message: "Connection works. Nothing in the document was changed.",
          checks: [
            { key: "account", label: "Google account", ok: true, detail: "Access works." },
            { key: "document", label: "Document", ok: true, detail: "Opened." },
            { key: "editable", label: "Editing", ok: true, detail: "Edits are allowed (checked without changing anything)." },
            { key: "location", label: "Insertion point", ok: true, detail: "The document ends with the text TypeWit entered." },
          ],
          content_unchanged: true,
          checked_at: new Date().toISOString(),
        },
      });
    case "delete":
      if (!["completed", "canceled", "failed"].includes(row.status)) return send(res, 409, { error: "Stop the session before deleting it." });
      drips.delete(row.id);
      return send(res, 200, { deleted: 1 });
    case "cancel":
      Object.assign(row, { status: "canceled" });
      log(row.id, "canceled");
      return send(res, 200, { drip: view(row, false) });
    case "engine":
      try {
        return engine(res, row, body);
      } catch (error) {
        return send(res, 400, { error: String(error) });
      }
    case "resume": {
      // The Word add-in sends the document's text; Google documents are read by the server.
      const text = row.provider === "microsoft"
        ? String((body.document as { text?: string } | undefined)?.text ?? "")
        : `${row.doc}\n`;
      const result = planResume(row, now, { revisionId: "r2", text }, body);
      if (!result.ok) return send(res, 409, { error: result.message, attention: result.attention });
      Object.assign(row, result.patch);
      log(row.id, "resumed", result.detail);
      return send(res, 200, { drip: view(row, false) });
    }
  }
  return send(res, 404, { error: "Not found." });
}

/** The Word add-in's store, with the server's rules: claim by document, lease-guarded updates, guarded confirms. */
function engine(res: ServerResponse, row: Row, body: Record<string, unknown>) {
  if (row.provider !== "microsoft") return send(res, 409, { error: "This session runs on TypeWit's servers." });
  const patchOf = (raw: unknown) => {
    const patch = raw as Record<string, unknown>;
    for (const key of Object.keys(patch)) if (!ENGINE_FIELDS.has(key)) throw new Error(`can't change ${key}`);
    return patch;
  };
  const now = Date.now();
  switch (body.op) {
    case "claim": {
      if (body.document_id !== row.document_id) return send(res, 409, { error: "This session belongs to a different Word document." });
      const due = row.next_run_at !== null && Date.parse(row.next_run_at) <= now + 60_000;
      if (["scheduled", "running"].includes(row.status) && due) {
        Object.assign(row, { status: "running", next_run_at: new Date(now + 240_000).toISOString(), lease_id: crypto.randomUUID() });
        return send(res, 200, { row, status: row.status, next_run_at: row.next_run_at });
      }
      return send(res, 200, { row: null, status: row.status, next_run_at: row.next_run_at });
    }
    case "control":
      return send(res, 200, { status: row.status, lease_id: row.lease_id });
    case "update": {
      const patch = patchOf(body.patch);
      const ok = row.lease_id === body.lease && row.status === "running";
      if (ok) Object.assign(row, patch);
      return send(res, 200, { ok });
    }
    case "confirm": {
      const patch = patchOf(body.patch);
      const ok = row.chunks_written === body.expected;
      if (ok) Object.assign(row, patch);
      return send(res, 200, { ok });
    }
    case "log":
      for (const e of (body.events as { kind: string; detail: Record<string, unknown> }[]) ?? []) log(row.id, e.kind, e.detail);
      return send(res, 200, { logged: true });
  }
  return send(res, 400, { error: "Unknown op." });
}

/** Test hooks: move a session along without waiting for real time. */
async function testHook(req: IncomingMessage, res: ServerResponse, path: string) {
  const body = await readBody(req);
  if (path === "/__test/requests") return send(res, 200, { requests });
  if (path === "/__test/reset") {
    drips.clear();
    events.clear();
    requests.length = 0;
    return send(res, 200, {});
  }
  const row = drips.get(String(body.id));
  if (!row) return send(res, 404, { error: "no such drip" });
  if (path === "/__test/advance") {
    const to = Math.min(row.total_chunks, Number(body.written));
    for (let i = row.chunks_written; i < to; i++) {
      const at = new Date().toISOString();
      log(row.id, "chunk_written", {
        index: i,
        written: i + 1,
        total: row.total_chunks,
        chars: row.chunks[i].length,
        planned_at: at,
        actual_at: at,
        late_seconds: 0,
      });
    }
    Object.assign(row, { chunks_written: to, doc: row.chunks.slice(0, to).join(""), status: to >= row.total_chunks ? "completed" : "running", last_written_at: new Date().toISOString() });
    if (row.status === "completed") {
      row.completed_at = new Date().toISOString();
      log(row.id, "completed", { text_at_end_matches: true, provider_revisions: { count: 4, in_window: 3 } });
    }
  }
  if (path === "/__test/attention") {
    Object.assign(row, {
      status: "paused",
      paused_at: new Date().toISOString(),
      attention: body.attention,
      last_error: String(body.message ?? "Needs attention."),
      pending_index: body.attention === "confirm_last_part" ? row.chunks_written : null,
      pending_revision: "r1",
    });
    // The interrupted part did land, but repeated text means the document alone can't tell.
    if (body.attention === "confirm_last_part") row.doc += row.chunks[row.chunks_written];
    log(row.id, "attention", { reason: body.attention, message: row.last_error });
    log(row.id, "paused", { by: "system", reason: body.attention });
  }
  return send(res, 200, { drip: view(row, true) });
}

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".json": "application/json",
};

async function staticFile(res: ServerResponse, path: string) {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [join(OUT, safe), join(OUT, safe, "index.html"), join(OUT, `${safe}.html`)]) {
    try {
      if ((await stat(candidate)).isFile()) {
        res.writeHead(200, { "Content-Type": TYPES[extname(candidate)] ?? "application/octet-stream" });
        return res.end(await readFile(candidate));
      }
    } catch { /* try the next candidate */ }
  }
  res.writeHead(404, { "Content-Type": "text/html" });
  res.end(await readFile(join(OUT, "404.html")).catch(() => "Not found"));
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (path.startsWith("/__test/")) return void testHook(req, res, path);
  if (/^\/(rest|auth|functions|realtime)\/v1\//.test(path)) return void api(req, res, path);
  return void staticFile(res, path);
}).listen(PORT, () => console.log(`mock api on http://localhost:${PORT}`));

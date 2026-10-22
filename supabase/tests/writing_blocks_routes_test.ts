import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { planSession, standardPacing } from "../functions/_shared/plan.ts";
import { CURRENT_TERMS_VERSION } from "../functions/_shared/terms.ts";

type Handler = (req: Request) => Promise<Response>;
Deno.test("real routes parse blocks, enforce Day Pass expiry and preview paused edits without writes", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map((name) => Deno.env.get(name));
  const fetch = globalThis.fetch, serve = Deno.serve;
  let handler!: Handler;
  let writes = 0, tier = "free", passHours: number | null = 3;
  const id = crypto.randomUUID(), owner = crypto.randomUUID();
  const now = Date.now();
  const text = "Approved sentence. ".repeat(20);
  const pacing = {
    ...standardPacing(7200),
    writing_blocks: { writing_duration_seconds: 7200, block_seconds: 3600, break_seconds: 21600 },
  };
  const original = planSession({ text, unit: "sentence", seed: 7, plan: "pro", pacing });
  assert(original.ok);
  const row = {
    id,
    user_id: owner,
    text,
    text_format: "plain",
    chunks: original.units,
    chunk_deletions: original.chunk_deletions,
    source_chunks: original.source_chunks,
    source_unit_ends: original.source_unit_ends,
    action_kinds: original.action_kinds,
    total_chunks: original.units.length,
    chunks_written: 0,
    schedule: original.schedule,
    breaks: original.breaks,
    pacing: original.pacing,
    session_started_at: new Date(now).toISOString(),
    schedule_shift_seconds: 0,
    paused_at: new Date(now).toISOString(),
    status: "paused",
    lease_id: null,
    attention: null,
    pending_index: null,
    last_written_at: null,
    updated_at: new Date(now).toISOString(),
  };
  try {
    Deno.env.set(names[0], "http://database.invalid");
    Deno.env.set(names[1], "fixture-service");
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (init?.method && !["GET", "HEAD"].includes(init.method)) {
        if (!url.pathname.endsWith("/rpc/hit_rate_limit")) writes++;
      }
      if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, role: "authenticated" });
      if (url.pathname.endsWith("/profiles")) {
        return Response.json({
          plan: tier,
          agreed_terms_version: CURRENT_TERMS_VERSION,
          day_pass_expires_at: passHours === null ? null : new Date(now + passHours * 3600000).toISOString(),
          eligibility_blocked_at: null,
        });
      }
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json(true);
      if (url.pathname.endsWith("/drips")) return Response.json(row);
      throw new Error(`Unexpected fixture path ${url.pathname}`);
    }) as typeof globalThis.fetch;
    Object.defineProperty(Deno, "serve", { value: (fn: Handler) => handler = fn, configurable: true, writable: true });
    await import(`../functions/drips/index.ts?writing-blocks-routes`);
    const call = (path: string, body: unknown) =>
      handler(
        new Request(`http://fixture.invalid/drips/${path}`, {
          method: "POST",
          headers: { authorization: "Bearer fixture", "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const expired = await call("plan", { text, rhythm: "natural", insertion_unit: "sentence", pacing });
    const invalid = (await expired.json()).plan;
    assert(!invalid.ok);
    assert(invalid.problems[0].resume_at);
    assert(invalid.problems[0].expires_at);
    passHours = 24;
    const valid =
      (await (await call("plan", { text, rhythm: "natural", insertion_unit: "sentence", pacing })).json()).plan;
    assert(valid.ok);
    assertEquals(valid.pacing.writing_blocks.break_seconds, 21600);
    assertEquals(valid.duration_seconds, 28800);
    passHours = null;
    const denied = (await (await call("plan", { text, insertion_unit: "sentence", pacing })).json()).plan;
    assert(!denied.ok);
    assert(denied.problems.some((p: { code: string }) => p.code === "pro_feature"));
    tier = "pro";
    const preview = await call(`${id}/settings`, {
      preview: true,
      updated_at: row.updated_at,
      insertion_unit: "sentence",
      pacing,
    });
    assertEquals(preview.status, 200);
    assert((await preview.json()).preview.finish_at);
    assertEquals(writes, 0);
    assertEquals(row.status, "paused");
  } finally {
    globalThis.fetch = fetch;
    Object.defineProperty(Deno, "serve", { value: serve, configurable: true, writable: true });
    names.forEach((name, i) => before[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, before[i]!));
  }
});

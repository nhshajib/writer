import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker, T0 } from "./fakes.ts";
import { MAX_RUN_MS, planResume, runSession } from "../functions/_shared/session.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";
import { planSession, standardPacing } from "../functions/_shared/plan.ts";
import { buildPacing } from "../functions/_shared/pacing.ts";

Deno.test("audit 1: 30-minute character sessions with 4–5 second gaps finish on plan across every tick", async () => {
  for (const gap of [4000, 4500, 5000]) {
    const clock = new Clock();
    const count = Math.floor(1800000 / gap);
    const row = makeSession("x".repeat(count), { clock, unit: "character", minutes: 30 });
    row.schedule = row.chunks.map((_, i) => (i + 1) * gap);
    row.next_run_at = new Date(T0 + gap).toISOString();
    const store = new FakeStore(row, clock);
    const doc = new FakeDoc(clock);
    doc.latencyMs = gap === 4000 ? 0 : 100;
    await runWorker(store, doc, clock, T0 + 1860000);
    assertEquals(store.row.status, "completed");
    assert(doc.writes.at(-1)!.at <= T0 + row.schedule.at(-1)! + 3000);
    assertEquals(store.row.schedule_shift_seconds, 0);
    assertEquals(doc.content, row.chunks.join(""));
  }
});

Deno.test("audit 8: enormous duration is rejected before planning breaks, with plan-limit messaging", () => {
  for (const plan of ["free", "pro"] as const) {
    const result = planSession({ text: "Test text.", unit: "sentence", seed: 1, plan, pacing: standardPacing(1e300) });
    assertEquals(result.ok, false);
    assert(result.problems.some((p) => p.code === "duration_over_plan"));
    assertEquals(result.schedule, []);
  }
  assertThrows(() => buildPacing(["x"], [1], standardPacing(1e300), 1));
});

Deno.test("audit 14: persistent revision conflicts eventually ask for attention; short conflicts still recover", async () => {
  for (const persistent of [true, false]) {
    const clock = new Clock();
    const store = new FakeStore(makeSession("Test text.", { clock, minutes: 1 }), clock);
    const doc = new FakeDoc(clock);
    doc.failures.write = Array.from({ length: persistent ? 100 : 2 }, () => ({
      error: new ProviderError("conflict", "Concurrent change", 400),
    }));
    await runWorker(store, doc, clock, T0 + 20 * 60000);
    assertEquals(store.row.status, persistent ? "paused" : "completed");
    if (persistent) assertEquals(store.row.attention, "document_changed");
    else assertEquals(doc.content, "Test text.");
  }
});

Deno.test("audit 16: repeated project quota responses never exhaust connection retries", async () => {
  const clock = new Clock();
  const store = new FakeStore(makeSession("Test text.", { clock, minutes: 1 }), clock);
  const doc = new FakeDoc(clock);
  doc.failures.write = Array.from({ length: 8 }, () => ({ error: new ProviderError("transient", "Quota", 429) }));
  await runWorker(store, doc, clock, T0 + 30 * 60000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.content, "Test text.");
});

Deno.test("audit 18: an expired window performs no provider I/O or conflict retries", async () => {
  const clock = new Clock();
  const row = Object.assign(makeSession("Test text.", { clock, minutes: 1 }), { status: "running", lease_id: "lease" });
  const store = new FakeStore(row, clock);
  const doc = new FakeDoc(clock);
  assertEquals(
    await runSession(structuredClone(row), "lease", {
      provider: doc,
      store,
      now: () => clock.now,
      sleep: clock.sleep,
      deadline: clock.now,
    }),
    "waiting",
  );
  assertEquals(doc.reads, 0);
  assertEquals(doc.writes.length, 0);
});

Deno.test("audit 13: database failure escapes the engine for lease recovery, without document attention", async () => {
  const clock = new Clock();
  const row = Object.assign(makeSession("Test text.", { clock, minutes: 1 }), {
    status: "running",
    lease_id: "lease",
    preflight_at: new Date(T0).toISOString(),
    schedule: [4000],
  });
  const store = new FakeStore(row, clock);
  store.control = () => Promise.reject(new Error("Database unavailable"));
  let error: unknown;
  try {
    await runSession(structuredClone(row), "lease", {
      provider: new FakeDoc(clock),
      store,
      now: () => clock.now,
      sleep: clock.sleep,
      deadline: T0 + MAX_RUN_MS,
    });
  } catch (e) {
    error = e;
  }
  assert(error instanceof Error);
  assertEquals(row.attention, null);
});

Deno.test("audit 15: an interrupted insertion in a drafting session accepts absent and a safe new end", () => {
  const clock = new Clock();
  const row = Object.assign(makeSession("Test text.", { clock, minutes: 1 }), {
    paused_at: new Date(T0).toISOString(),
    chunks: ["wrong", "", "Test text."],
    chunk_deletions: [0, 5, 0],
    source_unit_ends: [3],
    total_chunks: 3,
    schedule: [4000, 8000, 12000],
    pending_index: 0,
    pending_revision: "r1",
    pending_doc_length: 0,
    attention: "confirm_last_part",
  });
  const result = planResume(row, T0 + 60000, { revisionId: "r2", text: "Different testing text\n" }, {
    last_part: "absent",
    continue_from_current_end: true,
  });
  assertEquals(result.ok, true);
});

Deno.test("audit 30: invalid execution ranges pause permanently instead of retrying indefinitely", async () => {
  const clock = new Clock();
  const row = Object.assign(makeSession("Test text.", { clock, minutes: 1 }), {
    chunks_written: 1,
    chunks: ["x", "Test text."],
    chunk_deletions: [5, 0],
    total_chunks: 2,
    schedule: [4000, 60000],
    preflight_at: new Date(T0).toISOString(),
  });
  const store = new FakeStore(row, clock);
  await runWorker(store, new FakeDoc(clock), clock, T0 + 180000);
  assertEquals(row.status, "paused");
  assertEquals(row.attention, "insert_rejected");
});

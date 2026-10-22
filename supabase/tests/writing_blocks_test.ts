import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { planSession, standardPacing } from "../functions/_shared/plan.ts";
import { executionText } from "../functions/_shared/drafting.ts";
import { validateWritingBlocks } from "../functions/_shared/writingBlocks.ts";
import { computeProgress } from "../functions/_shared/progress.ts";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker, T0 } from "./fakes.ts";

const text = "An approved sentence. ".repeat(20);
const request = { text, unit: "sentence" as const, seed: 7, plan: "pro" as const };
function pacing(writing = 7200, block = 3600, rest = 10800) {
  return {
    ...standardPacing(writing),
    writing_blocks: { block_seconds: block, break_seconds: rest, writing_duration_seconds: writing },
  };
}
function fixture(rest: number, writing = 7200) {
  const clock = new Clock();
  const plan = planSession({ ...request, startsAt: T0, pacing: pacing(writing, 3600, rest) });
  assert(plan.ok, JSON.stringify(plan.problems));
  const row = makeSession(text, { clock });
  Object.assign(row, {
    chunks: plan.units,
    total_chunks: plan.units.length,
    schedule: plan.schedule,
    breaks: plan.breaks,
    source_chunks: plan.source_chunks,
    source_unit_ends: plan.source_unit_ends,
    chunk_deletions: plan.chunk_deletions,
    action_kinds: plan.action_kinds,
    next_run_at: new Date(T0 + plan.schedule[0]).toISOString(),
  });
  return { clock, plan, row, store: new FakeStore(row, clock), doc: new FakeDoc(clock) };
}
Deno.test("writing blocks add full rests without changing source, writing time or old schedules", () => {
  const base = planSession({ ...request, pacing: standardPacing(7200) });
  const explicitOff = planSession({ ...request, pacing: { ...standardPacing(7200), writing_blocks: null } });
  assertEquals(base.schedule, explicitOff.schedule);
  for (const tier of ["day_pass", "pro"] as const) {
    const plan = planSession({ ...request, plan: tier, pacing: pacing() });
    assert(plan.ok);
    assertEquals(plan.block_summary, { blocks: 2, writing_seconds: 7200, rest_seconds: 10800, waiting_seconds: 0 });
    assertEquals(plan.duration_seconds, 18000);
    assertEquals(plan.pacing?.duration_seconds, 18000);
    assertEquals(plan.pacing?.writing_blocks?.writing_duration_seconds, 7200);
    assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), text);
    assertEquals(plan.breaks.filter((b) => b.kind === "block").length, 1);
    assert(plan.breaks.every((b) => b.after_index < plan.units.length - 1));
  }
});
Deno.test("writing blocks validate finite ranges, plan gates, mode and total elapsed time", () => {
  for (
    const raw of [true, [], {}, { block_seconds: NaN, break_seconds: 900 }, {
      block_seconds: 300,
      break_seconds: 28801,
    }]
  ) assert(validateWritingBlocks(raw));
  assert(!planSession({ ...request, plan: "free", pacing: pacing() }).ok);
  assert(!planSession({ ...request, mode: "as_soon_as_possible", pacing: pacing() }).ok);
  assert(!planSession({ ...request, pacing: pacing(604800, 300, 28800) }).ok);
  assert(!planSession({ ...request, plan: "day_pass", pacing: pacing(86400, 300, 28800) }).ok);
  const short = planSession({ ...request, text: "Only one step.", pacing: pacing(600) });
  assert(short.ok);
  assertEquals(short.block_summary?.blocks, 1);
  assertEquals(short.block_summary?.rest_seconds, 0);
});
Deno.test("Day Pass checks every restart and finish including exact expiry and writing hours", () => {
  const base = planSession({ ...request, plan: "day_pass", startsAt: T0, pacing: pacing() });
  const rest = base.breaks.find((b) => b.kind === "block")!;
  const restart = T0 + base.schedule[rest.after_index + 1];
  for (const expiry of [restart - 1, restart]) {
    const plan = planSession({
      ...request,
      plan: "day_pass",
      startsAt: T0,
      pacing: pacing(),
      accessExpiresAt: new Date(expiry).toISOString(),
    });
    assert(!plan.ok);
    assertEquals(plan.problems[0].resume_at, new Date(restart).toISOString());
  }
  const lateFinish = planSession({
    ...request,
    plan: "day_pass",
    startsAt: T0,
    pacing: pacing(),
    accessExpiresAt: new Date(restart + 1000).toISOString(),
  });
  assert(!lateFinish.ok);
  assert(lateFinish.problems[0].finish_at);
  const valid = planSession({
    ...request,
    plan: "day_pass",
    startsAt: T0,
    pacing: pacing(),
    accessExpiresAt: new Date(T0 + 18000001).toISOString(),
  });
  assert(valid.ok);
  const projected = planSession({
    ...request,
    plan: "day_pass",
    startsAt: T0,
    pacing: pacing(),
    workWindow: { start: "09:00", end: "11:00", time_zone: "UTC" },
    accessExpiresAt: new Date(T0 + 86400000).toISOString(),
  });
  assert(!projected.ok);
  assert(planSession({ ...request, startsAt: T0, pacing: pacing(), accessExpiresAt: new Date(T0).toISOString() }).ok);
});
Deno.test("writing blocks only rest at complete correction and rich-text boundaries", () => {
  const plan = planSession({
    ...request,
    text: "**Approved words.** ".repeat(100),
    format: "markdown",
    rhythm: "drafting",
    pacing: pacing(7200, 300, 900),
  });
  assert(plan.ok);
  assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), "Approved words. ".repeat(100));
  for (const rest of plan.breaks.filter((b) => b.kind === "block")) {
    assert(plan.source_unit_ends.includes(rest.after_index + 1));
    const sourceCount = plan.source_unit_ends.indexOf(rest.after_index + 1) + 1;
    assertEquals(
      executionText(plan.units, plan.chunk_deletions, 0, rest.after_index + 1),
      plan.source_chunks.slice(0, sourceCount).join(""),
    );
  }
});
for (const hours of [6, 8]) {
  Deno.test(`worker automatically resumes after a ${hours}-hour rest, without holding a lease or duplicating text`, async () => {
    const { clock, plan, row, store, doc } = fixture(hours * 3600);
    const rest = plan.breaks.find((b) => b.kind === "block")!;
    await runWorker(store, doc, clock, T0 + rest.start_ms + 120000);
    assertEquals(row.chunks_written, rest.after_index + 1);
    assertEquals(row.lease_id, null);
    assert(Date.parse(row.next_run_at!) >= T0 + rest.start_ms + rest.duration_ms);
    const progress = computeProgress({ ...row, word_count: 60 }, new Date(clock.now));
    assertEquals(progress.current_break?.kind, "block");
    await runWorker(store, doc, clock, T0 + plan.duration_seconds * 1000 + 60000);
    assertEquals(row.status, "completed");
    assertEquals(doc.content, text);
    assert(doc.writes[rest.after_index + 1].at - doc.writes[rest.after_index].at >= hours * 3600000);
    assert(Math.abs(doc.writes.at(-1)!.at - (T0 + plan.duration_seconds * 1000)) < 5000);
  });
}
Deno.test("delayed confirmed writes preserve the full rest and the shift survives worker restarts", async () => {
  const { clock, plan, row, store, doc } = fixture(21600);
  doc.latencyMs = 6000;
  const rest = plan.breaks.find((b) => b.kind === "block")!;
  await runWorker(store, doc, clock, T0 + rest.start_ms + 120000);
  const shift = row.schedule_shift_seconds;
  assert(shift > 0);
  const count = doc.writes.length;
  await runWorker(store, doc, clock, Date.parse(row.next_run_at!) - 120000);
  assertEquals(doc.writes.length, count);
  assertEquals(row.schedule_shift_seconds, shift);
  await runWorker(store, doc, clock, T0 + plan.duration_seconds * 1000 + 600000);
  assertEquals(doc.content, text);
  assert(doc.writes[rest.after_index + 1].at - doc.writes[rest.after_index].at >= 21600000);
});
Deno.test("cancel, manual pause and pass expiry prevent automatic block continuation", async () => {
  for (const action of ["cancel", "pause", "expire"] as const) {
    const { clock, plan, row, store, doc } = fixture(21600);
    const rest = plan.breaks.find((b) => b.kind === "block")!;
    await runWorker(store, doc, clock, T0 + rest.start_ms + 120000);
    const count = doc.writes.length;
    if (action === "cancel") store.cancel();
    if (action === "pause") store.pause();
    if (action === "expire") row.access_expires_at = new Date(clock.now + 1000).toISOString();
    await runWorker(store, doc, clock, T0 + plan.duration_seconds * 1000 + 60000);
    assertEquals(doc.writes.length, count);
    if (action === "expire") assertEquals(row.attention, "access_expired");
    if (action === "pause") {
      assert((await store.resume(doc)).ok);
      await runWorker(store, doc, clock, clock.now + plan.duration_seconds * 1000);
      assertEquals(doc.content, text);
    }
  }
});

Deno.test("paused edits retain an outstanding rest unless the approved block settings replace it", async () => {
  const { replanPaused } = await import("../functions/_shared/replan.ts");
  const { plan, row } = fixture(21600);
  const rest = plan.breaks.find((b) => b.kind === "block")!;
  const pausedAt = T0 + rest.start_ms + 60000;
  const editable = {
    ...row,
    chunks_written: rest.after_index + 1,
    pacing: plan.pacing,
    text,
    paused_at: new Date(pausedAt).toISOString(),
    last_written_at: new Date(T0 + rest.start_ms).toISOString(),
  };
  const kept = replanPaused(editable, { unit: "sentence", seed: 7, pacing: pacing(3600, 3600, 21600) });
  assert(kept.breaks.some((b) => b.kind === "block" && b.after_index === rest.after_index));
  assert(kept.schedule[editable.chunks_written] >= rest.start_ms + rest.duration_ms);
  const changed = replanPaused(editable, { unit: "sentence", seed: 7, pacing: pacing(3600, 3600, 28800) });
  assert(!changed.breaks.some((b) => b.after_index === rest.after_index));
  assertEquals(kept.chunks.slice(0, editable.chunks_written), row.chunks.slice(0, editable.chunks_written));
});

Deno.test("lost write responses before a long rest recover once and preserve the approved source", async () => {
  const { ProviderError } = await import("../functions/_shared/providers/types.ts");
  const { clock, plan, row, store, doc } = fixture(21600);
  const rest = plan.breaks.find((b) => b.kind === "block")!;
  await runWorker(store, doc, clock, T0 + plan.schedule[rest.after_index - 1] + 10000);
  assertEquals(row.chunks_written, rest.after_index);
  doc.failures.write = [{ error: new ProviderError("transient", "fixture response lost"), applied: true }];
  await runWorker(store, doc, clock, T0 + plan.duration_seconds * 1000 + 300000);
  assertEquals(row.status, "completed");
  assertEquals(doc.content, text);
  assertEquals(doc.writes.length, plan.units.length);
});

Deno.test("writing-hours projection keeps block gaps and allowed times across daylight saving", async () => {
  const { writingClock } = await import("../functions/_shared/workWindow.ts");
  const startsAt = Date.parse("2026-11-01T04:30:00Z");
  const window = { start: "00:00", end: "04:00", time_zone: "America/New_York" };
  const allowed = writingClock(window);
  const plan = planSession({ ...request, startsAt, workWindow: window, pacing: pacing(7200, 1800, 900) });
  assert(plan.ok);
  for (const at of plan.schedule) assertEquals(allowed(startsAt + at), startsAt + at);
  for (const rest of plan.breaks.filter((b) => b.kind === "block")) {
    assert(plan.schedule[rest.after_index + 1] - plan.schedule[rest.after_index] >= 900000);
  }
});

Deno.test("resuming a paused pass rejects a future block restart past expiry, including shifted writing hours", async () => {
  const { planResume } = await import("../functions/_shared/session.ts");
  const { plan, row } = fixture(21600);
  const paused = {
    ...row,
    paused_at: new Date(T0).toISOString(),
    attention: null,
    access_expires_at: new Date(T0 + plan.duration_seconds * 1000 + 60000).toISOString(),
  };
  assert(planResume(paused, T0 + 1000, null, {}).ok);
  const delayed = planResume(paused, T0 + 7200000, null, {});
  assert(!delayed.ok);
  assertEquals(delayed.attention, "access_expired");
  assert(planResume({ ...paused, access_expires_at: null }, T0 + 7200000, null, {}).ok);
});

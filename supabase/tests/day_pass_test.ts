import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { checkCreateLimits, effectivePlan, PLAN_LIMITS } from "../functions/_shared/limits.ts";
import { readWorkWindow, windowSchedule, writingClock } from "../functions/_shared/workWindow.ts";
import { compileDrafting, DEFAULT_DRAFTING, executionText } from "../functions/_shared/drafting.ts";
import { planSession } from "../functions/_shared/plan.ts";
import { Clock, FakeDoc, FakeStore, makeSession, T0 } from "./fakes.ts";
import { runSession } from "../functions/_shared/session.ts";

Deno.test("pass entitlements expire exactly and never override a Pro subscription", () => {
  const expiry = new Date(T0 + 1000).toISOString();
  assertEquals(effectivePlan({ plan: "free", day_pass_expires_at: expiry }, T0), "day_pass");
  assertEquals(effectivePlan({ plan: "free", day_pass_expires_at: expiry }, T0 + 1000), "free");
  assertEquals(effectivePlan({ plan: "pro", day_pass_expires_at: expiry }, T0 + 2000), "pro");
  assertEquals(effectivePlan({ day_pass_expires_at: "invalid" }, T0), "free");
  assertEquals(PLAN_LIMITS.day_pass.maxActiveDrips, 1);
  const free = { plan: "free" as const, words: 250, textLength: 1000, durationSeconds: 3600, activeDrips: 0 };
  assertEquals(checkCreateLimits(free), null);
  assert(checkCreateLimits({ ...free, words: 251 }));
  assert(checkCreateLimits({ ...free, durationSeconds: 3601 }));
  assertEquals(checkCreateLimits({ ...free, plan: "day_pass", words: 10000, durationSeconds: 86400 }), null);
  assert(checkCreateLimits({ ...free, plan: "day_pass", durationSeconds: 86401 }));
  assert(checkCreateLimits({ ...free, plan: "day_pass", activeDrips: 1 }));
});

Deno.test("work hours reject invalid values and support daily, overnight and selected days", () => {
  for (
    const value of [
      [],
      1,
      { start: "09:00", end: "09:00", time_zone: "UTC" },
      { start: "25:00", end: "17:00", time_zone: "UTC" },
      { start: "09:00", end: "17:00", time_zone: "no-such-zone" },
      { start: "09:00", end: "17:00", time_zone: "UTC", days: [] },
    ]
  ) assertThrows(() => readWorkWindow(value));
  assertEquals(readWorkWindow(null), null);
  const daily = writingClock(readWorkWindow({ start: "09:00", end: "17:00", time_zone: "UTC" })!);
  assertEquals(daily(T0), T0);
  assertEquals(daily(Date.parse("2026-10-19T17:00:00Z")), T0 + 86400000);
  const overnight = writingClock(readWorkWindow({ start: "22:00", end: "02:00", time_zone: "UTC", days: [1] })!);
  const tuesday = Date.parse("2026-10-20T01:59:59Z");
  assertEquals(overnight(tuesday), tuesday);
  assertEquals(overnight(Date.parse("2026-10-20T02:00:00Z")), Date.parse("2026-10-26T22:00:00Z"));
});

Deno.test("work hours follow skipped and repeated DST wall-clock minutes", () => {
  const spring = writingClock({ start: "02:30", end: "04:00", time_zone: "America/New_York" });
  assertEquals(spring(Date.parse("2026-03-08T06:59:00Z")), Date.parse("2026-03-08T07:00:00Z"));
  const fall = writingClock({ start: "01:15", end: "01:45", time_zone: "America/New_York" });
  assertEquals(fall(Date.parse("2026-11-01T05:50:00Z")), Date.parse("2026-11-01T06:15:00Z"));
  const offsets = windowSchedule([0, 1000, 3000], Date.parse("2026-10-19T16:59:58Z"), {
    start: "09:00",
    end: "17:00",
    time_zone: "UTC",
  });
  assertEquals(offsets, [0, 1000, 57602000]);
});

Deno.test("final revision pass is opt-in, bounded to submitted text and restores Unicode exactly", () => {
  for (const text of ["Final word.", "বাংলা 👩🏽‍💻", "a\n\n", "café.", "1", "Last 😀", "Z!"]) {
    const script = compileDrafting([text], {
      ...DEFAULT_DRAFTING,
      typo_rate_pct: 0,
      false_start_rate_pct: 0,
      revision_sweep: true,
    }, 1);
    assertEquals(executionText(script.chunks, script.chunk_deletions, 0, script.chunks.length), text);
    assertEquals(
      executionText(script.chunks, script.chunk_deletions, 0, script.chunks.length, "Existing notes. "),
      "Existing notes. " + text,
    );
    assert(script.chunk_deletions.some((n) => n > 0));
    assertEquals(script.source_unit_ends.at(-1), script.chunks.length);
  }
  const base = { text: "Approved text.", unit: "word" as const, seed: 1, durationSeconds: 60, revisionSweep: true };
  assert(planSession({ ...base, plan: "pro" }).ok);
  assert(!planSession({ ...base, plan: "free" }).ok);
  assert(!planSession({ ...base, plan: "day_pass" }).ok);
  assert(!planSession({ ...base, plan: "pro", mode: "as_soon_as_possible" }).ok);
});

Deno.test("work-window plans preserve order and refuse elapsed durations over plan limits", () => {
  const base = {
    text: "First. Second.",
    unit: "sentence" as const,
    seed: 1,
    durationSeconds: 60,
    workWindow: { start: "10:00", end: "17:00", time_zone: "UTC" },
    startsAt: T0,
  };
  const plan = planSession({ ...base, plan: "day_pass" });
  assert(plan.ok);
  assert(plan.schedule[0] >= 3600000);
  assert(plan.schedule[1] > plan.schedule[0]);
  assert(!planSession({ ...base, plan: "free" }).ok);
  assert(
    !planSession({
      ...base,
      plan: "day_pass",
      workWindow: { start: "08:00", end: "08:01", time_zone: "UTC", days: [7] },
    }).ok,
  );
});

Deno.test("expired passes pause before provider access and preserve pending recovery", async () => {
  const clock = new Clock();
  const row = makeSession("First. Second.", { clock, minutes: 1 });
  Object.assign(row, {
    status: "running",
    lease_id: "fixture-lease",
    access_expires_at: new Date(T0).toISOString(),
    pending_index: 0,
    pending_revision: "r1",
    pending_doc_length: 1,
  });
  const doc = new FakeDoc(clock);
  const store = new FakeStore(row, clock);
  assertEquals(
    await runSession(row, "fixture-lease", {
      provider: doc,
      store,
      now: () => clock.now,
      sleep: clock.sleep,
      deadline: T0 + 100000,
    }),
    "paused",
  );
  assertEquals(row.attention, "access_expired");
  assertEquals(row.pending_index, 0);
  assertEquals(doc.reads, 0);
  assertEquals(doc.writes.length, 0);
});

Deno.test("closed writing hours release lease without touching a document", async () => {
  const clock = new Clock();
  const row = makeSession("First. Second.", { clock, minutes: 1 });
  Object.assign(row, {
    status: "running",
    lease_id: "fixture-lease",
    work_window: { start: "10:00", end: "17:00", time_zone: "UTC" },
  });
  const doc = new FakeDoc(clock);
  const store = new FakeStore(row, clock);
  assertEquals(
    await runSession(row, "fixture-lease", {
      provider: doc,
      store,
      now: () => clock.now,
      sleep: clock.sleep,
      deadline: T0 + 100000,
    }),
    "waiting",
  );
  assertEquals(row.next_run_at, new Date(T0 + 3600000).toISOString());
  assertEquals(row.lease_id, null);
  assertEquals(doc.reads, 0);
});

Deno.test("revision pass preserves every unit's recovery boundary and formatted correction spans", () => {
  for (const source of [["A", "."], ["First ", "last."], ["👩🏽‍💻", "!"], ["Line\n", "Z"]]) {
    const script = compileDrafting(source, {
      ...DEFAULT_DRAFTING,
      typo_rate_pct: 0,
      false_start_rate_pct: 0,
      revision_sweep: true,
    }, 1);
    let from = 0;
    script.source_unit_ends.forEach((to, i) => {
      assertEquals(executionText(script.chunks, script.chunk_deletions, from, to), source[i]);
      from = to;
    });
  }
  const plan = planSession({
    text: "**Bold final.**",
    format: "markdown",
    plan: "pro",
    unit: "word",
    durationSeconds: 60,
    revisionSweep: true,
    seed: 1,
  });
  assert(plan.ok);
  assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), "Bold final.");
  assert(plan.chunk_formats?.at(-1)?.spans.some((s) => s.bold));
});

Deno.test("renewal during an expired worker claim is observed before pausing", async () => {
  const clock = new Clock();
  const row = makeSession("Approved text.", { clock, minutes: 1 });
  Object.assign(row, { status: "running", lease_id: "fixture-lease", access_expires_at: new Date(T0).toISOString() });
  const store = new FakeStore(row, clock);
  const control = store.control.bind(store);
  store.control = async () => ({ ...await control(), access_expires_at: null });
  const doc = new FakeDoc(clock);
  const outcome = await runSession(row, "fixture-lease", {
    provider: doc,
    store,
    now: () => clock.now,
    sleep: clock.sleep,
    deadline: T0 + 100000,
  });
  assert(outcome !== "paused");
  assertEquals(row.attention, null);
});

Deno.test("a pass that expires during a document read cannot start another write", async () => {
  const clock = new Clock();
  const row = makeSession("Approved text.", { clock, minutes: 1 });
  Object.assign(row, {
    status: "running",
    lease_id: "fixture-lease",
    access_expires_at: new Date(T0 + 5000).toISOString(),
    preflight_at: new Date(T0).toISOString(),
    schedule: [1000],
    document_baseline_length: 0,
  });
  const store = new FakeStore(row, clock), doc = new FakeDoc(clock);
  doc.latencyMs = 10000;
  assertEquals(
    await runSession(row, "fixture-lease", {
      provider: doc,
      store,
      now: () => clock.now,
      sleep: clock.sleep,
      deadline: T0 + 100000,
    }),
    "paused",
  );
  assertEquals(doc.writes.length, 0);
  assertEquals(row.attention, "access_expired");
});

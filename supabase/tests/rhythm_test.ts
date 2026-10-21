import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { replanPaused } from "../functions/_shared/replan.ts";
import { Clock, makeSession } from "./fakes.ts";
import { planSession, rhythmPacing } from "../functions/_shared/plan.ts";

const text = "A short first sentence. Another short sentence follows. Keep every approved word.";
const base = { text, unit: "word" as const, seed: 42, durationSeconds: 900 };
Deno.test("Free Natural is a complete rhythm with sentence pauses and no temporary mistakes", () => {
  const plan = planSession({ ...base, plan: "free", rhythm: "natural" });
  assert(plan.ok);
  assertEquals(plan.source_chunks.join(""), text);
  assert(plan.drafting_stats.sentence_pauses > 0);
  assertEquals(plan.drafting_stats.typos, 0);
  assertEquals(plan.drafting_stats.false_starts, 0);
  assertEquals(plan.schedule.at(-1), 900_000);
});
Deno.test("Free Steady keeps its preset and has no sentence pauses", () => {
  const plan = planSession({ ...base, plan: "free", rhythm: "steady", pacing: rhythmPacing("steady", 900) });
  assert(plan.ok);
  assertEquals(plan.pacing?.variation_pct, 15);
  assertEquals(plan.drafting_stats.sentence_pauses, 0);
});
Deno.test("Free cannot smuggle custom mistakes through the Natural preset", () => {
  const pacing = rhythmPacing("drafting", 900);
  const plan = planSession({ ...base, plan: "free", rhythm: "natural", pacing });
  assert(plan.ok);
  assertEquals(plan.pacing?.drafting?.typo_rate_pct, 0);
  assertEquals(plan.pacing?.drafting?.false_start_rate_pct, 0);
  assertEquals(plan.pacing?.drafting?.sentence_pause_seconds, 2);
});
Deno.test("Drafting is enforced as Pro at the planner boundary", () => {
  const free = planSession({ ...base, plan: "free", rhythm: "drafting" });
  assert(!free.ok);
  assert(free.problems.some((p) => p.code === "pro_feature"));
  const pro = planSession({ ...base, plan: "pro", rhythm: "drafting" });
  assert(pro.ok);
  assertEquals(pro.pacing?.drafting?.typo_rate_pct, 1);
  assertEquals(pro.pacing?.drafting?.false_start_rate_pct, 1);
});
Deno.test("Free rhythm presets retain existing word and duration limits", () => {
  const words = planSession({ ...base, plan: "free", rhythm: "natural", text: "word ".repeat(151) });
  assert(words.problems.some((p) => p.code === "words_over_plan"));
  const time = planSession({ ...base, plan: "free", rhythm: "natural", durationSeconds: 3600 });
  assert(time.problems.some((p) => p.code === "duration_over_plan"));
});

Deno.test("named rhythms keep Markdown execution and formatting aligned when replanning", () => {
  const markdown = "# Heading\n" + "The garden grows and another writer reads the story. ".repeat(40);
  const initial = planSession({
    text: markdown,
    format: "markdown",
    unit: "sentence",
    seed: 7,
    plan: "pro",
    durationSeconds: 3600,
  });
  assert(initial.ok);
  const clock = new Clock();
  const row = {
    ...makeSession(initial.source_chunks.join(""), { clock }),
    text: markdown,
    text_format: "markdown" as const,
    chunks: initial.units,
    source_chunks: initial.source_chunks,
    source_unit_ends: initial.source_unit_ends,
    chunk_deletions: initial.chunk_deletions,
    action_kinds: initial.action_kinds,
    chunk_formats: initial.chunk_formats,
    total_chunks: initial.units.length,
    chunks_written: 1,
    schedule: initial.schedule,
    paused_at: new Date(clock.now + initial.schedule[0]).toISOString(),
  };
  const updated = replanPaused(row, {
    rhythm: "drafting",
    unit: "word",
    seed: 42,
    pacing: rhythmPacing("natural", 3600),
  });
  assertEquals(updated.chunk_formats?.length, updated.total_chunks);
  assertEquals(updated.chunks.length, updated.total_chunks);
});

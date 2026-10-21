import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import {
  compileDrafting,
  DEFAULT_DRAFTING,
  draftingEnabled,
  type DraftingSettings,
  executionText,
  neighborKey,
  validateDrafting,
} from "../functions/_shared/drafting.ts";
import { buildPacing, DEFAULT_BREAKS, type PacingSettings, validatePacing } from "../functions/_shared/pacing.ts";
import { planSession } from "../functions/_shared/plan.ts";
import { parseMarkdown } from "../functions/_shared/markdown.ts";
import { splitText, unitSize } from "../functions/_shared/chunker.ts";

const settings: DraftingSettings = {
  typo_rate_pct: 20,
  false_start_rate_pct: 20,
  sentence_pause_seconds: 2,
  sentence_pause_variation_pct: 25,
};
const text =
  'The quick brown fox jumps over the lazy dog.\n\n"Really?" Another writer wonders. Unicode café 👩🏽‍💻 stays intact.';
const pace = (drafting: DraftingSettings | undefined = settings): PacingSettings => ({
  timing: "duration",
  duration_seconds: 3600,
  variation_pct: 25,
  breaks: { ...DEFAULT_BREAKS, enabled: false },
  drafting,
});

Deno.test("drafting scripts reproduce exactly the source across seeds and unit modes", () => {
  for (const unit of ["sentence", "paragraph", "word", "character"] as const) {
    const source = splitText(text, unit);
    for (let seed = 0; seed < 70; seed++) {
      const script = compileDrafting(source, settings, seed);
      assertEquals(executionText(script.chunks, script.chunk_deletions, 0, script.chunks.length), text);
      assertEquals(script.source_chunks, source);
      assertEquals(script.chunks.length, script.action_kinds.length);
      assertEquals(script.chunks.length, script.chunk_deletions.length);
      assertEquals(script.source_unit_ends.at(-1), script.chunks.length);
      let from = 0;
      script.source_unit_ends.forEach((to, i) => {
        assert(to > from);
        // Every source unit is independently safe to resynchronize after.
        assertEquals(executionText(script.chunks, script.chunk_deletions, from, to), source[i]);
        from = to;
      });
    }
  }
});

Deno.test("seeded simulation and planned pauses repeat exactly", () => {
  const a = compileDrafting(splitText(text, "sentence"), settings, 42);
  const b = compileDrafting(splitText(text, "sentence"), settings, 42);
  const c = compileDrafting(splitText(text, "sentence"), settings, 43);
  assertEquals(a, b);
  assert(JSON.stringify(a) !== JSON.stringify(c));
  assert(a.stats.typos > 0);
  assert(a.stats.false_starts > 0);
  assert(a.stats.sentence_pauses > 0);
  assert(a.sentence_pauses_ms.every((ms) => ms === 0 || ms >= 1500 && ms <= 2500));
});

Deno.test("temporary mistakes are real separate edits, backspaced before correct source continues", () => {
  const script = compileDrafting(splitText(text, "sentence"), settings, 42);
  let current = "";
  for (let i = 0; i < script.chunks.length; i++) {
    const kind = script.action_kinds[i];
    const next = executionText(script.chunks, script.chunk_deletions, 0, i + 1);
    if (kind === "typo" || kind === "false_start") {
      assert(script.chunks[i].length > 0);
      assertEquals(script.action_kinds[i + 1], "backspace");
      assertEquals(script.chunk_deletions[i + 1], script.chunks[i].length);
      assertEquals(executionText(script.chunks, script.chunk_deletions, 0, i + 2), current);
    }
    if (kind === "backspace") {
      assert(next.length < current.length);
      assertEquals(script.chunks[i], "");
    }
    current = next;
  }
  assertEquals(current, text);
});

Deno.test("execution folding never backspaces into existing document text", () => {
  assertEquals(executionText(["wrong", "", "approved"], [0, 5, 0], 0, 3, "Original: "), "Original: approved");
  assertThrows(() => executionText([""], [1], 0, 1, "Original"), RangeError);
  assertThrows(() => executionText(["x", ""], [0, 2], 0, 2), RangeError);
  assertThrows(() => executionText(["x"], [-1], 0, 1), RangeError);
  assertThrows(() => executionText(["x"], [0.5], 0, 1), RangeError);
  assertThrows(() => executionText(["x"], [0], -1, 1), RangeError);
  assertEquals(executionText(["x", "y"], undefined, 0, 2, "before"), "beforexy");
});

Deno.test("neighbor keys stay adjacent and retain case", () => {
  assertEquals(neighborKey("q", () => 0), "w");
  assertEquals(neighborKey("Q", () => 0.9), "A");
  assertEquals(neighborKey("👋", () => 0), "👋");
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    assert(neighborKey(letter, () => 0.5) !== letter);
  }
});

Deno.test("zero settings preserve the original operation list and timing", () => {
  const units = splitText(text, "sentence");
  const script = compileDrafting(units, DEFAULT_DRAFTING, 42);
  assertEquals(script.chunks, units);
  assertEquals(script.chunk_deletions, units.map(() => 0));
  assertEquals(script.source_unit_ends, units.map((_, i) => i + 1));
  assertEquals(script.action_kinds, units.map(() => "insert"));
  const p = pace(undefined);
  assertEquals(
    buildPacing(units, units.map(unitSize), p, 42),
    buildPacing(script.chunks, script.chunks.map(unitSize), p, 42, script.sentence_pauses_ms),
  );
});

Deno.test("planner reserves simulation edits and sentence pauses within an exact duration", () => {
  const plan = planSession({ text, unit: "sentence", seed: 42, plan: "pro", pacing: pace() });
  assertEquals(plan.ok, true);
  assertEquals(plan.schedule.at(-1), 3600000);
  assertEquals(plan.words, 18);
  assertEquals(plan.chars, text.length);
  assert(plan.units.length > plan.source_chunks.length);
  assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), text);
  const gaps = plan.schedule.map((ms, i) => ms - (plan.schedule[i - 1] ?? 0));
  assert(gaps.every((ms) => ms >= 4000));
  assert(plan.break_seconds > 0);
  const impossible = planSession({
    text,
    unit: "word",
    seed: 42,
    plan: "pro",
    pacing: { ...pace(), duration_seconds: 60 },
  });
  assertEquals(impossible.ok, false);
  assert(impossible.problems.some((p) => p.code === "duration_too_short"));
});

Deno.test("speed mode includes visible edit floors and sentence pauses in its estimate", () => {
  const settings = { ...pace(), timing: "speed" as const, wpm: 150 };
  const plan = planSession({ text, unit: "sentence", seed: 42, plan: "pro", pacing: settings });
  assertEquals(plan.ok, true);
  assert(plan.duration_seconds >= plan.units.length * 4);
  assert(plan.warnings.some((w) => w.code === "speed_capped"));
});

Deno.test("Pro-only drafting rejects Free and All-at-once requests", () => {
  const free = planSession({ text: "Two approved words.", unit: "sentence", seed: 42, plan: "free", pacing: pace() });
  assertEquals(free.ok, false);
  assert(free.problems.some((p) => p.code === "pro_feature"));
  const asap = planSession({
    text,
    unit: "sentence",
    seed: 42,
    plan: "pro",
    mode: "as_soon_as_possible",
    pacing: pace(),
  });
  assertEquals(asap.ok, false);
  assert(asap.problems.some((p) => p.code === "invalid_settings"));
});

Deno.test("malformed drafting settings fail clearly and cadence accepts only 20–150 WPM", () => {
  for (
    const value of [
      null,
      [],
      "wrong",
      {},
      { ...settings, typo_rate_pct: NaN },
      { ...settings, false_start_rate_pct: Infinity },
      { ...settings, sentence_pause_seconds: -1 },
      { ...settings, sentence_pause_variation_pct: 51 },
    ]
  ) {
    assert(validateDrafting(value));
  }
  assertEquals(validateDrafting(undefined), null);
  assertEquals(validateDrafting(DEFAULT_DRAFTING), null);
  assertEquals(draftingEnabled(DEFAULT_DRAFTING), false);
  for (const wpm of [19, 151, NaN, Infinity]) assert(validatePacing({ ...pace(), timing: "speed", wpm }));
  for (const wpm of [20, 150]) assertEquals(validatePacing({ ...pace(), timing: "speed", wpm }), null);
});

Deno.test("formatted drafting retains approved text and formatting on real insertions", () => {
  const markdown = "# Heading\n\n**The quick brown fox** jumps with *style*.\n- Another item stays.";
  const parsed = parseMarkdown(markdown);
  const plan = planSession({
    text: markdown,
    format: "markdown",
    unit: "sentence",
    seed: 42,
    plan: "pro",
    pacing: pace(),
  });
  assertEquals(plan.ok, true);
  assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), parsed.plain);
  assertEquals(plan.chunk_formats?.length, plan.units.length);
  assert(plan.chunk_formats?.some((f) => f.spans.some((s) => s.bold)));
  assert(plan.chunk_formats?.some((f) => f.paragraphs.some((p) => p.kind === "h1")));
  plan.action_kinds.forEach((kind, i) => {
    if (kind === "typo" || kind === "false_start" || kind === "backspace") {
      assertEquals(plan.chunk_formats![i], { paragraphs: [], spans: [] });
    }
  });
});

Deno.test("sentence pauses split paragraphs at real sentence boundaries without losing source grouping", () => {
  const text = "Dr. Smith paid 3.14 dollars. Then he left. Another sentence ends here.";
  const config = { ...DEFAULT_DRAFTING, sentence_pause_seconds: 3, sentence_pause_variation_pct: 0 };
  const script = compileDrafting([text], config, 5);
  assertEquals(script.source_unit_ends, [3]);
  assertEquals(script.sentence_pauses_ms, [3000, 3000, 0]);
  assertEquals(script.stats.typos, 0);
  assertEquals(executionText(script.chunks, script.chunk_deletions, 0, script.chunks.length), text);
  const plan = planSession({ text, unit: "paragraph", seed: 5, plan: "pro", pacing: pace(config) });
  assertEquals(plan.ok, true);
  assertEquals(plan.schedule.at(-1), 3600000);
  assertEquals(plan.break_seconds, 6);
  assertEquals(plan.source_chunks, [text]);
});

Deno.test("false-start cleanup stays bounded even beside unusually long words", () => {
  const text = `Short ${"a".repeat(500)} other words provide nearby choices.`;
  for (let seed = 0; seed < 30; seed++) {
    const script = compileDrafting([text], settings, seed);
    assert(script.chunk_deletions.every((n) => n <= 100));
    assertEquals(executionText(script.chunks, script.chunk_deletions, 0, script.chunks.length), text);
  }
});

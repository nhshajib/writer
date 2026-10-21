import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { backoffSeconds, MIN_GAP_SECONDS } from "../functions/_shared/schedule.ts";
import { checkCreateLimits } from "../functions/_shared/limits.ts";
import { splitText, unitSize } from "../functions/_shared/chunker.ts";
import {
  type BreakSettings,
  buildPacing,
  endsBoundary,
  PacingError,
  type PacingSettings,
} from "../functions/_shared/pacing.ts";

const gapsOf = (offsets: number[]) => offsets.map((at, i) => at - (i === 0 ? 0 : offsets[i - 1]));
const HOUR = 3600;
const NO_BREAKS: BreakSettings = {
  enabled: false,
  every_seconds: 600,
  every_variation_pct: 0,
  min_seconds: 30,
  max_seconds: 30,
  align: "any",
};
const BREAKS: BreakSettings = {
  enabled: true,
  every_seconds: 600,
  every_variation_pct: 30,
  min_seconds: 30,
  max_seconds: 180,
  align: "sentence",
};
const duration = (seconds: number, variation = 35, breaks = NO_BREAKS): PacingSettings => ({
  timing: "duration",
  duration_seconds: seconds,
  variation_pct: variation,
  breaks,
});
const speed = (wpm: number, variation = 0, breaks = NO_BREAKS): PacingSettings => ({
  timing: "speed",
  wpm,
  variation_pct: variation,
  breaks,
});

const ESSAY = Array.from(
  { length: 80 },
  (_, i) =>
    `Sentence ${i + 1} is ${i % 3 ? "short" : "a fair bit longer than the others around it"}.` +
    (i % 9 === 8 ? "\n\n" : " "),
).join("");
const units = (text: string, unit: "sentence" | "word" | "character" = "sentence") => {
  const parts = splitText(text, unit);
  return [parts, parts.map(unitSize)] as const;
};

Deno.test("duration mode: the last insertion lands exactly at the end, breaks included", () => {
  const [parts, sizes] = units(ESSAY);
  for (const breaks of [NO_BREAKS, BREAKS]) {
    for (const seconds of [600, HOUR, 6 * HOUR, 7 * 24 * HOUR]) {
      const p = buildPacing(parts, sizes, duration(seconds, 25, breaks), 42);
      assertEquals(p.offsets.length, parts.length);
      assertEquals(p.offsets.at(-1), seconds * 1000);
      assertEquals(p.total_ms, seconds * 1000);
      assertEquals(p.active_ms + p.break_ms, seconds * 1000);
      assert(p.offsets.every((at, i) => i === 0 || at > p.offsets[i - 1]), "strictly increasing");
      assert(p.offsets.every(Number.isInteger), "whole milliseconds");
    }
  }
});

Deno.test("breaks: lengths within limits, only at sentence ends, never after the last unit", () => {
  const [parts, sizes] = units(ESSAY);
  for (let seed = 1; seed <= 40; seed++) {
    const p = buildPacing(parts, sizes, duration(2 * HOUR, 25, BREAKS), seed);
    assert(p.breaks.length >= 5, `seed ${seed}: ${p.breaks.length} breaks`);
    for (const b of p.breaks) {
      assert(b.duration_ms >= 30_000 && b.duration_ms <= 180_000, `break length ${b.duration_ms}`);
      assert(endsBoundary(parts[b.after_index], "sentence"));
      assert(b.after_index < parts.length - 1);
      // The next insertion comes after the break ends.
      assert(p.offsets[b.after_index + 1] >= b.start_ms + b.duration_ms + MIN_GAP_SECONDS * 1000);
      assertEquals(b.start_ms, p.offsets[b.after_index]);
    }
  }
});

Deno.test("breaks follow the active time between them, within the variation", () => {
  const [parts, sizes] = units(ESSAY, "word");
  const p = buildPacing(parts, sizes, duration(3 * HOUR, 20, { ...BREAKS, align: "any", every_variation_pct: 20 }), 7);
  // Active time between consecutive breaks: within ±20% of 10 minutes (plus one unit, since a break waits for the unit to end).
  let last = 0;
  for (const b of p.breaks) {
    const breaksBefore = p.breaks.filter((x) => x.start_ms < b.start_ms).reduce((a, x) => a + x.duration_ms, 0);
    const activeAt = b.start_ms - breaksBefore;
    const interval = activeAt - last;
    assert(interval >= 0.8 * 600_000 && interval <= 1.2 * 600_000 + 120_000, `interval ${interval}`);
    last = activeAt;
  }
});

Deno.test("paragraph-aligned breaks only start after a paragraph", () => {
  const [parts, sizes] = units(ESSAY);
  const p = buildPacing(parts, sizes, duration(2 * HOUR, 25, { ...BREAKS, align: "paragraph" }), 3);
  assert(p.breaks.length > 0);
  for (const b of p.breaks) assert(parts[b.after_index].endsWith("\n\n"));
});

Deno.test("timing variation stays within its limits", () => {
  // Equal units, no breaks: each wait is the even share times a factor in [1 - v, 1 + v], then rescaled.
  const parts = Array.from({ length: 40 }, (_, i) => `Unit ${String(i).padStart(2, "0")}. `);
  for (const v of [0, 10, 25, 50]) {
    const gaps = gapsOf(buildPacing(parts, parts.map(unitSize), duration(HOUR, v), 11).offsets);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const low = (1 - v / 100) / (1 + v / 100);
    const high = (1 + v / 100) / (1 - v / 100);
    assert(gaps.every((g) => g / mean >= low - 1e-3 && g / mean <= high + 1e-3), `v=${v}`);
    if (v === 0) assert(Math.max(...gaps) - Math.min(...gaps) <= 1, "no variation means even gaps");
    else assert(new Set(gaps).size > gaps.length / 2, "varied");
  }
});

Deno.test("text is spread through the duration, not piled up near the end", () => {
  const [parts, sizes] = units(ESSAY, "word");
  for (let seed = 1; seed <= 20; seed++) {
    const p = buildPacing(parts, sizes, duration(HOUR, 50, BREAKS), seed);
    const total = sizes.reduce((a, b) => a + b, 0);
    for (const fraction of [0.25, 0.5, 0.75]) {
      const by = p.offsets.findIndex((at) => at > fraction * HOUR * 1000);
      const entered = sizes.slice(0, by).reduce((a, b) => a + b, 0) / total;
      assert(Math.abs(entered - fraction) < 0.12, `seed ${seed}: ${entered.toFixed(2)} entered by ${fraction}`);
    }
  }
});

Deno.test("speed mode: words per minute with 5-character words, breaks added to the estimate", () => {
  // 200 characters at 40 WPM is exactly one minute of active time.
  const parts = Array.from({ length: 10 }, () => "abcdefghijklmnopqrs "); // 20 characters each
  const p = buildPacing(parts, parts.map(unitSize), speed(40), 1);
  assertEquals(p.active_ms, 60_000);
  assertEquals(p.total_ms, 60_000);
  assertEquals(gapsOf(p.offsets), new Array(10).fill(6_000));

  const [essay, sizes] = units(ESSAY);
  const slow = buildPacing(essay, sizes, speed(30), 1);
  const fast = buildPacing(essay, sizes, speed(60), 1);
  assert(Math.abs(slow.total_ms - 2 * fast.total_ms) < 2 * sizes.length, "half the speed, twice the time");
  const withBreaks = buildPacing(essay, sizes, speed(30, 0, { ...BREAKS, every_seconds: 120 }), 1);
  assert(withBreaks.breaks.length > 0);
  assertEquals(withBreaks.total_ms, slow.total_ms + withBreaks.break_ms);
  assertEquals(withBreaks.active_ms, slow.active_ms);
});

Deno.test("speed mode: steps faster than the minimum gap are capped and counted", () => {
  const [parts, sizes] = units("Hi there, this is quick.", "character");
  const p = buildPacing(parts, sizes, speed(120), 1);
  assertEquals(p.capped_units, parts.length);
  assert(gapsOf(p.offsets).every((g) => g >= MIN_GAP_SECONDS * 1000));
});

Deno.test("the same seed gives the same schedule; another seed doesn't", () => {
  const [parts, sizes] = units(ESSAY);
  const a = buildPacing(parts, sizes, duration(HOUR, 30, BREAKS), 77);
  assertEquals(a, buildPacing(parts, sizes, duration(HOUR, 30, BREAKS), 77));
  assert(JSON.stringify(a) !== JSON.stringify(buildPacing(parts, sizes, duration(HOUR, 30, BREAKS), 78)));
});

Deno.test("impossible or invalid settings are refused with a reason", () => {
  const [parts, sizes] = units("word ".repeat(100), "word");
  const tooShort = assertThrows(() => buildPacing(parts, sizes, duration(300), 1), PacingError);
  assertEquals(tooShort.code, "duration_too_short");
  assert(tooShort.message.includes("100 insertions need at least 7 minutes"), tooShort.message);
  for (
    const bad of [
      speed(2),
      speed(500),
      duration(HOUR, 80),
      duration(30),
      duration(HOUR, 10, { ...BREAKS, min_seconds: 200, max_seconds: 100 }),
      duration(HOUR, 10, { ...BREAKS, every_seconds: 10 }),
    ]
  ) {
    assertEquals(assertThrows(() => buildPacing(parts, sizes, bad, 1), PacingError).code, "invalid_settings");
  }
});

Deno.test("very short and very long texts", () => {
  const one = buildPacing(["x"], [1], duration(60, 25, BREAKS), 1);
  assertEquals(one.offsets, [60_000]);
  assertEquals(one.breaks, []);

  // 15,000 sentences over a week, with breaks: built quickly and exact.
  const long = Array.from({ length: 15_000 }, (_, i) => `Line ${i}. `);
  const started = performance.now();
  const p = buildPacing(long, long.map(unitSize), duration(7 * 24 * HOUR, 30, BREAKS), 5);
  assert(performance.now() - started < 3000, "fast enough");
  assertEquals(p.offsets.at(-1), 7 * 24 * HOUR * 1000);
  assert(gapsOf(p.offsets).every((g) => g >= MIN_GAP_SECONDS * 1000));
});

Deno.test("backoff doubles from one minute", () => {
  assertEquals([1, 2, 3, 4, 5].map(backoffSeconds), [60, 120, 240, 480, 960]);
});

const ok = { plan: "free" as const, words: 100, textLength: 600, durationSeconds: 1800, activeDrips: 0 };

Deno.test("free plan limits", () => {
  assertEquals(checkCreateLimits(ok), null);
  assertEquals(checkCreateLimits({ ...ok, words: 251 }), "Your plan allows 250 words per day.");
  assertEquals(checkCreateLimits({ ...ok, durationSeconds: 3601 }), "Your plan allows sessions up to 1 hour.");
  assertEquals(checkCreateLimits({ ...ok, activeDrips: 1 }), "Your plan allows 1 active session at a time.");
});

Deno.test("pro plan limits", () => {
  const pro = { ...ok, plan: "pro" as const };
  assertEquals(checkCreateLimits({ ...pro, words: 50_000, durationSeconds: 7 * 86400 }), null);
  assertEquals(
    checkCreateLimits({ ...pro, durationSeconds: 7 * 86400 + 1 }),
    "Your plan allows sessions up to 1 week.",
  );
  assertEquals(checkCreateLimits({ ...pro, activeDrips: 3 }), "Your plan allows 3 active sessions at a time.");
});

Deno.test("generic validation", () => {
  assertEquals(checkCreateLimits({ ...ok, words: 0 }), "Text is empty.");
  assertEquals(checkCreateLimits({ ...ok, durationSeconds: 30 }), "Duration must be at least 1 minute.");
  assertEquals(checkCreateLimits({ ...ok, textLength: 200_001 }), "Text is too long (max 200,000 characters).");
});

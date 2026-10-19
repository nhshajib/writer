import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import {
  backoffSeconds,
  buildSchedule,
  InfeasibleScheduleError,
  MIN_GAP_SECONDS,
  SIZE_CLAMP,
  TIMING_VARIATION,
} from "../functions/_shared/schedule.ts";
import { checkCreateLimits } from "../functions/_shared/limits.ts";

const gapsOf = (offsets: number[]) => offsets.map((at, i) => at - (i === 0 ? 0 : offsets[i - 1]));
const HOUR = 3600;

Deno.test("the last insertion lands exactly at the end of the duration", () => {
  for (const [n, duration] of [[1, 60], [10, HOUR], [237, HOUR], [900, HOUR], [3, 7 * 86400]]) {
    const offsets = buildSchedule(Array.from({ length: n }, (_, i) => 20 + (i % 7) * 9), duration, 42);
    assertEquals(offsets.length, n);
    assertEquals(offsets.at(-1), duration * 1000);
    assert(offsets.every((at, i) => i === 0 || at > offsets[i - 1]), "strictly increasing");
    assert(offsets.every(Number.isInteger), "whole milliseconds");
  }
});

Deno.test("intervals vary instead of following a fixed rhythm", () => {
  // Ten equal sentences over an hour: an even schedule would be one every 6 minutes.
  const gaps = gapsOf(buildSchedule(new Array(10).fill(80), HOUR, 1234));
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
  assert(sd / mean > 0.08, `coefficient of variation ${(sd / mean).toFixed(3)}`);
  assertEquals(new Set(gaps).size, gaps.length, "no two gaps are equal");
  // ...but within clear limits: each wait is within ±TIMING_VARIATION of its share, renormalized.
  const low = (1 - TIMING_VARIATION) / (1 + TIMING_VARIATION);
  const high = (1 + TIMING_VARIATION) / (1 - TIMING_VARIATION);
  assert(gaps.every((g) => g / mean >= low && g / mean <= high), "bounded");
});

Deno.test("longer units get more time, within bounds", () => {
  const sizes = [20, 200, 20, 200, 20, 200, 20, 200, 20, 200];
  for (let seed = 1; seed <= 50; seed++) {
    const gaps = gapsOf(buildSchedule(sizes, HOUR, seed));
    const short = gaps.filter((_, i) => sizes[i] === 20);
    const long = gaps.filter((_, i) => sizes[i] === 200);
    assert(Math.min(...long) > Math.max(...short), `seed ${seed}`);
  }
  // Extremes are clamped to SIZE_CLAMP × the median, so one huge unit can't take the whole session.
  const gaps = gapsOf(buildSchedule([10, 10, 10, 10, 100_000], HOUR, 9));
  assert(gaps[4] / gaps[0] <= SIZE_CLAMP * (1 + TIMING_VARIATION) / (1 - TIMING_VARIATION) + 1e-9);
});

Deno.test("no two insertions are closer than the minimum gap", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const sizes = Array.from({ length: 800 }, (_, i) => (i * 7919 + seed) % 40 + 1);
    const gaps = gapsOf(buildSchedule(sizes, 3600, seed));
    assert(Math.min(...gaps) >= MIN_GAP_SECONDS * 1000, `seed ${seed}`);
  }
  // Exactly at capacity every gap is the minimum.
  assertEquals(new Set(gapsOf(buildSchedule(new Array(15).fill(5), 60, 1))), new Set([4000]));
});

Deno.test("the same seed gives the same schedule; another seed doesn't", () => {
  const sizes = [30, 45, 12, 80, 33];
  assertEquals(buildSchedule(sizes, HOUR, 77), buildSchedule(sizes, HOUR, 77));
  assert(JSON.stringify(buildSchedule(sizes, HOUR, 77)) !== JSON.stringify(buildSchedule(sizes, HOUR, 78)));
});

Deno.test("a duration too short for the minimum gap is refused with the minimum", () => {
  const error = assertThrows(() => buildSchedule(new Array(100).fill(5), 300, 1), InfeasibleScheduleError);
  assertEquals(error.minimumSeconds, 100 * MIN_GAP_SECONDS);
  assertThrows(() => buildSchedule([5], 0, 1), RangeError);
  assertEquals(buildSchedule([], 60, 1), []);
});

Deno.test("backoff doubles from one minute", () => {
  assertEquals([1, 2, 3, 4, 5].map(backoffSeconds), [60, 120, 240, 480, 960]);
});

const ok = { plan: "free" as const, words: 100, textLength: 600, durationSeconds: 1800, activeDrips: 0 };

Deno.test("free plan limits", () => {
  assertEquals(checkCreateLimits(ok), null);
  assertEquals(checkCreateLimits({ ...ok, words: 251 }), "Your plan allows 250 words per day.");
  assertEquals(checkCreateLimits({ ...ok, durationSeconds: 3601 }), "Your plan allows drips up to 1 hour.");
  assertEquals(checkCreateLimits({ ...ok, activeDrips: 1 }), "Your plan allows 1 active drip at a time.");
});

Deno.test("pro plan limits", () => {
  const pro = { ...ok, plan: "pro" as const };
  assertEquals(checkCreateLimits({ ...pro, words: 50_000, durationSeconds: 7 * 86400 }), null);
  assertEquals(checkCreateLimits({ ...pro, durationSeconds: 7 * 86400 + 1 }), "Your plan allows drips up to 1 week.");
  assertEquals(checkCreateLimits({ ...pro, activeDrips: 3 }), "Your plan allows 3 active drips at a time.");
});

Deno.test("generic validation", () => {
  assertEquals(checkCreateLimits({ ...ok, words: 0 }), "Text is empty.");
  assertEquals(checkCreateLimits({ ...ok, durationSeconds: 30 }), "Duration must be at least 1 minute.");
  assertEquals(checkCreateLimits({ ...ok, textLength: 200_001 }), "Text is too long (max 200,000 characters).");
});

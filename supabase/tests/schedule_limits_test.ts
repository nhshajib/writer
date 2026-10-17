import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { backoffSeconds, planDrip } from "../functions/_shared/schedule.ts";
import { checkCreateLimits } from "../functions/_shared/limits.ts";

Deno.test("planDrip uses one step per minute when there are enough words", () => {
  assertEquals(planDrip(1000, 60 * 60), { steps: 60, intervalSeconds: 60 });
  assertEquals(planDrip(500, 3 * 60), { steps: 3, intervalSeconds: 60 });
});

Deno.test("planDrip uses one step per word when words are scarce", () => {
  assertEquals(planDrip(4, 60 * 60), { steps: 4, intervalSeconds: 900 });
});

Deno.test("planDrip never goes below the minimum interval", () => {
  for (const [words, duration] of [[10_000, 600], [7, 61], [3, 7 * 86400]]) {
    const { steps, intervalSeconds } = planDrip(words, duration);
    if (steps > 1) assertEquals(intervalSeconds >= 60, true);
    assertEquals((steps - 1) * intervalSeconds <= duration, true);
  }
});

Deno.test("planDrip with a single step has no interval", () => {
  assertEquals(planDrip(1, 3600), { steps: 1, intervalSeconds: 0 });
  assertEquals(planDrip(100, 60), { steps: 1, intervalSeconds: 0 });
});

Deno.test("planDrip rejects invalid input", () => {
  assertThrows(() => planDrip(0, 60));
  assertThrows(() => planDrip(10, 0));
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

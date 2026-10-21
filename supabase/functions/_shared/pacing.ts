/**
 * Pacing: turns insertion units and the user's pace settings into a complete,
 * reproducible schedule, before the session starts. Pure: no document or
 * interface code, and the same seed always gives the same schedule.
 *
 * Two timing modes:
 *
 *   duration — the user picks the total time. Active time (time spent on
 *              units) and breaks are fitted to it exactly; the last insertion
 *              lands at the end.
 *   speed    — the user picks words per minute. Each unit takes its length at
 *              that speed (a "word" is 5 characters, the standard typing
 *              measure); the total is an estimate that includes breaks.
 *
 * In both, a unit is inserted when its share of time has passed, each share
 * varies within ±variation of its baseline, insertions are at least
 * MIN_GAP_SECONDS apart, and breaks are placed by active time since the last
 * break (optionally only after a sentence or paragraph ends). Randomness only
 * affects timing; units are never changed or reordered.
 */

import { type DraftingSettings, validateDrafting } from "./drafting.ts";
import { MIN_GAP_SECONDS, seededRandom, SIZE_CLAMP } from "./schedule.ts";

export type TimingMode = "duration" | "speed";
export type BreakAlignment = "any" | "sentence" | "paragraph";

export interface BreakSettings {
  enabled: boolean;
  /** Typical active time between breaks. */
  every_seconds: number;
  /** Each interval varies within ±this percent of every_seconds. */
  every_variation_pct: number;
  min_seconds: number;
  max_seconds: number;
  /** Only start a break after a unit that ends a sentence or paragraph. */
  align: BreakAlignment;
}

export interface PacingSettings {
  timing: TimingMode;
  /** Total planned time, breaks included (duration mode). */
  duration_seconds?: number;
  /** Words per minute, 1 word = 5 characters (speed mode). */
  wpm?: number;
  /** Each wait varies within ±this percent of its baseline. */
  variation_pct: number;
  breaks: BreakSettings;
  /** Pro: opt-in temporary edits and sentence-boundary pauses. */
  drafting?: DraftingSettings;
}

export const LIMITS = {
  wpm: { min: 20, max: 150 },
  variation_pct: { min: 0, max: 50 },
  every_seconds: { min: 60, max: 12 * 3600 },
  every_variation_pct: { min: 0, max: 50 },
  break_seconds: { min: 5, max: 8 * 3600 },
} as const;

/** Characters in one "word" for words-per-minute. */
export const CHARS_PER_WORD = 5;

export const DEFAULT_BREAKS: BreakSettings = {
  enabled: true,
  every_seconds: 8 * 60,
  every_variation_pct: 30,
  min_seconds: 20,
  max_seconds: 120,
  align: "sentence",
};

export interface PlannedBreak {
  /** The break starts right after this unit. */
  after_index: number;
  start_ms: number;
  duration_ms: number;
}

export interface Pacing {
  /** One offset (ms from the session start) per unit; when it is inserted. */
  offsets: number[];
  breaks: PlannedBreak[];
  active_ms: number;
  break_ms: number;
  total_ms: number;
  /** Speed mode: units whose time was raised to the minimum gap. */
  capped_units: number;
  /** Duration mode: breaks the settings asked for that didn't fit. */
  dropped_breaks: number;
}

export class PacingError extends Error {
  constructor(readonly code: "invalid_settings" | "duration_too_short", message: string) {
    super(message);
    this.name = "PacingError";
  }
}

/** Returns a reason the settings are out of range, or null. */
export function validatePacing(p: PacingSettings): string | null {
  const within = (v: number | undefined, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  const draftingProblem = validateDrafting(p.drafting);
  if (draftingProblem) return draftingProblem;
  if (p.timing !== "duration" && p.timing !== "speed") return "Choose a timing mode.";
  if (
    p.timing === "duration" &&
    !(typeof p.duration_seconds === "number" && Number.isFinite(p.duration_seconds) && p.duration_seconds >= 60)
  ) {
    return "Choose a duration of at least 1 minute.";
  }
  if (p.timing === "speed" && !within(p.wpm, LIMITS.wpm.min, LIMITS.wpm.max)) {
    return `Choose a typing speed between ${LIMITS.wpm.min} and ${LIMITS.wpm.max} WPM.`;
  }
  if (!within(p.variation_pct, LIMITS.variation_pct.min, LIMITS.variation_pct.max)) {
    return `Timing variation must be between 0 and ${LIMITS.variation_pct.max}%.`;
  }
  const b = p.breaks;
  if (typeof b !== "object" || b === null || Array.isArray(b)) return "Break settings must be an object.";
  if (b.enabled) {
    if (!within(b.every_seconds, LIMITS.every_seconds.min, LIMITS.every_seconds.max)) {
      return "Active time between breaks must be between 1 minute and 12 hours.";
    }
    if (!within(b.every_variation_pct, LIMITS.every_variation_pct.min, LIMITS.every_variation_pct.max)) {
      return `Break interval variation must be between 0 and ${LIMITS.every_variation_pct.max}%.`;
    }
    if (!within(b.min_seconds, LIMITS.break_seconds.min, LIMITS.break_seconds.max)) {
      return "The shortest break must be between 5 seconds and 8 hours.";
    }
    if (!within(b.max_seconds, b.min_seconds, LIMITS.break_seconds.max)) {
      return "The longest break must be at least the shortest break and at most 8 hours.";
    }
    if (!["any", "sentence", "paragraph"].includes(b.align)) return "Choose where breaks may start.";
  }
  return null;
}

/** Whether a break may start right after this unit. */
export function endsBoundary(unit: string, align: BreakAlignment): boolean {
  if (align === "any") return true;
  if (align === "paragraph") return /\n\s*$/u.test(unit);
  return /\n\s*$/u.test(unit) || /[.!?。！？…؟।]["'”’)\]]*\s*$/u.test(unit);
}

const jitter = (random: () => number, pct: number) => 1 + (pct / 100) * (2 * random() - 1);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Shares `totalMs` out in proportion to `weights` as whole milliseconds, none
 * below `minMs`, adding up to exactly `totalMs`. Caller ensures n·minMs ≤ total.
 */
export function distribute(weights: number[], totalMs: number, minMs: number): number[] {
  const n = weights.length;
  const pinned = new Array<boolean>(n).fill(false);
  let shares: number[] = [];
  for (let round = 0; round <= n; round++) {
    const free = weights.reduce((sum, w, i) => (pinned[i] ? sum : sum + w), 0);
    const budget = totalMs - pinned.filter(Boolean).length * minMs;
    shares = weights.map((w, i) => (pinned[i] ? minMs : (budget * w) / free));
    let changed = false;
    shares.forEach((share, i) => {
      if (!pinned[i] && share < minMs) {
        pinned[i] = true;
        changed = true;
      }
    });
    if (!changed) break;
  }
  const floors = shares.map((share) => Math.max(minMs, Math.floor(share)));
  let left = totalMs - floors.reduce((a, b) => a + b, 0);
  const order = shares.map((share, i) => ({ i, rest: share - Math.floor(share) })).sort((a, b) => b.rest - a.rest);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) floors[order[k].i]++;
  for (let k = 0; left < 0; k = (k + 1) % n) {
    const i = order[n - 1 - k].i;
    if (floors[i] > minMs) {
      floors[i]--;
      left++;
    }
  }
  return floors;
}

/** Break positions: after which unit each break starts, by active time since the last one. */
function placeBreaks(
  active: number[],
  units: string[],
  thresholds: number[],
  align: BreakAlignment,
): number[] {
  const positions: number[] = [];
  let sinceBreak = 0;
  let next = 0;
  for (let i = 0; i < units.length - 1 && next < thresholds.length; i++) {
    sinceBreak += active[i];
    if (sinceBreak >= thresholds[next] && endsBoundary(units[i], align)) {
      positions.push(i);
      sinceBreak = 0;
      next++;
    }
  }
  return positions;
}

function assemble(active: number[], breakAfter: number[], lengths: number[]): Pick<Pacing, "offsets" | "breaks"> {
  const offsets: number[] = [];
  const breaks: PlannedBreak[] = [];
  let at = 0;
  let b = 0;
  for (let i = 0; i < active.length; i++) {
    at += active[i];
    offsets.push(at);
    if (b < breakAfter.length && breakAfter[b] === i) {
      breaks.push({ after_index: i, start_ms: at, duration_ms: lengths[b] });
      at += lengths[b];
      b++;
    }
  }
  return { offsets, breaks };
}

/**
 * Builds the schedule. `units` are the insertion units, `sizes` their lengths
 * in user-perceived characters. Throws PacingError when the settings are out
 * of range or the duration can't hold the units.
 */
export function buildPacing(
  units: string[],
  sizes: number[],
  settings: PacingSettings,
  seed: number,
  sentencePauses: number[] = [],
): Pacing {
  const invalid = validatePacing(settings);
  if (invalid) throw new PacingError("invalid_settings", invalid);
  const n = units.length;
  const empty = { offsets: [], breaks: [], active_ms: 0, break_ms: 0, total_ms: 0, capped_units: 0, dropped_breaks: 0 };
  if (n === 0) return empty;

  const minGap = MIN_GAP_SECONDS * 1000;
  const naturalAfter = sentencePauses.flatMap((ms, i) => ms > 0 && i < n - 1 ? [i] : []);
  const naturalMs = naturalAfter.reduce((sum, i) => sum + sentencePauses[i], 0);
  const withNatural = (active: number[], after: number[], lengths: number[]) => {
    const merged = new Map<number, number>();
    after.forEach((i, j) => merged.set(i, lengths[j]));
    naturalAfter.forEach((i) => merged.set(i, (merged.get(i) ?? 0) + sentencePauses[i]));
    const positions = [...merged.keys()].sort((a, b) => a - b);
    return assemble(active, positions, positions.map((i) => merged.get(i)!));
  };
  const random = seededRandom(seed);
  const b = settings.breaks;
  // Draw the break intervals and lengths first so they don't depend on the mode.
  const drawBreaks = (count: number) =>
    Array.from({ length: count }, () => ({
      every: b.every_seconds * 1000 * jitter(random, b.every_variation_pct),
      length: Math.round((b.min_seconds + random() * (b.max_seconds - b.min_seconds)) * 1000),
    }));

  if (settings.timing === "speed") {
    const msPerChar = 60_000 / (settings.wpm! * CHARS_PER_WORD);
    let capped = 0;
    const active = sizes.map((size) => {
      const ms = Math.round(Math.max(1, size) * msPerChar * jitter(random, settings.variation_pct));
      if (ms < minGap) capped++;
      return Math.max(minGap, ms);
    });
    const activeMs = active.reduce((a, c) => a + c, 0);
    const draws = b.enabled ? drawBreaks(Math.ceil(activeMs / (b.every_seconds * 1000 * 0.5)) + 1) : [];
    const after = b.enabled ? placeBreaks(active, units, draws.map((d) => d.every), b.align) : [];
    const lengths = draws.slice(0, after.length).map((d) => d.length);
    const { offsets, breaks } = withNatural(active, after, lengths);
    const breakMs = lengths.reduce((a, c) => a + c, 0) + naturalMs;
    return {
      offsets,
      breaks,
      active_ms: activeMs,
      break_ms: breakMs,
      total_ms: offsets[n - 1],
      capped_units: capped,
      dropped_breaks: 0,
    };
  }

  // Duration mode.
  const totalMs = Math.round(settings.duration_seconds! * 1000);
  const availableMs = totalMs - naturalMs;
  if (n * minGap > availableMs) {
    throw new PacingError(
      "duration_too_short",
      `${n} insertions need at least ${
        Math.ceil((n * minGap + naturalMs) / 60_000)
      } minutes including sentence pauses (one edit every ${MIN_GAP_SECONDS} seconds at most).`,
    );
  }

  const med = median(sizes.map((s) => Math.max(1, s)));
  const weights = sizes.map((size) =>
    Math.min(med * SIZE_CLAMP, Math.max(med / SIZE_CLAMP, Math.max(1, size))) * jitter(random, settings.variation_pct)
  );

  let after: number[] = [];
  let lengths: number[] = [];
  let wanted = 0;
  if (b.enabled) {
    // The most breaks whose thresholds fall inside the active time left after them.
    const draws = drawBreaks(Math.ceil(availableMs / (b.every_seconds * 1000 * 0.5)) + 1);
    let k = 0;
    let thresholdSum = 0;
    let lengthSum = 0;
    while (k < draws.length) {
      const nextThreshold = thresholdSum + draws[k].every;
      const nextLengths = lengthSum + draws[k].length;
      const activeLeft = availableMs - nextLengths;
      if (activeLeft < n * minGap || nextThreshold >= activeLeft - minGap) break;
      thresholdSum = nextThreshold;
      lengthSum = nextLengths;
      k++;
    }
    wanted = k;
    const trial = distribute(weights, availableMs - lengthSum, minGap);
    after = placeBreaks(trial, units, draws.slice(0, k).map((d) => d.every), b.align);
    lengths = draws.slice(0, after.length).map((d) => d.length);
  }

  // Breaks that couldn't be placed give their time back to the units, so the
  // schedule still fills the duration exactly.
  const breakMs = lengths.reduce((a, c) => a + c, 0) + naturalMs;
  const active = distribute(weights, totalMs - breakMs, minGap);
  const { offsets, breaks } = withNatural(active, after, lengths);
  return {
    offsets,
    breaks,
    active_ms: totalMs - breakMs,
    break_ms: breakMs,
    total_ms: offsets[n - 1],
    capped_units: 0,
    dropped_breaks: wanted - after.length,
  };
}

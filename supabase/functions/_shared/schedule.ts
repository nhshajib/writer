/**
 * Insertion schedules. The whole schedule is generated before a session
 * starts and stored with it, so retries, pauses and resumes follow the plan
 * the user saw instead of inventing a new pace.
 *
 * A schedule is a list of offsets in milliseconds from the session start, one
 * per unit. The wait before each unit grows with the unit's length and is
 * varied at random within ±TIMING_VARIATION, so there is no fixed rhythm. No
 * two insertions are closer than MIN_GAP_SECONDS, and the last one lands
 * exactly at the end of the chosen duration. Randomness only affects timing;
 * the units themselves are never changed or reordered.
 */

/**
 * Smallest gap between two insertions of one session. Google Docs allows 60
 * write requests per minute per user; 4 s keeps one session at 15 per minute,
 * so the 3 sessions Pro allows stay well inside the quota.
 */
export const MIN_GAP_SECONDS = 4;

/** Each wait is the length-based share of the duration times a random factor in [1 - v, 1 + v]. */
export const TIMING_VARIATION = 0.35;

/** Units far longer or shorter than the typical one are clamped to this multiple of the median length. */
export const SIZE_CLAMP = 3;

/** Most units one session may have; beyond this, a larger unit fits better. */
export const MAX_UNITS = 20_000;

export interface ScheduleOptions {
  minGapSeconds?: number;
  variation?: number;
}

export class InfeasibleScheduleError extends Error {
  constructor(readonly minimumSeconds: number, message: string) {
    super(message);
    this.name = "InfeasibleScheduleError";
  }
}

/** Shortest duration that fits `units` insertions with the minimum gap. */
export function minimumDurationSeconds(units: number, minGapSeconds = MIN_GAP_SECONDS): number {
  return Math.max(1, units) * minGapSeconds;
}

/** Small, fast, seedable PRNG (mulberry32). The same seed always gives the same schedule. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/**
 * Builds the schedule for units of the given sizes (characters per unit).
 *
 * The wait before unit i is proportional to clamp(size_i) × jitter_i, scaled so
 * the waits add up to the duration; waits under the minimum gap are raised to
 * it and the rest of the time is shared out again. Offsets are whole
 * milliseconds and strictly increasing, and the last equals the duration.
 */
export function buildSchedule(
  sizes: number[],
  durationSeconds: number,
  seed: number,
  options: ScheduleOptions = {},
): number[] {
  const n = sizes.length;
  const minGapMs = Math.round((options.minGapSeconds ?? MIN_GAP_SECONDS) * 1000);
  const variation = Math.min(0.9, Math.max(0, options.variation ?? TIMING_VARIATION));
  const totalMs = Math.round(durationSeconds * 1000);

  if (n === 0) return [];
  if (!Number.isFinite(totalMs) || totalMs <= 0) throw new RangeError("durationSeconds must be positive");
  if (n * minGapMs > totalMs) {
    const minimum = minimumDurationSeconds(n, minGapMs / 1000);
    throw new InfeasibleScheduleError(
      minimum,
      `${n} insertions need at least ${formatSeconds(minimum)} (one every ${minGapMs / 1000} seconds at most).`,
    );
  }

  const median = medianOf(sizes.map((s) => Math.max(1, s)));
  const random = seededRandom(seed);
  const weights = sizes.map((size) => {
    const clamped = Math.min(median * SIZE_CLAMP, Math.max(median / SIZE_CLAMP, Math.max(1, size)));
    return clamped * (1 + variation * (2 * random() - 1));
  });

  const gaps = distribute(weights, totalMs, minGapMs);
  const offsets: number[] = [];
  let at = 0;
  for (const gap of gaps) {
    at += gap;
    offsets.push(at);
  }
  return offsets;
}

/**
 * Shares `totalMs` out in proportion to `weights` as whole milliseconds, with
 * no share below `minMs` and the shares adding up to exactly `totalMs`.
 */
function distribute(weights: number[], totalMs: number, minMs: number): number[] {
  const n = weights.length;
  const pinned = new Array<boolean>(n).fill(false);
  let shares: number[] = [];

  // Raise shares under the minimum to the minimum and share the rest again,
  // until nothing new falls under it. At most n rounds.
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

  // Largest-remainder rounding keeps the total exact.
  const floors = shares.map((share) => Math.max(minMs, Math.floor(share)));
  let left = totalMs - floors.reduce((a, b) => a + b, 0);
  const order = shares
    .map((share, i) => ({ i, rest: share - Math.floor(share) }))
    .sort((a, b) => b.rest - a.rest);
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

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** When unit `index` is due: session start + its offset + any shift from pauses or delays. */
export function plannedAt(
  session: { session_started_at: string; schedule: number[]; schedule_shift_seconds: number },
  index: number,
): number {
  return Date.parse(session.session_started_at) + session.schedule[index] + session.schedule_shift_seconds * 1000;
}

export interface ScheduleStats {
  first_offset_ms: number;
  last_offset_ms: number;
  min_gap_ms: number;
  median_gap_ms: number;
  max_gap_ms: number;
}

export function scheduleStats(offsets: number[]): ScheduleStats | null {
  if (offsets.length === 0) return null;
  const gaps = offsets.map((at, i) => at - (i === 0 ? 0 : offsets[i - 1]));
  return {
    first_offset_ms: offsets[0],
    last_offset_ms: offsets[offsets.length - 1],
    min_gap_ms: Math.min(...gaps),
    median_gap_ms: Math.round(medianOf(gaps)),
    max_gap_ms: Math.max(...gaps),
  };
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} hours`;
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

/** Retry delay after a transient failure: 1, 2, 4, 8, 16 minutes. */
export function backoffSeconds(attempt: number): number {
  return 60 * 2 ** Math.max(0, attempt - 1);
}

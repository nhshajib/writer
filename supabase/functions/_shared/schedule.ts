/**
 * Schedule basics shared by the planner (pacing.ts), the worker and progress.
 *
 * A schedule is a list of offsets in milliseconds from the session start, one
 * per unit, generated once before the session starts and stored with it, so
 * retries, pauses and resumes follow the plan the user saw.
 */

/**
 * Smallest gap between two insertions of one session. Google Docs allows 60
 * write requests per minute per user; 4 s keeps one session at 15 per minute,
 * so the 3 sessions Pro allows stay well inside the quota.
 */
export const MIN_GAP_SECONDS = 4;

/** Timing variation for sessions created without pace settings (older clients). */
export const LEGACY_VARIATION_PCT = 35;

/** Units far longer or shorter than the typical one are clamped to this multiple of the median length. */
export const SIZE_CLAMP = 3;

/** Most units one session may have; beyond this, a larger unit fits better. */
export const MAX_UNITS = 20_000;

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

/** When unit `index` is due: session start + its offset + any shift from pauses or delays. */
export function plannedAt(
  session: { session_started_at: string; schedule: number[]; schedule_shift_seconds: number },
  index: number,
): number {
  return Date.parse(session.session_started_at) + session.schedule[index] + session.schedule_shift_seconds * 1000;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

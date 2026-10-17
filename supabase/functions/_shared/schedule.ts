/** The worker runs once a minute, so steps can't be closer together than this. */
export const MIN_INTERVAL_SECONDS = 60;

export interface DripPlan {
  steps: number;
  intervalSeconds: number;
}

/**
 * Spreads `words` across `durationSeconds` in evenly spaced steps.
 *
 * The first step runs immediately and the last one at
 * `(steps - 1) * intervalSeconds`, so the whole text is in the document by the
 * end of the chosen duration.
 */
export function planDrip(words: number, durationSeconds: number): DripPlan {
  if (!Number.isInteger(words) || words <= 0) {
    throw new RangeError("words must be a positive integer");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError("durationSeconds must be positive");
  }

  const maxSteps = Math.max(1, Math.floor(durationSeconds / MIN_INTERVAL_SECONDS));
  const steps = Math.min(words, maxSteps);
  const intervalSeconds = steps === 1 ? 0 : Math.floor(durationSeconds / steps);
  return { steps, intervalSeconds };
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

/** Retry delay after a transient failure: 1, 2, 4, 8, 16 minutes. */
export function backoffSeconds(attempt: number): number {
  return MIN_INTERVAL_SECONDS * 2 ** Math.max(0, attempt - 1);
}

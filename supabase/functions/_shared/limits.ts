export type PlanTier = "free" | "pro";

export interface PlanLimits {
  /** null = unlimited */
  dailyWords: number | null;
  maxDurationSeconds: number;
  maxActiveDrips: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { dailyWords: 150, maxDurationSeconds: 30 * 60, maxActiveDrips: 1 },
  pro: { dailyWords: null, maxDurationSeconds: 7 * 24 * 60 * 60, maxActiveDrips: 3 },
};

export const MIN_DURATION_SECONDS = 60;

/** What Free can't do, in the words shown to people. Free keeps every accessibility feature and insertion mode. */
export const PRO_ONLY_MESSAGES = {
  startLater: "Starting a session later is part of Pro. Start it now, or upgrade to schedule it.",
  formatting: "Keeping headings, bold, italic and bullets is part of Pro. Use plain text, or upgrade.",
  headings: "Adding text under a heading is part of Pro. Text goes at the end of the document on Free.",
  drafting: "Simulated typos, false starts and sentence pauses are part of Pro. Upgrade or turn these settings off.",
  speed: "Typing speed and custom timing are part of Pro. Free sessions use the standard pace for a set time.",
};
export const MAX_TEXT_CHARS = 200_000;

export interface CreateDripCheck {
  plan: PlanTier;
  words: number;
  textLength: number;
  durationSeconds: number;
  activeDrips: number;
}

/** Returns a user-facing reason the drip can't be created, or null if it can. */
export function checkCreateLimits(input: CreateDripCheck): string | null {
  const limits = PLAN_LIMITS[input.plan];

  if (input.words <= 0) {
    return "Text is empty.";
  }
  if (input.textLength > MAX_TEXT_CHARS) {
    return `Text is too long (max ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters).`;
  }
  if (input.durationSeconds < MIN_DURATION_SECONDS) {
    return "Duration must be at least 1 minute.";
  }
  if (input.durationSeconds > limits.maxDurationSeconds) {
    return `Your plan allows sessions up to ${formatDuration(limits.maxDurationSeconds)}.`;
  }
  if (input.activeDrips >= limits.maxActiveDrips) {
    return `Your plan allows ${limits.maxActiveDrips} active session${
      limits.maxActiveDrips === 1 ? "" : "s"
    } at a time.`;
  }
  if (limits.dailyWords !== null && input.words > limits.dailyWords) {
    return `Your plan allows ${limits.dailyWords} words per day.`;
  }
  return null;
}

function formatDuration(seconds: number): string {
  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return days === 7 ? "1 week" : `${days} day${days === 1 ? "" : "s"}`;
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${Math.round(seconds / 60)} minutes`;
}

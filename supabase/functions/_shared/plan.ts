import {
  countWords,
  findUnsupportedCharacters,
  groupEvenly,
  INSERTION_UNITS,
  type InsertionUnit,
  splitText,
  unitSize,
} from "./chunker.ts";
import { MAX_TEXT_CHARS, PLAN_LIMITS, type PlanTier } from "./limits.ts";
import {
  buildSchedule,
  formatSeconds,
  MAX_UNITS,
  MIN_GAP_SECONDS,
  minimumDurationSeconds,
  type ScheduleStats,
  scheduleStats,
} from "./schedule.ts";

export interface PlanRequest {
  text: string;
  unit: InsertionUnit;
  durationSeconds: number;
  seed: number;
  plan: PlanTier;
  /** `as_soon_as_possible` writes everything in one insertion. */
  mode?: "scheduled" | "as_soon_as_possible";
}

export interface PlanProblem {
  code:
    | "empty"
    | "too_long"
    | "unsupported_characters"
    | "too_many_units"
    | "duration_too_short"
    | "duration_over_plan"
    | "words_over_plan";
  message: string;
}

/** How long each unit would need at minimum, so the UI can suggest a unit that fits. */
export interface UnitOption {
  unit: InsertionUnit;
  units: number;
  minimum_duration_seconds: number;
  fits: boolean;
}

export interface SessionPlan {
  ok: boolean;
  problems: PlanProblem[];
  unit: InsertionUnit;
  words: number;
  chars: number;
  units: string[];
  /** Offsets in ms from the start; empty when the plan has problems. */
  schedule: number[];
  stats: ScheduleStats | null;
  seed: number;
  duration_seconds: number;
  minimum_duration_seconds: number;
  min_gap_seconds: number;
  options: UnitOption[];
}

/**
 * Splits the text, checks that the session is practical, and builds its
 * schedule. Problems are explained in plain language before anything starts;
 * nothing here changes the text.
 */
export function planSession(req: PlanRequest): SessionPlan {
  const { text, unit, seed } = req;
  const asap = req.mode === "as_soon_as_possible";
  const durationSeconds = asap ? 60 : req.durationSeconds;
  const limits = PLAN_LIMITS[req.plan];
  const words = countWords(text);
  const problems: PlanProblem[] = [];

  let units = splitText(text, unit);
  // "Even parts" groups words so a step lands about once a minute, as before.
  if (unit === "chunk") units = groupEvenly(units, Math.max(1, Math.floor(durationSeconds / 60)));
  if (asap && units.length > 0) units = [text];

  if (!text.trim()) problems.push({ code: "empty", message: "Add the text you want entered." });
  if (text.length > MAX_TEXT_CHARS) {
    problems.push({
      code: "too_long",
      message: `The text is too long (${text.length.toLocaleString("en-US")} characters; the limit is ${
        MAX_TEXT_CHARS.toLocaleString("en-US")
      }).`,
    });
  }

  const unsupported = findUnsupportedCharacters(text);
  if (unsupported.length > 0) {
    const list = unsupported.map((c) => `${c.codePoint} ${c.reason} at position ${c.index + 1}`).join("; ");
    problems.push({
      code: "unsupported_characters",
      message:
        `Google Docs would drop or change some characters, so the document wouldn't match your text exactly: ${list}. ` +
        "Remove or replace them and try again.",
    });
  }

  if (units.length > MAX_UNITS) {
    problems.push({
      code: "too_many_units",
      message:
        `${units.length.toLocaleString("en-US")} ${unitLabel(unit, units.length)} is more than one session can ` +
        `schedule (${MAX_UNITS.toLocaleString("en-US")}). Choose a larger step, such as sentences.`,
    });
  }

  const minimum = minimumDurationSeconds(units.length);
  if (!asap && units.length > 0 && durationSeconds < minimum && units.length <= MAX_UNITS) {
    problems.push({
      code: "duration_too_short",
      message:
        `${units.length.toLocaleString("en-US")} ${unitLabel(unit, units.length)} need at least ${
          formatSeconds(minimum)
        }: TypeWit leaves at least ${MIN_GAP_SECONDS} seconds between insertions to stay within Google Docs' ` +
        `limit of 60 edits a minute. Choose a longer duration or a larger step.`,
    });
  }

  if (durationSeconds > limits.maxDurationSeconds) {
    problems.push({
      code: "duration_over_plan",
      message: `Your plan allows sessions up to ${formatSeconds(limits.maxDurationSeconds)}.`,
    });
  }
  if (limits.dailyWords !== null && words > limits.dailyWords) {
    problems.push({ code: "words_over_plan", message: `Your plan allows ${limits.dailyWords} words per day.` });
  }

  const options: UnitOption[] = INSERTION_UNITS.filter((u) => u !== "chunk").map((u) => {
    const count = u === unit ? units.length : splitText(text, u).length;
    const min = minimumDurationSeconds(count);
    return { unit: u, units: count, minimum_duration_seconds: min, fits: count <= MAX_UNITS && min <= durationSeconds };
  });

  let schedule: number[] = [];
  if (problems.length === 0) {
    schedule = asap ? [1000] : buildSchedule(units.map(unitSize), durationSeconds, seed);
  }

  return {
    ok: problems.length === 0,
    problems,
    unit,
    words,
    chars: text.length,
    units,
    schedule,
    stats: scheduleStats(schedule),
    seed,
    duration_seconds: durationSeconds,
    minimum_duration_seconds: minimum,
    min_gap_seconds: MIN_GAP_SECONDS,
    options,
  };
}

function unitLabel(unit: InsertionUnit, count: number): string {
  const one = count === 1;
  switch (unit) {
    case "sentence":
      return one ? "sentence" : "sentences";
    case "paragraph":
      return one ? "paragraph" : "paragraphs";
    case "word":
      return one ? "word" : "words";
    case "character":
      return one ? "character" : "characters";
    case "chunk":
      return one ? "part" : "parts";
  }
}

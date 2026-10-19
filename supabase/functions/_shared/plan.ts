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
import { buildPacing, CHARS_PER_WORD, type PacingSettings, type PlannedBreak } from "./pacing.ts";
import {
  formatSeconds,
  LEGACY_VARIATION_PCT,
  MAX_UNITS,
  MIN_GAP_SECONDS,
  minimumDurationSeconds,
  type ScheduleStats,
  scheduleStats,
} from "./schedule.ts";

export interface PlanRequest {
  text: string;
  unit: InsertionUnit;
  seed: number;
  plan: PlanTier;
  /** Pace settings. Without them (older clients) the session spreads over `durationSeconds` without breaks. */
  pacing?: PacingSettings;
  durationSeconds?: number;
  /** `as_soon_as_possible` writes everything in one insertion. */
  mode?: "scheduled" | "as_soon_as_possible";
}

export interface PlanProblem {
  code:
    | "empty"
    | "too_long"
    | "unsupported_characters"
    | "too_many_units"
    | "invalid_settings"
    | "duration_too_short"
    | "duration_over_plan"
    | "words_over_plan";
  message: string;
}

/** Things worth knowing that don't stop the session. */
export interface PlanWarning {
  code: "speed_capped" | "breaks_dropped" | "no_breaks_fit";
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
  warnings: PlanWarning[];
  unit: InsertionUnit;
  words: number;
  chars: number;
  units: string[];
  /** Offsets in ms from the start; empty when the plan has problems. */
  schedule: number[];
  breaks: PlannedBreak[];
  stats: ScheduleStats | null;
  seed: number;
  pacing: PacingSettings | null;
  /** Planned (duration mode) or estimated (speed mode) total, breaks included. */
  duration_seconds: number;
  active_seconds: number;
  break_seconds: number;
  minimum_duration_seconds: number;
  min_gap_seconds: number;
  options: UnitOption[];
}

/** Pace settings for requests that only give a duration (older clients). */
export function legacyPacing(durationSeconds: number): PacingSettings {
  return {
    timing: "duration",
    duration_seconds: durationSeconds,
    variation_pct: LEGACY_VARIATION_PCT,
    breaks: {
      enabled: false,
      every_seconds: 600,
      every_variation_pct: 0,
      min_seconds: 30,
      max_seconds: 30,
      align: "any",
    },
  };
}

/**
 * Splits the text, checks that the session is practical, and builds its
 * schedule. Problems are explained in plain language before anything starts;
 * nothing here changes the text.
 */
export function planSession(req: PlanRequest): SessionPlan {
  const { text, unit, seed } = req;
  const asap = req.mode === "as_soon_as_possible";
  const pacing = asap ? null : req.pacing ?? legacyPacing(req.durationSeconds ?? 0);
  const limits = PLAN_LIMITS[req.plan];
  const words = countWords(text);
  const problems: PlanProblem[] = [];
  const warnings: PlanWarning[] = [];

  let units = splitText(text, unit);
  // "Even parts" groups words so a step lands about once a minute, as before.
  if (unit === "chunk") {
    const minutes = pacing?.timing === "duration" ? (pacing.duration_seconds ?? 60) / 60 : words;
    units = groupEvenly(units, Math.max(1, Math.floor(minutes)));
  }
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
  const targetSeconds = pacing?.timing === "duration" ? pacing.duration_seconds ?? 0 : null;
  if (
    pacing && targetSeconds !== null && units.length > 0 && units.length <= MAX_UNITS && targetSeconds >= 60 &&
    targetSeconds < minimum
  ) {
    problems.push({
      code: "duration_too_short",
      message:
        `${units.length.toLocaleString("en-US")} ${unitLabel(unit, units.length)} need at least ${
          formatSeconds(minimum)
        }: TypeWit leaves at least ${MIN_GAP_SECONDS} seconds between insertions to stay within Google Docs' ` +
        `limit of 60 edits a minute. Choose a longer duration or a larger step.`,
    });
  }

  if (limits.dailyWords !== null && words > limits.dailyWords) {
    problems.push({ code: "words_over_plan", message: `Your plan allows ${limits.dailyWords} words per day.` });
  }

  let schedule: number[] = [];
  let breaks: PlannedBreak[] = [];
  let totalMs = asap ? 1000 : 0;
  let activeMs = 0;
  let breakMs = 0;
  if (problems.length === 0 && units.length > 0) {
    if (asap) {
      schedule = [1000];
    } else {
      try {
        const result = buildPacing(units, units.map(unitSize), pacing!, seed);
        schedule = result.offsets;
        breaks = result.breaks;
        totalMs = result.total_ms;
        activeMs = result.active_ms;
        breakMs = result.break_ms;
        if (result.capped_units > 0) {
          warnings.push({
            code: "speed_capped",
            message:
              `At ${pacing!.wpm} WPM, ${result.capped_units.toLocaleString("en-US")} of the ${
                unitLabel(unit, units.length)
              } would need less than ${MIN_GAP_SECONDS} seconds each, but TypeWit waits at least ${MIN_GAP_SECONDS} ` +
              "seconds between insertions (Google Docs allows 60 edits a minute), so those take longer and the " +
              "estimate includes that. A larger step keeps closer to your speed.",
          });
        }
        if (pacing!.breaks.enabled && breaks.length === 0) {
          warnings.push({
            code: "no_breaks_fit",
            message: "No breaks fit: the active time is shorter than the time between breaks, or no unit ends at a " +
              "place where a break is allowed.",
          });
        } else if (result.dropped_breaks > 0) {
          warnings.push({
            code: "breaks_dropped",
            message: `${result.dropped_breaks} planned break${
              result.dropped_breaks === 1 ? "" : "s"
            } didn't fall at an allowed place and ${
              result.dropped_breaks === 1 ? "was" : "were"
            } left out; that time goes to the text instead.`,
          });
        }
      } catch (error) {
        const code = (error as { code?: string }).code;
        problems.push({
          code: code === "duration_too_short" ? "duration_too_short" : "invalid_settings",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const durationSeconds = Math.ceil(totalMs / 1000);
  if (durationSeconds > limits.maxDurationSeconds) {
    problems.push({
      code: "duration_over_plan",
      message: `Your plan allows sessions up to ${formatSeconds(limits.maxDurationSeconds)}; this one would take ${
        formatSeconds(durationSeconds)
      }.`,
    });
  }

  const options: UnitOption[] = INSERTION_UNITS.filter((u) => u !== "chunk").map((u) => {
    const count = u === unit ? units.length : splitText(text, u).length;
    const min = minimumDurationSeconds(count);
    return {
      unit: u,
      units: count,
      minimum_duration_seconds: min,
      fits: count <= MAX_UNITS && (targetSeconds === null || min <= targetSeconds),
    };
  });

  const ok = problems.length === 0;
  return {
    ok,
    problems,
    warnings,
    unit,
    words,
    chars: text.length,
    units,
    schedule: ok ? schedule : [],
    breaks: ok ? breaks : [],
    stats: ok ? scheduleStats(schedule) : null,
    seed,
    pacing,
    duration_seconds: durationSeconds,
    active_seconds: Math.round(activeMs / 1000),
    break_seconds: Math.round(breakMs / 1000),
    minimum_duration_seconds: minimum,
    min_gap_seconds: MIN_GAP_SECONDS,
    options,
  };
}

/** Plain-language explanation of words per minute, shown next to the speed setting. */
export const WPM_EXPLANATION = `A "word" is ${CHARS_PER_WORD} characters, including spaces and punctuation ` +
  `(the standard typing measure), so at 40 WPM, 200 characters take 1 minute of active time.`;

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

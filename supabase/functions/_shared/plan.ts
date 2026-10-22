import { addWritingBlocks, dayPassScheduleProblem, validateWritingBlocks } from "./writingBlocks.ts";
import { compileDrafting, type DraftActionKind, draftingEnabled, validateDrafting } from "./drafting.ts";
import {
  countWords,
  findUnsupportedCharacters,
  groupEvenly,
  INSERTION_UNITS,
  type InsertionUnit,
  splitText,
  unitSize,
} from "./chunker.ts";
import { MAX_TEXT_CHARS, PLAN_LIMITS, type PlanTier, PRO_ONLY_MESSAGES } from "./limits.ts";
import { windowSchedule, type WorkWindow } from "./workWindow.ts";
import { type ChunkFormat, parseFormatted, type TextFormat } from "./markdown.ts";
import { buildPacing, CHARS_PER_WORD, type PacingSettings, type PlannedBreak } from "./pacing.ts";
import {
  formatSeconds,
  LEGACY_VARIATION_PCT,
  MAX_UNITS,
  MIN_GAP_SECONDS,
  minimumDurationSeconds,
  type ScheduleStats,
  scheduleStats,
  seededRandom,
} from "./schedule.ts";

export type SessionRhythm = "steady" | "natural" | "drafting" | "custom";

/** Ready-made rhythms are shared with the UI; no temporary mistakes in the free rhythms. */
export function rhythmPacing(rhythm: Exclude<SessionRhythm, "custom">, seconds: number): PacingSettings {
  const base = standardPacing(seconds);
  return {
    ...base,
    variation_pct: rhythm === "steady" ? 15 : 25,
    drafting: {
      typo_rate_pct: rhythm === "drafting" ? 1 : 0,
      false_start_rate_pct: rhythm === "drafting" ? 1 : 0,
      sentence_pause_seconds: rhythm === "steady" ? 0 : 2,
      sentence_pause_variation_pct: rhythm === "steady" ? 0 : 25,
    },
  };
}

export interface PlanRequest {
  accessExpiresAt?: string | null;
  workWindow?: WorkWindow | null;
  startsAt?: number;
  revisionSweep?: boolean;
  rhythm?: SessionRhythm;
  text: string;
  unit: InsertionUnit;
  seed: number;
  plan: PlanTier;
  /** Pace settings. Without them (older clients) the session spreads over `durationSeconds` without breaks. */
  pacing?: PacingSettings;
  durationSeconds?: number;
  /** `as_soon_as_possible` writes everything in one insertion. */
  mode?: "scheduled" | "as_soon_as_possible";
  /** Plain, legacy Markdown or structured rich text; execution units contain only document text. */
  format?: TextFormat;
}

export interface PlanProblem {
  expires_at?: string;
  resume_at?: string;
  finish_at?: string;
  code:
    | "empty"
    | "too_long"
    | "unsupported_characters"
    | "too_many_units"
    | "invalid_settings"
    | "duration_too_short"
    | "duration_over_plan"
    | "words_over_plan"
    | "pro_feature";
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
  block_summary?: { blocks: number; writing_seconds: number; rest_seconds: number; waiting_seconds: number };
  ok: boolean;
  problems: PlanProblem[];
  warnings: PlanWarning[];
  unit: InsertionUnit;
  words: number;
  chars: number;
  units: string[];
  /** Complete, immutable execution script. Empty insertion strings represent backspaces. */
  chunk_deletions: number[];
  action_kinds: DraftActionKind[];
  /** Approved source units, independent of temporary simulated edits. */
  source_chunks: string[];
  source_unit_ends: number[];
  drafting_stats: { typos: number; false_starts: number; sentence_pauses: number; extra_edits: number };
  text_format: TextFormat;
  /** Supported formatting for each unit. */
  chunk_formats: ChunkFormat[] | null;
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

/** The standard pace Free sessions use: the same values as the app's defaults. */
export function standardPacing(durationSeconds: number): PacingSettings {
  return {
    timing: "duration",
    duration_seconds: durationSeconds,
    variation_pct: 25,
    breaks: {
      enabled: true,
      every_seconds: 8 * 60,
      every_variation_pct: 30,
      min_seconds: 20,
      max_seconds: 120,
      align: "sentence",
    },
  };
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
  const { unit, seed } = req;
  const source = req.text;
  const format: TextFormat = req.format === "rich" ? "rich" : req.format === "markdown" ? "markdown" : "plain";
  const parsed = parseFormatted(source, format);
  // The document gets the text without Markdown markers.
  const text = parsed ? parsed.plain : source;
  const asap = req.mode === "as_soon_as_possible";
  let requested = asap
    ? null
    : req.rhythm && req.rhythm !== "custom"
    ? rhythmPacing(req.rhythm, req.pacing?.duration_seconds ?? req.durationSeconds ?? 0)
    : req.pacing ?? legacyPacing(req.durationSeconds ?? 0);
  if (req.revisionSweep && requested) {
    requested = {
      ...requested,
      drafting: {
        typo_rate_pct: 0,
        false_start_rate_pct: 0,
        sentence_pause_seconds: 0,
        sentence_pause_variation_pct: 0,
        ...requested.drafting,
        revision_sweep: true,
      },
    };
  }
  // Free uses the standard pace for a chosen duration; typing speed and custom timing are Pro.
  const freeSpeed = req.plan !== "pro" && requested?.timing === "speed";
  const basePacing = req.plan !== "pro" && requested && req.pacing && !freeSpeed
    ? (req.rhythm === "natural" || req.rhythm === "steady")
      ? rhythmPacing(req.rhythm, requested.duration_seconds ?? 0)
      : standardPacing(requested.duration_seconds ?? 0)
    : requested;
  // Word grouping is available on every plan, independently of premium pace controls.
  let pacing = basePacing && req.pacing?.word_grouping !== undefined
    ? { ...basePacing, word_grouping: req.pacing.word_grouping }
    : basePacing;
  const blocks = req.pacing?.writing_blocks;
  const blockProblem = validateWritingBlocks(blocks);
  if (pacing && blocks && !blockProblem) {
    pacing = {
      ...pacing,
      writing_blocks: blocks,
      ...(pacing.timing === "duration" ? { duration_seconds: blocks.writing_duration_seconds } : {}),
    };
  }
  const limits = PLAN_LIMITS[req.plan];
  const words = countWords(text);
  const problems: PlanProblem[] = [];
  if (blockProblem) problems.push({ code: "invalid_settings", message: blockProblem });
  if (blocks && req.plan === "free") {
    problems.push({ code: "pro_feature", message: "Writing blocks are included with Day Pass and Pro." });
  }
  if (blocks && asap) {
    problems.push({
      code: "invalid_settings",
      message: "Writing blocks need a scheduled session. Turn off All at once.",
    });
  }
  if (blocks && pacing?.timing === "duration" && blocks.writing_duration_seconds === undefined) {
    problems.push({ code: "invalid_settings", message: "Choose the writing time before adding long breaks." });
  }
  if (req.pacing?.word_grouping !== undefined && !["random", "single"].includes(req.pacing.word_grouping)) {
    problems.push({ code: "invalid_settings", message: "Choose single words or random word groups." });
  }
  if (req.revisionSweep && req.plan !== "pro") {
    problems.push({ code: "pro_feature", message: "The final revision pass is part of Pro." });
  }
  if (req.revisionSweep && asap) {
    problems.push({ code: "invalid_settings", message: "The final revision pass needs a scheduled session." });
  }
  if (req.workWindow && req.plan === "free") {
    problems.push({ code: "pro_feature", message: "Writing hours are included with Day Pass and Pro." });
  }
  const suppliedDrafting = req.rhythm && req.rhythm !== "custom"
    ? requested?.drafting
    : req.revisionSweep && requested
    ? requested.drafting
    : req.pacing?.drafting;
  const draftingProblem = validateDrafting(suppliedDrafting);
  if (draftingProblem) problems.push({ code: "invalid_settings", message: draftingProblem });
  const hasDrafting = !draftingProblem && draftingEnabled(suppliedDrafting);
  if ((hasDrafting && req.rhythm !== "natural" || req.rhythm === "drafting") && req.plan !== "pro") {
    problems.push({ code: "pro_feature", message: PRO_ONLY_MESSAGES.drafting });
  }
  if (hasDrafting && asap) {
    problems.push({
      code: "invalid_settings",
      message: "Simulated drafting needs a scheduled session. Turn it off for All at once.",
    });
  }
  if (freeSpeed) problems.push({ code: "pro_feature", message: PRO_ONLY_MESSAGES.speed });
  const warnings: PlanWarning[] = [];

  const split = (u: InsertionUnit) => {
    const parts = splitText(text, u);
    if (u !== "word" || pacing?.word_grouping === "single") return parts;
    const random = seededRandom(seed ^ 0x776f7264);
    const groups: string[] = [];
    for (let i = 0; i < parts.length;) {
      const size = 1 + Math.floor(random() * 5);
      groups.push(parts.slice(i, i + size).join(""));
      i += size;
    }
    return groups;
  };
  let units = split(unit);
  // "Even parts" groups words so a step lands about once a minute, as before.
  if (unit === "chunk") {
    const minutes = pacing?.timing === "duration" ? (pacing.duration_seconds ?? 60) / 60 : words;
    units = groupEvenly(units, Math.max(1, Math.floor(minutes)));
  }
  if (asap && units.length > 0) units = [text];
  const sourceChunks = units;
  const script = compileDrafting(
    sourceChunks,
    (req.plan === "pro" || req.rhythm === "natural") && !asap && !draftingProblem ? suppliedDrafting : undefined,
    seed,
    parsed,
  );
  units = script.chunks;

  if (!text.trim()) problems.push({ code: "empty", message: "Add the text you want entered." });
  if (source.length > MAX_TEXT_CHARS) {
    problems.push({
      code: "too_long",
      message: `The text is too long (${source.length.toLocaleString("en-US")} characters; the limit is ${
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

  const minimum = minimumDurationSeconds(units.length) +
    Math.ceil(script.sentence_pauses_ms.reduce((sum, ms) => sum + ms, 0) / 1000);
  const targetSeconds = pacing?.timing === "duration" ? pacing.duration_seconds ?? 0 : null;
  if (
    pacing && targetSeconds !== null && units.length > 0 && units.length <= MAX_UNITS && targetSeconds >= 60 &&
    targetSeconds < minimum
  ) {
    problems.push({
      code: "duration_too_short",
      message:
        `${units.length.toLocaleString("en-US")} ${
          script.stats.extra_edits > 0 ? "scheduled edits" : unitLabel(unit, units.length)
        } need at least ${
          formatSeconds(minimum)
        }: TypeWit leaves at least ${MIN_GAP_SECONDS} seconds between insertions to stay within Google Docs' ` +
        `limit of 60 edits a minute. Choose a longer duration or a larger step${
          hasDrafting ? ", or lower the simulated-error rates" : ""
        }.`,
    });
  }

  if (limits.dailyWords !== null && words > limits.dailyWords) {
    problems.push({ code: "words_over_plan", message: `Your plan allows ${limits.dailyWords} words per day.` });
  }

  // Refuse over-plan durations before buildPacing allocates break arrays.
  // Preserve the existing plan-limit code and wording for these requests.
  if (targetSeconds !== null && Number.isFinite(targetSeconds) && targetSeconds > limits.maxDurationSeconds) {
    problems.push({
      code: "duration_over_plan",
      message: `Your plan allows sessions up to ${formatSeconds(limits.maxDurationSeconds)}; this one would take ${
        formatSeconds(targetSeconds)
      }.`,
    });
  }
  let schedule: number[] = [];
  let breaks: PlannedBreak[] = [];
  let totalMs = asap ? 1000 : 0;
  let activeMs = 0;
  let breakMs = 0;
  let blockSummary: SessionPlan["block_summary"];
  if (problems.length === 0 && units.length > 0) {
    if (asap) {
      schedule = [1000];
    } else {
      try {
        const baseResult = buildPacing(
          units,
          units.map((u, i) => Math.max(unitSize(u), script.chunk_deletions[i])),
          blocks ? { ...pacing!, breaks: { ...pacing!.breaks, enabled: false } } : pacing!,
          seed,
          script.sentence_pauses_ms,
        );
        const result = blocks ? addWritingBlocks(baseResult, script.source_unit_ends, blocks) : baseResult;
        if (blocks) {
          const rests = result.breaks.filter((b) => b.kind === "block");
          blockSummary = {
            blocks: rests.length + 1,
            writing_seconds: Math.ceil(baseResult.total_ms / 1000),
            rest_seconds: rests.reduce((sum, b) => sum + (b.rest_ms ?? 0), 0) / 1000,
            waiting_seconds: 0,
          };
        }
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
        if (!blocks && pacing!.breaks.enabled && breaks.length === 0) {
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

  if (req.workWindow && problems.length === 0) {
    try {
      const before = schedule;
      schedule = windowSchedule(schedule, req.startsAt ?? Date.now(), req.workWindow, limits.maxDurationSeconds * 1000);
      breaks = breaks.map((b) => ({ ...b, start_ms: b.start_ms + (schedule[b.after_index] - before[b.after_index]) }));
      const projected = schedule.at(-1) ?? totalMs;
      if (blockSummary) blockSummary.waiting_seconds = Math.ceil((projected - totalMs) / 1000);
      totalMs = projected;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      problems.push({
        code: "duration_over_plan",
        ...(req.plan === "day_pass" && req.accessExpiresAt ? { expires_at: req.accessExpiresAt } : {}),
        message: req.plan === "day_pass" && req.accessExpiresAt
          ? "The writing hours and breaks push this session beyond your Day Pass access. Choose a shorter schedule or upgrade to Pro."
          : `Your plan allows sessions up to ${
            formatSeconds(limits.maxDurationSeconds)
          }. Choose wider writing hours or a shorter session.`,
      });
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

  if (req.plan === "day_pass" && req.accessExpiresAt && problems.length === 0) {
    const expiryProblem = dayPassScheduleProblem(schedule, breaks, req.startsAt ?? Date.now(), req.accessExpiresAt);
    if (expiryProblem) problems.push(expiryProblem);
  }
  // Preserve the canonical duration meaning; the separate writing input survives run-again and edits.
  if (blocks && pacing?.timing === "duration") pacing = { ...pacing, duration_seconds: durationSeconds };

  const options: UnitOption[] = INSERTION_UNITS.filter((u) => u !== "chunk").map((u) => {
    const alternative = u === unit ? script : compileDrafting(
      split(u),
      (req.plan === "pro" || req.rhythm === "natural") && !asap && !draftingProblem ? suppliedDrafting : undefined,
      seed,
    );
    const count = alternative.chunks.length;
    const min = minimumDurationSeconds(count) +
      Math.ceil(alternative.sentence_pauses_ms.reduce((sum, ms) => sum + ms, 0) / 1000);
    return {
      unit: u,
      units: count,
      minimum_duration_seconds: min,
      fits: count <= MAX_UNITS && (targetSeconds === null || min <= targetSeconds),
    };
  });

  const ok = problems.length === 0;
  return {
    ...(blockSummary ? { block_summary: blockSummary } : {}),
    text_format: format,
    chunk_formats: script.chunk_formats,
    chunk_deletions: script.chunk_deletions,
    action_kinds: script.action_kinds,
    source_chunks: sourceChunks,
    source_unit_ends: script.source_unit_ends,
    drafting_stats: script.stats,
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

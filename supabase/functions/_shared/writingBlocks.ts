/** Optional writing blocks. Source boundaries always include completed corrections. */
import type { Pacing, PlannedBreak } from "./pacing.ts";
import type { PlanProblem } from "./plan.ts";

export interface WritingBlocks {
  block_seconds: number;
  break_seconds: number;
  /** Writing time only; canonical session duration still includes all rests. */
  writing_duration_seconds?: number;
}
export function validateWritingBlocks(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return "Choose valid writing blocks.";
  const value = raw as Record<string, unknown>;
  for (
    const [key, min, max] of [["block_seconds", 300, 43200], ["break_seconds", 900, 28800], [
      "writing_duration_seconds",
      60,
      604800,
    ]] as const
  ) {
    if (key === "writing_duration_seconds" && value[key] === undefined) continue;
    if (!Number.isInteger(value[key]) || (value[key] as number) < min || (value[key] as number) > max) {
      return key === "block_seconds"
        ? "Writing blocks must be between 5 minutes and 12 hours."
        : key === "break_seconds"
        ? "Breaks between blocks must be between 15 minutes and 8 hours."
        : "Choose writing time between 1 minute and 1 week.";
    }
  }
  return null;
}

/** Linear pass; never removes a requested rest to fit a shorter deadline. */
export function addWritingBlocks(base: Pacing, ends: readonly number[], settings: WritingBlocks): Pacing {
  const positions = new Set<number>();
  let blockStart = 0;
  for (const end of ends) {
    const at = base.offsets[end - 1];
    if (end < base.offsets.length && at - blockStart >= settings.block_seconds * 1000) {
      positions.add(end - 1);
      blockStart = at;
    }
  }
  const breaksByIndex = new Map(base.breaks.map((b) => [b.after_index, b]));
  const breaks: PlannedBreak[] = [];
  let shift = 0;
  const offsets = base.offsets.map((at, i) => {
    const due = at + shift;
    const existing = breaksByIndex.get(i);
    const rest = positions.has(i) ? settings.break_seconds * 1000 : 0;
    if (existing || rest) {
      breaks.push({
        after_index: i,
        start_ms: (existing?.start_ms ?? at) + shift,
        duration_ms: (existing?.duration_ms ?? 0) + rest,
        ...(rest ? { kind: "block" as const, rest_ms: rest } : {}),
      });
    }
    shift += rest;
    return due;
  });
  return { ...base, offsets, breaks, total_ms: base.total_ms + shift, break_ms: base.break_ms + shift };
}

/** Server-side expiry checks; equality with expiry is outside access. */
export function dayPassScheduleProblem(
  schedule: readonly number[],
  breaks: readonly PlannedBreak[],
  startsAt: number,
  expiresAt: string,
): PlanProblem | null {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || !schedule.length) return null;
  const restart = breaks.find((b) => b.kind === "block" && startsAt + schedule[b.after_index + 1] >= expiry);
  if (restart) {
    return {
      code: "duration_over_plan",
      message:
        "Your Day Pass expires before writing can resume after this break. Choose a shorter break or upgrade to Pro.",
      expires_at: expiresAt,
      resume_at: new Date(startsAt + schedule[restart.after_index + 1]).toISOString(),
    };
  }
  const finish = startsAt + schedule[schedule.length - 1];
  return finish >= expiry
    ? {
      code: "duration_over_plan",
      message:
        "This session would finish after your Day Pass expires. Reduce writing time or breaks, or upgrade to Pro.",
      expires_at: expiresAt,
      finish_at: new Date(finish).toISOString(),
    }
    : null;
}

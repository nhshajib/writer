import { compileDrafting, executionText } from "./drafting.ts";
import { parseFormatted, type TextFormat } from "./markdown.ts";
import { type PlanRequest, planSession } from "./plan.ts";
import type { PlannedBreak } from "./pacing.ts";
import type { SessionRow } from "./session.ts";

export type EditableSession = SessionRow & {
  text: string;
  text_format?: "plain" | "markdown" | "rich";
  paused_at: string | null;
  attention?: string | null;
  breaks?: PlannedBreak[];
};

/** Replace only unentered actions, retaining the confirmed prefix and document anchor. */
export function replanPaused(
  row: EditableSession,
  request: Omit<PlanRequest, "text" | "plan" | "format">,
  replacement?: string,
  replacementFormat: TextFormat = "plain",
) {
  const written = row.chunks_written;
  if (!row.paused_at || !Number.isFinite(Date.parse(row.paused_at))) {
    throw new Error("Pause the session before editing settings.");
  }
  if (row.pending_index !== null || row.attention) {
    throw new Error("Resolve the session's document check before changing settings.");
  }
  const source = row.source_chunks ?? row.chunks;
  const ends = row.source_unit_ends ?? source.map((_, i) => i + 1);
  const completed = ends.filter((end) => end <= written).length;
  const prefixSource = source.slice(0, completed);
  const prefixEnds = ends.slice(0, completed);
  let partial = "";
  if (written > 0 && ends[completed - 1] !== written) {
    const boundary = ends[completed - 1] ?? 0;
    partial = executionText(row.chunks, row.chunk_deletions, boundary, written);
    const action = row.action_kinds?.[written - 1];
    if (
      !partial || !(source[completed] ?? "").startsWith(partial) || action === "typo" || action === "false_start" ||
      action === "backspace"
    ) {
      throw new Error("A temporary edit still needs correction. Resume until it is corrected, then pause again.");
    }
    prefixSource.push(partial);
    prefixEnds.push(written);
  }
  const remaining = replacement === undefined
    ? source.slice(completed).join("").slice(partial.length)
    : parseFormatted(replacement, replacementFormat)?.plain ?? replacement;
  if (!remaining.trim()) throw new Error("There is no remaining text to reschedule.");
  const plan = planSession({
    ...request,
    text: replacement ?? remaining,
    plan: "pro",
    format: replacement === undefined ? "plain" : replacementFormat,
  });
  if (!plan.ok) throw new Error(plan.problems.map((p) => p.message).join(" "));
  let formats = plan.chunk_formats;
  if ((row.text_format === "markdown" || row.text_format === "rich") && replacement === undefined) {
    const parsed = parseFormatted(row.text, row.text_format)!;
    const offset = prefixSource.join("").length;
    const clip = <T extends { start: number; end: number }>(ranges: T[]) =>
      ranges.filter((r) => r.end > offset)
        .map((r) => ({ ...r, start: Math.max(0, r.start - offset), end: r.end - offset }));
    formats = compileDrafting(plan.source_chunks, plan.pacing?.drafting, request.seed, {
      plain: remaining,
      paragraphs: clip(parsed.paragraphs),
      spans: clip(parsed.spans),
    }).chunk_formats;
  }
  const anchor = Math.max(
    row.schedule[written - 1] ?? 0,
    Date.parse(row.paused_at!) - Date.parse(row.session_started_at) - row.schedule_shift_seconds * 1000,
  );
  const schedule = [...row.schedule.slice(0, written), ...plan.schedule.map((ms) => anchor + ms)];
  return {
    chunks: [...row.chunks.slice(0, written), ...plan.units],
    chunk_deletions: [...(row.chunk_deletions ?? row.chunks.map(() => 0)).slice(0, written), ...plan.chunk_deletions],
    action_kinds: [
      ...(row.action_kinds ?? row.chunks.map(() => "insert" as const)).slice(0, written),
      ...plan.action_kinds,
    ],
    source_chunks: [...prefixSource, ...plan.source_chunks],
    source_unit_ends: [...prefixEnds, ...plan.source_unit_ends.map((end) => written + end)],
    chunk_formats: formats || row.chunk_formats
      ? [
        ...(row.chunk_formats ?? row.chunks.map(() => ({ paragraphs: [], spans: [] }))).slice(0, written),
        ...(formats ?? plan.units.map(() => ({ paragraphs: [], spans: [] }))),
      ]
      : null,
    total_chunks: written + plan.units.length,
    schedule,
    breaks: [
      ...(row.breaks ?? []).filter((b) => b.after_index < written - 1),
      ...plan.breaks.map((b) => ({ ...b, after_index: b.after_index + written, start_ms: b.start_ms + anchor })),
    ],
    duration_seconds: Math.max(1, Math.ceil(schedule[schedule.length - 1] / 1000)),
    deadline_at: new Date(
      Date.parse(row.session_started_at) + row.schedule_shift_seconds * 1000 + schedule[schedule.length - 1],
    ).toISOString(),
    interval_seconds: Math.round((plan.stats?.median_gap_ms ?? 0) / 1000),
    insertion_unit: request.unit,
    pacing: plan.pacing,
    timing_mode: plan.pacing!.timing,
    mode: "scheduled",
    schedule_seed: request.seed,
    next_run_at: null,
    retry_at: null,
  };
}

import { span, when } from "./time";
import { type DripEvent, EVENT_LABEL } from "./types";

export type Detail = Record<string, unknown>;
export const str = (v: unknown) => (typeof v === "string" ? v : null);
export const num = (v: unknown) => (typeof v === "number" ? v : null);

/** One line of the session log, in plain words. */
export function describe(event: DripEvent): { text: string; sub?: string; late?: boolean } {
  const d = event.detail as Detail;
  const label = EVENT_LABEL[event.kind] ?? event.kind;
  switch (event.kind) {
    case "chunk_written": {
      const action = str(d.action_kind);
      const names: Record<string, string> = { typo: "Simulated neighbor-key typo entered", false_start: "Simulated false start entered", backspace: "Simulated backspace confirmed", correction: "Correction confirmed" };
      if (action && names[action]) return {
        text: names[action],
        sub: d.recovered ? "Confirmed from the document after an interruption." : "Automated drafting edit; final approved text is unchanged.",
      };
      const part = `Part ${num(d.written)} of ${num(d.total)} entered (${num(d.chars)} characters)`;
      if (d.recovered) return { text: `${part}, confirmed from the document after an interruption`, sub: `Planned ${when(str(d.planned_at)!, true)}` };
      const late = num(d.late_seconds) ?? 0;
      return {
        text: part,
        sub: `Planned ${when(str(d.planned_at)!, true)} · entered ${when(str(d.actual_at)!, true)}${late >= 1 ? ` · ${late} s late` : ""}`,
        late: late >= 15,
      };
    }
    case "schedule_shifted":
      return { text: label, sub: `Moved ${span((num(d.by_seconds) ?? 0) * 1000)} later · now finishing ${when(str(d.finish_at)!)}`, late: true };
    case "paused":
      return { text: d.by === "system" ? "Paused by TypeWit" : "Paused by you" };
    case "resumed": {
      const finish = str(d.finish_at);
      return {
        text: label,
        sub: `After ${span((num(d.paused_seconds) ?? 0) * 1000)} paused, the rest moved later${finish ? ` · now finishing ${when(finish)}` : ""}` +
          (d.continued_from_current_end ? " · continuing after the document's current end" : ""),
      };
    }
    case "attention":
      return { text: label, sub: str(d.message) ?? undefined, late: true };
    case "retry_scheduled":
      return { text: label, sub: `Attempt ${num(d.attempts)}, retrying in ${span((num(d.delay_seconds) ?? 0) * 1000)}: ${str(d.error) ?? ""}`, late: true };
    case "connection_checked":
      return d.ok
        ? { text: label, sub: "The document opened and is editable. Nothing was changed." }
        : { text: "Connection check failed before the first insertion", sub: str(d.problem) ?? undefined, late: true };
    case "insertion_uncertain":
      return {
        text: `Part ${(num(d.index) ?? 0) + 1}: ${label.toLowerCase()}`,
        sub: "TypeWit checks the document before continuing, so the part is neither repeated nor skipped.",
        late: true,
      };
    case "created":
      return { text: label, sub: str(d.finish_at) ? `Planned to finish ${when(str(d.finish_at)!)}` : undefined };
    case "completed":
      return {
        text: label,
        sub: d.text_at_end_matches === true
          ? "Checked: the document ends with exactly the approved text."
          : d.text_at_end_matches === false
          ? "Warning: the end of the document doesn't match the approved text."
          : undefined,
      };
    default:
      return { text: label };
  }
}

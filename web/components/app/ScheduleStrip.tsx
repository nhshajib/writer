import { when } from "@/lib/time";

interface Props {
  /** Planned offsets in ms from the start, one per insertion. */
  offsets: number[];
  /** Epoch ms the offsets count from (start plus any shift); omit for a preview. */
  startMs?: number;
  /** Insertions already confirmed in the document. */
  done?: number;
  /** Shows a "now" marker while the session runs. */
  nowMs?: number;
  label: string;
}

/**
 * The whole schedule as one strip: a mark per insertion, placed at its planned
 * time. Entered ones are filled. Purely visual; the summary is in aria-label.
 */
export function ScheduleStrip({ offsets, startMs, done = 0, nowMs, label }: Props) {
  if (offsets.length === 0) return null;
  const total = offsets[offsets.length - 1] || 1;
  const x = (offset: number) => Math.min(1000, Math.max(0, (offset / total) * 1000));
  const now = startMs !== undefined && nowMs !== undefined ? x(nowMs - startMs) : null;
  const thin = offsets.length > 300;

  return (
    <figure className="strip">
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" role="img" aria-label={label} focusable="false">
        <rect x="0" y="18" width="1000" height="4" rx="2" style={{ fill: "var(--surface-2)" }} />
        {offsets.map((offset, i) => (
          <rect
            key={i}
            x={x(offset) - (thin ? 0.5 : 1.5)}
            y={i < done ? 8 : 12}
            width={thin ? 1 : 3}
            height={i < done ? 24 : 16}
            rx="1"
            style={{ fill: i < done ? "var(--accent)" : "var(--border-strong)" }}
          />
        ))}
        {now !== null && now > 0 && now < 1000 && (
          <rect x={now - 1} y="0" width="2" height="40" style={{ fill: "var(--text)" }} />
        )}
      </svg>
      {startMs !== undefined && (
        <figcaption className="row small muted" aria-hidden="true" style={{ justifyContent: "space-between" }}>
          <span>{when(startMs)}</span>
          <span>{when(startMs + total)}</span>
        </figcaption>
      )}
    </figure>
  );
}

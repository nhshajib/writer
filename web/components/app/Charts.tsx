/* Small, dependency-free charts. Each has a text equivalent for screen readers. */

/** A circular progress meter. */
export function ProgressRing({ value, size = 56, stroke = 6, tone = "accent", label }: {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "warn" | "good";
  /** Accessible description; omit when the number is shown as text next to it. */
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg className={`ring ring-${tone}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-track" />
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-value"
        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

/** A tiny trend line for a KPI card. Decorative: the card states the number. */
export function Sparkline({ values, width = 96, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`);
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={`0,${height} ${points.join(" ")} ${width},${height}`} className="spark-fill" />
      <polyline points={points.join(" ")} className="spark-line" />
    </svg>
  );
}

/** A round axis maximum: 1, 2 or 5 times a power of ten, at or above the largest value. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value)!;
  return step * power;
}

/** Vertical bars with day labels and a light value axis, plus a hidden table with the same numbers. */
export function BarChart({ data, unit, caption }: { data: { label: string; full: string; value: number }[]; unit: string; caption: string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0];
  return (
    <figure className="bars">
      <div className="bars-chart" aria-hidden="true">
        <div className="bars-axis">{ticks.map((t) => <span key={t}>{Math.round(t).toLocaleString()}</span>)}</div>
        <div className="bars-plot">
          <div className="bars-grid">{ticks.map((t) => <span key={t} />)}</div>
          {data.map((d) => (
            <div key={d.full} className="bar-col" title={`${d.full}: ${d.value.toLocaleString()} ${unit}`}>
              <span className="bar-fill" style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%` }} />
              <span className="bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>{data.map((d) => <tr key={d.full}><th scope="row">{d.full}</th><td>{d.value} {unit}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

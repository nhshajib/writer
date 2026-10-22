"use client";
import { useId } from "react";
import Link from "next/link";
import type { WorkWindow } from "../../../supabase/functions/_shared/workWindow";

export function WorkWindowControls({ value, onChange, enabled }: { value: WorkWindow | null; onChange: (value: WorkWindow | null) => void; enabled: boolean }) {
  const id = useId();
  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return <fieldset className="field" style={{ marginTop: "1rem" }}>
    <legend className="label">Writing hours</legend>
    <label className="check"><input type="checkbox" checked={Boolean(value)} disabled={!enabled} onChange={e => onChange(e.target.checked ? { start: "09:00", end: "17:00", time_zone: zone() } : null)} />Write only during chosen hours</label>
    <p className="hint">{enabled ? "Optional. Try 9 AM–5 PM in your time zone. Outside these hours the session waits automatically, then continues. Overnight windows work too. This can move the finish time later." : <>Included with <Link href="/app/billing/">Day Pass and Pro</Link>. Free sessions can still run in the background.</>}</p>
    {value && <div className="row" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
      <div className="field"><label className="label" htmlFor={`${id}-start`}>Write from</label><input id={`${id}-start`} type="time" value={value.start} required onChange={e => onChange({ ...value, start: e.target.value })} /></div>
      <div className="field"><label className="label" htmlFor={`${id}-end`}>Write until</label><input id={`${id}-end`} type="time" value={value.end} required onChange={e => onChange({ ...value, end: e.target.value })} /></div>
      <div className="field"><label className="label" htmlFor={`${id}-zone`}>Writing time zone</label><input id={`${id}-zone`} value={value.time_zone} placeholder="Asia/Dhaka" required onChange={e => onChange({ ...value, time_zone: e.target.value })} aria-describedby={`${id}-zone-help`} /><span id={`${id}-zone-help`} className="hint">An IANA name, such as Asia/Dhaka or America/New_York. Daylight saving is handled automatically.</span></div>
    </div>}
  </fieldset>;
}

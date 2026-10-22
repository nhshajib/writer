"use client";
import { useId, useState } from "react";
import { PlanLock } from "./PlanLock";
import { canUse } from "@/lib/plans";
import type { PlanTier } from "../../../supabase/functions/_shared/limits";
import type { WritingBlocks } from "../../../supabase/functions/_shared/writingBlocks";
import type { Pace } from "./PaceControls";

export function blocksFromPace(pace: Pace): WritingBlocks | null {
  return pace.blocksOn ? { block_seconds: pace.blockMinutes * 60, break_seconds: pace.blockBreakMinutes * 60 } : null;
}
export function blockPace(value: WritingBlocks | null): Partial<Pace> {
  return { blocksOn: Boolean(value), ...(value ? { blockMinutes: value.block_seconds / 60, blockBreakMinutes: value.break_seconds / 60 } : {}) };
}
export function WritingBlockControls({ value, onChange, plan, expiresAt }: {
  value: WritingBlocks | null; onChange: (value: WritingBlocks | null) => void; plan: PlanTier; expiresAt?: string | null;
}) {
  const enabled = canUse(plan, "writingBlocks");
  return <fieldset className="writing-block-controls">
    <legend className="label">Writing blocks<PlanLock plan={plan} feature="writingBlocks" /></legend>
    <label className="check" {...(!enabled ? { "data-locked": "writingBlocks" } : {})}>
      <input type="checkbox" checked={enabled && Boolean(value)} aria-describedby={!enabled ? "writing-block-plan-hint" : undefined} onChange={e => { if (enabled) onChange(e.target.checked ? { block_seconds: 3600, break_seconds: 10800 } : null); }} />
      <span>Take a long break between writing blocks</span>
    </label>
    <p id="writing-block-plan-hint" className="hint">Optional. Enter text for a while, rest, then continue automatically. Sentence pauses stay on; these breaks replace the usual longer-break schedule.</p>
    {enabled && value && <>
      <div className="block-duration-grid">
        <DurationChoice label="Write for about" value={value.block_seconds / 60} min={5} max={720} options={[5, 15, 30, 60, 120, 240, 360, 480, 720]} onChange={minutes => onChange({ ...value, block_seconds: minutes * 60 })} />
        <DurationChoice label="Break between blocks" value={value.break_seconds / 60} min={15} max={480} options={[15, 30, 60, 120, 180, 240, 360, 480]} onChange={minutes => onChange({ ...value, break_seconds: minutes * 60 })} />
      </div>
      <p className="hint">Writing finishes a text step and any correction before resting. No long break is added after the final block. Google decides how edits appear in version history.</p>
      {plan === "day_pass" && expiresAt && <p className="hint">Day Pass ends {new Date(expiresAt).toLocaleString()}. Every restart and the finish must be before then.</p>}
    </>}
  </fieldset>;
}
function DurationChoice({ label, value, min, max, options, onChange }: {
  label: string; value: number; min: number; max: number; options: number[]; onChange: (minutes: number) => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(!options.includes(value));
  return <div className="field">
    <label className="label" htmlFor={id}>{label}</label>
    <select id={id} value={custom || !options.includes(value) ? "custom" : value} onChange={e => { setCustom(e.target.value === "custom"); if (e.target.value !== "custom") onChange(Number(e.target.value)); }}>
      {options.map(minutes => <option value={minutes} key={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`}</option>)}
      <option value="custom">Custom minutes…</option>
    </select>
    {(custom || !options.includes(value)) && <label className="hint block-custom">{label} (minutes)
      <input aria-label={`${label} (minutes)`} type="number" min={min} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>}
  </div>;
}

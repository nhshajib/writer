"use client";
import { SentenceStepHint } from "./SentenceStepHint";
import { DEFAULT_INSERTION_UNIT } from "../../../supabase/functions/_shared/chunker.ts";
import { WritingBlockControls } from "./WritingBlockControls";
import type { WritingBlocks } from "../../../supabase/functions/_shared/writingBlocks";

import { type FormEvent, useState } from "react";
import { PlanLock } from "@/components/app/PlanLock";
import { useToast } from "@/components/Toast";
import { type SessionDefaults, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { DURATIONS } from "@/lib/durations";
import { canUse, PLAN_NAME, planForMinutes } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { type InsertionUnit, UNIT_LABEL } from "@/lib/types";

const UNITS: InsertionUnit[] = ["sentence", "word", "paragraph", "character", "chunk"];

/** Saves `defaults` on the account. Returns an error message, or null. */
export async function saveSessionDefaults(defaults: SessionDefaults): Promise<string | null> {
  const { error } = await supabase().rpc("set_session_defaults", { defaults });
  return error ? error.message : null;
}

/** Settings › Session defaults: what New session starts from, on any device. Pro also manages saved presets here. */
export function SessionDefaultsForm() {
  const { profile, setProfile } = useDashboard();
  const toast = useToast();
  const saved = profile.session_defaults ?? {};
  const [rhythm, setRhythm] = useState(saved.rhythm ?? "natural");
  const [minutes, setMinutes] = useState(String(saved.minutes ?? ""));
  const [grouping, setGrouping] = useState(saved.word_grouping ?? "random");
  const [unit, setUnit] = useState<InsertionUnit>(saved.unit ?? DEFAULT_INSERTION_UNIT);
  const [blocks, setBlocks] = useState<WritingBlocks | null>(canUse(profile.plan, "writingBlocks") ? saved.writing_blocks ?? null : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = profile.pace_presets ?? [];
  const maxMinutes = PLAN_LIMITS[profile.plan].maxMinutes;

  async function save(event: FormEvent) {
    event.preventDefault();
    const next: SessionDefaults = {
      rhythm,
      word_grouping: grouping,
      unit,
      ...(blocks ? { writing_blocks: blocks } : {}),
      ...(minutes ? { minutes: Number(minutes) } : {}),
    };
    setBusy(true);
    setError(null);
    const problem = await saveSessionDefaults(next);
    setBusy(false);
    if (problem) return setError(`Couldn't save your defaults: ${problem}`);
    setProfile({ session_defaults: next });
    toast("Saved. New sessions start from these settings.");
  }

  async function deletePreset(name: string) {
    const next = presets.filter((p) => p.name !== name);
    const { data, error: rpcError } = await supabase().rpc("set_pace_presets", { presets: next });
    if (rpcError) return setError(rpcError.message);
    setProfile({ pace_presets: (data as typeof presets | null) ?? next });
    toast(`Deleted "${name}".`);
  }

  return (
    <form className="stack" onSubmit={save} aria-label="Session defaults" style={{ maxWidth: 480 }}>
      <div className="field">
        <label className="label" htmlFor="default-rhythm">Rhythm</label>
        <select id="default-rhythm" value={rhythm} onChange={(e) => setRhythm(e.target.value as typeof rhythm)}>
          <option value="natural">Natural (recommended)</option>
          <option value="steady">Steady</option>
          <option value="drafting" disabled={!canUse(profile.plan, "drafting")}>Drafting{canUse(profile.plan, "drafting") ? "" : " (Pro)"}</option>
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="default-minutes">{blocks ? "Writing time" : "Finish within"}</label>
        <select id="default-minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-describedby="default-minutes-hint">
          <option value="">Suggest one for my text</option>
          {DURATIONS.map((d) => (
            <option key={d.minutes} value={d.minutes} disabled={d.minutes > maxMinutes}>
              {d.label}{d.minutes > maxMinutes ? ` (${PLAN_NAME[planForMinutes(d.minutes)]})` : ""}
            </option>
          ))}
        </select>
        <span id="default-minutes-hint" className="hint">Starting values only. The full schedule, including long breaks, must fit your plan when you start.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="default-unit">Steps</label>
        <select id="default-unit" value={unit} onChange={(e) => setUnit(e.target.value as InsertionUnit)}>
          {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u].title}</option>)}
        </select>
      </div>
      {unit === "sentence" && <SentenceStepHint />}
      {unit === "word" && <fieldset className="field">
        <legend className="label">How words arrive</legend>
        <label className="check"><input type="radio" name="default-grouping" checked={grouping === "random"} onChange={() => setGrouping("random")} />Random groups of 1–5 words</label>
        <label className="check"><input type="radio" name="default-grouping" checked={grouping === "single"} onChange={() => setGrouping("single")} />One word at a time</label>
      </fieldset>}
      <WritingBlockControls value={blocks} onChange={setBlocks} plan={profile.plan} expiresAt={profile.day_pass_expires_at} />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div><button type="submit" className="btn btn-secondary" disabled={busy}>{busy ? "Saving…" : "Save defaults"}</button></div>

      <div className="field">
        <p className="label">Saved pace presets<PlanLock plan={profile.plan} feature="presets" /></p>
        {!canUse(profile.plan, "presets")
          ? <p className="hint">Save custom pace settings under a name on New session, then apply them in one click. <button type="button" className="link-btn" data-locked="presets">See what Pro adds</button></p>
          : presets.length === 0
          ? <p className="hint">None yet. Save one from More options › Pace &amp; corrections on New session.</p>
          : (
            <ul className="preset-list">
              {presets.map((p) => (
                <li key={p.name}>
                  <span>{p.name}<span className="hint"> · {p.timing === "speed" ? "typing speed" : p.minutes ? `${p.minutes} min` : "finish time"}</span></span>
                  <button type="button" className="link-btn danger" onClick={() => deletePreset(p.name)} aria-label={`Delete preset ${p.name}`}>Delete</button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import type { Pace } from "@/components/app/PaceControls";
import { type PacePreset, useDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

/** Pro: save the current pacing under a name, and apply a saved one in one click. */
export function PacePresets({ timing, minutes, pace, onApply }: {
  timing: "duration" | "speed";
  minutes: number;
  pace: Pace;
  onApply: (preset: PacePreset) => void;
}) {
  const { profile, setProfile } = useDashboard();
  const presets = profile.pace_presets ?? [];
  const [chosen, setChosen] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: PacePreset[], done: string) {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase().rpc("set_pace_presets", { presets: next });
    setBusy(false);
    if (error) return setMessage(error.message);
    setProfile({ pace_presets: (data as PacePreset[] | null) ?? next });
    setMessage(done);
  }

  function saveCurrent() {
    const clean = name.trim().slice(0, 40);
    if (!clean) return setMessage("Give the preset a name.");
    const preset: PacePreset = { name: clean, timing, ...(timing === "duration" ? { minutes } : {}), pace: { ...pace } };
    const next = [...presets.filter((p) => p.name !== clean), preset].slice(-10);
    setNaming(false);
    setName("");
    setChosen(clean);
    save(next, `Saved "${clean}".`);
  }

  const selected = presets.find((p) => p.name === chosen);

  return (
    <div className="presets" role="group" aria-labelledby="presets-label">
      <div className="presets-row">
        <label id="presets-label" className="label" htmlFor="preset">Presets</label>
        <select id="preset" value={chosen} onChange={(e) => {
          setChosen(e.target.value);
          const p = presets.find((x) => x.name === e.target.value);
          if (p) {
            onApply(p);
            setMessage(`Applied "${p.name}".`);
          }
        }}>
          <option value="">{presets.length ? "Choose a preset" : "No presets yet"}</option>
          {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div className="presets-actions">
        {!naming && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNaming(true)} disabled={busy}>Save as preset…</button>}
        {selected && !naming && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
            onClick={() => { setChosen(""); save(presets.filter((p) => p.name !== selected.name), `Deleted "${selected.name}".`); }}>
            Delete preset
          </button>
        )}
        {naming && (
          <>
            <label className="sr-only" htmlFor="preset-name">Preset name</label>
            <input id="preset-name" type="text" maxLength={40} value={name} placeholder="e.g. Essay, 2 hours" autoFocus
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCurrent(); } }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={saveCurrent} disabled={busy}>Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNaming(false); setName(""); }}>Cancel</button>
          </>
        )}
      </div>
      {message && <p className="hint" role="status">{message}</p>}
    </div>
  );
}

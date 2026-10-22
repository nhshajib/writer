"use client";
import { WritingBlockControls, blocksFromPace, blockPace } from "./WritingBlockControls";
import { when } from "@/lib/time";
import { useEffect } from "react";
import { WordGroupingControls } from "./WordGroupingControls";
import { RhythmPreview } from "./RhythmPreview";

import { RichTextEditor } from "./RichTextEditor";
import { WorkWindowControls } from "./WorkWindowControls";
import type { TextFormat } from "../../../supabase/functions/_shared/markdown.ts";
import { type FormEvent, useState } from "react";
import { DEFAULT_PACE, PaceControls, paceFromSettings, pacingFor, sanitizePace, type Pace } from "./PaceControls";
import { api, sha256Hex } from "@/lib/api";
import { type Drip, type InsertionUnit, UNIT_LABEL } from "@/lib/types";

export function PausedSessionEditor({ drip, onSaved, onCancel }: {
  drip: Drip;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [originalText] = useState(drip.progress.remaining_text ?? "");
  const [version] = useState(drip.updated_at);
  const [text, setText] = useState(originalText);
  const [format, setFormat] = useState<TextFormat>("plain");
  const [timing, setTiming] = useState<"duration" | "speed">(drip.pacing?.timing ?? "duration");
  const [minutes, setMinutes] = useState(Math.max(1, Math.ceil((drip.pacing?.writing_blocks?.writing_duration_seconds ?? drip.duration_seconds) * (1 - drip.progress.percent / 100) / 60)));
  const [unit, setUnit] = useState<InsertionUnit>(drip.insertion_unit);
  const [pace, setPace] = useState<Pace>({ ...DEFAULT_PACE, ...(drip.pacing ? paceFromSettings(drip.pacing) : {}) });
  const [approved, setApproved] = useState(false);
  const [workWindow, setWorkWindow] = useState(drip.work_window ?? null);
  const [revisionSweep, setRevisionSweep] = useState(drip.pacing?.drafting?.revision_sweep ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<{ finish_at: string; remaining_breaks: number } | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const settingsKey = JSON.stringify([text, format, timing, minutes, unit, pace, workWindow, revisionSweep]);
  const needsPreview = pace.blocksOn || Boolean(drip.pacing?.writing_blocks);
  const checked = !needsPreview || previewKey === settingsKey;
  useEffect(() => {
    if (!needsPreview) return;
    let stale = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await api<{ preview: { finish_at: string; remaining_breaks: number } }>(`drips/${drip.id}/settings`, { method: "POST", body: {
          preview: true, updated_at: version, insertion_unit: unit, mode: "scheduled",
          pacing: pacingFor(timing, minutes, pace), work_window: workWindow, revision_sweep: revisionSweep,
          ...(text !== originalText ? { remaining_text: text, remaining_text_format: format, remaining_sha256: await sha256Hex(text) } : {}),
        } });
        if (!stale) { setSchedulePreview(response.preview); setPreviewKey(settingsKey); setError(null); }
      } catch (e) { if (!stale) setError(e instanceof Error ? e.message : "Couldn't preview the remaining schedule."); }
    }, 400);
    return () => { stale = true; clearTimeout(timeout); };
  // settingsKey includes each controlled setting and preserves the original approval/version guard.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, needsPreview, drip.id, version]);
  function change(update: () => void) { update(); setApproved(false); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!approved || busy || !checked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`drips/${drip.id}/settings`, { method: "POST", body: {
        confirmed: true, updated_at: version,
        ...(text !== originalText ? { remaining_text: text, remaining_text_format: format, remaining_sha256: await sha256Hex(text) } : {}),
        insertion_unit: unit, mode: "scheduled",
        pacing: pacingFor(timing, minutes, pace),
        work_window: workWindow, revision_sweep: revisionSweep,
      } });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the changes.");
      setBusy(false);
    }
  }
  return (
    <form className="card session-settings-editor" onSubmit={save} aria-labelledby="edit-session-title">
      <h2 id="edit-session-title">Edit the remaining session <span className="badge badge-blue">Pro</span></h2>
      <p className="muted">Text already entered stays in your document. Changes apply only to what comes next. Saving keeps the session paused; choose Resume when you are ready.</p>
      <fieldset disabled={busy}>
        <legend className="sr-only">Remaining text and settings</legend>
        <div className="field">
          <label className="label" htmlFor="remaining-text">Remaining text</label>
          <RichTextEditor id="remaining-text" label="Remaining text" text={text} format={format} disabled={busy} onChange={(next, kind) => change(() => { setText(next); setFormat(kind); })} />
          <p className="hint">Keep spaces or line breaks needed to join the entered text. Leave this text unchanged to retain its original formatting; paste a formatted replacement to change it. Saving does not resume the session.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="edit-unit">Insertion steps</label>
          <select id="edit-unit" value={unit} onChange={(e) => change(() => setUnit(e.target.value as InsertionUnit))}>
            {Object.entries(UNIT_LABEL).map(([value, label]) => <option key={value} value={value}>{label.title}{value === "word" ? " (choose grouping below)" : ""}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="edit-timing">Timing for the remaining text</label>
          <select id="edit-timing" value={timing} onChange={(e) => change(() => setTiming(e.target.value as typeof timing))}>
            <option value="duration">Finish within a chosen time after resuming</option>
            <option value="speed">Use a typing speed</option>
          </select>
        </div>
        {timing === "duration" && <div className="field">
          <label className="label" htmlFor="edit-minutes">{pace.blocksOn ? "Writing minutes after resuming" : "Minutes after resuming"}</label>
          <input id="edit-minutes" type="number" min={1} max={10080} required value={minutes} onChange={(e) => change(() => setMinutes(Number(e.target.value)))} />
        </div>}
        {unit === "word" && <WordGroupingControls value={pace.wordGrouping} onChange={wordGrouping => change(() => setPace(p => ({ ...p, wordGrouping })))} />}
        <WritingBlockControls value={blocksFromPace(pace)} plan="pro" onChange={value => change(() => setPace(p => ({ ...p, ...blockPace(value) })))} />
        {needsPreview && <p className="hint" aria-live="polite">{checked && schedulePreview ? `If resumed now: finish ${when(schedulePreview.finish_at, true)} · ${schedulePreview.remaining_breaks} remaining block rests. Saving keeps this session paused.` : "Checking the remaining block schedule…"}</p>}
        <RhythmPreview pace={pace} unit={unit} allAtOnce={false} revisionSweep={revisionSweep} />
        <PaceControls timing={timing} pace={pace} onChange={(update) => change(() => setPace((p) => { const next = { ...p, ...update }; if (next.maxBreakSeconds < next.minBreakSeconds) { if ("minBreakSeconds" in update) next.maxBreakSeconds = next.minBreakSeconds; else next.minBreakSeconds = next.maxBreakSeconds; } return sanitizePace(next); }))} />
        <WorkWindowControls value={workWindow} onChange={v => change(() => setWorkWindow(v))} enabled />
        <label className="check"><input type="checkbox" checked={revisionSweep} onChange={e => change(() => setRevisionSweep(e.target.checked))} />Final revision pass (restore exact approved text)</label>
        <label className="check">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          <span>I have reviewed and approve the remaining text and settings, including any enabled temporary mistakes and corrections.</span>
        </label>
      </fieldset>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy || !approved || !text.trim() || !checked}>{busy ? "Saving…" : "Save changes and stay paused"}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { SliderField } from "@/components/app/SliderField";
import { span } from "@/lib/time";
import type { BreakAlignment, PacingSettings, TimingMode } from "@/lib/types";

const ALIGN: { value: BreakAlignment; label: string }[] = [
  { value: "sentence", label: "After a sentence ends" },
  { value: "paragraph", label: "After a paragraph ends" },
  { value: "any", label: "After any step" },
];

/** The pace controls, remembered in this browser between sessions. */
export interface Pace {
  wordGrouping: "random" | "single";
  wpm: number;
  variation: number;
  breaksOn: boolean;
  everyMinutes: number;
  everyVariation: number;
  minBreakSeconds: number;
  maxBreakSeconds: number;
  align: BreakAlignment;
  typoRate: number;
  falseStartRate: number;
  sentencePauseSeconds: number;
  sentencePauseVariation: number;
}

export const DEFAULT_PACE: Pace = {
  wordGrouping: "random",
  wpm: 40,
  variation: 25,
  breaksOn: true,
  everyMinutes: 8,
  everyVariation: 30,
  minBreakSeconds: 20,
  maxBreakSeconds: 120,
  align: "sentence",
  typoRate: 0,
  falseStartRate: 0,
  sentencePauseSeconds: 0,
  sentencePauseVariation: 0,
};
const PACE_KEY = "typewit.pace";

/** Browser storage and older presets are untrusted; keep every knob within supported bounds. */
export function sanitizePace(raw: unknown): Pace {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const number = (key: keyof Pace, min: number, max: number): number => {
    const v = p[key];
    return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULT_PACE[key] as number;
  };
  const next: Pace = {
    wordGrouping: p.wordGrouping === "single" ? "single" : "random",
    wpm: number("wpm", 20, 150), variation: number("variation", 0, 50),
    breaksOn: typeof p.breaksOn === "boolean" ? p.breaksOn : DEFAULT_PACE.breaksOn,
    everyMinutes: number("everyMinutes", 1, 720), everyVariation: number("everyVariation", 0, 50),
    minBreakSeconds: number("minBreakSeconds", 5, 28800), maxBreakSeconds: number("maxBreakSeconds", 5, 28800),
    align: ALIGN.some((a) => a.value === p.align) ? p.align as BreakAlignment : DEFAULT_PACE.align,
    typoRate: number("typoRate", 0, 20), falseStartRate: number("falseStartRate", 0, 20),
    sentencePauseSeconds: number("sentencePauseSeconds", 0, 30), sentencePauseVariation: number("sentencePauseVariation", 0, 50),
  };
  next.maxBreakSeconds = Math.max(next.minBreakSeconds, next.maxBreakSeconds);
  return next;
}

export function paceFromSettings(pacing: PacingSettings): Partial<Pace> {
  return {
    wordGrouping: pacing.word_grouping === "single" ? "single" : "random",
    ...(pacing.wpm ? { wpm: pacing.wpm } : {}), variation: pacing.variation_pct,
    breaksOn: pacing.breaks.enabled, everyMinutes: pacing.breaks.every_seconds / 60,
    everyVariation: pacing.breaks.every_variation_pct, minBreakSeconds: pacing.breaks.min_seconds,
    maxBreakSeconds: pacing.breaks.max_seconds, align: pacing.breaks.align,
    typoRate: pacing.drafting?.typo_rate_pct ?? 0, falseStartRate: pacing.drafting?.false_start_rate_pct ?? 0,
    sentencePauseSeconds: pacing.drafting?.sentence_pause_seconds ?? 0,
    sentencePauseVariation: pacing.drafting?.sentence_pause_variation_pct ?? 0,
  };
}

/** The pace, loaded from and saved to this browser. The shortest break never exceeds the longest. */
export function usePace(): [Pace, (change: Partial<Pace>) => void] {
  const [pace, setPace] = useState<Pace>(DEFAULT_PACE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PACE_KEY);
      if (saved) setPace(sanitizePace(JSON.parse(saved)));
    } catch { /* storage unavailable: defaults */ }
  }, []);

  function updatePace(change: Partial<Pace>) {
    setPace((p) => {
      const merged = { ...p, ...change };
      if (merged.maxBreakSeconds < merged.minBreakSeconds) {
        if ("minBreakSeconds" in change) merged.maxBreakSeconds = merged.minBreakSeconds;
        else merged.minBreakSeconds = merged.maxBreakSeconds;
      }
      const next = sanitizePace(merged);
      try {
        localStorage.setItem(PACE_KEY, JSON.stringify(next));
      } catch { /* storage unavailable */ }
      return next;
    });
  }

  return [pace, updatePace];
}

/** The pacing a session is planned with. */
export function pacingFor(timing: TimingMode, minutes: number, pace: Pace): PacingSettings {
  return {
    word_grouping: pace.wordGrouping,
    timing,
    ...(timing === "duration" ? { duration_seconds: Math.round(minutes * 60) } : { wpm: pace.wpm }),
    variation_pct: pace.variation,
    drafting: {
      typo_rate_pct: pace.typoRate,
      false_start_rate_pct: pace.falseStartRate,
      sentence_pause_seconds: pace.sentencePauseSeconds,
      sentence_pause_variation_pct: pace.sentencePauseVariation,
    },
    breaks: {
      enabled: pace.breaksOn,
      every_seconds: Math.round(pace.everyMinutes * 60),
      every_variation_pct: pace.everyVariation,
      min_seconds: pace.minBreakSeconds,
      max_seconds: pace.maxBreakSeconds,
      align: pace.align,
    },
  };
}

/**
 * Speed and Breaks settings: every slider has a labelled number box and a unit.
 * With `collapsed`, variation and breaks start folded under "Advanced timing" (phones).
 */
export function PaceControls({ timing, pace, onChange, collapsed = false }: {
  timing: TimingMode;
  pace: Pace;
  onChange: (change: Partial<Pace>) => void;
  collapsed?: boolean;
}) {
  return (
    <>
      <details className="advanced-timing" open={!collapsed}>
        <summary>
          Pace &amp; corrections <span className="badge badge-blue pro-badge">Pro</span>
          <span className="hint"> · remembered in this browser</span>
        </summary>
        <button type="button" className="btn btn-secondary btn-sm pace-reset" onClick={() => onChange({ ...DEFAULT_PACE, wordGrouping: pace.wordGrouping, typoRate: 1, falseStartRate: 1, sentencePauseSeconds: 2, sentencePauseVariation: 25 })}>Use recommended settings</button>
        <p className="hint">Choose how quickly text arrives, how often a temporary mistake is corrected, and when to pause. These automated edits create a varied drafting rhythm; completed text still matches the text you approve. Google Docs decides which edits appear together in version history.</p>
        <fieldset className="settings-group">
          <legend>1. Pace and variation</legend>
          <p className="hint">Use your finish time above, or choose Typing speed for a WPM target. Start with 25% variation so edits do not arrive at identical intervals.</p>
          <div className="slider-grid">
            {timing === "speed" ? <SliderField label="Typing speed (adjustable cadence)" unit="WPM" unitLabel="words per minute" value={pace.wpm} min={20} max={150}
              onChange={(v) => onChange({ wpm: v })}
              hint={'How fast text is added: 20 is slower and 150 is faster. Start at 40 WPM, then adjust to your preferred pace. A "word" means 5 characters; corrections and API limits can make the session take longer.'} />
              : <p className="hint">Choose Typing speed above to use the remembered {pace.wpm} WPM setting. Target duration uses your selected finish time.</p>}
            <SliderField label="Timing variation" unit="%" unitLabel="percent" value={pace.variation} min={0} max={50}
              onChange={(v) => onChange({ variation: v })}
              hint={`Waits between edits can be shorter or longer by up to ${pace.variation}%. Start at 25% for a changing rhythm; 0% gives even spacing. This also applies to Target duration.`} />
          </div>
        </fieldset>
        <fieldset className="settings-group">
          <legend>2. Temporary mistakes</legend>
          <p className="hint">Optional. Keep both at 0% for clean entry, or start at 1% for occasional corrected mistakes. These effects use English words and a QWERTY keyboard.</p>
          <div className="slider-grid">
            <SliderField label="Neighbor-key typos" unit="%" unitLabel="percent of eligible words" value={pace.typoRate} min={0} max={20}
              onChange={(v) => onChange({ typoRate: v })}
              hint="Occasionally inserts a letter from a nearby keyboard key, then deletes and corrects it. Start at 1%: roughly 1 in 100 eligible English words may get a typo, not 1 in 100 letters. Higher rates add more corrections and time. Set 0% to turn off." />
            <SliderField label="False starts" unit="%" unitLabel="percent of eligible words" value={pace.falseStartRate} min={0} max={20}
              onChange={(v) => onChange({ falseStartRate: v })}
              hint="Occasionally adds a temporary wrong word, pauses, deletes it, and enters your approved word. Start at 1% for occasional detours: roughly 1 in 100 eligible English words. The count varies per session. Set 0% to turn off." />
          </div>
        </fieldset>
        <fieldset className="settings-group">
          <legend>3. Thinking pauses</legend>
          <p className="hint">Start with 2 seconds and 25% variation. Longer pauses leave more breathing room between sentences.</p>
          <div className="slider-grid">
            <SliderField label="Natural breaks after sentences" unit="s" unitLabel="seconds" value={pace.sentencePauseSeconds} min={0} max={30}
              onChange={(v) => onChange({ sentencePauseSeconds: v })}
              hint="Adds a short wait after a sentence ends, like a moment to think before continuing. Start at 2 seconds; increase it for more breathing room. Set 0 seconds to turn off. These pauses are included in the schedule preview." />
            <SliderField label="Sentence-pause variation" unit="%" unitLabel="percent" value={pace.sentencePauseVariation} min={0} max={50}
              onChange={(v) => onChange({ sentencePauseVariation: v })}
              hint={`Each sentence pause can be shorter or longer by up to ${pace.sentencePauseVariation}%. Start at 25%: a 2-second pause becomes about 1.5–2.5 seconds. 0% keeps every pause the same length. This has no effect when sentence pauses are off.`} />
          </div>
          {(pace.typoRate > 0 || pace.falseStartRate > 0) && <p className="alert alert-info small" role="status">Temporary words and mistakes appear in the real document before correction. Pausing or stopping mid-correction can leave temporary text there. Review it before sharing. Google decides how these automated edits appear in version history.</p>}
        </fieldset>
      </details>

      <details className="advanced-timing" open={!collapsed}>
        <summary>
          Longer breaks
          <span className="hint"> · {pace.breaksOn ? `breaks every ${pace.everyMinutes} min` : "no longer breaks"}</span>
        </summary>
        <fieldset className="settings-group">
          <legend>4. Time away from typing</legend>
          <p className="hint">Try a 20–120 second break after about 8 minutes of entry. Short sessions may finish before a longer break fits.</p>
          <label className="check">
            <input type="checkbox" checked={pace.breaksOn} onChange={(e) => onChange({ breaksOn: e.target.checked })} />
            <span>Take breaks</span>
          </label>
          {pace.breaksOn && (
            <>
              <div className="slider-grid" style={{ marginTop: "0.5rem" }}>
                <SliderField label="Active time between breaks" unit="min" unitLabel="minutes" value={pace.everyMinutes} min={1} max={720}
                  onChange={(v) => onChange({ everyMinutes: v })} hint={`Time spent entering text before a break (${span(pace.everyMinutes * 60_000)}). Up to 12 hours.`} />
                <SliderField label="Variation in that time" unit="%" unitLabel="percent" value={pace.everyVariation} min={0} max={50}
                  onChange={(v) => onChange({ everyVariation: v })}
                  hint={`Each stretch varies within ${pace.everyVariation}% of ${pace.everyMinutes} minutes.`} />
                <BreakField id="min-break" label="Shortest break" seconds={pace.minBreakSeconds}
                  onChange={(v) => onChange({ minBreakSeconds: v })} />
                <BreakField id="max-break" label="Longest break" seconds={pace.maxBreakSeconds}
                  onChange={(v) => onChange({ maxBreakSeconds: v })} />
              </div>
              <div className="field" style={{ marginTop: "1rem", maxWidth: 320 }}>
                <label className="label" htmlFor="align">Breaks may start</label>
                <select id="align" value={pace.align} onChange={(e) => onChange({ align: e.target.value as BreakAlignment })}>
                  {ALIGN.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </>
          )}
        </fieldset>
      </details>
    </>
  );
}

/** Break lengths go from 5 seconds to 8 hours, so the unit can be chosen. */
const BREAK_UNITS = [
  { key: "s", label: "seconds", factor: 1, min: 5, max: 600, step: 5 },
  { key: "min", label: "minutes", factor: 60, min: 1, max: 480, step: 1 },
  { key: "h", label: "hours", factor: 3600, min: 0.5, max: 8, step: 0.5 },
] as const;
const MIN_BREAK_SECONDS = 5;
const MAX_BREAK_SECONDS = 8 * 3600;

function BreakField({ id, label, seconds, onChange }: {
  id: string;
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const [unitKey, setUnitKey] = useState<(typeof BREAK_UNITS)[number]["key"]>(() =>
    seconds >= 3 * 3600 ? "h" : seconds >= 600 ? "min" : "s"
  );
  const unit = BREAK_UNITS.find((u) => u.key === unitKey)!;
  const inUnit = (s: number, u: (typeof BREAK_UNITS)[number]) =>
    Math.min(u.max, Math.max(u.min, Math.round(s / u.factor / u.step) * u.step));
  const toSeconds = (v: number, u: (typeof BREAK_UNITS)[number]) =>
    Math.min(MAX_BREAK_SECONDS, Math.max(MIN_BREAK_SECONDS, Math.round(v * u.factor)));
  return (
    <div className="break-field">
      <SliderField label={label} unit={unit.key} unitLabel={unit.label} value={inUnit(seconds, unit)} min={unit.min}
        max={unit.max} step={unit.step} onChange={(v) => onChange(toSeconds(v, unit))} hint={span(seconds * 1000)} />
      <div className="field break-unit">
        <label className="label" htmlFor={`${id}-unit`}>{label} in</label>
        <select id={`${id}-unit`} value={unitKey} onChange={(e) => {
          const next = BREAK_UNITS.find((u) => u.key === e.target.value)!;
          setUnitKey(next.key);
          onChange(toSeconds(inUnit(seconds, next), next));
        }}>
          {BREAK_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
        </select>
      </div>
    </div>
  );
}

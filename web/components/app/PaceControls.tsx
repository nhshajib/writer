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
  wpm: number;
  variation: number;
  breaksOn: boolean;
  everyMinutes: number;
  everyVariation: number;
  minBreakSeconds: number;
  maxBreakSeconds: number;
  align: BreakAlignment;
}

export const DEFAULT_PACE: Pace = {
  wpm: 40,
  variation: 25,
  breaksOn: true,
  everyMinutes: 8,
  everyVariation: 30,
  minBreakSeconds: 20,
  maxBreakSeconds: 120,
  align: "sentence",
};
const PACE_KEY = "typewit.pace";

/** The pace, loaded from and saved to this browser. The shortest break never exceeds the longest. */
export function usePace(): [Pace, (change: Partial<Pace>) => void] {
  const [pace, setPace] = useState<Pace>(DEFAULT_PACE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PACE_KEY);
      if (saved) setPace({ ...DEFAULT_PACE, ...JSON.parse(saved) });
    } catch { /* storage unavailable: defaults */ }
  }, []);

  function updatePace(change: Partial<Pace>) {
    setPace((p) => {
      const next = { ...p, ...change };
      if (next.maxBreakSeconds < next.minBreakSeconds) {
        if ("minBreakSeconds" in change) next.maxBreakSeconds = next.minBreakSeconds;
        else next.minBreakSeconds = next.maxBreakSeconds;
      }
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
    timing,
    ...(timing === "duration" ? { duration_seconds: Math.round(minutes * 60) } : { wpm: pace.wpm }),
    variation_pct: pace.variation,
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
      {timing === "speed" && (
        <fieldset className="settings-group">
          <legend>Speed</legend>
          <div className="slider-grid">
            <SliderField label="Typing speed" unit="WPM" unitLabel="words per minute" value={pace.wpm} min={5} max={200}
              onChange={(v) => onChange({ wpm: v })}
              hint={'A "word" is 5 characters, including spaces and punctuation (the standard typing measure). At 40 WPM, 200 characters take 1 minute.'} />
          </div>
        </fieldset>
      )}

      <details className="advanced-timing" open={!collapsed}>
        <summary>
          Advanced timing
          <span className="hint"> · variation {pace.variation}% · {pace.breaksOn ? `breaks every ${pace.everyMinutes} min` : "no breaks"}</span>
        </summary>
        <fieldset className="settings-group">
          <legend>Variation</legend>
          <div className="slider-grid">
            <SliderField label="Timing variation" unit="%" unitLabel="percent" value={pace.variation} min={0} max={50}
              onChange={(v) => onChange({ variation: v })}
              hint={`Each wait varies within ${pace.variation}% of its baseline. 0% means even spacing.`} />
          </div>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Breaks</legend>
          <label className="check">
            <input type="checkbox" checked={pace.breaksOn} onChange={(e) => onChange({ breaksOn: e.target.checked })} />
            <span>Take breaks</span>
          </label>
          {pace.breaksOn && (
            <>
              <div className="slider-grid" style={{ marginTop: "0.5rem" }}>
                <SliderField label="Active time between breaks" unit="min" unitLabel="minutes" value={pace.everyMinutes} min={1} max={120}
                  onChange={(v) => onChange({ everyMinutes: v })} hint="Time spent entering text before a break." />
                <SliderField label="Variation in that time" unit="%" unitLabel="percent" value={pace.everyVariation} min={0} max={50}
                  onChange={(v) => onChange({ everyVariation: v })}
                  hint={`Each stretch varies within ${pace.everyVariation}% of ${pace.everyMinutes} minutes.`} />
                <SliderField label="Shortest break" unit="s" unitLabel="seconds" value={pace.minBreakSeconds} min={5} max={1800} step={5}
                  onChange={(v) => onChange({ minBreakSeconds: v })} hint={span(pace.minBreakSeconds * 1000)} />
                <SliderField label="Longest break" unit="s" unitLabel="seconds" value={pace.maxBreakSeconds} min={5} max={1800} step={5}
                  onChange={(v) => onChange({ maxBreakSeconds: v })} hint={span(pace.maxBreakSeconds * 1000)} />
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

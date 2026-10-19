"use client";

import { useEffect, useId, useState } from "react";

interface Props {
  label: string;
  /** Shown beside the number, e.g. "WPM", "%", "min", "s". */
  unit: string;
  /** Spoken unit for screen readers, e.g. "words per minute". */
  unitLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  onChange: (value: number) => void;
}

/**
 * A slider with a labelled number box for exact values. Both control the same
 * setting; out-of-range typing is clamped when the box loses focus.
 */
export function SliderField({ label, unit, unitLabel, value, min, max, step = 1, hint, onChange }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit(raw: string) {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(n / step) * step));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <div className="slider-field">
      <div className="slider-head">
        <label htmlFor={`${id}-number`} className="label" id={`${id}-label`}>{label}</label>
        <span className="slider-value">
          <input
            id={`${id}-number`}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft}
            aria-describedby={hint ? `${id}-hint` : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
            }}
            onBlur={(e) => commit(e.target.value)}
          />
          <span aria-hidden="true">{unit}</span>
          <span className="sr-only">{unitLabel}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={`${id}-label`}
        aria-valuetext={`${value} ${unitLabel}`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
    </div>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import { type AgeCheck, checkAge, countries, guessCountry } from "@/lib/age";

export interface AboutYouValue {
  country: string;
  month: string;
  year: string;
  guardian: boolean;
}

export const EMPTY_ABOUT_YOU: AboutYouValue = { country: "", month: "", year: "", guardian: false };

/** The age answers, checked: null until all three are chosen. */
export function aboutYouCheck(value: AboutYouValue): AgeCheck | null {
  if (!value.country || !value.month || !value.year) return null;
  return checkAge(value.country, Number(value.year), Number(value.month));
}

/**
 * Country and month and year of birth, asked neutrally (no hint of the age
 * needed), plus a parent or guardian's agreement for under-18s.
 */
export function AboutYou({ value, onChange, idPrefix = "about", legend = "About you" }: {
  value: AboutYouValue;
  onChange: (value: AboutYouValue) => void;
  idPrefix?: string;
  legend?: string;
}) {
  const list = useMemo(() => countries(), []);
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" })),
    [],
  );
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i);
  const check = aboutYouCheck(value);

  useEffect(() => {
    if (!value.country) {
      const guess = guessCountry();
      if (guess) onChange({ ...value, country: guess });
    }
    // Only once, on first show.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<AboutYouValue>) => onChange({ ...value, ...patch });

  return (
    <fieldset className="about-you">
      <legend className="label">{legend}</legend>
      <div className="about-row">
        <div className="about-field">
          <label className="about-label" htmlFor={`${idPrefix}-country`}>Country<span className="sr-only"> you live in</span></label>
          <select id={`${idPrefix}-country`} className="about-country" value={value.country} onChange={(e) => set({ country: e.target.value })} required>
            <option value="">Choose…</option>
            {list.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div className="about-field">
          <span className="about-label" aria-hidden="true">Born</span>
          <div className="about-born">
            <label className="sr-only" htmlFor={`${idPrefix}-month`}>Month you were born</label>
            <select id={`${idPrefix}-month`} value={value.month} onChange={(e) => set({ month: e.target.value })} required>
              <option value="">Month</option>
              {months.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
            <label className="sr-only" htmlFor={`${idPrefix}-year`}>Year you were born</label>
            <select id={`${idPrefix}-year`} value={value.year} onChange={(e) => set({ year: e.target.value })} required>
              <option value="">Year</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>
      {check === "guardian" && (
        <label className="check guardian" htmlFor={`${idPrefix}-guardian`}>
          <input id={`${idPrefix}-guardian`} type="checkbox" checked={value.guardian} onChange={(e) => set({ guardian: e.target.checked })} />
          <span>A parent or guardian knows I&apos;m using TypeWit and agrees to it.</span>
        </label>
      )}
      <p className="hint">Only to check who can join. We keep month and year.</p>
    </fieldset>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { ConnectionReport } from "@/components/app/ConnectionReport";
import { ScheduleStrip } from "@/components/app/ScheduleStrip";
import { SliderField } from "@/components/app/SliderField";
import { api, ApiError, sha256Hex } from "@/lib/api";
import { ACTIVE_STATUSES, useDashboard } from "@/lib/dashboard";
import { span } from "@/lib/time";
import {
  type AccessReport,
  type BreakAlignment,
  type InsertionUnit,
  type PacingSettings,
  type PlanProblem,
  type SessionPlan,
  type TimingMode,
  UNIT_LABEL,
} from "@/lib/types";

type Timing = TimingMode | "asap";
type Target = "new" | "existing";

/** Plan limits shown in the form. The server enforces the same values. */
const LIMITS = {
  free: { words: 250, minutes: 60 },
  pro: { words: Infinity, minutes: 7 * 24 * 60 },
};

const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 5, label: "5 minutes" },
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "1 week" },
];

const UNITS: { value: InsertionUnit; hint: string }[] = [
  { value: "sentence", hint: "One sentence at a time. Recommended." },
  { value: "word", hint: "One word at a time." },
  { value: "character", hint: "One character at a time." },
  { value: "paragraph", hint: "One paragraph at a time." },
  { value: "chunk", hint: "Equal groups of words, about once a minute." },
];

const ALIGN: { value: BreakAlignment; label: string }[] = [
  { value: "sentence", label: "After a sentence ends" },
  { value: "paragraph", label: "After a paragraph ends" },
  { value: "any", label: "After any step" },
];

/** The pace controls, remembered in this browser between sessions. */
interface Pace {
  wpm: number;
  variation: number;
  breaksOn: boolean;
  everyMinutes: number;
  everyVariation: number;
  minBreakSeconds: number;
  maxBreakSeconds: number;
  align: BreakAlignment;
}

const DEFAULT_PACE: Pace = {
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

function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

interface PastDoc {
  key: string;
  connectionId: string;
  documentId: string;
  title: string;
  busy: boolean;
}

export default function NewSessionPage() {
  const router = useRouter();
  const dashboard = useDashboard();
  const plan = dashboard.profile.plan;
  const connections = useMemo(
    () => dashboard.connections.filter((c) => c.provider === "google" && c.connected !== false),
    [dashboard.connections],
  );
  // Documents TypeWit wrote into before can be written into again, one session at a time.
  const pastDocs = useMemo(() => {
    const seen = new Map<string, PastDoc>();
    for (const d of dashboard.drips) {
      if (d.provider !== "google") continue;
      const key = `${d.connection_id}:${d.document_id}`;
      const busy = ACTIVE_STATUSES.has(d.status);
      const prev = seen.get(key);
      if (!prev) {
        seen.set(key, { key, connectionId: d.connection_id, documentId: d.document_id, title: d.document_title ?? "Untitled document", busy });
      } else if (busy) prev.busy = true;
    }
    return [...seen.values()];
  }, [dashboard.drips]);

  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [target, setTarget] = useState<Target>("new");
  const [title, setTitle] = useState("");
  const [pastDocKey, setPastDocKey] = useState("");
  const [text, setText] = useState("");
  const [unit, setUnit] = useState<InsertionUnit>("sentence");
  const [timing, setTiming] = useState<Timing>("duration");
  const [preset, setPreset] = useState<string>("60");
  const [customMinutes, setCustomMinutes] = useState("90");
  const [pace, setPace] = useState<Pace>(DEFAULT_PACE);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<PlanProblem[]>([]);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<AccessReport | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  // One id per Start press, so a repeated request can't start a second session.
  const requestId = useRef<string>(crypto.randomUUID());
  // Set synchronously, so two clicks in the same moment can't both submit.
  const starting = useRef(false);

  // The schedule preview comes from the server, so it is exactly what will run.
  const [preview, setPreview] = useState<SessionPlan | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [seed, setSeed] = useState<number | undefined>(undefined);

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

  // "Add text" on the Documents page links here with ?doc=<connection>:<document>.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("doc");
    const doc = key ? pastDocs.find((d) => d.key === key) : undefined;
    if (doc && !doc.busy && connections.some((c) => c.id === doc.connectionId)) {
      setConnectionId(doc.connectionId);
      setTarget("existing");
      setPastDocKey(doc.key);
    }
  }, [pastDocs, connections]);

  const limits = LIMITS[plan];
  const words = countWords(text);
  const overWords = words > limits.words;
  const minutes = preset === "custom" ? Number(customMinutes) : Number(preset);
  const minutesValid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 10080;
  const docsForAccount = pastDocs.filter((d) => d.connectionId === connectionId);
  const chosenDoc = pastDocs.find((d) => d.key === pastDocKey);

  const pacing: PacingSettings | null = timing === "asap" ? null : {
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
  const pacingKey = JSON.stringify(pacing);
  const inputKey = JSON.stringify([text, unit, timing, pacingKey, seed ?? null]);
  const current = preview !== null && previewKey === inputKey;
  const ready = text.trim() !== "" && (timing !== "duration" || minutesValid);

  useEffect(() => {
    if (!ready) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let stale = false;
    const handle = setTimeout(async () => {
      try {
        const res = await api<{ plan: SessionPlan }>("drips/plan", {
          method: "POST",
          body: {
            text,
            insertion_unit: unit,
            mode: timing === "asap" ? "as_soon_as_possible" : "scheduled",
            ...(timing === "asap" ? {} : { pacing: JSON.parse(pacingKey) }),
            ...(seed !== undefined ? { schedule_seed: seed } : {}),
          },
        });
        if (stale) return;
        setPreview(res.plan);
        setPreviewError(null);
        // Keep this timing while the user keeps editing, until they ask for another.
        const kept = seed ?? res.plan.seed;
        if (seed === undefined) setSeed(kept);
        setPreviewKey(JSON.stringify([text, unit, timing, pacingKey, kept]));
      } catch (e) {
        if (!stale) setPreviewError(e instanceof Error ? e.message : "Couldn't check the schedule.");
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(handle);
    };
  }, [text, unit, timing, pacingKey, ready, seed]);

  function changeText(next: string) {
    setText(next);
    // Approval belongs to the exact text, so any edit needs a fresh approval.
    if (approved) setApproved(false);
  }

  function fail(message: string, list: PlanProblem[] = []) {
    setError(message);
    setProblems(list);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function testConnection() {
    setChecking(true);
    setReport(null);
    try {
      const res = await api<{ report: AccessReport }>("drips/check", {
        method: "POST",
        body: { connection_id: connectionId, ...(target === "existing" && chosenDoc ? { document_id: chosenDoc.documentId } : {}) },
      });
      setReport(res.report);
    } catch (e) {
      setReport({
        ok: false,
        problem: "connection_interrupted",
        message: e instanceof Error ? e.message : "The connection was interrupted.",
        checks: [],
        revision_unchanged: null,
        checked_at: new Date().toISOString(),
      });
    } finally {
      setChecking(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (starting.current) return;
    setError(null);
    setProblems([]);

    if (!connectionId) return fail("Connect your Google account first.");
    if (target === "new" && !title.trim()) return fail("Give the new document a title.");
    if (target === "existing" && !chosenDoc) return fail("Choose a document.");
    if (chosenDoc?.busy && target === "existing") return fail("That document already has an unfinished session.");
    if (words === 0) return fail("Add the text you want entered.");
    if (overWords) return fail(`Your plan allows ${limits.words} words a day. Shorten the text or upgrade to Pro.`);
    if (timing === "duration" && !minutesValid) return fail("Choose a duration between 1 minute and 1 week.");
    if (!current) return fail("The schedule is still being checked. Try again in a moment.");
    if (!preview.ok) return fail("This session can't run as set up:", preview.problems);
    if (!approved) return fail("Read your text and tick the box to approve it.");

    starting.current = true;
    setBusy(true);
    try {
      const { drip } = await api<{ drip: { id: string } }>("drips", {
        method: "POST",
        body: {
          connection_id: connectionId,
          ...(target === "new" ? { new_document_title: title.trim() } : { document_id: chosenDoc!.documentId }),
          text,
          insertion_unit: unit,
          mode: timing === "asap" ? "as_soon_as_possible" : "scheduled",
          ...(timing === "asap" ? { duration_minutes: 1 } : { pacing }),
          schedule_seed: preview.seed,
          request_id: requestId.current,
          approval: { confirmed: true, text_sha256: await sha256Hex(text) },
        },
      });
      await dashboard.refresh();
      router.push(`/app/session?id=${drip.id}`);
    } catch (e) {
      const list = e instanceof ApiError ? e.problems : [];
      fail(e instanceof Error ? e.message : "Couldn't start the session.", list);
      // A different Start press after a failure gets a new id.
      if (!(e instanceof ApiError && e.status === 409)) requestId.current = crypto.randomUUID();
      starting.current = false;
      setBusy(false);
    }
  }

  if (connections.length === 0) {
    return (
      <>
        <div className="page-head"><div><h1>New session</h1></div></div>
        <div className="card empty">
          <div className="icon"><Icon.doc /></div>
          <h3>Connect Google first</h3>
          <p>TypeWit needs your permission to create documents and add your text to them.</p>
          <Link href="/app/documents" className="btn btn-primary btn-sm">Connect Google Docs</Link>
        </div>
      </>
    );
  }

  const optionFor = (u: InsertionUnit) => (current ? preview.options.find((o) => o.unit === u) : undefined);
  const steps = current && preview.ok ? preview.unit_count : 0;
  const docLabel = target === "new" ? (title.trim() ? `New Google Doc "${title.trim()}"` : "New Google Doc (add a title)") : chosenDoc?.title ?? "Choose a document";

  return (
    <>
      <div className="crumbs"><Link href="/app/sessions">Sessions</Link><span aria-hidden="true">/</span><span>New</span></div>
      <div className="page-head">
        <div>
          <h1 id="new-title">New session</h1>
          <p>Choose a document, add your text and set the pace. TypeWit enters it for you, step by step, as automated text entry.</p>
        </div>
      </div>

      <form className="card card-flush" onSubmit={onSubmit} noValidate aria-labelledby="new-title" style={{ maxWidth: 860 }}>
        <fieldset className="form-section">
          <legend className="sr-only">Document</legend>
          <h2 aria-hidden="true">Document</h2>
          <p className="muted">Where the text should go. TypeWit always adds it at the end of the document.</p>
          {connections.length > 1 && (
            <div className="field" style={{ marginBottom: "1rem", maxWidth: 420 }}>
              <label className="label" htmlFor="account">Google account</label>
              <select id="account" value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setPastDocKey(""); setReport(null); }}>
                {connections.map((c) => <option key={c.id} value={c.id}>{c.account_email ?? "Google account"}</option>)}
              </select>
            </div>
          )}
          <div className="choices" role="radiogroup" aria-label="Document">
            <label className="choice">
              <input type="radio" name="target" value="new" checked={target === "new"} onChange={() => { setTarget("new"); setReport(null); }} />
              <span><strong>New Google Doc</strong><small>Created in your Drive when you start.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="target" value="existing" checked={target === "existing"} onChange={() => { setTarget("existing"); setReport(null); }} disabled={docsForAccount.length === 0} />
              <span><strong>Existing document</strong><small>{docsForAccount.length ? "One TypeWit created before." : "None from past sessions yet."}</small></span>
            </label>
          </div>
          <div className="field" style={{ marginTop: "1rem", maxWidth: 520 }}>
            {target === "new"
              ? (
                <>
                  <label className="label" htmlFor="title">Title</label>
                  <input id="title" type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="History essay" />
                </>
              )
              : (
                <>
                  <label className="label" htmlFor="doc">Document</label>
                  <select id="doc" value={pastDocKey} onChange={(e) => { setPastDocKey(e.target.value); setReport(null); }} aria-describedby="doc-hint">
                    <option value="">Choose a document</option>
                    {docsForAccount.map((d) => (
                      <option key={d.key} value={d.key} disabled={d.busy}>{d.title}{d.busy ? " (has an unfinished session)" : ""}</option>
                    ))}
                  </select>
                  <span id="doc-hint" className="hint">A document can have one unfinished session at a time.</span>
                </>
              )}
          </div>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={testConnection} disabled={checking || !connectionId || (target === "existing" && !chosenDoc)}>
              {checking ? "Testing…" : "Test connection"}
            </button>
            <span className="hint">Checks access without changing the document.</span>
          </div>
          <div aria-live="polite">{report && <ConnectionReport report={report} />}</div>
        </fieldset>

        <div className="form-section">
          <h2>Text</h2>
          <p className="muted">Paste or dictate it here. It is entered exactly as written, in order, including line breaks.</p>
          <div className="field">
            <label className="sr-only" htmlFor="text">Text to enter</label>
            <textarea id="text" value={text} onChange={(e) => changeText(e.target.value)} aria-describedby="text-count" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span id="text-count" className={overWords ? "error-text" : "hint"}>
                {words.toLocaleString()} {words === 1 ? "word" : "words"} · {text.length.toLocaleString()} characters
                {plan === "free" && ` · ${limits.words} words a day on Free`}
              </span>
              {overWords && <Link href="/app/billing" className="small">Pro has no daily limit</Link>}
            </div>
          </div>
        </div>

        <fieldset className="form-section">
          <legend className="sr-only">Insertion mode</legend>
          <h2 aria-hidden="true">Insertion mode</h2>
          <p className="muted">What each insertion adds to the document.</p>
          <div className="choices" role="radiogroup" aria-label="Insert one">
            {UNITS.map((u) => {
              const option = optionFor(u.value);
              const count = option ? `${option.units.toLocaleString()} ${UNIT_LABEL[u.value][option.units === 1 ? "one" : "many"]}` : null;
              const tooSlow = option && !option.fits && timing === "duration" ? ` · needs at least ${span(option.minimum_duration_seconds * 1000)}` : "";
              return (
                <label key={u.value} className="choice">
                  <input type="radio" name="unit" value={u.value} checked={unit === u.value} onChange={() => setUnit(u.value)} />
                  <span>
                    <strong>{UNIT_LABEL[u.value].title}</strong>
                    <small>{count ? `${count}${tooSlow}` : u.hint}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend className="sr-only">Timing</legend>
          <h2 aria-hidden="true">Timing</h2>
          <p className="muted">Pick a total time, or a typing speed. Breaks and variation apply to both.</p>
          <div className="choices" role="radiogroup" aria-label="Timing mode">
            <label className="choice">
              <input type="radio" name="timing" value="duration" checked={timing === "duration"} onChange={() => setTiming("duration")} />
              <span><strong>Target duration</strong><small>Fit everything, breaks included, into a set time.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="timing" value="speed" checked={timing === "speed"} onChange={() => setTiming("speed")} />
              <span><strong>Typing speed</strong><small>Set words per minute; see how long it takes.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="timing" value="asap" checked={timing === "asap"} onChange={() => setTiming("asap")} />
              <span><strong>All at once</strong><small>One insertion, no pacing.</small></span>
            </label>
          </div>

          {timing === "duration" && (
            <div className="row" style={{ marginTop: "1rem", alignItems: "flex-end", gap: "1rem" }}>
              <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
                <label className="label" htmlFor="duration">Total duration</label>
                <select id="duration" value={preset} onChange={(e) => setPreset(e.target.value)} aria-describedby="duration-hint">
                  {DURATIONS.map((d) => (
                    <option key={d.minutes} value={d.minutes} disabled={d.minutes > limits.minutes}>
                      {d.label}{d.minutes > limits.minutes ? " (Pro)" : ""}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {preset === "custom" && (
                <div className="field" style={{ maxWidth: 180, marginBottom: 0 }}>
                  <label className="label" htmlFor="custom-minutes">Minutes</label>
                  <input id="custom-minutes" type="number" inputMode="numeric" min={1} max={limits.minutes} step={1}
                    value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} aria-invalid={!minutesValid} />
                </div>
              )}
              <p id="duration-hint" className="hint" style={{ flexBasis: "100%", margin: 0 }}>
                Breaks are part of this time, and the last insertion is planned for the very end. It is a target: Google
                Docs outages or delays can make it finish later, and TypeWit never rushes to catch up.
              </p>
            </div>
          )}

          {timing !== "asap" && (
            <>
              <fieldset className="settings-group">
                <legend>Speed</legend>
                <div className="slider-grid">
                  {timing === "speed" && (
                    <SliderField label="Typing speed" unit="WPM" unitLabel="words per minute" value={pace.wpm} min={5} max={200}
                      onChange={(v) => updatePace({ wpm: v })}
                      hint={'A "word" is 5 characters, including spaces and punctuation (the standard typing measure). At 40 WPM, 200 characters take 1 minute.'} />
                  )}
                  <SliderField label="Timing variation" unit="%" unitLabel="percent" value={pace.variation} min={0} max={50}
                    onChange={(v) => updatePace({ variation: v })}
                    hint={`Each wait varies within ${pace.variation}% of its baseline. 0% means even spacing.`} />
                </div>
              </fieldset>

              <fieldset className="settings-group">
                <legend>Breaks</legend>
                <label className="check">
                  <input type="checkbox" checked={pace.breaksOn} onChange={(e) => updatePace({ breaksOn: e.target.checked })} />
                  <span>Take breaks</span>
                </label>
                {pace.breaksOn && (
                  <>
                    <div className="slider-grid" style={{ marginTop: "0.5rem" }}>
                      <SliderField label="Active time between breaks" unit="min" unitLabel="minutes" value={pace.everyMinutes} min={1} max={120}
                        onChange={(v) => updatePace({ everyMinutes: v })} hint="Time spent entering text before a break." />
                      <SliderField label="Variation in that time" unit="%" unitLabel="percent" value={pace.everyVariation} min={0} max={50}
                        onChange={(v) => updatePace({ everyVariation: v })}
                        hint={`Each stretch varies within ${pace.everyVariation}% of ${pace.everyMinutes} minutes.`} />
                      <SliderField label="Shortest break" unit="s" unitLabel="seconds" value={pace.minBreakSeconds} min={5} max={1800} step={5}
                        onChange={(v) => updatePace({ minBreakSeconds: v })} hint={span(pace.minBreakSeconds * 1000)} />
                      <SliderField label="Longest break" unit="s" unitLabel="seconds" value={pace.maxBreakSeconds} min={5} max={1800} step={5}
                        onChange={(v) => updatePace({ maxBreakSeconds: v })} hint={span(pace.maxBreakSeconds * 1000)} />
                    </div>
                    <div className="field" style={{ marginTop: "1rem", maxWidth: 320 }}>
                      <label className="label" htmlFor="align">Breaks may start</label>
                      <select id="align" value={pace.align} onChange={(e) => updatePace({ align: e.target.value as BreakAlignment })}>
                        {ALIGN.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </fieldset>
            </>
          )}

          <PlanSummary plan={current ? preview : null} error={previewError} hasText={words > 0} timing={timing}
            onReshuffle={() => setSeed(undefined)} />
        </fieldset>

        <div className="form-section">
          <h2>Before you start</h2>
          <dl className="summary-list" aria-label="Session summary">
            <dt>Document</dt><dd>{docLabel}</dd>
            <dt>Insertion location</dt><dd>At the end of the document</dd>
            <dt>Text length</dt><dd>{words.toLocaleString()} words, {text.length.toLocaleString()} characters</dd>
            <dt>Insertion mode</dt><dd>{UNIT_LABEL[unit].title}{steps ? ` (${steps.toLocaleString()} insertions)` : ""}</dd>
            <dt>Timing mode</dt><dd>{timing === "duration" ? "Target duration" : timing === "speed" ? `Typing speed, ${pace.wpm} WPM` : "All at once"}</dd>
            <dt>Planned duration</dt>
            <dd>
              {current && preview.ok
                ? `${span(preview.duration_seconds * 1000)}${preview.break_seconds ? ` (${span(preview.active_seconds * 1000)} entering, ${span(preview.break_seconds * 1000)} of breaks)` : ""}${timing === "speed" ? ", estimated" : ""}`
                : "—"}
            </dd>
          </dl>
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Each insertion is a real edit made through the Google Docs API at its scheduled time, using your Google
            account. Google Docs decides how edits are grouped in its version history. TypeWit never adds typos, false
            starts or fake corrections, and it runs on TypeWit&apos;s servers, so you can close this page.
          </p>
        </div>

        <div className="form-section">
          <h2>Review and approve</h2>
          <p className="muted">TypeWit enters exactly this text. Editing it clears your approval.</p>
          <div className="preview" tabIndex={0} role="region" aria-label="Text to approve">
            {text || <span className="pending">Your text will appear here.</span>}
          </div>
          {steps > 1 && current && <StepList text={text} plan={preview} />}
          <label className="check" htmlFor="approve" style={{ marginTop: "0.75rem" }}>
            <input id="approve" type="checkbox" checked={approved} disabled={words === 0} onChange={(e) => setApproved(e.target.checked)} />
            <span>I&apos;ve read this exact text and approve TypeWit entering it into my document.</span>
          </label>
          <p className="hint">
            Your text and its schedule are stored with TypeWit until you delete the session (Settings → Your data). The
            activity log records times and counts, not your text.
          </p>
          {error && (
            <div className="alert alert-error" role="alert" tabIndex={-1} ref={errorRef} style={{ marginTop: "0.75rem", display: "block" }}>
              <p>{error}</p>
              {problems.length > 0 && <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>{problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="form-actions">
          <Link href="/app" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy} aria-disabled={busy}>{busy ? "Starting…" : "Start session"}</button>
        </div>
      </form>
    </>
  );
}

function PlanSummary({ plan, error, hasText, timing, onReshuffle }: {
  plan: SessionPlan | null;
  error: string | null;
  hasText: boolean;
  timing: Timing;
  onReshuffle: () => void;
}) {
  if (!hasText) return <p className="hint" style={{ marginTop: "1rem" }}>Add text to see the schedule.</p>;
  if (error) return <p className="alert alert-error" style={{ marginTop: "1rem" }}>{error}</p>;
  if (!plan) return <p className="hint" role="status" style={{ marginTop: "1rem" }}>Checking the schedule…</p>;

  if (!plan.ok) {
    return (
      <div className="problems" role="status">
        {plan.problems.map((p) => <p key={p.code} className="alert alert-error">{p.message}</p>)}
      </div>
    );
  }
  if (timing === "asap" || !plan.stats) {
    return <p className="hint" role="status" style={{ marginTop: "1rem" }}>The whole text is entered in one insertion within about a minute.</p>;
  }

  const { stats } = plan;
  const n = plan.unit_count;
  const label = UNIT_LABEL[plan.unit][n === 1 ? "one" : "many"];
  const total = span(plan.duration_seconds * 1000);
  const breaks = plan.breaks.length;
  const summary = `${n.toLocaleString()} ${label}, one insertion each, ${timing === "speed" ? "estimated to take" : "over"} ${total}` +
    (breaks ? ` with ${breaks} break${breaks === 1 ? "" : "s"} (${span(plan.break_seconds * 1000)} in all)` : "") +
    `. The first after about ${span(stats.first_offset_ms)}; the last at the ${total} mark.`;

  return (
    <div className="plan-box">
      <p className="small" role="status" aria-live="polite" aria-atomic="true" style={{ marginBottom: "0.75rem" }}>{summary}</p>
      <dl>
        <div><dt>Insertions</dt><dd>{n.toLocaleString()}</dd></div>
        <div><dt>{timing === "speed" ? "Estimated time" : "Total time"}</dt><dd>{total}</dd></div>
        <div><dt>Breaks</dt><dd>{breaks ? `${breaks}, ${span(plan.break_seconds * 1000)}` : "None"}</dd></div>
        <div><dt>Typical gap</dt><dd>{span(stats.median_gap_ms)}</dd></div>
      </dl>
      <ScheduleStrip offsets={plan.schedule} breaks={plan.breaks} label={`Planned schedule: ${summary}`} />
      {plan.warnings.map((w) => <p key={w.code} className="alert alert-info small" style={{ marginTop: "0.5rem" }}>{w.message}</p>)}
      <p className="hint" style={{ marginTop: "0.5rem" }}>
        Longer {UNIT_LABEL[plan.unit].many} get more time. Insertions are always at least {plan.min_gap_seconds} seconds
        apart. The schedule is saved when you start; pausing moves the rest of it later by the length of the pause.{" "}
        <button type="button" className="link-btn" onClick={onReshuffle}>Try different timing</button>
      </p>
    </div>
  );
}

/** Every step, with its planned offset, so the split can be checked before approving. */
function StepList({ text, plan }: { text: string; plan: SessionPlan }) {
  const shown = Math.min(plan.unit_count, 500);
  const parts: string[] = [];
  let at = 0;
  for (let i = 0; i < shown; i++) {
    parts.push(text.slice(at, at + plan.unit_lengths[i]));
    at += plan.unit_lengths[i];
  }
  const breakAfter = new Map(plan.breaks.map((b) => [b.after_index, b]));
  const label = UNIT_LABEL[plan.unit][plan.unit_count === 1 ? "one" : "many"];
  return (
    <details className="more" style={{ marginTop: "0.5rem" }}>
      <summary>See the {plan.unit_count.toLocaleString()} {label} as they will be entered</summary>
      <ol className="steps-list" tabIndex={0} aria-label="Steps in order">
        {parts.map((part, i) => (
          <li key={i}>
            <span className="n">{i + 1}.</span>
            <time>+{span(plan.schedule[i] ?? 0)}</time>
            <span className="t">
              {part.split("\n").map((line, k) => (
                <span key={k}>{k > 0 && <><mark aria-hidden="true">↵</mark>{"\n"}</>}{line}</span>
              ))}
              {breakAfter.has(i) && <em className="muted"> Then a {span(breakAfter.get(i)!.duration_ms)} break.</em>}
            </span>
          </li>
        ))}
      </ol>
      {plan.unit_count > shown && <p className="hint">Showing the first {shown}.</p>}
    </details>
  );
}

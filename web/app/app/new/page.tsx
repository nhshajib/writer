"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { ScheduleStrip } from "@/components/app/ScheduleStrip";
import { api, ApiError, sha256Hex } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { span } from "@/lib/time";
import { type InsertionUnit, type PlanProblem, type SessionPlan, UNIT_LABEL } from "@/lib/types";

type Timing = "spread" | "asap";
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
  { value: "paragraph", hint: "One paragraph at a time." },
  { value: "word", hint: "One word at a time." },
  { value: "character", hint: "One character at a time." },
  { value: "chunk", hint: "Equal groups of words, about once a minute." },
];

function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

interface PastDoc {
  key: string;
  connectionId: string;
  documentId: string;
  title: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const dashboard = useDashboard();
  const plan = dashboard.profile.plan;
  const connections = useMemo(
    () => dashboard.connections.filter((c) => c.provider === "google" && c.connected !== false),
    [dashboard.connections],
  );
  // Documents TypeWit wrote into before can be written into again.
  const pastDocs = useMemo(() => {
    const seen = new Map<string, PastDoc>();
    for (const d of dashboard.drips) {
      if (d.provider !== "google") continue;
      const key = `${d.connection_id}:${d.document_id}`;
      if (!seen.has(key)) {
        seen.set(key, { key, connectionId: d.connection_id, documentId: d.document_id, title: d.document_title ?? "Untitled document" });
      }
    }
    return [...seen.values()];
  }, [dashboard.drips]);

  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [target, setTarget] = useState<Target>("new");
  const [title, setTitle] = useState("");
  const [pastDocKey, setPastDocKey] = useState("");
  const [text, setText] = useState("");
  const [unit, setUnit] = useState<InsertionUnit>("sentence");
  const [timing, setTiming] = useState<Timing>("spread");
  const [preset, setPreset] = useState<string>("60");
  const [customMinutes, setCustomMinutes] = useState("90");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<PlanProblem[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

  // The schedule preview comes from the server, so it is exactly what will run.
  const [preview, setPreview] = useState<SessionPlan | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [seed, setSeed] = useState<number | undefined>(undefined);

  // "Add text" on the Documents page links here with ?doc=<connection>:<document>.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("doc");
    const doc = key ? pastDocs.find((d) => d.key === key) : undefined;
    if (doc && connections.some((c) => c.id === doc.connectionId)) {
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
  const inputKey = JSON.stringify([text, unit, timing, minutes, seed ?? null]);
  const current = preview !== null && previewKey === inputKey;

  useEffect(() => {
    if (!text.trim() || (timing === "spread" && !minutesValid)) {
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
            duration_minutes: timing === "asap" ? 1 : minutes,
            ...(seed !== undefined ? { schedule_seed: seed } : {}),
          },
        });
        if (stale) return;
        setPreview(res.plan);
        setPreviewKey(JSON.stringify([text, unit, timing, minutes, seed ?? null]));
        setPreviewError(null);
        // Keep this timing while the user keeps editing, until they ask for another.
        if (seed === undefined) {
          setSeed(res.plan.seed);
          setPreviewKey(JSON.stringify([text, unit, timing, minutes, res.plan.seed]));
        }
      } catch (e) {
        if (!stale) setPreviewError(e instanceof Error ? e.message : "Couldn't check the schedule.");
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(handle);
    };
  }, [text, unit, timing, minutes, minutesValid, seed]);

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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setProblems([]);

    if (!connectionId) return fail("Connect your Google account first.");
    if (target === "new" && !title.trim()) return fail("Give the new document a title.");
    if (target === "existing" && !pastDocKey) return fail("Choose a document.");
    if (words === 0) return fail("Add the text you want entered.");
    if (overWords) return fail(`Your plan allows ${limits.words} words a day. Shorten the text or upgrade to Pro.`);
    if (timing === "spread" && !minutesValid) return fail("Choose a duration between 1 minute and 1 week.");
    if (!current) return fail("The schedule is still being checked. Try again in a moment.");
    if (!preview.ok) return fail("This session can't run as set up:", preview.problems);
    if (!approved) return fail("Read your text and tick the box to approve it.");

    const doc = pastDocs.find((d) => d.key === pastDocKey);
    setBusy(true);
    try {
      const { drip } = await api<{ drip: { id: string } }>("drips", {
        method: "POST",
        body: {
          connection_id: connectionId,
          ...(target === "new" ? { new_document_title: title.trim() } : { document_id: doc?.documentId }),
          text,
          insertion_unit: unit,
          mode: timing === "asap" ? "as_soon_as_possible" : "scheduled",
          duration_minutes: timing === "asap" ? 1 : minutes,
          schedule_seed: preview.seed,
          approval: { confirmed: true, text_sha256: await sha256Hex(text) },
        },
      });
      await dashboard.refresh();
      router.push(`/app/session?id=${drip.id}`);
    } catch (e) {
      const list = e instanceof ApiError ? e.problems : [];
      fail(e instanceof Error ? e.message : "Couldn't start the session.", list);
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

  return (
    <>
      <div className="crumbs"><Link href="/app/sessions">Sessions</Link><span aria-hidden="true">/</span><span>New</span></div>
      <div className="page-head">
        <div>
          <h1 id="new-title">New session</h1>
          <p>Choose a document, add your text and set the pace. TypeWit enters it for you, step by step.</p>
        </div>
      </div>

      <form className="card card-flush" onSubmit={onSubmit} noValidate aria-labelledby="new-title" style={{ maxWidth: 820 }}>
        <fieldset className="form-section">
          <legend className="sr-only">Document</legend>
          <h2 aria-hidden="true">Document</h2>
          <p className="muted">Where the text should go. TypeWit adds it at the end of the document.</p>
          {connections.length > 1 && (
            <div className="field" style={{ marginBottom: "1rem", maxWidth: 420 }}>
              <label className="label" htmlFor="account">Google account</label>
              <select id="account" value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setPastDocKey(""); }}>
                {connections.map((c) => <option key={c.id} value={c.id}>{c.account_email ?? "Google account"}</option>)}
              </select>
            </div>
          )}
          <div className="choices" role="radiogroup" aria-label="Document">
            <label className="choice">
              <input type="radio" name="target" value="new" checked={target === "new"} onChange={() => setTarget("new")} />
              <span><strong>New Google Doc</strong><small>Created in your Drive.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="target" value="existing" checked={target === "existing"} onChange={() => setTarget("existing")} disabled={docsForAccount.length === 0} />
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
                  <select id="doc" value={pastDocKey} onChange={(e) => setPastDocKey(e.target.value)}>
                    <option value="">Choose a document</option>
                    {docsForAccount.map((d) => <option key={d.key} value={d.key}>{d.title}</option>)}
                  </select>
                </>
              )}
          </div>
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
          <legend className="sr-only">Pace</legend>
          <h2 aria-hidden="true">Pace</h2>
          <p className="muted">What each insertion adds, and how long the whole session takes.</p>
          <div className="choices" role="radiogroup" aria-label="Insert one">
            {UNITS.map((u) => {
              const option = optionFor(u.value);
              const count = option ? `${option.units.toLocaleString()} ${UNIT_LABEL[u.value][option.units === 1 ? "one" : "many"]}` : null;
              const tooSlow = option && !option.fits && timing === "spread" ? ` · needs at least ${span(option.minimum_duration_seconds * 1000)}` : "";
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
          <div className="choices" role="radiogroup" aria-label="Timing" style={{ marginTop: "0.75rem" }}>
            <label className="choice">
              <input type="radio" name="timing" value="spread" checked={timing === "spread"} onChange={() => setTiming("spread")} />
              <span><strong>Spread over time</strong><small>Varied gaps, finishing at the end.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="timing" value="asap" checked={timing === "asap"} onChange={() => setTiming("asap")} />
              <span><strong>All at once</strong><small>One insertion, within about a minute.</small></span>
            </label>
          </div>
          {timing === "spread" && (
            <div className="row" style={{ marginTop: "1rem", alignItems: "flex-end", gap: "1rem" }}>
              <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
                <label className="label" htmlFor="duration">Session length</label>
                <select id="duration" value={preset} onChange={(e) => setPreset(e.target.value)}>
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
            </div>
          )}

          <PlanSummary plan={current ? preview : null} error={previewError} hasText={words > 0} timing={timing}
            onReshuffle={() => setSeed(undefined)} />
        </fieldset>

        <div className="form-section">
          <h2>Review and approve</h2>
          <p className="muted">
            TypeWit enters exactly this text through the Google Docs API. Each step is a real edit at its scheduled time, so
            Google Docs records it in version history under your account. TypeWit doesn&apos;t add typos or imitate typing.
            Editing the text clears your approval.
          </p>
          <div className="preview" tabIndex={0} role="region" aria-label="Text to approve">
            {text || <span className="pending">Your text will appear here.</span>}
          </div>
          {steps > 1 && current && <StepList text={text} plan={preview} />}
          <label className="check" htmlFor="approve" style={{ marginTop: "0.75rem" }}>
            <input id="approve" type="checkbox" checked={approved} disabled={words === 0} onChange={(e) => setApproved(e.target.checked)} />
            <span>I&apos;ve read this exact text and approve TypeWit entering it into my document.</span>
          </label>
          {error && (
            <div className="alert alert-error" role="alert" tabIndex={-1} ref={errorRef} style={{ marginTop: "0.75rem", display: "block" }}>
              <p>{error}</p>
              {problems.length > 0 && <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>{problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="form-actions">
          <Link href="/app" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Starting…" : "Start session"}</button>
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
  const summary = `${n.toLocaleString()} ${label}, one insertion each. The first after about ${span(stats.first_offset_ms)}, ` +
    `then gaps between ${span(stats.min_gap_ms)} and ${span(stats.max_gap_ms)}; the last lands at the ${span(stats.last_offset_ms)} mark.`;

  return (
    <div className="plan-box">
      <p className="small" role="status" aria-live="polite" aria-atomic="true" style={{ marginBottom: "0.75rem" }}>{summary}</p>
      <dl>
        <div><dt>Insertions</dt><dd>{n.toLocaleString()}</dd></div>
        <div><dt>First</dt><dd>after {span(stats.first_offset_ms)}</dd></div>
        <div><dt>Typical gap</dt><dd>{span(stats.median_gap_ms)}</dd></div>
        <div><dt>Last</dt><dd>at {span(stats.last_offset_ms)}</dd></div>
      </dl>
      <ScheduleStrip offsets={plan.schedule} label={`Planned schedule: ${summary}`} />
      <p className="hint" style={{ marginTop: "0.5rem" }}>
        Longer {UNIT_LABEL[plan.unit].many} get more time, and each gap varies by up to a third, so there is no fixed rhythm.
        Insertions are always at least {plan.min_gap_seconds} seconds apart. The schedule is saved when you start; pausing
        moves the rest of it later by the length of the pause.{" "}
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
  const label = UNIT_LABEL[plan.unit][plan.unit_count === 1 ? "one" : "many"];
  return (
    <details className="more" style={{ marginTop: "0.5rem" }}>
      <summary>See the {plan.unit_count.toLocaleString()} {label} as they will be entered</summary>
      <ol className="steps-list" tabIndex={0} aria-label="Steps in order">
        {parts.map((part, i) => (
          <li key={i}>
            <span className="n">{i + 1}.</span>
            <time>+{span(plan.schedule[i] ?? 0)}</time>
            <span className="t">{part.split("\n").map((line, k) => (
              <span key={k}>{k > 0 && <><mark aria-hidden="true">↵</mark>{"\n"}</>}{line}</span>
            ))}</span>
          </li>
        ))}
      </ol>
      {plan.unit_count > shown && <p className="hint">Showing the first {shown}.</p>}
    </details>
  );
}

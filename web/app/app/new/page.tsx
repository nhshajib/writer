"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AgreementGate } from "@/components/dashboard/AgreementGate";
import { api, sha256Hex } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import type { Connection, Drip } from "@/lib/types";
import { useRequireSession } from "@/lib/useRequireSession";

type Unit = "sentence" | "paragraph" | "chunk";
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
  { minutes: 180, label: "3 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "1 week" },
];

const UNITS: { value: Unit; label: string; hint: string }[] = [
  { value: "sentence", label: "Sentence by sentence", hint: "Each step adds whole sentences." },
  { value: "paragraph", label: "Paragraph by paragraph", hint: "Each step adds whole paragraphs." },
  { value: "chunk", label: "Even parts", hint: "Steps of roughly equal length." },
];

function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

function countUnits(text: string, unit: Unit): number {
  if (!text.trim()) return 0;
  if (unit === "paragraph") return text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  if (unit === "sentence") return text.split(/(?<=[.!?]["')\]]*\s+)/).filter((p) => p.trim()).length;
  return countWords(text);
}

function describeInterval(seconds: number): string {
  if (seconds < 90) return "about every minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `about every ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `about every ${hours} hour${hours === 1 ? "" : "s"}`;
}

interface PastDoc {
  key: string;
  connectionId: string;
  documentId: string;
  title: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const session = useRequireSession();
  const [loaded, setLoaded] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pastDocs, setPastDocs] = useState<PastDoc[]>([]);

  const [connectionId, setConnectionId] = useState("");
  const [target, setTarget] = useState<Target>("new");
  const [title, setTitle] = useState("");
  const [pastDocKey, setPastDocKey] = useState("");
  const [text, setText] = useState("");
  const [unit, setUnit] = useState<Unit>("sentence");
  const [timing, setTiming] = useState<Timing>("spread");
  const [minutes, setMinutes] = useState(30);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const client = supabase();
        const [{ data: profile }, { data: conns }, list] = await Promise.all([
          client.from("profiles").select("agreed_terms_version, plan").maybeSingle(),
          client.from("provider_connections").select("id, provider, account_email"),
          api<{ drips: Drip[] }>("drips"),
        ]);
        setAgreed(profile?.agreed_terms_version === CURRENT_TERMS_VERSION);
        setPlan(profile?.plan === "pro" ? "pro" : "free");
        const google = ((conns ?? []) as Connection[]).filter((c) => c.provider === "google");
        setConnections(google);
        setConnectionId(google[0]?.id ?? "");

        // Documents TypeWit wrote into before can be written into again.
        const seen = new Map<string, PastDoc>();
        for (const d of list.drips) {
          if (d.provider !== "google") continue;
          const key = `${d.connection_id}:${d.document_id}`;
          if (!seen.has(key)) {
            seen.set(key, {
              key,
              connectionId: d.connection_id,
              documentId: d.document_id,
              title: d.document_title ?? "Untitled document",
            });
          }
        }
        setPastDocs([...seen.values()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your account.");
      } finally {
        setLoaded(true);
      }
    })();
  }, [session]);

  const limits = LIMITS[plan];
  const words = countWords(text);
  const overWords = words > limits.words;
  const units = countUnits(text, unit);
  const docsForAccount = pastDocs.filter((d) => d.connectionId === connectionId);

  const schedule = useMemo(() => {
    if (timing === "asap" || units === 0) return null;
    const steps = Math.max(1, Math.min(units, minutes));
    const interval = steps === 1 ? 0 : Math.floor((minutes * 60) / steps);
    return { steps, interval };
  }, [timing, units, minutes]);

  function changeText(next: string) {
    setText(next);
    // Approval belongs to the exact text, so any edit needs a fresh approval.
    if (approved) setApproved(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!connectionId) return setError("Connect your Google account first.");
    if (target === "new" && !title.trim()) return setError("Give the new document a title.");
    if (target === "existing" && !pastDocKey) return setError("Choose a document.");
    if (words === 0) return setError("Add the text you want entered.");
    if (overWords) return setError(`Your plan allows ${limits.words} words a day. Shorten the text or upgrade to Pro.`);
    if (!approved) return setError("Read your text and tick the box to approve it.");

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
          approval: { confirmed: true, text_sha256: await sha256Hex(text) },
        },
      });
      router.push(`/app/session?id=${drip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the session.");
      setBusy(false);
    }
  }

  if (!session || !loaded) return <p role="status">Loading…</p>;
  if (!agreed) return <AgreementGate onAgreed={() => setAgreed(true)} />;

  if (connections.length === 0) {
    return (
      <div className="new-session">
        <h1>New session</h1>
        <div className="card">
          <h2 style={{ fontSize: "1.3rem" }}>Connect Google first</h2>
          <p className="muted">TypeWit needs your permission to create and add to Google Docs.</p>
          <Link href="/app" className="button">Go to dashboard to connect</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="new-session stack" onSubmit={onSubmit} noValidate aria-labelledby="new-title">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}><Link href="/app">Dashboard</Link></p>
          <h1 id="new-title">New session</h1>
        </div>
        {plan === "pro" ? <span className="pill pro">Pro</span> : <span className="pill">Free plan</span>}
      </div>

      <fieldset className="step-card">
        <legend>1. Choose the document</legend>
        {connections.length > 1 && (
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="account">Google account</label>
            <select id="account" value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setPastDocKey(""); }}>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.account_email ?? "Google account"}</option>)}
            </select>
          </div>
        )}
        <div className="options" role="radiogroup" aria-label="Document">
          <label className="option">
            <input type="radio" name="target" value="new" checked={target === "new"} onChange={() => setTarget("new")} />
            <span>A new Google Doc<small>TypeWit creates it in your Drive.</small></span>
          </label>
          <label className="option">
            <input type="radio" name="target" value="existing" checked={target === "existing"}
              onChange={() => setTarget("existing")} disabled={docsForAccount.length === 0} />
            <span>
              A document from a past session
              <small>{docsForAccount.length ? "Text is added at the end." : "None yet."}</small>
            </span>
          </label>
        </div>
        {target === "new"
          ? (
            <div className="field" style={{ marginTop: "1rem" }}>
              <label htmlFor="title">Document title</label>
              <input id="title" type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="For example: History essay" />
            </div>
          )
          : (
            <div className="field" style={{ marginTop: "1rem" }}>
              <label htmlFor="doc">Document</label>
              <select id="doc" value={pastDocKey} onChange={(e) => setPastDocKey(e.target.value)}>
                <option value="">Choose a document</option>
                {docsForAccount.map((d) => <option key={d.key} value={d.key}>{d.title}</option>)}
              </select>
            </div>
          )}
      </fieldset>

      <fieldset className="step-card">
        <legend>2. Add your text</legend>
        <div className="field">
          <label htmlFor="text">Text to enter</label>
          <textarea id="text" value={text} onChange={(e) => changeText(e.target.value)} aria-describedby="text-count" />
          <span id="text-count" className={`hint counter${overWords ? " over" : ""}`} aria-live="polite">
            {words} {words === 1 ? "word" : "words"}
            {plan === "free" && ` of ${limits.words} a day on Free`}
          </span>
        </div>
        {overWords && (
          <p className="upsell" style={{ marginTop: "1rem" }}>
            <span>Pro has no daily word limit.</span>
            <Link href="/pricing" className="button pro small">Try Pro free for 7 days</Link>
          </p>
        )}
      </fieldset>

      <fieldset className="step-card">
        <legend>3. Choose how it's added</legend>
        <div className="options" role="radiogroup" aria-label="Step size">
          {UNITS.map((u) => (
            <label key={u.value} className="option">
              <input type="radio" name="unit" value={u.value} checked={unit === u.value} onChange={() => setUnit(u.value)} />
              <span>{u.label}<small>{u.hint}</small></span>
            </label>
          ))}
        </div>

        <div className="options" role="radiogroup" aria-label="Timing" style={{ marginTop: "1rem" }}>
          <label className="option">
            <input type="radio" name="timing" value="spread" checked={timing === "spread"} onChange={() => setTiming("spread")} />
            <span>Spread over time<small>Steps arrive evenly over the time you choose.</small></span>
          </label>
          <label className="option">
            <input type="radio" name="timing" value="asap" checked={timing === "asap"} onChange={() => setTiming("asap")} />
            <span>All at once<small>Everything is added within about a minute.</small></span>
          </label>
        </div>

        {timing === "spread" && (
          <div className="field" style={{ marginTop: "1rem" }}>
            <label htmlFor="duration">Finish within</label>
            <select id="duration" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
              aria-describedby="duration-hint">
              {DURATIONS.map((d) => (
                <option key={d.minutes} value={d.minutes} disabled={d.minutes > limits.minutes}>
                  {d.label}{d.minutes > limits.minutes ? " (Pro)" : ""}
                </option>
              ))}
            </select>
            <span id="duration-hint" className="hint">
              {schedule
                ? `${schedule.steps} ${schedule.steps === 1 ? "step" : "steps"}${schedule.steps > 1 ? `, ${describeInterval(schedule.interval)}` : ""}.`
                : "Add text to see the steps."}
              {plan === "free" && " Free sessions can last up to 1 hour."}
            </span>
          </div>
        )}
      </fieldset>

      <fieldset className="step-card">
        <legend>4. Review and approve</legend>
        <p className="muted">TypeWit will enter exactly this text. If you change it, you'll need to approve it again.</p>
        <div className="preview" tabIndex={0} role="region" aria-label="Text to approve">
          {text || <span className="pending">Your text will appear here.</span>}
        </div>
        <div className="approve-box" style={{ marginTop: "1rem" }}>
          <label className="choice" htmlFor="approve">
            <input id="approve" type="checkbox" checked={approved} disabled={words === 0}
              onChange={(e) => setApproved(e.target.checked)} />
            <span>I've read this exact text and approve TypeWit entering it into my document.</span>
          </label>
        </div>
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="controls" style={{ marginTop: 0 }}>
        <button type="submit" className="button large" disabled={busy}>
          {busy ? "Starting…" : "Start session"}
        </button>
        <Link href="/app" className="button large quiet">Cancel</Link>
      </div>
    </form>
  );
}

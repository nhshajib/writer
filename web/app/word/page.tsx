"use client";
import { WritingBlockControls, blocksFromPace, blockPace } from "@/components/app/WritingBlockControls";
import { WritingBlockSummary } from "@/components/app/WritingBlockSummary";
import { planProblemText } from "@/lib/planMessages";
import { WordGroupingControls } from "@/components/app/WordGroupingControls";
import { SentenceStepHint } from "@/components/app/SentenceStepHint";
import { DEFAULT_INSERTION_UNIT } from "../../../supabase/functions/_shared/chunker.ts";
import { RhythmPreview } from "@/components/app/RhythmPreview";
import { effectivePlan, type PlanTier } from "../../../supabase/functions/_shared/limits";
import type { WorkWindow } from "../../../supabase/functions/_shared/workWindow";
import { WorkWindowControls } from "@/components/app/WorkWindowControls";
import { PLAN_LIMITS, type SessionDefaults } from "@/lib/dashboard";
import { RichTextEditor } from "@/components/app/RichTextEditor";
import { parseFormatted, type TextFormat } from "../../../supabase/functions/_shared/markdown.ts";

import type { Session } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionReport } from "@/components/app/ConnectionReport";
import { DEFAULT_PACE, PaceControls, paceFromSettings, pacingFor, usePace } from "@/components/app/PaceControls";
import { rhythmPacing, type SessionRhythm } from "../../../supabase/functions/_shared/plan.ts";
import { ScheduleStrip } from "@/components/app/ScheduleStrip";
import { StatusBadge } from "@/components/app/StatusBadge";
import { api, ApiError, sha256Hex } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { span, when } from "@/lib/time";
import {
  type AccessReport,
  ACTIVITY_LABEL,
  type Drip,
  type InsertionUnit,
  type SessionPlan,
  type SessionState,
  STATE_LABEL,
  stateOf,
  UNIT_LABEL,
} from "@/lib/types";
import { loadWord, officeWordHost } from "@/lib/wordHost";
import { WordRunner } from "@/lib/wordSession";
import { checkAccess } from "../../../supabase/functions/_shared/access.ts";
import { WordDocProvider } from "../../../supabase/functions/_shared/providers/word.ts";

/*
 * The TypeWit add-in for Microsoft Word (task pane). Word sessions edit the
 * document this pane is open in, through Word's JavaScript API, at the planned
 * times; they run only while the document and this pane are open.
 */

const ACTIVE = new Set(["scheduled", "running", "paused"]);

const DURATIONS = [5, 15, 30, 60, 120, 180, 480, 720, 1380, 1440, 4320, 10080];

function titleFromUrl(address: string): string {
  const last = address.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop() ?? "";
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch { /* keep it as it is */ }
  return name.replace(/\.(docx?|dotx?|docm)$/i, "") || "Word document";
}

export default function WordPane() {
  const [env, setEnv] = useState<{ inWord: boolean; documentUrl: string | null } | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void loadWord().then(setEnv);
  }, []);

  useEffect(() => {
    const client = supabase();
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  let body: React.ReactNode;
  if (env === null) body = <p role="status">Connecting to Word…</p>;
  else if (!env.inWord) {
    body = (
      <div className="card">
        <h1 className="word-title">Open TypeWit from Word</h1>
        <p>
          This page is TypeWit&apos;s add-in for Microsoft Word. In Word, choose Home → Add-ins (or Insert → Add-ins),
          then TypeWit. To add it to Word the first time, follow the steps on the Documents page.
        </p>
        <p><a href="/app/connections#word">How to add TypeWit to Word</a></p>
      </div>
    );
  } else if (!env.documentUrl) {
    body = (
      <div className="alert alert-info alert-block" role="status">
        Save this document first (to OneDrive, SharePoint or your computer). TypeWit ties each session to one saved
        document, so it can never write into another one.
      </div>
    );
  } else if (session === undefined) body = <p role="status">Checking your TypeWit account…</p>;
  else if (session === null) body = <SignIn />;
  else body = <WordSession documentUrl={env.documentUrl} userId={session.user.id} />;

  return (
    <main id="main" className="pane">
      <header className="pane-head">
        <strong>TypeWit</strong>
        <span className="badge">Automated text entry</span>
      </header>
      {body}
    </main>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "The email or password is incorrect." : signInError.message);
    }
    setBusy(false);
  }

  async function forgot() {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Enter your email first, then choose “Forgot password?”.");
    const { error: resetError } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password/`,
    });
    if (resetError) setError(resetError.message);
    else setNotice("If that email has an account, we've sent a reset link. Open it in your browser, then sign in here.");
  }

  return (
    <form className="card" onSubmit={submit} aria-labelledby="signin-title">
      <h2 id="signin-title">Sign in to TypeWit</h2>
      <div className="field">
        <label className="label" htmlFor="pane-email">Email</label>
        <input id="pane-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label className="label" htmlFor="pane-password">Password</label>
        <input id="pane-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {notice && <p className="alert alert-info" role="status">{notice}</p>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="link-btn" onClick={forgot}>Forgot password?</button>
      </div>
      <ul className="hint mt-3 pane-list">
        <li>No account yet? <a href="/signup/" target="_blank" rel="noopener">Create one on typewit.com</a> (opens in your browser).</li>
        <li>
          You sign in with Google? Word can&apos;t open Google&apos;s sign-in here. On typewit.com, go to{" "}
          <a href="/app/settings/" target="_blank" rel="noopener">Settings → Security</a> and set a password, then use it here.
        </li>
      </ul>
    </form>
  );
}

function WordSession({ documentUrl, userId }: { documentUrl: string; userId: string }) {
  const title = titleFromUrl(documentUrl);
  const provider = useMemo(() => new WordDocProvider(officeWordHost, documentUrl, title), [documentUrl, title]);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [tier, setTier] = useState<PlanTier | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<SessionDefaults>({});
  const [dripId, setDripId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data: profile, error: profileError } = await supabase().from("profiles").select("plan,day_pass_expires_at,session_defaults").eq("user_id", userId).maybeSingle();
        if (profileError) throw new Error(profileError.message);
        setTier(effectivePlan(profile ?? {}));
        setExpiresAt(profile?.day_pass_expires_at ?? null);
        setDefaults(profile?.session_defaults ?? {});
        const { connection } = await api<{ connection: { id: string } }>("drips/connections/microsoft", { method: "POST" });
        setConnectionId(connection.id);
        const { drips } = await api<{ drips: Drip[] }>("drips");
        const open = drips.find((d) => d.provider === "microsoft" && d.document_id === documentUrl && ACTIVE.has(d.status));
        setDripId(open?.id ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "TypeWit couldn't be reached.");
      }
    })();
  }, [documentUrl, userId]);

  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (dripId === undefined || !connectionId || tier === null) return <p role="status">Loading…</p>;
  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>Document: <strong>{title}</strong></p>
      {dripId
        ? <WordProgress key={dripId} dripId={dripId} documentUrl={documentUrl} provider={provider} onDone={() => setDripId(null)} />
        : <WordStart tier={tier} expiresAt={expiresAt} defaults={defaults} connectionId={connectionId} documentUrl={documentUrl} title={title} provider={provider} onStarted={setDripId} />}
    </>
  );
}

type Timing = "duration" | "speed" | "asap";

function WordStart({ connectionId, documentUrl, title, provider, onStarted, tier, expiresAt, defaults }: {
  expiresAt: string | null;
  defaults: SessionDefaults;
  tier: PlanTier;
  connectionId: string;
  documentUrl: string;
  title: string;
  provider: WordDocProvider;
  onStarted: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [workWindow, setWorkWindow] = useState<WorkWindow | null>(null);
  const [revisionSweep, setRevisionSweep] = useState(false);
  const [textFormat, setTextFormat] = useState<TextFormat>("plain");
  const formatted = parseFormatted(text, textFormat);
  const plainText = formatted?.plain ?? text;
  const [unit, setUnit] = useState<InsertionUnit>(defaults.unit ?? DEFAULT_INSERTION_UNIT);
  const [timing, setTiming] = useState<Timing>("duration");
  useEffect(() => { if (timing === "asap") setRevisionSweep(false); }, [timing]);
  const [minutes, setMinutes] = useState(defaults.minutes ?? (tier === "pro" ? 60 : 30));
  const [pace, updatePace] = usePace();
  const [rhythm, setRhythm] = useState<SessionRhythm>(defaults.rhythm && (defaults.rhythm !== "drafting" || tier === "pro") ? defaults.rhythm : tier === "pro" ? "custom" : "natural");
  const [approved, setApproved] = useState(false);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [planKey, setPlanKey] = useState("");
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [report, setReport] = useState<AccessReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const starting = useRef(false);

  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultsApplied.current) return;
    defaultsApplied.current = true;
    if (defaults.word_grouping) updatePace({ wordGrouping: defaults.word_grouping });
    if (tier !== "free" && defaults.writing_blocks) updatePace(blockPace(defaults.writing_blocks));
  }, [defaults, tier, updatePace]);
  const isPro = tier === "pro";
  const rhythmPace = rhythm === "custom" ? (isPro ? pace : DEFAULT_PACE) : { ...DEFAULT_PACE, ...paceFromSettings(rhythmPacing(rhythm, minutes * 60)) };
  const effectivePace = { ...rhythmPace, wordGrouping: pace.wordGrouping, blocksOn: tier !== "free" && pace.blocksOn, blockMinutes: pace.blockMinutes, blockBreakMinutes: pace.blockBreakMinutes };
  const simulatedDrafting = isPro && timing !== "asap" && (effectivePace.typoRate > 0 || effectivePace.falseStartRate > 0 || revisionSweep);
  useEffect(() => setApproved(false), [effectivePace.typoRate, effectivePace.falseStartRate, simulatedDrafting]);
  const pacing = timing === "asap" ? null : pacingFor(timing, minutes, effectivePace);
  const key = JSON.stringify([text, textFormat, unit, timing, pacing, rhythm, seed ?? null, workWindow, revisionSweep]);
  const current = plan !== null && planKey === key;

  useEffect(() => {
    if (!text.trim()) return setPlan(null);
    let stale = false;
    const handle = setTimeout(async () => {
      try {
        const res = await api<{ plan: SessionPlan }>("drips/plan", {
          method: "POST",
          body: {
            text,
            text_format: textFormat, work_window: workWindow, revision_sweep: revisionSweep,
            rhythm,
            insertion_unit: unit,
            mode: timing === "asap" ? "as_soon_as_possible" : "scheduled",
            ...(pacing ? { pacing } : {}),
            ...(seed !== undefined ? { schedule_seed: seed } : {}),
          },
        });
        if (stale) return;
        const kept = seed ?? res.plan.seed;
        if (seed === undefined) setSeed(kept);
        setPlan(res.plan);
        setPlanKey(JSON.stringify([text, textFormat, unit, timing, pacing, rhythm, kept, workWindow, revisionSweep]));
      } catch (e) {
        if (!stale) setError(e instanceof Error ? e.message : "Couldn't check the schedule.");
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` covers text, unit, timing, pacing and seed
  }, [key]);

  async function testConnection() {
    setChecking(true);
    setReport(await checkAccess(provider, documentUrl, null));
    setChecking(false);
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    if (starting.current) return;
    setError(null);
    if (!text.trim()) return setError("Add the text you want entered.");
    if (!current) return setError("The schedule is still being checked. Try again in a moment.");
    if (!plan.ok) return setError(plan.problems.map(planProblemText).join(" "));
    if (!approved) return setError("Read your text and tick the box to approve it.");
    starting.current = true;
    setBusy(true);
    try {
      const { drip } = await api<{ drip: { id: string } }>("drips", {
        method: "POST",
        body: {
          connection_id: connectionId,
          document_id: documentUrl,
          document_title: title,
          text,
          text_format: textFormat, work_window: workWindow, revision_sweep: revisionSweep,
          rhythm,
          insertion_unit: unit,
          mode: timing === "asap" ? "as_soon_as_possible" : "scheduled",
          ...(pacing ? { pacing } : { duration_minutes: 1 }),
          schedule_seed: plan.seed,
          request_id: requestId.current,
          approval: { confirmed: true, text_sha256: await sha256Hex(text) },
        },
      });
      onStarted(drip.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the session.");
      // A refused Start gets a new id; a duplicate (409) or one with no response (0) keeps it, so a retry can't start twice.
      if (!(e instanceof ApiError && (e.status === 409 || e.status === 0))) requestId.current = crypto.randomUUID();
      starting.current = false;
      setBusy(false);
    }
  }

  const steps = current && plan.ok ? plan.source_unit_count ?? plan.unit_count : 0;
  const words = (plainText.match(/\S+/g) ?? []).length;

  return (
    <form onSubmit={start} noValidate aria-label="New Word session">
      <div className="field">
        <label className="label" htmlFor="text">Text to enter</label>
        <RichTextEditor importEnabled={tier === "pro"} text={text} format={textFormat} onChange={(next, format) => { setText(next); setTextFormat(format); setApproved(false); }} />
        <span id="text-count" className="hint">{words.toLocaleString()} words · {plainText.length.toLocaleString()} characters</span>
      </div>

      <div className="field">
        <label className="label" htmlFor="pane-unit">Insert one</label>
        <select id="pane-unit" value={unit} onChange={(e) => setUnit(e.target.value as InsertionUnit)}>
          {(["sentence", "word", "character", "paragraph"] as const).map((u) => <option key={u} value={u}>{u === "word" ? "words (choose grouping below)" : `${UNIT_LABEL[u].one} at a time`}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="pane-rhythm">Writing rhythm</label>
        <select id="pane-rhythm" value={rhythm} onChange={(e) => { setRhythm(e.target.value as SessionRhythm); setTiming("duration"); setApproved(false); }}>
          <option value="natural">Natural — varied timing and sentence pauses</option>
          <option value="steady">Steady — fewer pauses</option>
          <option value="drafting" disabled={!isPro}>Drafting — occasional corrected mistakes (Pro)</option>
          <option value="custom" disabled={!isPro}>Custom settings (Pro)</option>
        </select>
      </div>
      <fieldset className="field">
        <legend className="label">Timing</legend>
        {([["duration", "Target duration"], ["speed", "Typing speed"], ["asap", "All at once"]] as const).map(([value, label]) => (
          <label key={value} className="check">
            <input type="radio" name="pane-timing" value={value} checked={timing === value} disabled={value === "speed" && !isPro} onChange={() => { if (value === "speed") { updatePace(effectivePace); setRhythm("custom"); } setTiming(value); }} />
            <span>{label}{value === "speed" && !isPro && " (Pro)"}</span>
          </label>
        ))}
      </fieldset>

      {timing === "duration" && (
        <div className="field">
          <label className="label" htmlFor="pane-duration">{effectivePace.blocksOn ? "Writing time" : "Total duration"}</label>
          <select id="pane-duration" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-describedby="pane-duration-hint">
            {!DURATIONS.includes(minutes) && <option value={minutes}>{span(minutes * 60000)}</option>}
            {DURATIONS.map((m) => <option key={m} value={m} disabled={m > PLAN_LIMITS[tier].maxMinutes}>{span(m * 60_000)}</option>)}
          </select>
          <span id="pane-duration-hint" className="hint">
            {effectivePace.blocksOn ? "Long breaks are added to the writing time; the preview shows the full elapsed time." : "Breaks are included and the last insertion is planned for the end."} It&apos;s a target: closing this document or
            the TypeWit pane, sleep or Word delays move the rest later.
          </span>
        </div>
      )}
      {unit === "sentence" && timing !== "asap" && <SentenceStepHint />}
      {unit === "word" && timing !== "asap" && <WordGroupingControls value={pace.wordGrouping} onChange={wordGrouping => { updatePace({ wordGrouping }); setApproved(false); }} />}
      <RhythmPreview pace={effectivePace} unit={unit} allAtOnce={timing === "asap"} revisionSweep={revisionSweep} />
      {timing !== "asap" && <WritingBlockControls value={blocksFromPace(effectivePace)} plan={tier} expiresAt={expiresAt} onChange={value => { updatePace(blockPace(value)); setApproved(false); }} />}
      <WritingBlockSummary plan={current ? plan : null} />
      <WorkWindowControls value={workWindow} onChange={v => { setWorkWindow(v); setApproved(false); }} enabled={tier !== "free"} />
      <label className="check"><input type="checkbox" checked={revisionSweep} disabled={!isPro || timing === "asap"} onChange={e => { setRevisionSweep(e.target.checked); setApproved(false); }} />Final revision pass (Pro; restores approved text)</label>
      {timing !== "asap" && isPro && <PaceControls timing={timing} pace={effectivePace} onChange={(change) => { updatePace({ ...effectivePace, ...change }); setRhythm("custom"); }} />}
      {timing !== "asap" && !isPro && <p className="hint">Natural and Steady are included on Free. Pro adds custom speed, adjustable pauses and simulated corrections.</p>}

      <div className="plan-box" role="status" aria-live="polite">
        {!text.trim() ? "Add text to see the schedule." : !current ? "Checking the schedule…" : !plan.ok
          ? plan.problems.map((p) => <p key={p.code} className="error-text">{planProblemText(p)}</p>)
          : (
            <>
              <p className="small" style={{ marginTop: 0 }}>
                {steps.toLocaleString()} {UNIT_LABEL[plan.unit][steps === 1 ? "one" : "many"]}{plan.unit_count !== steps ? `, ${plan.unit_count} automated edits including simulated corrections` : ""},{" "}
                {timing === "speed" ? "estimated" : "planned"} {span(plan.duration_seconds * 1000)}
                {plan.breaks.length ? `, with ${plan.breaks.length} break${plan.breaks.length === 1 ? "" : "s"}` : ""}.
              </p>
              {plan.schedule.length > 1 && <ScheduleStrip offsets={plan.schedule} breaks={plan.breaks} label="Planned schedule" />}
              {plan.warnings.map((w) => <p key={w.code} className="hint">{w.message}</p>)}
              <button type="button" className="link-btn" onClick={() => setSeed(undefined)}>Try different timing</button>
            </>
          )}
      </div>

      <dl className="summary-list mt-4" aria-label="Session summary">
        <dt>Document</dt><dd>{title}</dd>
        <dt>Location</dt><dd>At the end of the document</dd>
        <dt>Length</dt><dd>{words.toLocaleString()} words</dd>
        <dt>Mode</dt><dd>{UNIT_LABEL[unit].title}</dd>
        <dt>Timing</dt><dd>{timing === "duration" ? "Target duration" : timing === "speed" ? `${pace.wpm} WPM` : "All at once"}</dd>
        <dt>Duration</dt><dd>{current && plan.ok ? span(plan.duration_seconds * 1000) : "—"}</dd>
      </dl>

      <div className="row mt-4">
        <button type="button" className="btn btn-secondary btn-sm" onClick={testConnection} disabled={checking}>
          {checking ? "Testing…" : "Test connection"}
        </button>
      </div>
      <div aria-live="polite">{report && <ConnectionReport report={report} />}</div>

      <label className="check mt-4">
        <input type="checkbox" checked={approved} disabled={!text.trim()} onChange={(e) => setApproved(e.target.checked)} />
        <span>I&apos;ve read this exact text and approve TypeWit entering it into this document.{simulatedDrafting && " I also approve the enabled simulated mistakes and corrections; pausing or stopping can leave temporary text in the document."}</span>
      </label>
      <p className="hint">
        Each insertion is a real automated edit through Word, made at its planned time. Enabled drafting simulations make temporary mistakes and correct them; completed text matches your approval. Keep this document and the TypeWit pane open while it runs.
      </p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block btn-lg mt-2" disabled={busy}>
        {busy ? "Starting…" : "Start session"}
      </button>
    </form>
  );
}

function WordProgress({ dripId, documentUrl, provider, onDone }: {
  dripId: string;
  documentUrl: string;
  provider: WordDocProvider;
  onDone: () => void;
}) {
  const [drip, setDrip] = useState<Drip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [report, setReport] = useState<AccessReport | null>(null);
  const runner = useRef<WordRunner | null>(null);
  const announced = useRef<{ state: SessionState | null; quarter: number }>({ state: null, quarter: -1 });

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ drip: Drip }>(`drips/${dripId}`);
      setDrip(res.drip);
    } catch (e) {
      setError(e instanceof Error ? e.message : "TypeWit couldn't be reached.");
    }
  }, [dripId]);

  useEffect(() => {
    const r = new WordRunner(dripId, documentUrl, provider, (_outcome, message) => {
      setError(message ?? null);
      void refresh();
    });
    runner.current = r;
    r.start();
    const timer = setInterval(refresh, 5_000);
    void refresh();
    return () => {
      r.stop();
      clearInterval(timer);
    };
  }, [dripId, documentUrl, provider, refresh]);

  // Screen readers hear state changes and each quarter of the text, not every insertion.
  useEffect(() => {
    if (!drip) return;
    const state = stateOf(drip);
    const quarter = Math.floor(drip.progress.percent / 25);
    const last = announced.current;
    if (last.state !== null && state !== last.state) setAnnouncement(`Session ${STATE_LABEL[state].toLowerCase()}.`);
    else if (last.quarter >= 0 && quarter > last.quarter && quarter < 4) setAnnouncement(`${quarter * 25}% entered.`);
    announced.current = { state, quarter };
  }, [drip]);

  async function act(path: "pause" | "cancel" | "resume", options: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const body = path === "resume" ? { ...options, document: { text: (await provider.readDocument(documentUrl)).text } } : undefined;
      await api(`drips/${dripId}/${path}`, { method: "POST", body });
      setConfirmStop(false);
      runner.current?.poke();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!drip) return <p role="status">{error ?? "Loading the session…"}</p>;
  const state = stateOf(drip);
  const p = drip.progress;
  const finished = !ACTIVE.has(drip.status);
  const finish = p.finish_at ?? p.finish_if_resumed_now;

  return (
    <section aria-labelledby="pane-session-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="pane-session-title" style={{ margin: 0 }}>Session</h2>
        <StatusBadge state={state} />
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>

      <div className="mt-3">
        <div className="progress lg" role="progressbar" aria-label="Text confirmed in the document" aria-valuemin={0}
          aria-valuemax={100} aria-valuenow={p.percent}>
          <span style={{ width: `${p.percent}%` }} />
        </div>
        <p className="small mt-2">
          {p.percent}% confirmed: {p.chunks_written.toLocaleString()} of {p.chunks_total.toLocaleString()} parts,{" "}
          {(p.chars_total ?? 0) - (p.chars_written ?? 0)} characters to go.
        </p>
      </div>

      {p.temporary_edit_active && <p className="alert alert-info" role="status">Automated simulated drafting active. Temporary text is awaiting correction; pausing or stopping can leave it in the document.</p>}
      <dl className="summary-list mt-3">
        <dt>Now</dt><dd>{p.activity ? ACTIVITY_LABEL[p.activity] : STATE_LABEL[state]}</dd>
        {p.current_break && <><dt>Break until</dt><dd>{when(p.current_break.end, true)}</dd></>}
        {p.next_chunk_at && <><dt>Next insertion</dt><dd>{when(p.next_chunk_at, true)}</dd></>}
        {p.next_break && !p.current_break && <><dt>Next break</dt><dd>after part {p.next_break.after_part}, {when(p.next_break.start)}</dd></>}
        {finish && <><dt>{drip.status === "completed" ? "Finished" : drip.status === "paused" ? "Finish if resumed now" : "Expected finish"}</dt><dd>{when(finish)}</dd></>}
      </dl>

      {drip.status === "paused" && drip.attention && (
        <div className="alert alert-error alert-block mt-3" role="alert">
          <p>{drip.last_error}</p>
          {drip.attention === "access_expired" && <p><a href="/app/billing/" target="_blank" rel="noopener noreferrer">Renew Day Pass or upgrade to Pro (opens in a new tab)</a>, then resume here.</p>}
          <div className="row row-wrap mt-2">
            {drip.attention === "document_changed" && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("resume", { continue_from_current_end: true })}>
                Continue after the current end
              </button>
            )}
            {drip.attention === "confirm_last_part" && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("resume", { last_part: "present" })}>
                  The part is in the document
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("resume", { last_part: "absent" })}>
                  It isn&apos;t there
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!finished && (
        <p className="hint mt-3">
          Text is entered only while this document and the TypeWit pane are open. If you close them, nothing is entered and
          the rest moves later when you come back.
        </p>
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <div className="row row-wrap mt-3">
        {(drip.status === "scheduled" || drip.status === "running") && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act("pause")}>Pause</button>
        )}
        {drip.status === "paused" && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act("resume")}>Resume</button>
        )}
        {!finished && !confirmStop && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirmStop(true)}>Stop…</button>
        )}
        {!finished && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
            onClick={async () => setReport(await checkAccess(provider, documentUrl, null))}>
            Test connection
          </button>
        )}
        {finished && <button type="button" className="btn btn-primary" onClick={onDone}>Start another session</button>}
      </div>
      {confirmStop && (
        <div className="confirm mt-3" role="alertdialog" aria-labelledby="pane-stop-title" aria-describedby="pane-stop-desc"
          onKeyDown={(e) => e.key === "Escape" && setConfirmStop(false)}>
          <p id="pane-stop-title"><strong>Stop this session?</strong></p>
          <p id="pane-stop-desc" className="small">
            Everything still planned is cancelled. Text already entered stays in your document, and the session can&apos;t be
            resumed. Temporary text may remain if a simulated correction was in progress; review the document.
          </p>
          <div className="row row-wrap">
            <button type="button" className="btn btn-danger-solid btn-sm" disabled={busy} onClick={() => act("cancel")} autoFocus>Stop session</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmStop(false)}>Keep going</button>
          </div>
        </div>
      )}
      <div aria-live="polite">{report && <ConnectionReport report={report} />}</div>
      <p className="hint mt-4">
        <a href={`/app/session?id=${drip.id}`} target="_blank" rel="noopener">Open the activity log on the website</a>
      </p>
    </section>
  );
}

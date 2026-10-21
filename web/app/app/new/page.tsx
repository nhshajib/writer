"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Sheet } from "@/components/app/mobile/Sheet";
import { useIsMobile } from "@/lib/useMediaQuery";
import { ConnectionReport } from "@/components/app/ConnectionReport";
import { ScheduleStrip } from "@/components/app/ScheduleStrip";
import { DEFAULT_PACE, PaceControls, paceFromSettings, pacingFor, usePace } from "@/components/app/PaceControls";
import { api, ApiError, sha256Hex } from "@/lib/api";
import { ACTIVE_STATUSES, type PacePreset, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { PacePresets } from "@/components/app/PacePresets";
import { MarkdownPreview } from "@/components/app/MarkdownPreview";
import { IMPORT_ACCEPT, importFile } from "@/lib/importDoc";
import { parseMarkdown, type TextFormat } from "../../../../supabase/functions/_shared/markdown.ts";
import { pickGoogleDoc } from "@/lib/googlePicker";
import { supabase } from "@/lib/supabase";
import { span, when } from "@/lib/time";
import {
  type AccessReport,
  type InsertionUnit,
  type PacingSettings,
  type PlanProblem,
  type SessionPlan,
  type TimingMode,
  UNIT_LABEL,
} from "@/lib/types";

type Timing = TimingMode | "asap";

/** The form is shown as five steps, one at a time; every check still runs again on Start. */
const STEP_NAMES = ["Document", "Text", "Insertion", "Timing", "Review"];
/** The field to focus when a step has a problem. */
const STEP_FIELDS: Record<number, string[]> = { 1: ["title", "doc"], 2: ["text"], 3: ["heading"], 4: ["custom-minutes", "duration", "start-at"] };
type Target = "new" | "existing";
type Place = "end" | "heading";
interface DocHeading { id: string; text: string; level: number }


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

/** The unsent text is kept in this browser only, so a closed tab or a failed Start doesn't lose it. */
const DRAFT_KEY = "typewit.draft";

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(text: string) {
  try {
    if (text.trim()) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: drafts just aren't kept.
  }
}

/** "2026-10-20T09:30" for a datetime-local input, in local time. */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const UNITS: { value: InsertionUnit; hint: string }[] = [
  { value: "sentence", hint: "One sentence at a time. Recommended." },
  { value: "word", hint: "Random groups of 1–5 words per insertion." },
  { value: "character", hint: "One character at a time." },
  { value: "paragraph", hint: "One paragraph at a time." },
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
  const [pace, updatePace] = usePace();
  // Google Docs chosen with Google Picker in this visit.
  const [picked, setPicked] = useState<PastDoc[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<PlanProblem[]>([]);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<AccessReport | null>(null);
  const [draft, setDraft] = useState("");
  const [fromNote, setFromNote] = useState<string | null>(null);
  const [format, setFormat] = useState<TextFormat>("plain");
  const [importNote, setImportNote] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [place, setPlace] = useState<Place>("end");
  const [headings, setHeadings] = useState<DocHeading[] | null>(null);
  const [headingsError, setHeadingsError] = useState<string | null>(null);
  const [headingId, setHeadingId] = useState("");
  const [startLater, setStartLater] = useState(false);
  const [startAt, setStartAt] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const errorRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [step, setStep] = useState(1);
  // The furthest step reached, so finished steps can be revisited from the progress steps.
  const [reached, setReached] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [stepError, setStepError] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => setCanPaste(typeof navigator.clipboard?.readText === "function"), []);
  const stepperCurrent = useRef<HTMLLIElement>(null);
  const [leaving, setLeaving] = useState(false);
  const stepHeading = useRef<HTMLParagraphElement>(null);
  // One id per Start press, so a repeated request can't start a second session.
  const requestId = useRef<string>(crypto.randomUUID());
  // Set synchronously, so two clicks in the same moment can't both submit.
  const starting = useRef(false);

  // The schedule preview comes from the server, so it is exactly what will run.
  const [preview, setPreview] = useState<SessionPlan | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [seed, setSeed] = useState<number | undefined>(undefined);

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

  // "Run again" on a session page links here with ?from=<session id>: start from that session's text and settings.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    const from = new URLSearchParams(window.location.search).get("from");
    if (!from) {
      prefilled.current = true;
      const saved = readDraft();
      if (saved) setDraft(saved);
      return;
    }
    if (dashboard.drips.length === 0) return;
    prefilled.current = true;
    const source = dashboard.drips.find((d) => d.id === from);
    supabase().from("drips").select("text, insertion_unit, timing_mode, pacing, text_format").eq("id", from).maybeSingle()
      .then(({ data }) => {
        if (!data?.text) return;
        setText(data.text as string);
        if (data.text_format === "markdown") setFormat("markdown");
        if (data.insertion_unit) setUnit(data.insertion_unit as InsertionUnit);
        const pacing = data.pacing as PacingSettings | null;
        if (data.timing_mode === "asap") setTiming("asap");
        else if (pacing) {
          setTiming(pacing.timing);
          if (pacing.timing === "duration" && pacing.duration_seconds) {
            const mins = Math.round(pacing.duration_seconds / 60);
            if (DURATIONS.some((d) => d.minutes === mins)) setPreset(String(mins));
            else {
              setPreset("custom");
              setCustomMinutes(String(mins));
            }
          }
          updatePace(paceFromSettings(pacing));
        }
        const doc = source ? pastDocs.find((d) => d.key === `${source.connection_id}:${source.document_id}`) : undefined;
        if (doc && !doc.busy && connections.some((c) => c.id === doc.connectionId)) {
          setConnectionId(doc.connectionId);
          setTarget("existing");
          setPastDocKey(doc.key);
        }
        setFromNote(`Started from "${source?.document_title ?? "a past session"}". Check the text and settings, then approve.`);
      });
  }, [dashboard.drips, pastDocs, connections, updatePace]);

  useEffect(() => {
    if (plan !== "pro" && timing === "speed") setTiming("duration");
    if (plan !== "pro" && startLater) setStartLater(false);
    if (plan !== "pro" && format !== "plain") setFormat("plain");
    if (plan !== "pro" && place !== "end") setPlace("end");
    // Start on the longest duration the plan allows, never on a Pro-only one.
    const allowed = PLAN_LIMITS[plan].maxMinutes;
    if (preset !== "custom" && Number(preset) > allowed) {
      setPreset(String(DURATIONS.filter((d) => d.minutes <= allowed).at(-1)?.minutes ?? allowed));
    }
  }, [plan, timing, startLater, preset, format, place]);

  function applyPreset(p: PacePreset) {
    setTiming(p.timing);
    if (p.timing === "duration" && p.minutes) {
      if (DURATIONS.some((d) => d.minutes === p.minutes)) setPreset(String(p.minutes));
      else {
        setPreset("custom");
        setCustomMinutes(String(p.minutes));
      }
    }
    updatePace({ ...DEFAULT_PACE, ...p.pace as Partial<typeof pace> });
  }

  // Keep the unsent text in this browser while it's being written.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (text) writeDraft(text);
    }, 500);
    return () => clearTimeout(handle);
  }, [text]);

  const isPro = plan === "pro";
  const limits = { words: PLAN_LIMITS[plan].dailyWords ?? Infinity, minutes: PLAN_LIMITS[plan].maxMinutes };
  const parsed = useMemo(() => (format === "markdown" ? parseMarkdown(text) : null), [format, text]);
  // The document gets the text without Markdown markers; counts and steps are of that text.
  const plainText = parsed ? parsed.plain : text;
  const words = countWords(plainText);
  const overWords = words > limits.words;
  const minutes = preset === "custom" ? Number(customMinutes) : Number(preset);
  const minutesValid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 10080;
  const allDocs = [...pastDocs, ...picked.filter((p) => !pastDocs.some((d) => d.key === p.key))];
  const docsForAccount = allDocs.filter((d) => d.connectionId === connectionId);
  const chosenDoc = allDocs.find((d) => d.key === pastDocKey);
  const heading = headings?.find((h) => h.id === headingId) ?? null;
  const placeLabel = place === "heading" && heading ? `At the end of the "${heading.text}" section` : "At the end of the document";

  // Free sessions use the standard pace (the server does the same); custom timing is Pro.
  const effectivePace = isPro ? pace : DEFAULT_PACE;
  const simulatedDrafting = timing !== "asap" && isPro && (pace.typoRate > 0 || pace.falseStartRate > 0);
  useEffect(() => setApproved(false), [pace.typoRate, pace.falseStartRate, simulatedDrafting]);
  const pacing: PacingSettings | null = timing === "asap" ? null : pacingFor(timing, minutes, effectivePace);
  const pacingKey = JSON.stringify(pacing);
  const inputKey = JSON.stringify([text, format, unit, timing, pacingKey, seed ?? null]);
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
            text_format: format,
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
        setPreviewKey(JSON.stringify([text, format, unit, timing, pacingKey, kept]));
      } catch (e) {
        if (!stale) setPreviewError(e instanceof Error ? e.message : "Couldn't check the schedule.");
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(handle);
    };
  }, [text, format, unit, timing, pacingKey, ready, seed]);

  // The chosen document's headings, for "Under a heading" (Pro, Google Docs).
  const headingDoc = place === "heading" && target === "existing" && chosenDoc ? chosenDoc : null;
  useEffect(() => {
    setHeadings(null);
    setHeadingsError(null);
    if (!headingDoc) return;
    let stale = false;
    const query = new URLSearchParams({ connection_id: headingDoc.connectionId, document_id: headingDoc.documentId });
    api<{ headings: DocHeading[] }>(`drips/headings?${query}`)
      .then((res) => {
        if (stale) return;
        setHeadings(res.headings);
        setHeadingId((id) => (res.headings.some((h) => h.id === id) ? id : ""));
      })
      .catch((e) => !stale && setHeadingsError(e instanceof Error ? e.message : "Couldn't read the document's headings."));
    return () => {
      stale = true;
    };
  }, [headingDoc?.connectionId, headingDoc?.documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function chooseFromDrive() {
    setPickError(null);
    setPicking(true);
    try {
      const doc = await pickGoogleDoc(connectionId);
      if (!doc) return;
      const key = `${connectionId}:${doc.id}`;
      const known = pastDocs.find((d) => d.key === key);
      if (!known) {
        setPicked((list) => [...list.filter((d) => d.key !== key), {
          key,
          connectionId,
          documentId: doc.id,
          title: doc.name,
          busy: false,
        }]);
      }
      setTarget("existing");
      setPastDocKey(key);
      setReport(null);
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "Google Drive couldn't be opened.");
    } finally {
      setPicking(false);
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    setImportNote(null);
    setImporting(true);
    try {
      const imported = await importFile(file);
      if (!imported.text) {
        setImportNote(`"${file.name}" has no text to import.`);
        return;
      }
      changeText(imported.text);
      setFormat(imported.markdown ? "markdown" : "plain");
      setImportNote(
        `Imported "${file.name}"${imported.markdown ? " with its headings, bold, italic and bullets" : ""}.` +
          (imported.removed ? ` ${imported.removed} character${imported.removed === 1 ? "" : "s"} Google Docs can't keep ${imported.removed === 1 ? "was" : "were"} removed.` : "") +
          " Check it before you approve.",
      );
    } catch (e) {
      setImportNote(e instanceof Error ? e.message : "That file couldn't be read.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function changeFormat(next: TextFormat) {
    setFormat(next);
    if (approved) setApproved(false);
  }

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
        content_unchanged: null,
        checked_at: new Date().toISOString(),
      });
    } finally {
      setChecking(false);
    }
  }

  /** What's missing in one step, checked only when moving on from it (phones). */
  function stepProblem(n: number): string | null {
    if (n === 1) {
      if (!connectionId) return "Connect your Google account first.";
      if (target === "new" && !title.trim()) return "Give the new document a title.";
      if (target === "existing" && !chosenDoc) return "Choose a document.";
      if (target === "existing" && chosenDoc?.busy) return "That document already has an unfinished session.";
    }
    if (n === 2) {
      if (words === 0) return "Add the text you want entered.";
      if (overWords) return `Your plan allows ${limits.words} words a day. Shorten the text or upgrade to Pro.`;
    }
    if (n === 3 && place === "heading") {
      if (target !== "existing") return "Choose an existing document in step 1 to add text under one of its headings.";
      if (!headingId) return "Choose a heading.";
    }
    if (n === 4) {
      if (timing === "duration" && !minutesValid) return "Choose a duration between 1 minute and 1 week.";
      const startTime = startLater ? new Date(startAt) : null;
      if (startTime && !(startTime.getTime() > Date.now())) return "Choose a start time in the future.";
      if (startTime && startTime.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return "Sessions can be scheduled up to 7 days ahead.";
      if (current && !preview.ok) return preview.problems.map((p) => p.message).join(" ");
    }
    return null;
  }

  function goToStep(next: number) {
    setDirection(next < step ? "back" : "forward");
    setStep(next);
    setReached((r) => Math.max(r, next));
    setStepError(null);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => (isMobile ? stepHeading.current : stepperCurrent.current)?.focus());
  }

  /** From the progress steps: back freely, forward only through steps that pass their checks. */
  function jumpTo(target: number) {
    if (target <= step) return goToStep(target);
    for (let n = step; n < target; n++) {
      const problem = stepProblem(n);
      if (problem) {
        if (n !== step) goToStep(n);
        setStepError(problem);
        return;
      }
    }
    goToStep(target);
  }

  async function pasteText() {
    setPasteNote(null);
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) changeText(text ? `${text}${text.endsWith("\n") ? "" : "\n"}${clip}` : clip);
      else setPasteNote("Nothing to paste. Copy your text first.");
    } catch {
      setPasteNote("Your browser didn't allow pasting from here. Press Ctrl+V (⌘V on a Mac) in the box instead.");
    }
    document.getElementById("text")?.focus();
  }

  function cancel() {
    if (text.trim() || title.trim()) setLeaving(true);
    else router.push("/app/sessions/");
  }

  function continueStep() {
    const problem = stepProblem(step);
    if (problem) {
      setStepError(problem);
      const field = (STEP_FIELDS[step] ?? []).map((id) => document.getElementById(id)).find((el) => el && el.offsetParent !== null);
      field?.focus();
      return;
    }
    goToStep(step + 1);
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
    const placeProblem = stepProblem(3);
    if (placeProblem) return fail(placeProblem);
    if (timing === "duration" && !minutesValid) return fail("Choose a duration between 1 minute and 1 week.");
    if (!current) return fail("The schedule is still being checked. Try again in a moment.");
    if (!preview.ok) return fail("This session can't run as set up:", preview.problems);
    if (!approved) return fail("Read your text and tick the box to approve it.");
    const startTime = startLater ? new Date(startAt) : null;
    if (startTime && !(startTime.getTime() > Date.now())) return fail("Choose a start time in the future.");
    if (startTime && startTime.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return fail("Sessions can be scheduled up to 7 days ahead.");

    starting.current = true;
    setBusy(true);
    try {
      const { drip } = await api<{ drip: { id: string } }>("drips", {
        method: "POST",
        body: {
          connection_id: connectionId,
          ...(target === "new" ? { new_document_title: title.trim() } : { document_id: chosenDoc!.documentId }),
          text,
          text_format: format,
          ...(place === "heading" && heading
            ? { insert_target: { heading_id: heading.id, heading_text: heading.text, level: heading.level } }
            : {}),
          insertion_unit: unit,
          mode: timing === "asap" ? "as_soon_as_possible" : "scheduled",
          ...(timing === "asap" ? { duration_minutes: 1 } : { pacing }),
          schedule_seed: preview.seed,
          request_id: requestId.current,
          ...(startTime ? { start_at: startTime.toISOString() } : {}),
          approval: { confirmed: true, text_sha256: await sha256Hex(text) },
        },
      });
      writeDraft("");
      await dashboard.refresh();
      router.push(`/app/session?id=${drip.id}`);
    } catch (e) {
      const list = e instanceof ApiError ? e.problems : [];
      fail(e instanceof Error ? e.message : "Couldn't start the session.", list);
      // A different Start press after a failure gets a new id.
      // A refused Start gets a new id; a duplicate (409) or one with no response (0) keeps it, so a retry can't start twice.
      if (!(e instanceof ApiError && (e.status === 409 || e.status === 0))) requestId.current = crypto.randomUUID();
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
          <p className="small muted" style={{ marginTop: "1rem" }}>
            Writing in Microsoft Word instead? Sessions for Word start from the{" "}
            <Link href="/app/documents#word">TypeWit add-in in Word</Link>; no Google account is needed.
          </p>
        </div>
      </>
    );
  }

  const optionFor = (u: InsertionUnit) => (current ? preview.options.find((o) => o.unit === u) : undefined);
  const steps = current && preview.ok ? preview.source_unit_count ?? preview.unit_count : 0;
  const plannedDuration = current && preview.ok
    ? `${span(preview.duration_seconds * 1000)}${preview.break_seconds ? ` (${span(preview.active_seconds * 1000)} entering, ${span(preview.break_seconds * 1000)} of breaks)` : ""}${timing === "speed" ? ", estimated" : ""}`
    : timing === "asap" ? "All at once" : "—";
  const docLabel = target === "new" ? (title.trim() ? `New Google Doc "${title.trim()}"` : "New Google Doc (add a title)") : chosenDoc?.title ?? "Choose a document";

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/app/sessions">Sessions</Link><span aria-hidden="true">/</span><span aria-current="page">New session</span></nav>
      <div className="page-head">
        <div>
          <h1 id="new-title">New session</h1>
          {isMobile
            ? <p className="step-indicator" ref={stepHeading} tabIndex={-1} aria-live="polite">Step {step} of 5 · {STEP_NAMES[step - 1]}</p>
            : <p className="new-sub">Your words. Your document. Your pace.</p>}
        </div>
      </div>
      {!isMobile && (
        <ol className="stepper" aria-label="Steps">
          {STEP_NAMES.map((name, i) => {
            const n = i + 1;
            const state = n === step ? "current" : n < step || n <= reached ? "done" : "todo";
            const label = <><span className="stepper-dot" aria-hidden="true">{n < step ? <Icon.check /> : n}</span><span className="stepper-name">{n}. {name}</span></>;
            return (
              <li key={name} data-state={state} aria-current={n === step ? "step" : undefined} ref={n === step ? stepperCurrent : undefined} tabIndex={n === step ? -1 : undefined}>
                {n !== step && n <= reached
                  ? <button type="button" onClick={() => jumpTo(n)}>{label}<span className="sr-only">{n < step ? ", done" : ""}</span></button>
                  : <span className="stepper-item">{label}{n === step && <span className="sr-only">, current step</span>}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {fromNote && <p className="alert alert-info mb-4" role="status">{fromNote}</p>}

      <form className="new-grid" onSubmit={onSubmit} noValidate aria-labelledby="new-title" data-step={step} data-direction={direction}>
        <div className="card card-flush new-main">
        <fieldset className="form-section" data-step-section="1">
          <legend className="sr-only">Document</legend>
          <h2 aria-hidden="true"><span className="step-n">1</span>Choose a document</h2>
          <p className="muted">
            Where the text should go. TypeWit adds it at the end of the document, or with Pro, under a heading you choose.
            Writing in Microsoft Word? Start
            from the <Link href="/app/documents#word">TypeWit add-in in Word</Link>.
          </p>
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
              <input type="radio" name="target" value="existing" checked={target === "existing"} onChange={() => { setTarget("existing"); setReport(null); }} />
              <span><strong>Existing document</strong><small>Any Google Doc you choose from your Drive.</small></span>
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
                  <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <select id="doc" value={pastDocKey} onChange={(e) => { setPastDocKey(e.target.value); setReport(null); }} aria-describedby="doc-hint" style={{ flex: "1 1 240px" }}>
                      <option value="">{docsForAccount.length ? "Choose a document" : "No documents yet: choose one from Drive"}</option>
                      {docsForAccount.map((d) => (
                        <option key={d.key} value={d.key} disabled={d.busy}>{d.title}{d.busy ? " (has an unfinished session)" : ""}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={chooseFromDrive} disabled={picking || !connectionId}>
                      {picking ? "Opening Drive…" : "Choose from Google Drive…"}
                    </button>
                  </div>
                  <span id="doc-hint" className="hint">
                    Choosing a document in Google&apos;s file picker lets TypeWit open that one document, nothing else in your
                    Drive. A document can have one unfinished session at a time.
                  </span>
                  {pickError && <p className="alert alert-error small" role="alert" style={{ marginTop: "0.5rem" }}>{pickError}</p>}
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

        <div className="form-section" data-step-section="2">
          <h2><span className="step-n" aria-hidden="true">2</span>Add your text</h2>
          <p className="muted">Paste or dictate your text. TypeWit enters it exactly as written, in order, including line breaks.</p>
          <div className="field">
            {draft && !text && (
              <p className="alert alert-info" style={{ marginBottom: "0.75rem" }}>
                <span>You have unsent text from before ({countWords(draft).toLocaleString()} words), saved in this browser.</span>{" "}
                <button type="button" className="link-btn" onClick={() => { changeText(draft); setDraft(""); }}>Restore it</button>{" "}
                <button type="button" className="link-btn" onClick={() => { writeDraft(""); setDraft(""); }}>Discard</button>
              </p>
            )}
            <div className="text-head">
              <label className="label" htmlFor="text">Text to enter</label>
              <div className="text-actions">
                {canPaste && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={pasteText}><Icon.clipboard />Paste text</button>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()}
                  disabled={!isPro || importing} aria-describedby={isPro ? undefined : "import-pro"}>
                  <Icon.doc />{importing ? "Importing…" : "Import file"}{!isPro && <span className="badge badge-blue pro-badge">Pro</span>}
                </button>
                <input ref={fileInput} type="file" accept={IMPORT_ACCEPT} hidden data-testid="import-file"
                  onChange={(e) => onImport(e.target.files?.[0])} />
              </div>
            </div>
            {!isPro && <span id="import-pro" className="sr-only">Importing .docx, .md and .txt files is part of Pro.</span>}
            {pasteNote && <p className="hint" role="status">{pasteNote}</p>}
            {importNote && <p className="hint" role="status">{importNote}</p>}
            <div className="choices choices-inline format-choice" role="radiogroup" aria-label="Text format">
              <label className="choice">
                <input type="radio" name="format" value="plain" checked={format === "plain"} onChange={() => changeFormat("plain")} />
                <span><strong>Plain text</strong><small>Entered exactly as typed.</small></span>
              </label>
              <label className="choice">
                <input type="radio" name="format" value="markdown" checked={format === "markdown"} onChange={() => changeFormat("markdown")}
                  disabled={!isPro} />
                <span>
                  <strong>Keep formatting{!isPro && <span className="badge badge-blue pro-badge">Pro</span>}</strong>
                  <small># Heading, **bold**, *italic* and - bullets become real formatting.</small>
                </span>
              </label>
            </div>
            <textarea id="text" value={text} onChange={(e) => changeText(e.target.value)} aria-describedby="text-count" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span id="text-count" className={overWords ? "error-text" : "hint"}>
                {words.toLocaleString()} {words === 1 ? "word" : "words"} · {plainText.length.toLocaleString()} characters
                {plan === "free" && ` · ${limits.words} words a day on Free`}
              </span>
              {overWords && <Link href="/app/billing" className="small">Pro has no daily limit</Link>}
            </div>
            <p className="dictation-hint"><Icon.mic />Use your device&apos;s dictation to add text by voice.</p>
            {parsed && text.trim() && (
              <div className="format-preview">
                <p className="label">How it will look</p>
                <MarkdownPreview parsed={parsed} />
              </div>
            )}
          </div>
        </div>

        <fieldset className="form-section" data-step-section="3">
          <legend className="sr-only">Insertion mode</legend>
          <h2 aria-hidden="true"><span className="step-n">3</span>Choose how it&apos;s entered</h2>
          <h3 className="review-sub" id="place-title">Where the text goes</h3>
          <div className="choices" role="radiogroup" aria-labelledby="place-title">
            <label className="choice">
              <input type="radio" name="place" value="end" checked={place === "end"} onChange={() => setPlace("end")} />
              <span><strong>End of the document</strong><small>After everything already in it.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="place" value="heading" checked={place === "heading"} onChange={() => setPlace("heading")} disabled={!isPro} />
              <span>
                <strong>Under a heading{!isPro && <span className="badge badge-blue pro-badge">Pro</span>}</strong>
                <small>At the end of a section of an existing Google Doc.</small>
              </span>
            </label>
          </div>
          {!isPro && <p className="hint">Adding text under a heading is part of <Link href="/app/billing/">Pro</Link>.</p>}
          {place === "heading" && (
            <div className="field" style={{ marginTop: "0.75rem", maxWidth: 520 }}>
              {target !== "existing" || !chosenDoc
                ? <p className="alert alert-info small">Choose an existing document in step 1 to see its headings.</p>
                : headingsError
                ? <p className="alert alert-error small" role="alert">{headingsError}</p>
                : headings === null
                ? <p className="hint" role="status">Reading the document&apos;s headings…</p>
                : headings.length === 0
                ? <p className="alert alert-info small">This document has no headings. Add one in Google Docs, or add the text at the end.</p>
                : (
                  <>
                    <label className="label" htmlFor="heading">Heading</label>
                    <select id="heading" value={headingId} onChange={(e) => setHeadingId(e.target.value)} aria-describedby="heading-hint">
                      <option value="">Choose a heading</option>
                      {headings.map((h) => (
                        <option key={h.id} value={h.id}>{`${"\u2002".repeat(Math.max(0, h.level - 1))}${h.text}`}</option>
                      ))}
                    </select>
                    <span id="heading-hint" className="hint">
                      The text goes at the end of that section, before the next heading of the same level. The section
                      needs an empty line at its end.
                    </span>
                  </>
                )}
            </div>
          )}
          <h3 className="review-sub">Insertion steps</h3>
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
                    <small>{count ? `${count}${tooSlow}` : u.hint}{count && u.value === "word" ? " · Random groups of 1–5 words." : ""}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="form-section" data-step-section="4">
          <legend className="sr-only">Timing</legend>
          <h2 aria-hidden="true"><span className="step-n">4</span>Set the timing</h2>
          <p className="muted">Pick a total time, or a typing speed. Breaks and variation apply to both.</p>
          <div className="choices" role="radiogroup" aria-label="Timing mode">
            <label className="choice">
              <input type="radio" name="timing" value="duration" checked={timing === "duration"} onChange={() => setTiming("duration")} />
              <span><strong>Target duration</strong><small>Fit everything, breaks included, into a set time.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="timing" value="speed" checked={timing === "speed"} onChange={() => setTiming("speed")} disabled={!isPro} />
              <span><strong>Typing speed{!isPro && <span className="badge badge-blue pro-badge">Pro</span>}</strong><small>Set words per minute; see how long it takes.</small></span>
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

          {timing !== "asap" && isPro && (
            <PacePresets timing={timing === "speed" ? "speed" : "duration"} minutes={minutes} pace={pace} onApply={applyPreset} />
          )}
          {timing !== "asap" && isPro && <PaceControls timing={timing} pace={pace} onChange={updatePace} collapsed={isMobile} />}
          {timing !== "asap" && !isPro && (
            <div className="pro-note">
              <p>
                <strong>Standard pacing.</strong> A little natural variation between parts, and short breaks about every 8
                minutes. <Link href="/app/billing/">Pro</Link> adds 20–150 WPM cadence, simulated typos and false starts, sentence pauses, custom timing and saved presets.
              </p>
            </div>
          )}

          <div className="plan-preview">
            <PlanSummary plan={current ? preview : null} error={previewError} hasText={words > 0} timing={timing}
              onReshuffle={() => setSeed(undefined)} />
          </div>

          <div className="field" style={{ marginTop: "1.25rem" }}>
            <label className="check" htmlFor="start-later">
              <input id="start-later" type="checkbox" checked={startLater} onChange={(e) => setStartLater(e.target.checked)} disabled={!isPro}
                aria-describedby={isPro ? undefined : "start-later-pro"} />
              <span>Start later instead of now{!isPro && <span className="badge badge-blue pro-badge">Pro</span>}</span>
            </label>
            {!isPro && <span id="start-later-pro" className="hint">Scheduling a start time is part of <Link href="/app/billing/">Pro</Link>.</span>}
            {startLater && (
              <div className="field" style={{ maxWidth: 280, marginBottom: 0 }}>
                <label className="label" htmlFor="start-at">Start at (your time)</label>
                <input id="start-at" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
                  min={localInputValue(new Date())} max={localInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}
                  aria-describedby="start-at-hint" />
                <span id="start-at-hint" className="hint">
                  Your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Up to 7 days ahead. The schedule counts from this time.
                </span>
              </div>
            )}
          </div>

        </fieldset>

        <div className="form-section" data-step-section="5">
          <h2><span className="step-n" aria-hidden="true">5</span>Review and approve</h2>
          <p className="muted">TypeWit enters exactly this text. Editing it clears your approval.</p>
          <div className="preview" tabIndex={0} role="region" aria-label="Text to approve">
            {parsed && text.trim() ? <MarkdownPreview parsed={parsed} /> : text || <span className="pending">Your text will appear here.</span>}
          </div>
          {steps > 1 && current && <StepList text={plainText} plan={preview} />}
          <h3 className="review-sub">Before you start</h3>
          <dl className="summary-list" aria-label="Before you start">
            <dt>Document</dt><dd>{docLabel}</dd>
            <dt>Insertion location</dt><dd>{placeLabel}</dd>
            <dt>Formatting</dt><dd>{format === "markdown" ? "Headings, bold, italic and bullets kept" : "Plain text"}</dd>
            <dt>Starts</dt><dd>{startLater && startAt ? when(new Date(startAt).getTime()) : "Now"}</dd>
            <dt>Text length</dt><dd>{words.toLocaleString()} words, {plainText.length.toLocaleString()} characters</dd>
            <dt>Insertion mode</dt><dd>{UNIT_LABEL[unit].title}{steps ? ` (${steps.toLocaleString()} insertions)` : ""}</dd>
            <dt>Timing mode</dt><dd>{timing === "duration" ? "Target duration" : timing === "speed" ? `Typing speed, ${pace.wpm} WPM` : "All at once"}</dd>
            {simulatedDrafting && <><dt>Automated simulated edits</dt><dd>Neighbor-key typos {pace.typoRate}%, false starts {pace.falseStartRate}% per eligible English word; temporary text is deleted and corrected.</dd></>}
            <dt>Planned duration</dt>
            <dd>{plannedDuration}</dd>
          </dl>
          <label className="check approve-check" htmlFor="approve">
            <input id="approve" type="checkbox" checked={approved} disabled={words === 0} onChange={(e) => setApproved(e.target.checked)} />
            <span>I&apos;ve read this exact text and approve TypeWit entering it into my document.{simulatedDrafting && " I also approve the enabled simulated mistakes and corrections; pausing or stopping can leave temporary text in the document."}</span>
          </label>
          {error && (
            <div className="alert alert-error" role="alert" tabIndex={-1} ref={errorRef} style={{ marginTop: "1rem", display: "block" }}>
              <p>{error}</p>
              {problems.length > 0 && <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>{problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul>}
            </div>
          )}
          <p className="hint">
            Each insertion is a real edit made through the Google Docs API at its scheduled time, using your Google
            account. Enabled drafting simulations make temporary edits and correct them; they are automated, and Google controls version-history grouping. It runs on TypeWit&apos;s servers, so
            you can close this page. Your text and its schedule are stored with TypeWit until you delete the session
            (Settings → Your data); the activity log records times and counts, not your text.
          </p>
        </div>
        </div>

        <aside className="new-rail" aria-labelledby="summary-title">
          <div className="card rail-card">
            <h2 id="summary-title" className="card-title">Session summary</h2>
            <ul className="summary-rows">
              <li><span className="sr-icon" aria-hidden="true"><Icon.doc /></span><span className="sr-label">Document</span>
                <span className="sr-value">{target === "new" ? title.trim() || <span className="muted">Add a title</span> : chosenDoc?.title ?? <span className="muted">Choose a document</span>}</span></li>
              <li><span className="sr-icon gdoc" aria-hidden="true"><Icon.doc /></span><span className="sr-label">Provider</span><span className="sr-value">Google Docs</span></li>
              <li><span className="sr-icon" aria-hidden="true"><Icon.list /></span><span className="sr-label">Insert at</span><span className="sr-value">{place === "heading" && heading ? `Under "${heading.text}"` : "End of document"}</span></li>
              <li><span className="sr-icon" aria-hidden="true"><Icon.text /></span><span className="sr-label">Text</span>
                <span className="sr-value">
                  {words > 0 && !overWords
                    ? <span className="pill good"><Icon.check />{reached > 2 ? `${words.toLocaleString()} words` : "Ready to review"}</span>
                    : <span className="muted">{overWords ? "Over today's limit" : "Add your text"}</span>}
                </span></li>
              <li><span className="sr-icon" aria-hidden="true"><Icon.clock /></span><span className="sr-label">Timing</span>
                <span className="sr-value">{reached >= 4 ? plannedDuration : <span className="muted">Set in next steps</span>}</span></li>
              <li><span className="sr-icon" aria-hidden="true"><Icon.eye /></span><span className="sr-label">Review</span>
                <span className="sr-value">{approved ? <span className="pill good"><Icon.check />Approved</span> : <span className="muted">{reached >= 5 ? "Not approved yet" : "Set in next steps"}</span>}</span></li>
            </ul>
            <div className="control-note">
              <span aria-hidden="true"><Icon.info /></span>
              <p><strong>You stay in control</strong>You review and approve the exact text before anything is entered, and you can pause or stop at any time.</p>
            </div>
          </div>
        </aside>
        <div className="step-bar">
          {stepError && <p className="alert alert-error" role="alert">{stepError}</p>}
          <div className="step-bar-row">
            {!isMobile && <button type="button" className="btn btn-ghost btn-lg step-cancel" onClick={cancel}>Cancel</button>}
            {(step > 1 || isMobile) && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => (step > 1 ? goToStep(step - 1) : setLeaving(true))}>
                {step > 1 ? "Back" : "Exit"}
              </button>
            )}
            {step < 5
              // Different keys: the press on Continue must not land on a submit button swapped into its place.
              ? (
                <button key="continue" type="button" className="btn btn-primary btn-lg" onClick={continueStep}>
                  {isMobile ? "Continue" : <>Continue to {STEP_NAMES[step].toLowerCase()}<Icon.chevronRight /></>}
                </button>
              )
              : <button key="start" type="submit" className="btn btn-primary btn-lg" disabled={busy} aria-disabled={busy}>{busy ? "Starting…" : "Start session"}</button>}
          </div>
        </div>
      </form>

      <Sheet open={leaving} onClose={() => setLeaving(false)} title="Leave without starting?" dismissible={false}>
        <p className="sheet-text">
          {text.trim()
            ? "Your text stays saved as a draft in this browser, so you can pick up where you left off. Pacing settings are remembered; approval must be given again."
            : "Nothing has been started."}
        </p>
        <div className="stack-4">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setLeaving(false)}>Keep editing</button>
          <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => router.push("/app/")}>Leave</button>
        </div>
      </Sheet>
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
  const n = plan.source_unit_count ?? plan.unit_count;
  const edits = plan.unit_count;
  const simulated = edits !== n;
  const label = UNIT_LABEL[plan.unit][n === 1 ? "one" : "many"];
  const total = span(plan.duration_seconds * 1000);
  const breaks = plan.breaks.length;
  const summary = `${n.toLocaleString()} ${label}, ${simulated ? `${edits.toLocaleString()} automated edits including simulated corrections` : "one insertion each"}, ${timing === "speed" ? "estimated to take" : "over"} ${total}` +
    (breaks ? ` with ${breaks} break${breaks === 1 ? "" : "s"} (${span(plan.break_seconds * 1000)} in all)` : "") +
    `. The first after about ${span(stats.first_offset_ms)}; the last at the ${total} mark.`;

  return (
    <div className="plan-box">
      <p className="small" role="status" aria-live="polite" aria-atomic="true" style={{ marginBottom: "0.75rem" }}>{summary}</p>
      <dl>
        <div><dt>{simulated ? "Document edits" : "Insertions"}</dt><dd>{edits.toLocaleString()}</dd></div>
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
  const count = plan.source_unit_count ?? plan.unit_count;
  const lengths = plan.source_unit_lengths ?? plan.unit_lengths;
  const endAt = (i: number) => (plan.source_unit_ends?.[i] ?? i + 1) - 1;
  const shown = Math.min(count, 500);
  const parts: string[] = [];
  let at = 0;
  for (let i = 0; i < shown; i++) {
    parts.push(text.slice(at, at + lengths[i]));
    at += lengths[i];
  }
  const breakAfter = new Map(plan.breaks.map((b) => [b.after_index, b]));
  const label = UNIT_LABEL[plan.unit][count === 1 ? "one" : "many"];
  return (
    <details className="more" style={{ marginTop: "0.5rem" }}>
      <summary>See the {count.toLocaleString()} {label} in order</summary>
      <ol className="steps-list" tabIndex={0} aria-label="Steps in order">
        {parts.map((part, i) => (
          <li key={i}>
            <span className="n">{i + 1}.</span>
            <time>+{span(plan.schedule[endAt(i)] ?? 0)}</time>
            <span className="t">
              {part.split("\n").map((line, k) => (
                <span key={k}>{k > 0 && <><mark aria-hidden="true">↵</mark>{"\n"}</>}{line}</span>
              ))}
              {breakAfter.has(endAt(i)) && <em className="muted"> Then a {span(breakAfter.get(endAt(i))!.duration_ms)} break.</em>}
            </span>
          </li>
        ))}
      </ol>
      {count > shown && <p className="hint">Showing the first {shown}.</p>}
    </details>
  );
}

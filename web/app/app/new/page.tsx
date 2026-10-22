"use client";
import { WritingBlockControls, blocksFromPace, blockPace } from "@/components/app/WritingBlockControls";
import { WritingBlockSummary } from "@/components/app/WritingBlockSummary";
import { planProblemText } from "@/lib/planMessages";
import { WordGroupingControls } from "@/components/app/WordGroupingControls";
import { RhythmPreview } from "@/components/app/RhythmPreview";
import { WorkWindowControls } from "@/components/app/WorkWindowControls";
import type { WorkWindow } from "../../../../supabase/functions/_shared/workWindow";
import { RichTextEditor } from "@/components/app/RichTextEditor";
import { PlanLock, UpgradeNote } from "@/components/app/PlanLock";
import { lockedProps, lockedWrap } from "@/components/app/UpgradeSheet";
import { canUse, PLAN_NAME, planForMinutes } from "@/lib/plans";
import { DURATIONS } from "@/lib/durations";

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
import { ACTIVE_STATUSES, type PacePreset, PLAN_LIMITS, type SessionDefaults, useDashboard } from "@/lib/dashboard";
import { saveSessionDefaults } from "@/components/app/SessionDefaultsForm";
import { useToast } from "@/components/Toast";
import { PacePresets } from "@/components/app/PacePresets";
import { MarkdownPreview } from "@/components/app/MarkdownPreview";
import { IMPORT_ACCEPT, importFile } from "@/lib/importDoc";
import { rhythmPacing, type SessionRhythm } from "../../../../supabase/functions/_shared/plan.ts";
import { parseFormatted, type TextFormat } from "../../../../supabase/functions/_shared/markdown.ts";
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

type Target = "new" | "existing";
type Place = "end" | "heading";
interface DocHeading { id: string; text: string; level: number }
/** Where a setup problem lives, so the page can open and focus it. */
interface SetupProblem { message: string; field: string; open?: "destination" | "more" }


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
  { value: "word", hint: "Single words or random 1–5-word groups. Recommended." },
  { value: "sentence", hint: "One sentence at a time." },
  { value: "paragraph", hint: "One paragraph at a time." },
  { value: "character", hint: "One character at a time." },
  { value: "chunk", hint: "Equal groups of words, about once a minute." },
];

const RHYTHMS = [
  ["natural", "Natural", "Varied timing and short pauses between sentences."],
  ["steady", "Steady", "Fewer pauses for a simpler, consistent pace."],
  ["drafting", "Drafting", "Adds occasional temporary typos and false starts, then corrects them."],
] as const;

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
  const toast = useToast();
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
  // Start from the account's saved defaults; "Run again" replaces them with that session's settings.
  const defaults = dashboard.profile.session_defaults;
  const defaultMinutes = defaults?.minutes;
  const [unit, setUnit] = useState<InsertionUnit>(defaults?.unit ?? "word");
  const [timing, setTiming] = useState<Timing>("duration");
  const [preset, setPreset] = useState<string>(() =>
    defaultMinutes ? DURATIONS.some((d) => d.minutes === defaultMinutes) ? String(defaultMinutes) : "custom" : "15");
  const [customMinutes, setCustomMinutes] = useState(() => String(defaultMinutes ?? 90));
  const [pace, updatePace] = usePace();
  const [rhythm, setRhythm] = useState<SessionRhythm>("natural");
  const [autoDuration, setAutoDuration] = useState(!defaultMinutes);
  useEffect(() => {
    // The account's saved defaults come first; without one, the rhythm last used in this browser.
    if (defaults?.rhythm && (defaults.rhythm !== "drafting" || canUse(plan, "drafting"))) return setRhythm(defaults.rhythm);
    try {
      const saved = localStorage.getItem("typewit.rhythm");
      if (saved === "natural" || saved === "steady" || plan === "pro" && (saved === "custom" || saved === "drafting")) setRhythm(saved);
    } catch { /* Keep the recommended rhythm if browser storage is unavailable. */ }
  }, [plan, defaults?.rhythm]);
  // The saved word style goes into the pace, which loads from this browser first.
  const groupingApplied = useRef(false);
  const blocksApplied = useRef(false);
  useEffect(() => {
    if (blocksApplied.current || !defaults?.writing_blocks) return;
    blocksApplied.current = true;
    if (plan !== "free") updatePace(blockPace(defaults.writing_blocks));
  }, [defaults, plan, updatePace]);
  useEffect(() => {
    if (groupingApplied.current || !defaults?.word_grouping) return;
    groupingApplied.current = true;
    updatePace({ wordGrouping: defaults.word_grouping });
  }, [defaults, updatePace]);

  async function saveAsDefaults() {
    const next: SessionDefaults = {
      ...(rhythm !== "custom" ? { rhythm } : {}),
      ...(timing === "duration" && minutesValid ? { minutes: Math.round(minutes) } : {}),
      word_grouping: pace.wordGrouping,
      ...(effectivePace.blocksOn ? { writing_blocks: blocksFromPace(effectivePace)! } : {}),
      unit,
    };
    const problem = await saveSessionDefaults(next);
    if (problem) return setStepError(`Couldn't save your defaults: ${problem}`);
    dashboard.setProfile({ session_defaults: next });
    toast("Saved as your defaults. Change them any time in Settings.");
  }
  function rememberRhythm(next: SessionRhythm) {
    setRhythm(next);
    try { localStorage.setItem("typewit.rhythm", next); } catch { /* Browser storage is optional. */ }
  }
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
  const [workWindow, setWorkWindow] = useState<WorkWindow | null>(null);
  const [revisionSweep, setRevisionSweep] = useState(false);
  useEffect(() => { if (timing === "asap") setRevisionSweep(false); }, [timing]);
  const [startLater, setStartLater] = useState(false);
  const [startAt, setStartAt] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [stepError, setStepError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
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
    supabase().from("drips").select("text, insertion_unit, timing_mode, pacing, text_format, work_window").eq("id", from).maybeSingle()
      .then(({ data }) => {
        if (!data?.text) return;
        setText(data.text as string);
        setRhythm(plan === "pro" ? "custom" : (data.pacing as PacingSettings | null)?.drafting?.sentence_pause_seconds ? "natural" : "steady");
        setAutoDuration(false);
        if (data.text_format === "markdown" || data.text_format === "rich") setFormat(data.text_format);
        if (data.insertion_unit) setUnit(data.insertion_unit as InsertionUnit);
        const pacing = data.pacing as PacingSettings | null;
        if (plan !== "free") setWorkWindow(data.work_window as WorkWindow | null);
        if (plan === "pro") setRevisionSweep(Boolean(pacing?.drafting?.revision_sweep));
        if (data.timing_mode === "asap") setTiming("asap");
        else if (pacing) {
          setTiming(pacing.timing);
          if (pacing.timing === "duration" && pacing.duration_seconds) {
            const mins = Math.round((pacing.writing_blocks?.writing_duration_seconds ?? pacing.duration_seconds) / 60);
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
    if (!canUse(plan, "typingSpeed") && timing === "speed") setTiming("duration");
    if (!canUse(plan, "revisionPass") && revisionSweep) setRevisionSweep(false);
    if (!canUse(plan, "writingHours") && workWindow) setWorkWindow(null);
    if (!canUse(plan, "startLater") && startLater) setStartLater(false);
    if (!canUse(plan, "headingPlacement") && place !== "end") setPlace("end");
    // Start on the longest duration the plan allows, never on a locked one.
    const allowed = PLAN_LIMITS[plan].maxMinutes;
    if (preset !== "custom" && Number(preset) > allowed) {
      setPreset(String(DURATIONS.filter((d) => d.minutes <= allowed).at(-1)?.minutes ?? allowed));
    }
  }, [plan, timing, startLater, preset, format, place, workWindow, revisionSweep]);

  function applyPreset(p: PacePreset) {
    rememberRhythm("custom");
    setAutoDuration(false);
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
      if (text) writeDraft(JSON.stringify({ format, text }));
    }, 500);
    return () => clearTimeout(handle);
  }, [text, format]);

  const isPro = plan === "pro";
  const dailyWords = PLAN_LIMITS[plan].dailyWords;
  // The server checks the day's remaining words, not the plan's daily total.
  const wordsLeft = dailyWords === null ? Infinity : Math.max(0, dailyWords - dashboard.wordsToday);
  const limits = { words: wordsLeft, minutes: PLAN_LIMITS[plan].maxMinutes };
  const parsed = useMemo(() => parseFormatted(text, format), [format, text]);
  // The document gets the text without Markdown markers; counts and steps are of that text.
  const plainText = parsed ? parsed.plain : text;
  const words = countWords(plainText);
  const overWords = words > limits.words;
  const wordLimitMessage = `That's more than the ${limits.words.toLocaleString()} ${limits.words === 1 ? "word" : "words"} left today on ${PLAN_NAME[plan]}. Shorten the text, or get unlimited words with a Day Pass or Pro.`;
  const minutes = preset === "custom" ? Number(customMinutes) : Number(preset);
  const minutesValid = Number.isFinite(minutes) && minutes >= 1 && minutes <= limits.minutes;
  const allDocs = [...pastDocs, ...picked.filter((p) => !pastDocs.some((d) => d.key === p.key))];
  const docsForAccount = allDocs.filter((d) => d.connectionId === connectionId);
  const chosenDoc = allDocs.find((d) => d.key === pastDocKey);
  const heading = headings?.find((h) => h.id === headingId) ?? null;
  const placeLabel = place === "heading" && heading ? `At the end of the "${heading.text}" section` : "At the end of the document";

  // Free and Day Pass sessions use the ready-made rhythms (the server does the same); custom timing is Pro.
  const rhythmPace = rhythm === "custom" ? (isPro ? pace : DEFAULT_PACE)
    : { ...DEFAULT_PACE, ...paceFromSettings(rhythmPacing(rhythm, minutes * 60)) };
  const effectivePace = { ...rhythmPace, wordGrouping: pace.wordGrouping, blocksOn: plan !== "free" && pace.blocksOn, blockMinutes: pace.blockMinutes, blockBreakMinutes: pace.blockBreakMinutes };
  // All at once has no pacing, so it's sent as a custom rhythm whatever card is chosen.
  const sentRhythm: SessionRhythm = timing === "asap" ? "custom" : rhythm;
  const sessionTitle = title.trim() || plainText.trim().split(/\n|(?<=[.!?])\s/)[0]?.slice(0, 80) || "Untitled session";
  useEffect(() => {
    if (!autoDuration || timing !== "duration") return;
    const desired = Math.max(5, Math.ceil(words / (unit === "word" && pace.wordGrouping === "single" ? 10 : 25)));
    const allowed = DURATIONS.filter((d) => d.minutes <= limits.minutes);
    setPreset(String((allowed.find((d) => d.minutes >= desired) ?? allowed[allowed.length - 1]).minutes));
  }, [words, autoDuration, timing, limits.minutes, unit, pace.wordGrouping]);
  function chooseRhythm(next: SessionRhythm) {
    if (next === "drafting" && !canUse(plan, "drafting")) return;
    rememberRhythm(next);
    setApproved(false);
    // The ready-made rhythms are planned for a finish time, not a typing speed.
    if (next !== "custom" && timing === "speed") setTiming("duration");
  }
  function customize(change: Partial<typeof pace>) {
    updatePace({ ...effectivePace, ...change });
    rememberRhythm("custom");
    setApproved(false);
  }
  const simulatedDrafting = timing !== "asap" && isPro && (effectivePace.typoRate > 0 || effectivePace.falseStartRate > 0 || revisionSweep);
  useEffect(() => setApproved(false), [effectivePace.typoRate, effectivePace.falseStartRate, simulatedDrafting]);
  const pacing: PacingSettings | null = timing === "asap" ? null : pacingFor(timing, minutes, effectivePace);
  const pacingKey = JSON.stringify(pacing);
  const windowKey = JSON.stringify(workWindow);
  const inputKey = JSON.stringify([text, format, unit, timing, pacingKey, sentRhythm, seed ?? null, windowKey, revisionSweep, startLater ? startAt : null]);
  useEffect(() => setApproved(false), [windowKey, revisionSweep]);
  const current = preview !== null && previewKey === inputKey;
  useEffect(() => setStepError(null), [inputKey]);
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
            rhythm: sentRhythm,
            text_format: format,
            work_window: workWindow,
            revision_sweep: revisionSweep,
            ...(startLater && Number.isFinite(Date.parse(startAt)) ? { start_at: new Date(startAt).toISOString() } : {}),
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
        setPreviewKey(JSON.stringify([text, format, unit, timing, pacingKey, sentRhythm, kept, windowKey, revisionSweep, startLater ? startAt : null]));
      } catch (e) {
        if (!stale) setPreviewError(e instanceof Error ? e.message : "Couldn't check the schedule.");
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(handle);
    };
  }, [text, format, unit, timing, pacingKey, sentRhythm, ready, seed, windowKey, revisionSweep, startLater, startAt]);

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

  function restoreDraft() {
    try {
      const saved = JSON.parse(draft);
      if (saved && typeof saved.text === "string" && ["plain", "markdown", "rich"].includes(saved.format)) {
        parseFormatted(saved.text, saved.format);
        changeText(saved.text);
        setFormat(saved.format);
      } else changeText(draft);
    } catch {
      changeText(draft);
    }
    setDraft("");
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

  /** The first thing stopping this session, in page order. Server checks still run on Start. */
  function setupProblem(): SetupProblem | null {
    if (!connectionId) return { message: "Connect your Google account first.", field: "account", open: "destination" };
    if (words === 0) return { message: "Add the text you want entered.", field: "text" };
    if (overWords) return { message: wordLimitMessage, field: "text" };
    if (target === "existing" && !chosenDoc) return { message: "Choose a document.", field: "doc", open: "destination" };
    if (target === "existing" && chosenDoc?.busy) return { message: "That document already has an unfinished session.", field: "doc", open: "destination" };
    if (place === "heading") {
      if (target !== "existing") return { message: "Choose an existing document under Destination to add text under one of its headings.", field: "heading", open: "more" };
      if (!headingId) return { message: "Choose a heading.", field: "heading", open: "more" };
    }
    if (timing === "duration" && !minutesValid) {
      return { message: `Choose a finish time between 1 minute and ${span(limits.minutes * 60 * 1000)}.`, field: preset === "custom" ? "custom-minutes" : "duration" };
    }
    const startTime = startLater ? new Date(startAt) : null;
    if (startTime && !(startTime.getTime() > Date.now())) return { message: "Choose a start time in the future.", field: "start-at", open: "more" };
    if (startTime && startTime.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return { message: "Sessions can be scheduled up to 7 days ahead.", field: "start-at", open: "more" };
    if (current && !preview.ok) return { message: preview.problems.map(planProblemText).join(" "), field: "duration" };
    return null;
  }

  /** Shows a part of the setup, opening its section first if it's folded away. */
  function reveal(field: string, open?: "destination" | "more") {
    if (open === "destination") setDestinationOpen(true);
    if (open === "more") setMoreOpen(true);
    requestAnimationFrame(() => {
      const el = document.getElementById(field);
      if (el && el.offsetParent !== null) {
        el.scrollIntoView({ block: "center" });
        el.focus();
      }
    });
  }

  function goToStep(next: 1 | 2) {
    setDirection(next < step ? "back" : "forward");
    setStep(next);
    setStepError(null);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.getElementById("new-title")?.focus());
  }

  /** From the review, back to the setting to change. */
  function edit(field: string, open?: "destination" | "more") {
    goToStep(1);
    reveal(field, open);
  }

  function cancel() {
    if (text.trim() || title.trim()) setLeaving(true);
    else router.push("/app/");
  }

  function continueStep() {
    const problem = setupProblem();
    if (problem) {
      setStepError(problem.message);
      reveal(problem.field, problem.open);
      return;
    }
    if (!current) { setStepError("Checking your schedule. Please try again in a moment."); return; }
    goToStep(2);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step !== 2) { continueStep(); return; }
    if (starting.current) return;
    setError(null);
    setProblems([]);

    const problem = setupProblem();
    if (problem) return fail(problem.message);
    if (!current) return fail("The schedule is still being checked. Try again in a moment.");
    if (!preview.ok) return fail("This session can't run as set up:", preview.problems);
    if (!approved) return fail("Read your text and tick the box to approve it.");
    const startTime = startLater ? new Date(startAt) : null;

    starting.current = true;
    setBusy(true);
    try {
      const { drip } = await api<{ drip: { id: string } }>("drips", {
        method: "POST",
        body: {
          connection_id: connectionId,
          ...(target === "new" ? { new_document_title: sessionTitle } : { document_id: chosenDoc!.documentId }),
          text,
          rhythm: sentRhythm,
          text_format: format,
          work_window: workWindow,
          revision_sweep: revisionSweep,
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
          <Link href="/app/connections" className="btn btn-primary btn-sm">Connect Google Docs</Link>
          <p className="small muted" style={{ marginTop: "1rem" }}>
            Writing in Microsoft Word instead? Sessions for Word start from the{" "}
            <Link href="/app/connections#word">TypeWit add-in in Word</Link>; no Google account is needed.
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
  const docLabel = target === "new" ? `New Google Doc "${sessionTitle}"` : chosenDoc?.title ?? "Choose a document";
  const entryLabel = timing === "asap" ? "All at once, in one edit"
    : unit !== "word" ? UNIT_LABEL[unit].title
    : effectivePace.wordGrouping === "single" ? "One word at a time" : "Random groups of 1–5 words";
  const rhythmLabel = timing === "asap" ? "None (all at once)"
    : rhythm === "custom" ? "Custom pace"
    : rhythm === "drafting" ? "Drafting, with simulated corrections"
    : rhythm === "natural" ? "Natural" : "Steady";
  const timingLabel = timing === "asap" ? "All at once" : timing === "speed" ? `Typing speed, ${effectivePace.wpm} WPM` : `Finish within ${span(minutes * 60 * 1000)}`;
  // What's been changed in More options, so a folded section still says what it holds.
  const changed = [
    place === "heading" && "under a heading",
    unit !== "word" && UNIT_LABEL[unit].title.toLowerCase(),
    timing === "speed" && "typing speed",
    timing === "asap" && "all at once",
    rhythm === "custom" && timing !== "asap" && "custom pace",
    workWindow && "writing hours",
    startLater && "starts later",
    revisionSweep && "revision pass",
  ].filter(Boolean) as string[];
  const quickSummary = current && preview.ok && timing !== "asap"
    ? `${timing === "speed" ? "About " : ""}${span(preview.duration_seconds * 1000)} · ${steps.toLocaleString()} ${UNIT_LABEL[preview.unit][steps === 1 ? "one" : "many"]}${preview.breaks.length ? ` · ${preview.breaks.length} ${preview.breaks.length === 1 ? "break" : "breaks"}` : ""}`
    : null;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/app/sessions">Sessions</Link><span aria-hidden="true">/</span><span aria-current="page">New session</span></nav>
      <div className="page-head">
        <div>
          <h1 id="new-title" tabIndex={-1}>New session</h1>
          {isMobile
            ? <p className="step-indicator" tabIndex={-1} aria-live="polite">Step {step} of 2 · {step === 1 ? "Set up" : "Review & start"}</p>
            : <p className="new-sub">Paste your text, pick a rhythm, then review and start.</p>}
        </div>
      </div>
      {!isMobile && <ol className="session-stages" aria-label="Steps">
        <li aria-current={step === 1 ? "step" : undefined}><button type="button" onClick={() => goToStep(1)}>1. Set up</button></li>
        <li aria-current={step === 2 ? "step" : undefined}>2. Review &amp; start</li>
      </ol>}
      {fromNote && <p className="alert alert-info mb-4" role="status">{fromNote}</p>}

      <form className="new-grid quick-session" onSubmit={onSubmit} noValidate aria-labelledby="new-title" data-step={step === 2 ? 5 : 1} data-direction={direction}>
        <div className="card card-flush new-main">
        <div className="form-section" data-step-section="1">
          <h2>Your text</h2>
          <div className="field">
            {draft && !text && (
              <p className="alert alert-info" style={{ marginBottom: "0.75rem" }}>
                <span>You have unsent text from before, saved in this browser.</span>{" "}
                <button type="button" className="link-btn" onClick={restoreDraft}>Restore it</button>{" "}
                <button type="button" className="link-btn" onClick={() => { writeDraft(""); setDraft(""); }}>Discard</button>
              </p>
            )}
            <div className="text-head">
              <label className="label" htmlFor="text">Text to enter</label>
              <div className="text-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()}
                  disabled={importing} {...lockedProps(plan, "import")}>
                  <Icon.doc />{importing ? "Importing…" : "Import file"}<PlanLock plan={plan} feature="import" />
                </button>
                <input ref={fileInput} type="file" accept={IMPORT_ACCEPT} hidden data-testid="import-file"
                  onChange={(e) => onImport(e.target.files?.[0])} />
              </div>
            </div>
            {importNote && <p className="hint" role="status">{importNote}</p>}
            <RichTextEditor text={text} format={format} onChange={(next, kind) => { changeText(next); changeFormat(kind); }} />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span id="text-count" className={overWords ? "error-text" : "hint"}>
                {words.toLocaleString()} {words === 1 ? "word" : "words"} · {plainText.length.toLocaleString()} characters
                {Number.isFinite(limits.words) && ` · ${limits.words.toLocaleString()} left today on ${PLAN_NAME[plan]}`}
              </span>
              {overWords && <Link href="/app/billing" className="small">Get unlimited words</Link>}
            </div>
          </div>
        </div>

        <details className="destination-options" data-step-section="1" open={destinationOpen} onToggle={(e) => setDestinationOpen(e.currentTarget.open)}>
        <summary>Destination: {docLabel} <span className="summary-action">{destinationOpen ? "Done" : "Change"}</span></summary>
        <fieldset className="form-section">
          <legend className="sr-only">Document</legend>
          <p className="muted">
            Writing in Microsoft Word? Start from the <Link href="/app/connections#word">TypeWit add-in in Word</Link>.
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
              <span><strong>Existing document</strong><small>Continue a draft. Text goes at the end; the session pauses if that spot changes.</small></span>
            </label>
          </div>
          <div className="field" style={{ marginTop: "1rem", maxWidth: 520 }}>
            {target === "new"
              ? (
                <>
                  <label className="label" htmlFor="title">Title (optional)</label>
                  <input id="title" type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Uses the opening sentence of your text" />
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
                    TypeWit can open only the document you pick, nothing else in your Drive. One unfinished session per document.
                  </span>
                  {pickError && <p className="alert alert-error small" role="alert" style={{ marginTop: "0.5rem" }}>{pickError}</p>}
                </>
              )}
          </div>
          <details className="more"><summary>Check the connection (optional)</summary>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={testConnection} disabled={checking || !connectionId || (target === "existing" && !chosenDoc)}>
              {checking ? "Testing…" : "Test connection"}
            </button>
            <span className="hint">Checks access without changing the document.</span>
          </div>
          <div aria-live="polite">{report && <ConnectionReport report={report} />}</div>
          </details>
        </fieldset>
        </details>

        <section className="form-section rhythm-setup" data-step-section="1" aria-labelledby="rhythm-title">
          <h2 id="rhythm-title">Rhythm</h2>
          {timing === "asap"
            ? (
              <p className="alert alert-info">
                <span>All at once is on: the whole text goes in as one edit, with no rhythm.{" "}
                  <button type="button" className="link-btn" onClick={() => { setTiming("duration"); setApproved(false); }}>Use a rhythm instead</button></span>
              </p>
            )
            : <p className="muted">How your text arrives. Natural works well for most writing.</p>}
          <div className="rhythm-cards" role="group" aria-label="Writing rhythm">
            {RHYTHMS.map(([key, name, description]) => (
              <button key={key} type="button" className="rhythm-card" aria-pressed={timing !== "asap" && rhythm === key}
                disabled={timing === "asap"} {...(key === "drafting" ? lockedProps(plan, "drafting") : {})} onClick={() => chooseRhythm(key)}>
                <strong>{name}{key === "natural" && <span className="badge badge-blue">Recommended</span>}{key === "drafting" && <PlanLock plan={plan} feature="drafting" />}</strong>
                <span>{description}</span>
              </button>
            ))}
          </div>
          {timing !== "asap" && rhythm !== "custom" && <p className="hint mobile-only" aria-live="polite">{RHYTHMS.find(([key]) => key === rhythm)?.[2]}</p>}
          {timing !== "asap" && rhythm === "custom" && (
            <p className="hint">
              Using your custom pace from More options.{" "}
              <button type="button" className="link-btn" onClick={() => chooseRhythm("natural")}>Switch back to Natural</button>
            </p>
          )}
          {timing === "duration" && (
            <div className="row duration-row" style={{ marginTop: "1rem", alignItems: "flex-end", gap: "1rem" }}>
              <div className="field" style={{ maxWidth: 320, marginBottom: 0 }}>
                <label className="label" htmlFor="duration">{effectivePace.blocksOn ? "Writing time" : "Finish within"}</label>
                <select id="duration" value={preset} onChange={(e) => { setPreset(e.target.value); setAutoDuration(false); }} aria-describedby="duration-hint">
                  {DURATIONS.map((d) => (
                    <option key={d.minutes} value={d.minutes} disabled={d.minutes > limits.minutes}>
                      {d.label}{d.minutes > limits.minutes ? ` (${PLAN_NAME[planForMinutes(d.minutes)]})` : ""}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {preset === "custom" && (
                <div className="field" style={{ maxWidth: 180, marginBottom: 0 }}>
                  <label className="label" htmlFor="custom-minutes">Minutes</label>
                  <input id="custom-minutes" type="number" inputMode="numeric" min={1} max={limits.minutes} step={1}
                    value={customMinutes} onChange={(e) => { setCustomMinutes(e.target.value); setAutoDuration(false); }} aria-invalid={!minutesValid} />
                </div>
              )}
              <p id="duration-hint" className="hint" style={{ flexBasis: "100%", margin: 0 }}>
                {autoDuration ? "Suggested for your text. " : ""}{effectivePace.blocksOn ? "Sentence pauses included. Long breaks are added to this writing time." : "Breaks included."} You can close this page after starting.
                {plan === "day_pass" && dashboard.profile.day_pass_expires_at && ` Your Day Pass ends ${when(dashboard.profile.day_pass_expires_at)}, so the session must finish before then.`}
              </p>
            </div>
          )}
          {timing === "speed" && <p className="hint" style={{ marginTop: "1rem" }}>Typing at {effectivePace.wpm} WPM, set in More options. The finish time is an estimate.</p>}
          {unit === "word" && timing !== "asap" && <WordGroupingControls value={pace.wordGrouping} onChange={wordGrouping => { updatePace({ wordGrouping }); setApproved(false); }} />}
          {timing !== "asap" && <WritingBlockControls value={blocksFromPace(effectivePace)} plan={plan} expiresAt={dashboard.profile.day_pass_expires_at} onChange={value => { updatePace(blockPace(value)); setApproved(false); }} />}
          <WritingBlockSummary plan={current ? preview : null} />
          {current && !preview.ok && stepError !== preview.problems.map(planProblemText).join(" ") && <p className="alert alert-error" role="alert">{preview.problems.map(planProblemText).join(" ")}</p>}
          {previewError && <p className="alert alert-error" role="alert">{previewError}</p>}
          {quickSummary && <p className="timing-line"><Icon.clock /><span><span className="sr-only">Planned: </span>{quickSummary}</span></p>}
          <details className="more timing-details"><summary>See the full timing</summary>
            <RhythmPreview pace={effectivePace} unit={unit} allAtOnce={timing === "asap"} revisionSweep={revisionSweep} />
            <PlanSummary plan={current ? preview : null} error={previewError} hasText={words > 0} timing={timing} onReshuffle={() => setSeed(undefined)} />
          </details>
        </section>

        <details className="session-advanced" data-step-section="1" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>More options <span className="hint"> · {changed.length ? `Changed: ${changed.join(", ")}` : "placement, steps, timing, writing hours, start time"}</span></summary>
        <p className="advanced-intro">
          All optional. Changes update the schedule before you approve it.{" "}
          <button type="button" className="link-btn" onClick={saveAsDefaults}>Save rhythm, finish time and steps as my defaults</button>
        </p>
        <fieldset id="entry-settings" className="form-section">
          <legend className="sr-only">Placement and steps</legend>
          <h3 className="review-sub" id="place-title">Where the text goes</h3>
          <div className="choices" role="radiogroup" aria-labelledby="place-title">
            <label className="choice">
              <input type="radio" name="place" value="end" checked={place === "end"} onChange={() => setPlace("end")} />
              <span><strong>End of the document</strong><small>After everything already in it.</small></span>
            </label>
            <label className="choice" {...lockedWrap(plan, "headingPlacement")}>
              <input type="radio" name="place" value="heading" checked={place === "heading"} onChange={() => setPlace("heading")} {...lockedProps(plan, "headingPlacement")} />
              <span>
                <strong>Under a heading<PlanLock plan={plan} feature="headingPlacement" /></strong>
                <small>At the end of a section of an existing Google Doc.</small>
              </span>
            </label>
          </div>
          {place === "heading" && (
            <div className="field" style={{ marginTop: "0.75rem", maxWidth: 520 }}>
              {target !== "existing" || !chosenDoc
                ? <p className="alert alert-info small">Choose an existing document under Destination to see its headings.</p>
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
                        <option key={h.id} value={h.id}>{`${" ".repeat(Math.max(0, h.level - 1))}${h.text}`}</option>
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
          <h3 className="review-sub">Steps</h3>
          <p className="muted">How much text each edit adds.</p>
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

        <fieldset id="timing-settings" className="form-section">
          <legend className="sr-only">Timing</legend>
          <h3 className="review-sub">Timing</h3>
          <div className="choices" role="radiogroup" aria-label="Timing mode">
            <label className="choice">
              <input type="radio" name="timing" value="duration" checked={timing === "duration"} onChange={() => setTiming("duration")} />
              <span><strong>Finish time</strong><small>{effectivePace.blocksOn ? "Choose writing time under Rhythm; long breaks are added." : "Fit everything, breaks included, into the time chosen under Rhythm."}</small></span>
            </label>
            <label className="choice" {...lockedWrap(plan, "typingSpeed")}>
              <input type="radio" name="timing" value="speed" checked={timing === "speed"} onChange={() => { updatePace(effectivePace); rememberRhythm("custom"); setTiming("speed"); }} {...lockedProps(plan, "typingSpeed")} />
              <span><strong>Typing speed<PlanLock plan={plan} feature="typingSpeed" /></strong><small>Set words per minute; see how long it takes.</small></span>
            </label>
            <label className="choice">
              <input type="radio" name="timing" value="asap" checked={timing === "asap"} onChange={() => setTiming("asap")} />
              <span><strong>All at once</strong><small>One edit, no pacing.</small></span>
            </label>
          </div>
          <p className="hint">The finish time is a target: Google Docs delays can make it later, and TypeWit never rushes to catch up.</p>

          <h3 className="review-sub">Pace &amp; corrections{!isPro && <PlanLock plan={plan} feature="customPace" />}</h3>
          {timing === "asap"
            ? <p className="hint">Not used for All at once.</p>
            : isPro
            ? (
              <>
                <PacePresets timing={timing === "speed" ? "speed" : "duration"} minutes={minutes} pace={effectivePace} onApply={applyPreset} />
                <PaceControls timing={timing} pace={effectivePace} onChange={customize} collapsed={isMobile} />
              </>
            )
            : (
              <p className="hint">
                Natural and Steady set the pace for you. Custom speed, pauses, breaks, corrected mistakes and saved presets come with Pro.{" "}
                <button type="button" className="link-btn" data-locked="customPace">See what Pro adds</button>
              </p>
            )}

          <WorkWindowControls value={workWindow} onChange={setWorkWindow} enabled={canUse(plan, "writingHours")} plan={plan} />

          <div className="field" style={{ marginTop: "1.25rem" }}>
            <label className="check" htmlFor="start-later" {...lockedWrap(plan, "startLater")}>
              <input id="start-later" type="checkbox" checked={startLater} onChange={(e) => setStartLater(e.target.checked)} {...lockedProps(plan, "startLater")} />
              <span>Start later instead of now<PlanLock plan={plan} feature="startLater" /></span>
            </label>
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

          <div className="field" style={{ marginTop: "1rem" }}>
            <label className="check" htmlFor="revision-sweep" {...lockedWrap(plan, "revisionPass")}>
              <input id="revision-sweep" type="checkbox" checked={revisionSweep} disabled={timing === "asap"} onChange={e => setRevisionSweep(e.target.checked)} {...lockedProps(plan, "revisionPass")} />
              <span>Final revision pass<PlanLock plan={plan} feature="revisionPass" /></span>
            </label>
            <span className="hint">After entry, briefly revisits up to three ending words, then restores your exact approved text. Keep the session running until it finishes.</span>
          </div>
        </fieldset>
        </details>

        <div className="form-section upgrade-section" data-step-section="1">
          <UpgradeNote plan={plan} />
        </div>

        <div className="form-section" data-step-section="5">
          <h2>Review and approve</h2>
          <p className="muted">TypeWit enters exactly this text. Editing it clears your approval.</p>
          <div className="preview" tabIndex={0} role="region" aria-label="Text to approve">
            {parsed && text.trim() ? <MarkdownPreview parsed={parsed} /> : text || <span className="pending">Your text will appear here.</span>}
          </div>
          {steps > 1 && current && <StepList text={plainText} plan={preview} />}
          <h3 className="review-sub">Before you start</h3>
          <dl className="summary-list review-list" aria-label="Before you start">
            <ReviewRow label="Document" value={docLabel} onEdit={() => edit(target === "new" ? "title" : "doc", "destination")} />
            {place === "heading" && <ReviewRow label="Insertion location" value={placeLabel} onEdit={() => edit("heading", "more")} />}
            {effectivePace.blocksOn && <ReviewRow label="Writing blocks" value={`About ${span(effectivePace.blockMinutes * 60000)} writing, then ${span(effectivePace.blockBreakMinutes * 60000)} rest. Automatic continuation.`} onEdit={() => edit("rhythm-title")} />}
            <ReviewRow label="Word entry" value={entryLabel} onEdit={() => edit(unit === "word" && timing !== "asap" ? "rhythm-title" : "entry-settings", unit === "word" && timing !== "asap" ? undefined : "more")} />
            <ReviewRow label="Rhythm" value={rhythmLabel} onEdit={() => edit("rhythm-title")} />
            <ReviewRow label="Timing" value={timingLabel} onEdit={() => edit(timing === "duration" ? "duration" : "timing-settings", timing === "duration" ? undefined : "more")} />
            {format !== "plain" && <ReviewRow label="Formatting" value="Headings, bold, italic, bullets and highlights kept" />}
            {startLater && <ReviewRow label="Starts" value={when(new Date(startAt).getTime())} onEdit={() => edit("start-at", "more")} />}
            {workWindow && <ReviewRow label="Writing hours" value={`${workWindow.start}–${workWindow.end} · ${workWindow.time_zone}. Waiting may move the finish later.`} onEdit={() => edit("timing-settings", "more")} />}
            {revisionSweep && <ReviewRow label="Final revision pass" value="A small temporary edit at the end, then your exact approved text is restored." onEdit={() => edit("revision-sweep", "more")} />}
            {simulatedDrafting && <ReviewRow label="Simulated edits" value={`Neighbor-key typos ${effectivePace.typoRate}%, false starts ${effectivePace.falseStartRate}% per eligible English word; temporary text is deleted and corrected.`} />}
            <ReviewRow label="Text length" value={`${words.toLocaleString()} words, ${plainText.length.toLocaleString()} characters`} />
            <ReviewRow label="Planned duration" value={plannedDuration} />
          </dl>
          <label className="check approve-check" htmlFor="approve">
            <input id="approve" type="checkbox" checked={approved} disabled={words === 0} onChange={(e) => setApproved(e.target.checked)} />
            <span>I&apos;ve read this exact text and approve TypeWit entering it into my document.{simulatedDrafting && " I also approve the enabled simulated mistakes and corrections; pausing or stopping can leave temporary text in the document."}</span>
          </label>
          {error && (
            <div className="alert alert-error" role="alert" tabIndex={-1} ref={errorRef} style={{ marginTop: "1rem", display: "block" }}>
              <p>{error}</p>
              {problems.length > 0 && <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>{problems.map((p) => <li key={p.code}>{planProblemText(p)}</li>)}</ul>}
            </div>
          )}
          <details className="more" style={{ marginTop: "1rem" }}><summary>What happens when I start?</summary>
            <p className="hint">
              Each step is a real edit made through the Google Docs API at its scheduled time, using your Google
              account. Enabled drafting simulations make temporary edits and correct them; they are automated, and Google controls version-history grouping. It runs on TypeWit&apos;s servers, so
              you can close this page. Your text and its schedule are stored with TypeWit until you delete the session
              (Settings → Your data); the activity log records times and counts, not your text.
            </p>
          </details>
        </div>
        </div>

        <div className="step-bar">
          {stepError && <p className="alert alert-error" role="alert">{stepError}</p>}
          <div className="step-bar-row">
            {!isMobile && <button type="button" className="btn btn-ghost btn-lg step-cancel" onClick={cancel}>Cancel</button>}
            {(step > 1 || isMobile) && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => (step > 1 ? goToStep(1) : setLeaving(true))}>
                {step > 1 ? "Back" : "Exit"}
              </button>
            )}
            {step === 1
              // Different keys: the press on Continue must not land on a submit button swapped into its place.
              ? (
                <button key="continue" type="button" className="btn btn-primary btn-lg" onClick={continueStep} disabled={words > 0 && !current && !previewError}>
                  Review session<Icon.chevronRight />
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

/** One line of the review, with a way back to the setting it shows. */
function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {onEdit && <button type="button" className="link-btn review-edit" onClick={onEdit} aria-label={`Change ${label.toLowerCase()}`}>Change</button>}
      </dd>
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
        {plan.problems.map((p) => <p key={p.code} className="alert alert-error">{planProblemText(p)}</p>)}
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
  const corrections = Boolean(plan.pacing?.drafting?.revision_sweep) || (plan.drafting_stats?.typos ?? 0) + (plan.drafting_stats?.false_starts ?? 0) > 0;
  const label = UNIT_LABEL[plan.unit][n === 1 ? "one" : "many"];
  const total = span(plan.duration_seconds * 1000);
  const breaks = plan.breaks.length;
  const summary = `${n.toLocaleString()} ${label}, ${simulated ? `${edits.toLocaleString()} automated edits ${corrections ? "including simulated corrections" : "to allow sentence pauses"}` : "one insertion each"}, ${timing === "speed" ? "estimated to take" : "over"} ${total}` +
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

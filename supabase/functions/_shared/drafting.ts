/**
 * Opt-in automated drafting effects. The complete edit script is generated
 * before starting; the only temporary text it deletes is text it generated.
 */
import { splitText } from "./chunker.ts";
import { type ChunkFormat, type ParsedMarkdown } from "./markdown.ts";
import { seededRandom } from "./schedule.ts";

export interface DraftingSettings {
  /** Percentage of eligible ASCII words receiving one adjacent-key slip. */
  typo_rate_pct: number;
  /** Percentage of eligible ASCII words preceded by a temporary nearby word. */
  false_start_rate_pct: number;
  /** Extra pause after each sentence boundary, except the final boundary. */
  sentence_pause_seconds: number;
  sentence_pause_variation_pct: number;
}

export type DraftActionKind = "insert" | "typo" | "false_start" | "backspace" | "correction";

export const DEFAULT_DRAFTING: DraftingSettings = {
  typo_rate_pct: 0,
  false_start_rate_pct: 0,
  sentence_pause_seconds: 0,
  sentence_pause_variation_pct: 0,
};

export const DRAFTING_LIMITS = {
  typo_rate_pct: { min: 0, max: 20 },
  false_start_rate_pct: { min: 0, max: 20 },
  sentence_pause_seconds: { min: 0, max: 30 },
  sentence_pause_variation_pct: { min: 0, max: 50 },
} as const;

export function validateDrafting(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "Drafting settings must be an object.";
  const settings = raw as Record<string, unknown>;
  for (const [key, limit] of Object.entries(DRAFTING_LIMITS)) {
    const value = settings[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < limit.min || value > limit.max) {
      return `${key.replaceAll("_", " ")} must be between ${limit.min} and ${limit.max}.`;
    }
  }
  return null;
}

/** A zeroed settings object has no effect on older sessions or schedules. */
export function draftingEnabled(settings: DraftingSettings | undefined): boolean {
  return Boolean(
    settings &&
      (settings.typo_rate_pct > 0 || settings.false_start_rate_pct > 0 || settings.sentence_pause_seconds > 0),
  );
}

/**
 * Replay a range of append/backspace actions. `anchor` is existing document
 * content: it is deliberately outside the deletable generated suffix.
 */
export function executionText(
  chunks: readonly string[],
  deletions: readonly number[] | null | undefined,
  from: number,
  to: number,
  anchor = "",
): string {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > chunks.length) {
    throw new RangeError("Invalid execution range.");
  }
  let generated = "";
  for (let i = from; i < to; i++) {
    const remove = deletions?.[i] ?? 0;
    if (!Number.isSafeInteger(remove) || remove < 0 || remove > generated.length) {
      throw new RangeError("A backspace cannot remove existing document text.");
    }
    generated = generated.slice(0, generated.length - remove) + chunks[i];
  }
  return anchor + generated;
}

// Physical adjacent letter keys on a US QWERTY keyboard, including diagonals.
const NEIGHBORS: Record<string, string> = {
  q: "wa",
  w: "qase",
  e: "wsdr",
  r: "edft",
  t: "rfgy",
  y: "tghu",
  u: "yhji",
  i: "ujko",
  o: "iklp",
  p: "ol",
  a: "qwsz",
  s: "awedxz",
  d: "serfcx",
  f: "drtgvc",
  g: "ftyhbv",
  h: "gyujnb",
  j: "huikmn",
  k: "jiolm",
  l: "kop",
  z: "asx",
  x: "zsdc",
  c: "xdfv",
  v: "cfgb",
  b: "vghn",
  n: "bhjm",
  m: "njk",
};

export function neighborKey(letter: string, random: () => number): string {
  const choices = NEIGHBORS[letter.toLowerCase()];
  if (!choices) return letter;
  const key = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  return letter === letter.toUpperCase() ? key.toUpperCase() : key;
}

interface Effect {
  kind: "typo" | "false_start";
  text: string;
}

export interface DraftingScript {
  chunks: string[];
  chunk_deletions: number[];
  action_kinds: DraftActionKind[];
  source_chunks: string[];
  source_unit_ends: number[];
  chunk_formats: ChunkFormat[] | null;
  /** Extra pause following each action (0 for actions that do not end a sentence). */
  sentence_pauses_ms: number[];
  stats: { typos: number; false_starts: number; sentence_pauses: number; extra_edits: number };
}

function formatSlice(parsed: ParsedMarkdown, from: number, to: number): ChunkFormat {
  const paragraphs: ChunkFormat["paragraphs"] = [];
  parsed.paragraphs.forEach((p, i) => {
    if (p.start < from || p.start >= to) return;
    const previous = parsed.paragraphs[i - 1];
    if (p.kind === "normal" && i > 0 && previous?.kind === "normal") return;
    paragraphs.push({
      start: p.start - from,
      end: Math.min(p.end, to) - from,
      kind: p.kind,
      ...(previous?.kind === "bullet" && p.kind !== "bullet" ? { after_bullet: true } : {}),
    });
  });
  return {
    paragraphs,
    spans: parsed.spans.filter((s) => s.start < to && s.end > from).map((s) => ({
      ...s,
      start: Math.max(s.start, from) - from,
      end: Math.min(s.end, to) - from,
    })),
  };
}

/** Compile temporary, reversible edits without changing the approved source. */
export function compileDrafting(
  sourceChunks: string[],
  settings: DraftingSettings | undefined,
  seed: number,
  parsed: ParsedMarkdown | null = null,
): DraftingScript {
  const invalid = validateDrafting(settings);
  if (invalid) throw new RangeError(invalid);
  const cfg = settings ?? DEFAULT_DRAFTING;
  const random = seededRandom(seed ^ 0x44524146);
  const text = sourceChunks.join("");
  const effects = new Map<number, Effect[]>();
  const words = [...text.matchAll(/(?<![\p{L}\p{N}_])[A-Za-z]{2,}(?![\p{L}\p{N}_])/gu)];
  let typos = 0, falseStarts = 0;
  const addEffect = (position: number, effect: Effect) =>
    effects.set(position, [...(effects.get(position) ?? []), effect]);
  words.forEach((word, i) => {
    const at = word.index!;
    if (random() * 100 < cfg.false_start_rate_pct) {
      const eligible = (w: RegExpMatchArray) => w[0].length <= 99 && w[0].toLowerCase() !== word[0].toLowerCase();
      const upcoming = words.slice(i + 1, i + 4).filter(eligible);
      const nearby = upcoming.length ? upcoming : words.slice(Math.max(0, i - 3), i).filter(eligible);
      const alternatives = nearby.length
        ? nearby.map((w) => w[0])
        : ["the", "this", "that", "then", "there", "from", "for", "with"].filter((w) => w !== word[0].toLowerCase());
      const wrong = alternatives[Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length))];
      addEffect(at, { kind: "false_start", text: wrong + " " });
      falseStarts++;
    }
    if (random() * 100 < cfg.typo_rate_pct) {
      const offset = Math.min(word[0].length - 1, Math.floor(random() * word[0].length));
      addEffect(at + offset, { kind: "typo", text: neighborKey(word[0][offset], random) });
      typos++;
    }
  });
  const pauses = new Map<number, number>();
  if (cfg.sentence_pause_seconds > 0) {
    let boundary = 0;
    for (const sentence of splitText(text, "sentence")) {
      boundary += sentence.length;
      if (boundary < text.length && sentence.trim()) {
        const scale = 1 + cfg.sentence_pause_variation_pct / 100 * (2 * random() - 1);
        pauses.set(boundary, Math.round(cfg.sentence_pause_seconds * 1000 * scale));
      }
    }
  }

  const out: DraftingScript = {
    chunks: [],
    chunk_deletions: [],
    action_kinds: [],
    source_chunks: sourceChunks.slice(),
    source_unit_ends: [],
    chunk_formats: parsed ? [] : null,
    sentence_pauses_ms: [],
    stats: { typos, false_starts: falseStarts, sentence_pauses: pauses.size, extra_edits: 0 },
  };
  const emit = (chunk: string, remove: number, kind: DraftActionKind, from: number | null = null) => {
    if (!chunk && remove === 0) return;
    out.chunks.push(chunk);
    out.chunk_deletions.push(remove);
    out.action_kinds.push(kind);
    out.sentence_pauses_ms.push(0);
    out.chunk_formats?.push(
      from !== null ? formatSlice(parsed!, from, from + chunk.length) : { paragraphs: [], spans: [] },
    );
  };
  let global = 0;
  for (const source of sourceChunks) {
    let buffer = "", bufferFrom = global;
    const flush = () => {
      emit(buffer, 0, "insert", bufferFrom);
      buffer = "";
    };
    for (let i = 0; i < source.length; i++, global++) {
      const at = effects.get(global) ?? [];
      for (const effect of at.filter((e) => e.kind === "false_start")) {
        flush();
        emit(effect.text, 0, "false_start");
        emit("", effect.text.length, "backspace");
      }
      const typo = at.find((e) => e.kind === "typo");
      if (typo) {
        flush();
        emit(typo.text, 0, "typo");
        emit("", typo.text.length, "backspace");
        emit(source[i], 0, "correction", global);
      } else {
        if (!buffer) bufferFrom = global;
        buffer += source[i];
      }
      const pause = pauses.get(global + 1);
      if (pause !== undefined) {
        flush();
        out.sentence_pauses_ms[out.sentence_pauses_ms.length - 1] = pause;
      }
    }
    flush();
    out.source_unit_ends.push(out.chunks.length);
  }
  out.stats.extra_edits = out.chunks.length - sourceChunks.length;
  if (executionText(out.chunks, out.chunk_deletions, 0, out.chunks.length) !== text) {
    throw new Error("The drafting script does not match the approved text.");
  }
  return out;
}

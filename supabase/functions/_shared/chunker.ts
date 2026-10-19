/**
 * Splits text into word tokens that keep their surrounding whitespace, so that
 * joining the tokens (or any chunks built from them) reproduces the input
 * exactly — newlines, tabs and Unicode included.
 *
 * Leading whitespace is attached to the first token; every token carries the
 * whitespace that follows it.
 */
export function tokenize(text: string): string[] {
  const tokens = text.match(/\S+\s*/gu) ?? [];
  if (tokens.length === 0) {
    return [];
  }

  const leading = /^\s*/u.exec(text)?.[0] ?? "";
  if (leading) {
    tokens[0] = leading + tokens[0];
  }
  return tokens;
}

export function countWords(text: string): number {
  return tokenize(text).length;
}

/**
 * What a drip is split on. `sentence` is the default; `chunk` (even groups of
 * words) is kept for older clients.
 */
export type InsertionUnit = "sentence" | "paragraph" | "word" | "character" | "chunk";

export const INSERTION_UNITS: InsertionUnit[] = ["sentence", "paragraph", "word", "character", "chunk"];

const sentenceSegmenter = new Intl.Segmenter("und", { granularity: "sentence" });
const graphemeSegmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

// Unicode sentence segmentation splits after these; joining them with the next
// sentence avoids one-word steps like "Mr. ".
const ABBREVIATION_END = /(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No|Fig|approx)\.\s*$/iu;

/**
 * Splits text at sentence or paragraph ends. Every character is kept, so the
 * parts join back to the input exactly.
 *
 * Sentences use Unicode sentence boundaries (so "。", "।", "؟" and quotes after
 * a full stop work too). A part that is only whitespace, such as the blank line
 * between paragraphs, is attached to the sentence before it.
 */
export function splitIntoUnits(text: string, unit: "sentence" | "paragraph"): string[] {
  if (unit === "paragraph") return text.split(/(?<=\n\s*\n)/u).filter((part) => part.length > 0);

  const parts: string[] = [];
  let carry = "";
  for (const { segment } of sentenceSegmenter.segment(text)) {
    if (!/\S/u.test(segment) && (carry || parts.length > 0)) {
      // Whitespace-only, e.g. a blank line: it belongs to whatever came just before.
      if (carry) carry += segment;
      else parts[parts.length - 1] += segment;
      continue;
    }
    carry += segment;
    if (!ABBREVIATION_END.test(carry)) {
      parts.push(carry);
      carry = "";
    }
  }
  if (carry) parts.push(carry);
  // Leading whitespace before the first sentence belongs to that sentence.
  if (parts.length > 1 && !/\S/u.test(parts[0])) parts.splice(0, 2, parts[0] + parts[1]);
  return parts;
}

/**
 * Splits text into user-perceived characters, so emoji and accents are never
 * broken apart. Whitespace rides along with the character before it (leading
 * whitespace with the first one), so no step adds only invisible text.
 */
export function splitIntoGraphemes(text: string): string[] {
  const parts: string[] = [];
  let leading = "";
  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (/^\s+$/u.test(segment)) {
      if (parts.length > 0) parts[parts.length - 1] += segment;
      else leading += segment;
    } else {
      parts.push(leading + segment);
      leading = "";
    }
  }
  if (leading) parts.push(leading);
  return parts;
}

/** Splits text into the insertion units of a session. Joining the result always gives `text` back. */
export function splitText(text: string, unit: InsertionUnit): string[] {
  switch (unit) {
    case "sentence":
    case "paragraph":
      return splitIntoUnits(text, unit);
    case "word":
    case "chunk": {
      const words = tokenize(text);
      // Whitespace-only text has no words but must still not be lost.
      return words.length > 0 || !text ? words : [text];
    }
    case "character":
      return splitIntoGraphemes(text);
  }
}

/** Length of a unit in user-perceived characters, used to give longer units more time. */
export function unitSize(unit: string): number {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(unit)) count++;
  return count;
}

export interface UnsupportedCharacter {
  /** Index in the text (UTF-16 code units). */
  index: number;
  codePoint: string;
  reason: string;
}

/**
 * Characters the Google Docs API would drop or change on insert. Docs strips
 * control characters (U+0000-U+0008, U+000C-U+001F, which includes the
 * carriage return) and Private Use Area characters (U+E000-U+F8FF), and a lone
 * surrogate is not valid text. TypeWit refuses such text instead of silently
 * changing it, so the document always ends up with exactly the approved text.
 */
export function findUnsupportedCharacters(text: string, limit = 5): UnsupportedCharacter[] {
  const found: UnsupportedCharacter[] = [];
  for (let i = 0; i < text.length && found.length < limit; i++) {
    const code = text.charCodeAt(i);
    let reason: string | null = null;
    if (code <= 0x08 || (code >= 0x0c && code <= 0x1f) || code === 0x7f) {
      reason = code === 0x0d ? "carriage return (use a normal line break)" : "control character";
    } else if (code >= 0xe000 && code <= 0xf8ff) {
      reason = "private-use character";
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
      else reason = "broken character (lone surrogate)";
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      reason = "broken character (lone surrogate)";
    }
    if (reason) {
      found.push({ index: i, codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`, reason });
    }
  }
  return found;
}

/**
 * Joins consecutive parts into `count` groups whose sizes differ by at most one.
 * `count` is clamped to [1, parts.length].
 */
export function groupEvenly(parts: string[], count: number): string[] {
  if (parts.length === 0) {
    return [];
  }

  const n = Math.max(1, Math.min(Math.floor(count), parts.length));
  const base = Math.floor(parts.length / n);
  const extra = parts.length % n;

  const groups: string[] = [];
  let index = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    groups.push(parts.slice(index, index + size).join(""));
    index += size;
  }
  return groups;
}

/** Splits text into `count` word-based chunks with word counts as even as possible. */
export function splitIntoChunks(text: string, count: number): string[] {
  return groupEvenly(tokenize(text), count);
}

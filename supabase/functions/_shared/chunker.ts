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

/** What a drip is split on: words (the default), sentences, or paragraphs. */
export type InsertionUnit = "chunk" | "sentence" | "paragraph";

/**
 * Splits text at sentence or paragraph ends. Every character is kept, so the
 * parts join back to the input exactly.
 */
export function splitIntoUnits(text: string, unit: "sentence" | "paragraph"): string[] {
  const boundary = unit === "paragraph" ? /(?<=\n\s*\n)/u : /(?<=[.!?]["')\]]*\s+)/u;
  return text.split(boundary).filter((part) => part.length > 0);
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

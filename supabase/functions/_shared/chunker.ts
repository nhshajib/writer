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
 * Splits text into `count` chunks with word counts as even as possible
 * (they differ by at most one). `count` is clamped to [1, words].
 */
export function splitIntoChunks(text: string, count: number): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return [];
  }

  const n = Math.max(1, Math.min(Math.floor(count), tokens.length));
  const base = Math.floor(tokens.length / n);
  const extra = tokens.length % n;

  const chunks: string[] = [];
  let index = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    chunks.push(tokens.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}

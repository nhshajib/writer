/**
 * The Markdown subset TypeWit keeps as formatting: headings (#, ##, ###),
 * **bold**, *italic* / _italic_, and "- " or "* " bullets. Markers are removed
 * from the plain text; anything else stays exactly as typed. The engine only
 * ever sees the plain text, and the formatting travels next to each unit.
 */

export type TextFormat = "plain" | "markdown" | "rich";
export type ParagraphKind = "normal" | "title" | "subtitle" | "h1" | "h2" | "h3" | "bullet" | "numbered";

export interface ParagraphRange {
  start: number;
  /** Exclusive; includes the paragraph's line break when it has one. */
  end: number;
  kind: ParagraphKind;
  alignment?: "left" | "center" | "right" | "justify";
  /** Follows a bullet, so it would inherit the bullet unless it is removed. */
  after_bullet?: boolean;
}

export interface SpanRange {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlight?: string;
}

export interface ParsedMarkdown {
  plain: string;
  paragraphs: ParagraphRange[];
  spans: SpanRange[];
}

/** Formatting for one unit, with offsets relative to the unit's text. */
export interface ChunkFormat {
  /** Paragraphs that start in this unit and whose style must be set. */
  paragraphs: ParagraphRange[];
  spans: SpanRange[];
}

const INLINE =
  /\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*|\*(?=[^\s*])([^*\n]+?)(?<=\S)\*|(?<![\p{L}\p{N}_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\p{L}\p{N}_])/gu;

export function parseMarkdown(src: string): ParsedMarkdown {
  let plain = "";
  const paragraphs: ParagraphRange[] = [];
  const spans: SpanRange[] = [];
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    let kind: ParagraphKind = "normal";
    let body = line;
    const heading = /^(#{1,3}) +(\S.*)$/.exec(line);
    const bullet = /^[-*] +(\S.*)$/.exec(line);
    if (heading) {
      kind = `h${heading[1].length}` as ParagraphKind;
      body = heading[2];
    } else if (bullet) {
      kind = "bullet";
      body = bullet[1];
    }

    const start = plain.length;
    let last = 0;
    for (const match of body.matchAll(INLINE)) {
      const index = match.index!;
      plain += body.slice(last, index);
      const inner = match[1] ?? match[2] ?? match[3];
      const at = plain.length;
      plain += inner;
      spans.push(
        match[1] !== undefined ? { start: at, end: plain.length, bold: true } : {
          start: at,
          end: plain.length,
          italic: true,
        },
      );
      last = index + match[0].length;
    }
    plain += body.slice(last);
    if (i < lines.length - 1) plain += "\n";
    if (plain.length > start) paragraphs.push({ start, end: plain.length, kind });
  });
  return { plain, paragraphs, spans };
}

/**
 * Cuts the formatting into one entry per unit. `units` must join to
 * `parsed.plain`. A paragraph's style goes with the unit where it starts; a
 * plain paragraph is only included when it could have inherited a style (the
 * first one, or one after a styled paragraph), which keeps requests small.
 */
export function formatsForUnits(parsed: ParsedMarkdown, units: string[]): ChunkFormat[] {
  const slice = createFormatSlicer(parsed);
  let offset = 0;
  return units.map((unit) => {
    const from = offset;
    offset += unit.length;
    return slice(from, offset);
  });
}

/**
 * Index formatting once per compilation. Overlapping and out-of-order spans
 * retain their original order, including when a revision revisits an old range.
 */
export function createFormatSlicer(parsed: ParsedMarkdown): (from: number, to: number) => ChunkFormat {
  const paragraphs = new FormatRangeIndex(parsed.paragraphs);
  const spans = new FormatRangeIndex(parsed.spans);
  return (from, to) => ({
    paragraphs: paragraphs.overlapping(from, to).flatMap(({ value: p, index }) => {
      if (p.start < from) return [];
      const previous = parsed.paragraphs[index - 1];
      if (p.kind === "normal" && index > 0 && previous?.kind === "normal" && !p.alignment && !previous.alignment) {
        return [];
      }
      return [{
        start: p.start - from,
        end: Math.min(p.end, to) - from,
        kind: p.kind,
        ...(p.alignment || previous?.alignment ? { alignment: p.alignment ?? "left" } : {}),
        ...(["bullet", "numbered"].includes(previous?.kind ?? "") && !["bullet", "numbered"].includes(p.kind)
          ? { after_bullet: true }
          : {}),
      }];
    }),
    spans: spans.overlapping(from, to).map(({ value: s }) => ({
      ...s,
      start: Math.max(s.start, from) - from,
      end: Math.min(s.end, to) - from,
    })),
  });
}

interface IndexedRange<T> {
  value: T;
  index: number;
}

class FormatRangeIndex<T extends { start: number; end: number }> {
  private readonly ranges: IndexedRange<T>[];
  private readonly maxEnd: number[] = [];

  constructor(ranges: readonly T[]) {
    this.ranges = ranges.map((value, index) => ({ value, index })).sort((a, b) =>
      a.value.start - b.value.start || a.index - b.index
    );
    const build = (node: number, lo: number, hi: number): number => {
      if (hi - lo === 1) return this.maxEnd[node] = this.ranges[lo].value.end;
      const mid = Math.floor((lo + hi) / 2);
      return this.maxEnd[node] = Math.max(build(node * 2, lo, mid), build(node * 2 + 1, mid, hi));
    };
    if (this.ranges.length) build(1, 0, this.ranges.length);
  }

  overlapping(from: number, to: number): IndexedRange<T>[] {
    const found: IndexedRange<T>[] = [];
    const visit = (node: number, lo: number, hi: number) => {
      if (this.maxEnd[node] <= from || this.ranges[lo].value.start >= to) return;
      if (hi - lo === 1) {
        found.push(this.ranges[lo]);
        return;
      }
      const mid = Math.floor((lo + hi) / 2);
      visit(node * 2, lo, mid);
      visit(node * 2 + 1, mid, hi);
    };
    if (this.ranges.length && from < to) visit(1, 0, this.ranges.length);
    return found.sort((a, b) => a.index - b.index);
  }
}

/** Whether a unit's format changes anything (so plain units keep the simple insert). */
export function hasFormatting(format: ChunkFormat | null | undefined): format is ChunkFormat {
  return !!format && (format.paragraphs.length > 0 || format.spans.length > 0);
}

/** Rich paste stores only text and bounded style ranges, never executable HTML. */
export function parseRichText(source: string): ParsedMarkdown {
  const doc = JSON.parse(source);
  if (
    !doc || typeof doc.plain !== "string" || doc.plain.length > 1_000_000 ||
    !Array.isArray(doc.paragraphs) || !Array.isArray(doc.spans) ||
    doc.paragraphs.length > 50000 || doc.spans.length > 50000
  ) throw new Error("Invalid formatted text.");
  const splitsPair = (at: number) =>
    at > 0 && at < doc.plain.length &&
    /[\uD800-\uDBFF]/u.test(doc.plain[at - 1]) && /[\uDC00-\uDFFF]/u.test(doc.plain[at]);
  const range = (r: { start: number; end: number }) =>
    Number.isInteger(r.start) && Number.isInteger(r.end) &&
    r.start >= 0 && r.end > r.start && r.end <= doc.plain.length && !splitsPair(r.start) && !splitsPair(r.end);
  let end = 0;
  const paragraphs: ParagraphRange[] = doc.paragraphs.map((p: ParagraphRange) => {
    if (
      !range(p) || p.start !== end ||
      !["normal", "title", "subtitle", "h1", "h2", "h3", "bullet", "numbered"].includes(p.kind) ||
      (p.alignment !== undefined && !["left", "center", "right", "justify"].includes(p.alignment)) ||
      (p.start > 0 && doc.plain[p.start - 1] !== "\n") ||
      (p.end < doc.plain.length && doc.plain[p.end - 1] !== "\n")
    ) throw new Error("Invalid paragraph range.");
    end = p.end;
    return { start: p.start, end: p.end, kind: p.kind, ...(p.alignment ? { alignment: p.alignment } : {}) };
  });
  if (end !== doc.plain.length) throw new Error("Incomplete paragraph ranges.");
  const spans: SpanRange[] = doc.spans.map((s: SpanRange) => {
    if (
      !range(s) || (s.bold !== undefined && typeof s.bold !== "boolean") ||
      (s.italic !== undefined && typeof s.italic !== "boolean") ||
      (s.underline !== undefined && typeof s.underline !== "boolean") ||
      (s.strikethrough !== undefined && typeof s.strikethrough !== "boolean") ||
      (s.highlight !== undefined && !/^#[0-9a-f]{6}$/i.test(s.highlight))
    ) throw new Error("Invalid text style.");
    return {
      start: s.start,
      end: s.end,
      ...(s.bold ? { bold: true } : {}),
      ...(s.italic ? { italic: true } : {}),
      ...(s.underline ? { underline: true } : {}),
      ...(s.strikethrough ? { strikethrough: true } : {}),
      ...(s.highlight ? { highlight: s.highlight } : {}),
    };
  });
  return { plain: doc.plain, paragraphs, spans };
}

export function parseFormatted(source: string, format: TextFormat): ParsedMarkdown | null {
  return format === "rich" ? parseRichText(source) : format === "markdown" ? parseMarkdown(source) : null;
}

/** Keep the already-entered prefix and its styles when replacing a formatted tail. */
export function replaceFormattedTail(original: ParsedMarkdown, offset: number, tail: ParsedMarkdown): ParsedMarkdown {
  const prefix = original.plain.slice(0, offset);
  const paragraphs = original.paragraphs.filter((p) => p.start < offset).map((p) => ({
    ...p,
    end: Math.min(p.end, offset),
  }));
  const shifted = tail.paragraphs.map((p) => ({ ...p, start: p.start + offset, end: p.end + offset }));
  if (prefix && !prefix.endsWith("\n") && paragraphs.length && shifted.length) {
    paragraphs[paragraphs.length - 1].end = shifted.shift()!.end;
  }
  return {
    plain: prefix + tail.plain,
    paragraphs: [...paragraphs, ...shifted],
    spans: [
      ...original.spans.filter((s) => s.start < offset).map((s) => ({ ...s, end: Math.min(s.end, offset) })),
      ...tail.spans.map((s) => ({ ...s, start: s.start + offset, end: s.end + offset })),
    ],
  };
}

export function plainDocument(plain: string): ParsedMarkdown {
  return {
    plain,
    spans: [],
    paragraphs: [...plain.matchAll(/[^\n]*\n|[^\n]+$/g)].map((m) => ({
      start: m.index!,
      end: m.index! + m[0].length,
      kind: "normal",
    })),
  };
}

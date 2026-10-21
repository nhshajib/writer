/**
 * The Markdown subset TypeWit keeps as formatting: headings (#, ##, ###),
 * **bold**, *italic* / _italic_, and "- " or "* " bullets. Markers are removed
 * from the plain text; anything else stays exactly as typed. The engine only
 * ever sees the plain text, and the formatting travels next to each unit.
 */

export type TextFormat = "plain" | "markdown";
export type ParagraphKind = "normal" | "h1" | "h2" | "h3" | "bullet";

export interface ParagraphRange {
  start: number;
  /** Exclusive; includes the paragraph's line break when it has one. */
  end: number;
  kind: ParagraphKind;
  /** Follows a bullet, so it would inherit the bullet unless it is removed. */
  after_bullet?: boolean;
}

export interface SpanRange {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
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
  const out: ChunkFormat[] = [];
  let offset = 0;
  for (const unit of units) {
    const from = offset;
    const to = offset + unit.length;
    const paragraphs: ParagraphRange[] = [];
    parsed.paragraphs.forEach((p, i) => {
      if (p.start < from || p.start >= to) return;
      const previous = parsed.paragraphs[i - 1];
      if (p.kind === "normal" && i > 0 && previous?.kind === "normal") return;
      const range: ParagraphRange = { start: p.start - from, end: Math.min(p.end, to) - from, kind: p.kind };
      if (previous?.kind === "bullet" && p.kind !== "bullet") range.after_bullet = true;
      paragraphs.push(range);
    });
    const spans: SpanRange[] = [];
    for (const s of parsed.spans) {
      const start = Math.max(s.start, from);
      const end = Math.min(s.end, to);
      if (start < end) spans.push({ ...s, start: start - from, end: end - from });
    }
    out.push({ paragraphs, spans });
    offset = to;
  }
  return out;
}

/** Whether a unit's format changes anything (so plain units keep the simple insert). */
export function hasFormatting(format: ChunkFormat | null | undefined): format is ChunkFormat {
  return !!format && (format.paragraphs.length > 0 || format.spans.length > 0);
}

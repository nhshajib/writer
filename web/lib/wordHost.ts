import type { WordHost } from "../../supabase/functions/_shared/providers/word.ts";
import { ProviderError } from "../../supabase/functions/_shared/providers/types.ts";
import type { ChunkFormat, ParagraphKind } from "../../supabase/functions/_shared/markdown.ts";

/* Word's JavaScript API (Office.js, WordApi 1.1; styleBuiltIn needs 1.3), only the parts TypeWit uses. */
interface WordRange {
  font: { bold: boolean; italic: boolean; highlightColor?: string | null; underline?: string; strikeThrough?: boolean };
  delete(): void;
}
interface WordParagraph {
  text: string;
  styleBuiltIn?: string;
  alignment?: string;
  search(text: string, options: { matchCase: boolean; matchWildcards: boolean; ignoreSpace: boolean; ignorePunct: boolean }): {
    items: WordRange[];
    load(properties: string): void;
  };
  insertText(text: string, location: "End"): WordRange;
}
interface WordContext {
  document: {
    body: {
      paragraphs: { items: WordParagraph[]; load(properties: string): void };
      insertParagraph(text: string, location: "End"): WordParagraph;
    };
  };
  sync(): Promise<void>;
}
interface OfficeGlobal {
  onReady(): Promise<{ host: string | null }>;
  context: {
    document: { url?: string | null; mode?: string };
    requirements?: { isSetSupported(name: string, version: string): boolean };
  };
}
declare global {
  interface Window {
    Office?: OfficeGlobal;
    Word?: { run<T>(batch: (context: WordContext) => Promise<T>): Promise<T> };
  }
}

const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";

/**
 * Loads Office.js and waits for Word. Resolves with the document's address, or
 * null outside Word. Office.js replaces history.pushState/replaceState, which
 * the page needs, so they are put back afterwards.
 */
export function loadWord(): Promise<{ inWord: boolean; documentUrl: string | null }> {
  return new Promise((resolve) => {
    const ready = async () => {
      try {
        const info = await window.Office!.onReady();
        const inWord = info.host === "Word" && Boolean(window.Word);
        resolve({ inWord, documentUrl: inWord ? window.Office!.context.document.url || null : null });
      } catch {
        resolve({ inWord: false, documentUrl: null });
      }
    };
    if (window.Office) return void ready();
    const { pushState, replaceState } = window.history;
    const script = document.createElement("script");
    script.src = OFFICE_JS;
    script.onload = () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      void ready();
    };
    script.onerror = () => resolve({ inWord: false, documentUrl: null });
    document.head.appendChild(script);
  });
}

/** Word errors as the session engine understands them. */
function asProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const code = (error as { code?: string })?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);
  if (code === "AccessDenied" || code === "NotAllowed") return new ProviderError("permanent", `Word: ${message}`, 403);
  return new ProviderError("transient", `Word: ${message}`);
}

async function run<T>(batch: (context: WordContext) => Promise<T>): Promise<T> {
  try {
    return await window.Word!.run(batch);
  } catch (error) {
    throw asProviderError(error);
  }
}

async function paragraphTexts(context: WordContext): Promise<string[]> {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text");
  await context.sync();
  return paragraphs.items.map((p) => p.text);
}

/** The open Word document, through Word's JavaScript API. */
export const officeWordHost: WordHost = {
  readParagraphs: () => run(paragraphTexts),

  appendIf: (check, lines, format) =>
    run(async (context) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items/text");
      await context.sync();
      if (!check(paragraphs.items.map((p) => p.text))) return null;
      const before = paragraphs.items.map(p => p.text);
      const expected = [...before];
      expected[expected.length - 1] += lines[0];
      expected.push(...lines.slice(1));
      const last = paragraphs.items[paragraphs.items.length - 1];
      if (!format) {
        // The first line continues the last paragraph; each line break starts a new one.
        if (lines[0]) last.insertText(lines[0], "End");
        for (const line of lines.slice(1)) context.document.body.insertParagraph(line, "End");
      } else {
        const styles = headingStylesSupported();
        const lastWasEmpty = last.text === "";
        let offset = 0;
        lines.forEach((line, i) => {
          const paragraph = i === 0 ? last : context.document.body.insertParagraph("", "End");
          for (const segment of segments(line, offset, format)) {
            const range = paragraph.insertText(segment.text, "End");
            range.font.bold = segment.bold;
            range.font.italic = segment.italic;
            range.font.underline = segment.underline ? "Single" : "None";
            range.font.strikeThrough = Boolean(segment.strikethrough);
            range.font.highlightColor = segment.highlight ?? null;
          }
          // The person's own paragraph keeps its style; new paragraphs get theirs.
          const style = format.paragraphs.find((p) => p.start === offset);
          if (style && (i > 0 || lastWasEmpty)) {
            if (styles) paragraph.styleBuiltIn = WORD_STYLE[style.kind];
            if (style.alignment) paragraph.alignment = {left:"Left",center:"Centered",right:"Right",justify:"Justified"}[style.alignment];
          }
          offset += line.length + 1;
        });
      }
      await context.sync();
      const after = await paragraphTexts(context);
      if (after.length !== expected.length || after.some((p, i) => p !== expected[i])) {
        throw new ProviderError("conflict", "The document changed during the edit. TypeWit will check whether it landed.", 409, "write_uncertain");
      }
      return after;
    }),

  replaceTailIf: (check, deleteCount, text, format) =>
    run(async (context) => {
      if (!Number.isSafeInteger(deleteCount) || deleteCount <= 0) {
        throw new ProviderError("permanent", "Invalid temporary-text correction.", 422);
      }
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items/text");
      await context.sync();
      if (!check(paragraphs.items.map((p) => p.text))) return null;
      const last = paragraphs.items.at(-1);
      if (!last || deleteCount > last.text.length) {
        throw new ProviderError("permanent", "The temporary text is no longer at the insertion point.", 422);
      }
      const suffix = last.text.slice(-deleteCount);
      if (/[\r\n\v]/u.test(suffix) || /^[\uDC00-\uDFFF]/u.test(suffix)) {
        throw new ProviderError("permanent", "A correction cannot cross a paragraph or split a character.", 422);
      }
      if (typeof last.search !== "function") {
        throw new ProviderError("permanent", "This Word host cannot correct temporary text.", 422);
      }
      const matches = last.search(suffix, { matchCase: true, matchWildcards: false, ignoreSpace: false, ignorePunct: false });
      matches.load("items");
      paragraphs.load("items/text");
      await context.sync();
      // Search needs its own sync. Check again immediately before queuing the
      // edit, and mutate only the final exact suffix match in this paragraph.
      if (!check(paragraphs.items.map((p) => p.text)) || paragraphs.items.at(-1)?.text.slice(-deleteCount) !== suffix) return null;
      const expected = paragraphs.items.map(p => p.text);
      expected[expected.length - 1] = expected.at(-1)!.slice(0, -deleteCount) + text;
      const expectedParagraphs = expected.join("\n").split("\n");
      const range = matches.items.at(-1);
      if (!range) return null;
      range.delete();
      const lines = text.split("\n");
      if (!format) {
        if (lines[0]) last.insertText(lines[0], "End");
        for (const line of lines.slice(1)) context.document.body.insertParagraph(line, "End");
      } else {
        const styles = headingStylesSupported();
        const lastWasEmpty = last.text.length === deleteCount;
        let offset = 0;
        lines.forEach((line, i) => {
          const paragraph = i === 0 ? last : context.document.body.insertParagraph("", "End");
          for (const segment of segments(line, offset, format)) {
            const inserted = paragraph.insertText(segment.text, "End");
            inserted.font.bold = segment.bold;
            inserted.font.italic = segment.italic;
            inserted.font.underline = segment.underline ? "Single" : "None";
            inserted.font.strikeThrough = Boolean(segment.strikethrough);
            inserted.font.highlightColor = segment.highlight ?? null;
          }
          const style = format.paragraphs.find((p) => p.start === offset);
          if (style && (i > 0 || lastWasEmpty)) {
            if (styles) paragraph.styleBuiltIn = WORD_STYLE[style.kind];
            if (style.alignment) paragraph.alignment = {left:"Left",center:"Centered",right:"Right",justify:"Justified"}[style.alignment];
          }
          offset += line.length + 1;
        });
      }
      await context.sync();
      const after = await paragraphTexts(context);
      if (after.length !== expectedParagraphs.length || after.some((p, i) => p !== expectedParagraphs[i])) {
        throw new ProviderError("conflict", "The document changed during the edit. TypeWit will check whether it landed.", 409, "write_uncertain");
      }
      return after;
    }),

  isEditable: () => Promise.resolve(window.Office?.context.document.mode !== "readOnly"),
};

const WORD_STYLE: Record<ParagraphKind, string> = {
  normal: "Normal",
  title: "Title",
  subtitle: "Subtitle",
  h1: "Heading1",
  h2: "Heading2",
  h3: "Heading3",
  bullet: "ListBullet",
  numbered: "ListNumber",
};

/** Paragraph styles need WordApi 1.3; older Word still gets bold and italic. */
export function headingStylesSupported(): boolean {
  return window.Office?.context.requirements?.isSetSupported("WordApi", "1.3") ?? false;
}

/** A line cut where bold or italic starts or stops. `lineStart` is the line's offset in the unit. */
export function segments(line: string, lineStart: number, format: ChunkFormat) {
  const cuts = new Set([0, line.length]);
  for (const s of format.spans) {
    for (const at of [s.start - lineStart, s.end - lineStart]) if (at > 0 && at < line.length) cuts.add(at);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: { text: string; bold: boolean; italic: boolean; underline?: boolean; strikethrough?: boolean; highlight?: string }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = lineStart + points[i];
    const inSpan = (key: "bold" | "italic" | "underline" | "strikethrough") => format.spans.some((s) => s[key] && s.start <= from && from < s.end);
    const highlight = format.spans.findLast(s => s.highlight && s.start <= from && from < s.end)?.highlight;
    out.push({ text: line.slice(points[i], points[i + 1]), bold: inSpan("bold"), italic: inSpan("italic"), ...(inSpan("underline") ? {underline:true} : {}), ...(inSpan("strikethrough") ? {strikethrough:true} : {}), ...(highlight ? { highlight } : {}) });
  }
  return out;
}

import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  createFormatSlicer,
  formatsForUnits,
  type ParsedMarkdown,
  type SpanRange,
} from "../functions/_shared/markdown.ts";

/** The pre-audit scan is the oracle for formatting compatibility. */
function reference(doc: ParsedMarkdown, from: number, to: number) {
  return {
    paragraphs: doc.paragraphs.flatMap((p, i) => {
      if (p.start < from || p.start >= to) return [];
      const previous = doc.paragraphs[i - 1];
      if (p.kind === "normal" && i > 0 && previous?.kind === "normal" && !p.alignment && !previous.alignment) return [];
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
    spans: doc.spans.filter((s) => s.start < to && s.end > from).map((s) => ({
      ...s,
      start: Math.max(s.start, from) - from,
      end: Math.min(s.end, to) - from,
    })),
  };
}

Deno.test("security: indexed formatting preserves overlapping spans, paragraph resets and revision revisits", () => {
  const doc: ParsedMarkdown = {
    plain: "Heading\nBullet\nNormal\nMore\n",
    paragraphs: [
      { start: 0, end: 8, kind: "h1", alignment: "center" },
      { start: 8, end: 15, kind: "bullet" },
      { start: 15, end: 22, kind: "normal" },
      { start: 22, end: 27, kind: "normal" },
    ],
    spans: [
      { start: 10, end: 19, bold: true },
      { start: 0, end: 27, italic: true },
      { start: 3, end: 8, highlight: "#ffee00" },
      { start: 10, end: 11, underline: true },
      { start: 10, end: 19, strikethrough: true },
    ],
  };
  const slice = createFormatSlicer(doc);
  for (let from = doc.plain.length - 1; from >= 0; from--) {
    for (let to = from + 1; to <= doc.plain.length; to++) {
      assertEquals(slice(from, to), reference(doc, from, to));
    }
  }
  assertEquals(formatsForUnits(doc, [...doc.plain]), [...doc.plain].map((_, i) => reference(doc, i, i + 1)));
});

Deno.test("security: disjoint rich-text ranges do not rescan every style on every step", () => {
  let reads = 0;
  const spans: SpanRange[] = Array.from({ length: 20000 }, (_, i) => ({
    get start() {
      reads++;
      return i * 2;
    },
    get end() {
      reads++;
      return i * 2 + 1;
    },
    bold: true,
  }));
  const slice = createFormatSlicer({ plain: "x ".repeat(20000), paragraphs: [], spans });
  reads = 0;
  for (let i = 0; i < 2000; i++) {
    const from = (i * 7919 % 20000) * 2;
    assertEquals(slice(from, from + 1).spans, [{ start: 0, end: 1, bold: true }]);
  }
  assert(reads < 200000, `Formatting inspected ${reads} range fields for 2,000 steps.`);
});

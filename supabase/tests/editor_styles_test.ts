import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { formatsForUnits, type ParsedMarkdown, parseRichText } from "../functions/_shared/markdown.ts";
import { formatRequests } from "../functions/_shared/providers/google.ts";
import { planSession } from "../functions/_shared/plan.ts";

const source: ParsedMarkdown = {
  plain: "One\nTwo\nEnd",
  paragraphs: [
    { start: 0, end: 4, kind: "numbered", alignment: "center" },
    { start: 4, end: 8, kind: "numbered", alignment: "right" },
    { start: 8, end: 11, kind: "normal", alignment: "left" },
  ],
  spans: [{ start: 0, end: 3, underline: true, strikethrough: true, bold: true }],
};
Deno.test("editor styles validate, split across units, number lists and reset after a list", () => {
  const parsed = parseRichText(JSON.stringify(source));
  assertEquals(parsed, source);
  const chunks = formatsForUnits(parsed, ["On", "e\n", "Two\n", "End"]);
  assertEquals(chunks[0].spans[0], { start: 0, end: 2, underline: true, strikethrough: true, bold: true });
  assertEquals(chunks[1].spans[0].end, 1);
  assertEquals(chunks[2].paragraphs[0].alignment, "right");
  assertEquals(chunks[3].paragraphs[0].after_bullet, true);
  const requests = formatRequests({ paragraphs: parsed.paragraphs, spans: parsed.spans }, 1, 11, true) as {
    updateTextStyle?: { textStyle: Record<string, unknown> };
    updateParagraphStyle?: { paragraphStyle: { alignment?: string } };
    createParagraphBullets?: { bulletPreset: string };
  }[];
  assertEquals(requests[0].updateTextStyle!.textStyle.underline, false);
  assertEquals(requests[1].updateTextStyle!.textStyle.strikethrough, true);
  assert(requests.some((r) => r.updateParagraphStyle?.paragraphStyle.alignment === "CENTER"));
  assert(requests.some((r) => r.createParagraphBullets?.bulletPreset === "NUMBERED_DIGIT_ALPHA_ROMAN"));
  assert(
    formatRequests(chunks[3], 9, 3, true).some((r) =>
      typeof r === "object" && r !== null && "deleteParagraphBullets" in r
    ),
  );
});
Deno.test("editor styles reject unsafe alignment, non-boolean spans and split surrogate pairs", () => {
  for (const alignment of ["inherit", "url(javascript:bad)", 42, null]) {
    assertThrows(() =>
      parseRichText(JSON.stringify({ ...source, paragraphs: [{ start: 0, end: 11, kind: "normal", alignment }] }))
    );
  }
  for (const field of ["underline", "strikethrough"]) {
    assertThrows(() => parseRichText(JSON.stringify({ ...source, spans: [{ start: 0, end: 1, [field]: "true" }] })));
  }
  assertThrows(() =>
    parseRichText(
      JSON.stringify({
        plain: "😀",
        paragraphs: [{ start: 0, end: 2, kind: "normal" }],
        spans: [{ start: 0, end: 1, underline: true }],
      }),
    )
  );
});
Deno.test("drafting and all insertion units retain extended paragraph and text formatting", () => {
  for (const unit of ["character", "word", "sentence", "paragraph", "chunk"] as const) {
    const plan = planSession({
      text: JSON.stringify(source),
      format: "rich",
      unit,
      plan: "pro",
      durationSeconds: 600,
      seed: 7,
      rhythm: "drafting",
    });
    assert(plan.ok);
    assertEquals(plan.source_chunks.join(""), source.plain);
    const formats = plan.chunk_formats ?? [];
    assert(formats.some((f) => f.spans.some((s) => s.underline && s.strikethrough)));
    assert(formats.some((f) => f.paragraphs.some((p) => p.kind === "numbered" && p.alignment === "center")));
  }
});

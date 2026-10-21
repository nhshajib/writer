import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { parseRichText, plainDocument, replaceFormattedTail } from "../functions/_shared/markdown.ts";
import { executionText } from "../functions/_shared/drafting.ts";
import { planSession } from "../functions/_shared/plan.ts";
import { formatRequests } from "../functions/_shared/providers/google.ts";
import { replanPaused } from "../functions/_shared/replan.ts";
import { Clock, makeSession } from "./fakes.ts";

const plain = "Title\nA café 👩🏽‍💻 and bold highlighted text. Another sentence follows.";
const rich = JSON.stringify({
  plain,
  paragraphs: [
    { start: 0, end: 6, kind: "title" },
    { start: 6, end: plain.length, kind: "normal" },
  ],
  spans: [{ start: 6, end: plain.length, bold: true, italic: true, highlight: "#ffff00" }],
});

Deno.test("rich paste validates bounded styles and rejects malformed source", () => {
  const parsed = parseRichText(rich);
  assertEquals(parsed.plain, plain);
  for (
    const invalid of [
      "<script>alert(1)</script>",
      "null",
      JSON.stringify({ plain: "abc", paragraphs: [], spans: [] }),
      JSON.stringify({
        plain: "abc",
        paragraphs: [{ start: 0, end: 3, kind: "normal" }],
        spans: [{ start: 0, end: 5 }],
      }),
      rich.replace("#ffff00", "url(evil)"),
      rich.replace('"title"', '"script"'),
    ]
  ) {
    assertThrows(() => parseRichText(invalid));
  }
});

Deno.test("all rhythms keep rich Unicode text and supported styles through execution", () => {
  for (const rhythm of ["natural", "steady", "drafting"] as const) {
    const plan = planSession({
      text: rich,
      format: "rich",
      unit: "word",
      seed: 19,
      plan: rhythm === "drafting" ? "pro" : "free",
      rhythm,
      durationSeconds: 600,
    });
    assert(plan.ok);
    assertEquals(plan.chars, plain.length);
    assertEquals(plan.source_chunks.join(""), plain);
    assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), plain);
    assertEquals(plan.chunk_formats?.length, plan.units.length);
    assert(plan.chunk_formats!.some((f) => f.spans.some((s) => s.bold && s.italic && s.highlight === "#ffff00")));
  }
});

Deno.test("Google rich text sets title and combined inline styles and clears inherited highlight", () => {
  const parsed = parseRichText(rich);
  const requests = formatRequests(parsed, 10, plain.length, true) as {
    updateTextStyle?: { textStyle: Record<string, unknown>; fields: string };
    updateParagraphStyle?: { paragraphStyle: { namedStyleType: string } };
  }[];
  assert(requests.some((r) => r.updateParagraphStyle?.paragraphStyle.namedStyleType === "TITLE"));
  const combined = requests.find((r) => r.updateTextStyle?.textStyle.bold === true)?.updateTextStyle;
  assertEquals(combined?.fields, "bold,italic,backgroundColor");
  assertEquals(combined?.textStyle.backgroundColor, { color: { rgbColor: { red: 1, green: 1, blue: 0 } } });
  assertEquals(requests[0].updateTextStyle?.textStyle.backgroundColor, {});
});

Deno.test("changing only timing on a paused rich session preserves remaining highlights", () => {
  const plan = planSession({ text: rich, format: "rich", unit: "word", seed: 9, plan: "pro", durationSeconds: 600 });
  const base = makeSession(plain, { clock: new Clock(), minutes: 10 });
  const row = {
    ...base,
    text: rich,
    text_format: "rich" as const,
    chunks: plan.units,
    source_chunks: plan.source_chunks,
    source_unit_ends: plan.source_unit_ends,
    chunk_formats: plan.chunk_formats,
    chunk_deletions: plan.chunk_deletions,
    action_kinds: plan.action_kinds,
    chunks_written: 1,
    schedule: plan.schedule,
    paused_at: base.session_started_at,
  };
  const result = replanPaused(row, { unit: "word", seed: 3, durationSeconds: 600 });
  assertEquals(result.source_chunks.join(""), plain);
  assert(result.chunk_formats!.some((f) => f.spans.some((s) => s.highlight === "#ffff00")));
});

Deno.test("paused rich replacement keeps the confirmed prefix and applies new suffix styles", () => {
  const base = makeSession(plain, { clock: new Clock(), minutes: 10 });
  const tail = JSON.stringify({
    plain: "New ending.",
    paragraphs: [{ start: 0, end: 11, kind: "normal" }],
    spans: [{ start: 0, end: 3, highlight: "#00ff00" }],
  });
  const row = {
    ...base,
    text: plain,
    text_format: "plain" as const,
    chunks_written: 1,
    paused_at: base.session_started_at,
  };
  const patched = replanPaused(row, { unit: "word", seed: 2, durationSeconds: 600 }, tail, "rich");
  assertEquals(patched.source_chunks.join(""), base.chunks[0] + "New ending.");
  assert(patched.chunk_formats!.some((f) => f.spans.some((s) => s.highlight === "#00ff00")));
});

Deno.test("formatted tail merge preserves partial paragraph ranges and serializes for run again", () => {
  const original = parseRichText(rich);
  for (const offset of [0, 3, 6, 15, plain.length]) {
    const tail = plainDocument("Replacement.\nNext line.");
    const merged = replaceFormattedTail(original, offset, tail);
    assertEquals(parseRichText(JSON.stringify(merged)).plain, plain.slice(0, offset) + tail.plain);
    assert(merged.spans.every((s) => s.end <= offset));
  }
});

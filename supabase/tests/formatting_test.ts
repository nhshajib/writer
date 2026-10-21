import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { type ChunkFormat, formatsForUnits, parseMarkdown } from "../functions/_shared/markdown.ts";
import { planSession } from "../functions/_shared/plan.ts";
import { formatRequests, GoogleDocsProvider } from "../functions/_shared/providers/google.ts";
import { HEADING_MISSING, HEADING_NO_SPACE, ProviderError } from "../functions/_shared/providers/types.ts";
import { LIMITS, validatePacing } from "../functions/_shared/pacing.ts";
import { checkAccess } from "../functions/_shared/access.ts";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker } from "./fakes.ts";

// ---------------------------------------------------------------------------
// Markdown subset
// ---------------------------------------------------------------------------

Deno.test("markdown: headings, bullets, bold and italic become plain text with ranges", () => {
  const parsed = parseMarkdown("# Title\nSome **bold** and *italic* and _this_.\n- one\n* two\nplain");
  assertEquals(parsed.plain, "Title\nSome bold and italic and this.\none\ntwo\nplain");
  assertEquals(parsed.paragraphs.map((p) => p.kind), ["h1", "normal", "bullet", "bullet", "normal"]);
  assertEquals(parsed.paragraphs[0], { start: 0, end: 6, kind: "h1" });
  const slice = (s: { start: number; end: number }) => parsed.plain.slice(s.start, s.end);
  assertEquals(parsed.spans.map((s) => [slice(s), s.bold ? "b" : "i"]), [["bold", "b"], ["italic", "i"], [
    "this",
    "i",
  ]]);
});

Deno.test("markdown: anything outside the subset stays exactly as typed", () => {
  const src = "#NoSpace\n#### four\n1. numbered\nsnake_case_name and 2 * 3 * 4\n**unclosed\n> quote";
  assertEquals(parseMarkdown(src).plain, src);
  assertEquals(parseMarkdown(src).spans, []);
  assert(parseMarkdown(src).paragraphs.every((p) => p.kind === "normal"));
});

Deno.test("markdown: formats are cut per unit, relative to each unit", () => {
  const parsed = parseMarkdown("## Plan\nFirst **step** here. Then more.\nAfter");
  const units = ["Plan\n", "First step here. ", "Then more.\n", "After"];
  assertEquals(units.join(""), parsed.plain);
  const formats = formatsForUnits(parsed, units);
  assertEquals(formats[0].paragraphs, [{ start: 0, end: 5, kind: "h2" }]);
  // The paragraph after the heading is reset to normal where it starts.
  assertEquals(formats[1].paragraphs, [{ start: 0, end: 17, kind: "normal" }]);
  assertEquals(formats[1].spans, [{ start: 6, end: 10, bold: true }]);
  assertEquals(formats[2].paragraphs, []);
  // A plain paragraph after a plain one can't inherit anything, so it is left alone.
  assertEquals(formats[3].paragraphs, []);
});

Deno.test("markdown: a span crossing units is split, and a paragraph after a bullet drops the bullet", () => {
  const parsed = parseMarkdown("- a **bold run**\nnext");
  const formats = formatsForUnits(parsed, ["a bo", "ld run\n", "next"]);
  assertEquals(formats[0].spans, [{ start: 2, end: 4, bold: true }]);
  assertEquals(formats[1].spans, [{ start: 0, end: 6, bold: true }]);
  assertEquals(formats[2].paragraphs, [{ start: 0, end: 4, kind: "normal", after_bullet: true }]);
});

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

Deno.test("plan: formatted paste is included on Free, units are the text without markers, and formats line up", () => {
  const text = "# Heading\nA **bold** sentence. Another one.";
  const pro = planSession({ text, unit: "sentence", seed: 1, plan: "pro", durationSeconds: 600, format: "markdown" });
  assert(pro.ok);
  assertEquals(pro.text_format, "markdown");
  assertEquals(pro.units.join(""), "Heading\nA bold sentence. Another one.");
  assertEquals(pro.chunk_formats!.length, pro.units.length);
  assertEquals(pro.words, 6);

  const free = planSession({ text, unit: "sentence", seed: 1, plan: "free", durationSeconds: 600, format: "markdown" });
  assert(free.ok);

  const plain = planSession({ text, unit: "sentence", seed: 1, plan: "free", durationSeconds: 600 });
  assert(plain.ok);
  assertEquals(plain.chunk_formats, null);
  assert(plain.units.join("").startsWith("# Heading"));
});

Deno.test("pacing: Pro breaks can be up to 8 hours, with up to 12 hours between them", () => {
  const base = {
    timing: "duration" as const,
    duration_seconds: 7 * 24 * 3600,
    variation_pct: 25,
    breaks: {
      enabled: true,
      every_seconds: 12 * 3600,
      every_variation_pct: 0,
      min_seconds: 3 * 3600,
      max_seconds: 8 * 3600,
      align: "any" as const,
    },
  };
  assertEquals(validatePacing(base), null);
  assertEquals(LIMITS.break_seconds.max, 8 * 3600);
  assert(validatePacing({ ...base, breaks: { ...base.breaks, max_seconds: 8 * 3600 + 1 } }));
  assert(validatePacing({ ...base, breaks: { ...base.breaks, every_seconds: 12 * 3600 + 1 } }));
});

// ---------------------------------------------------------------------------
// Google: formatted and targeted inserts
// ---------------------------------------------------------------------------

type Call = { url: string; init?: RequestInit };
function fakeFetch(responses: Response[], calls: Call[]): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const res = responses.shift();
    return res ? Promise.resolve(res) : Promise.reject(new Error("unexpected request"));
  }) as typeof fetch;
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const para = (text: string, start: number, style = "NORMAL_TEXT", headingId?: string) => ({
  startIndex: start,
  endIndex: start + text.length,
  paragraph: {
    elements: [{ textRun: { content: text } }],
    paragraphStyle: { namedStyleType: style, ...(headingId ? { headingId } : {}) },
  },
});

/** A document: intro, "Method" (h1) with one line, "Detail" (h2), then "Results" (h1) with an empty line. */
function docBody(revisionId = "rev-1") {
  return {
    revisionId,
    body: {
      content: [
        { startIndex: 0, endIndex: 1, sectionBreak: {} },
        para("Intro\n", 1),
        para("Method\n", 7, "HEADING_1", "h.method"),
        para("Steps\n", 14),
        para("Detail\n", 20, "HEADING_2", "h.detail"),
        para("More\n", 27),
        para("Results\n", 32, "HEADING_1", "h.results"),
        para("\n", 40),
      ],
    },
  };
}

Deno.test("google: lists headings with their ids and levels", async () => {
  const provider = new GoogleDocsProvider(() => Promise.resolve("t"), fakeFetch([jsonRes(docBody())], []));
  assertEquals(await provider.listHeadings("abc"), [
    { id: "h.method", text: "Method", level: 1 },
    { id: "h.detail", text: "Detail", level: 2 },
    { id: "h.results", text: "Results", level: 1 },
  ]);
});

Deno.test("google: a target's section ends before the next heading of the same level", async () => {
  const calls: Call[] = [];
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("t"),
    fakeFetch([jsonRes(docBody()), jsonRes({ writeControl: { requiredRevisionId: "rev-2" } })], calls),
    { heading_id: "h.method", heading_text: "Method", level: 1 },
  );
  const doc = await provider.readDocument("abc");
  // Subsections belong to the section; the text runs up to just before "Results".
  assertEquals(doc.text, "Intro\nMethod\nSteps\nDetail\nMore\n");
  await provider.insertAtEnd("abc", " added", "rev-1");
  assertEquals(JSON.parse(String(calls[1].init?.body)), {
    requests: [{ insertText: { text: " added", location: { index: 31 } } }],
    writeControl: { requiredRevisionId: "rev-1" },
  });
});

Deno.test("google: a missing heading or one with no room under it is reported, not guessed", async () => {
  const gone = new GoogleDocsProvider(() => Promise.resolve("t"), fakeFetch([jsonRes(docBody())], []), {
    heading_id: "h.deleted",
    heading_text: "Old",
    level: 1,
  });
  const missing = await assertRejects(() => gone.readDocument("abc"), ProviderError);
  assertEquals(missing.code, HEADING_MISSING);

  const body = docBody();
  body.body.content.pop(); // "Results" is now the last element, with nothing under it
  const empty = new GoogleDocsProvider(() => Promise.resolve("t"), fakeFetch([jsonRes(body)], []), {
    heading_id: "h.results",
    heading_text: "Results",
    level: 1,
  });
  assertEquals((await assertRejects(() => empty.readDocument("abc"), ProviderError)).code, HEADING_NO_SPACE);

  // The Test connection explains it in plain words.
  const report = await checkAccess(
    new GoogleDocsProvider(
      () => Promise.resolve("t"),
      fakeFetch([jsonRes({}), jsonRes(docBody())], []),
      { heading_id: "h.deleted", heading_text: "Old", level: 1 },
    ),
    "abc",
  );
  assertEquals(report.problem, "heading_missing");
});

Deno.test("google: a formatted unit is one conditional edit with styles applied after the insert", async () => {
  const calls: Call[] = [];
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("t"),
    fakeFetch([jsonRes(docBody("rev-5")), jsonRes({ writeControl: { requiredRevisionId: "rev-6" } })], calls),
  );
  const format: ChunkFormat = {
    paragraphs: [{ start: 0, end: 5, kind: "h2" }, { start: 5, end: 9, kind: "bullet" }],
    spans: [{ start: 5, end: 7, bold: true }],
  };
  await provider.readDocument("abc");
  await provider.insertAtEnd("abc", "Plan\nGo!\n", "rev-5", format);
  const sent = JSON.parse(String(calls[1].init?.body));
  // The body's last paragraph is empty, so its style may be set; index 40 is before its newline.
  assertEquals(sent.requests[0], { insertText: { text: "Plan\nGo!\n", location: { index: 40 } } });
  assertEquals(sent.requests[1].updateTextStyle.range, { startIndex: 40, endIndex: 49 });
  assertEquals(sent.requests[2].updateTextStyle, {
    range: { startIndex: 45, endIndex: 47 },
    textStyle: { bold: true },
    fields: "bold",
  });
  assertEquals(sent.requests[3].updateParagraphStyle.paragraphStyle, { namedStyleType: "HEADING_2" });
  assertEquals(sent.requests[5].createParagraphBullets.range, { startIndex: 45, endIndex: 49 });
  assertEquals(sent.writeControl, { requiredRevisionId: "rev-5" });
});

Deno.test("google: the person's own paragraph is never restyled", () => {
  const format: ChunkFormat = { paragraphs: [{ start: 0, end: 4, kind: "h1" }], spans: [] };
  const requests = formatRequests(format, 10, 4, false);
  assertEquals(requests.length, 1); // only the bold/italic reset over the new text
  assertEquals(formatRequests(format, 10, 4, true).length, 2);
});

Deno.test("google: a changed document between read and write is a conflict, not a misplaced insert", async () => {
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("t"),
    fakeFetch([jsonRes(docBody("rev-9"))], []),
    { heading_id: "h.method", heading_text: "Method", level: 1 },
  );
  const error = await assertRejects(() => provider.insertAtEnd("abc", "x", "rev-1"), ProviderError);
  assertEquals(error.kind, "conflict");
});

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

Deno.test("engine: each unit is inserted with its own format, and the document text stays exact", async () => {
  const clock = new Clock();
  const formats: (ChunkFormat | null | undefined)[] = [];
  const doc = new FakeDoc(clock, "");
  const insert = doc.insertAtEnd.bind(doc);
  doc.insertAtEnd = (id: string, text: string, required?: string, format?: ChunkFormat | null) => {
    formats.push(format);
    return insert(id, text, required);
  };
  const plan = planSession({
    text: "# Notes\nOne **two**. Three.",
    unit: "sentence",
    seed: 3,
    plan: "pro",
    durationSeconds: 300,
    format: "markdown",
  });
  const row = makeSession(plan.units.join(""), { clock, minutes: 5 });
  row.chunks = plan.units;
  row.total_chunks = plan.units.length;
  row.schedule = plan.schedule;
  row.chunk_formats = plan.chunk_formats;
  const store = new FakeStore(row, clock);
  await runWorker(store, doc, clock, clock.now + 30 * 60_000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.content, "Notes\nOne two. Three.");
  assertEquals(formats, plan.chunk_formats);
});

import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1.0.13";
import { validateConfirmPatch, validateEngineEvents } from "../functions/_shared/engineProtocol.ts";
import { expectedTail } from "../functions/_shared/session.ts";
import { checkAccess } from "../functions/_shared/access.ts";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker, T0 } from "./fakes.ts";
import { DOCUMENT_FIELDS, FORMAT_BATCH_SIZE, GoogleDocsProvider } from "../functions/_shared/providers/google.ts";
import { parseRichText } from "../functions/_shared/markdown.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";

Deno.test("audit 3: confirms advance exactly one unit and cannot change status, lease or anchors", () => {
  const patch = {
    chunks_written: 2,
    pending_index: null,
    pending_revision: null,
    pending_doc_length: null,
    attempts: 0,
    conflict_runs: 0,
    last_error: null,
    last_revision_id: "revision",
    last_written_at: new Date(T0).toISOString(),
  };
  validateConfirmPatch(patch, 1, 5);
  for (
    const extra of [{ status: "running" }, { lease_id: "other" }, { resync_tail: "rewritten" }, { chunks_written: 4 }, {
      attempts: -1,
    }]
  ) assertThrows(() => validateConfirmPatch({ ...patch, ...extra }, 1, 5));
  assertThrows(() => validateConfirmPatch(patch, -1, 5));
  assertThrows(() => validateConfirmPatch(patch, 5, 5));
});
Deno.test("audit 3: canceled confirmations fail while a write landing after a pause is still recorded", async () => {
  const clock = new Clock();
  const row = makeSession("test", { clock });
  const store = new FakeStore(row, clock);
  row.status = "canceled";
  assertEquals(await store.confirm(row.id, 0, { chunks_written: 1 }), false);
  row.status = "paused";
  assertEquals(await store.confirm(row.id, 0, { chunks_written: 1 }), true);
  assertEquals(row.status, "paused");
});
Deno.test("audit 3/19: Word log requests reject unknown kinds, too many events and oversized details", () => {
  assertEquals(validateEngineEvents([{ kind: "chunk_written", detail: { index: 0 } }]).length, 1);
  assertThrows(() => validateEngineEvents([{ kind: "approved", detail: {} }]));
  assertThrows(() => validateEngineEvents(Array.from({ length: 21 }, () => ({ kind: "paused", detail: {} }))));
  assertThrows(() => validateEngineEvents([{ kind: "paused", detail: { text: "x".repeat(4096) } }]));
});
Deno.test("audit 7: connection checks on corrected execution use deletions rather than the raw chunk join", async () => {
  const clock = new Clock();
  const row = { chunks: ["wrong", "", "right"], chunk_deletions: [0, 5, 0], resync_index: 0, resync_tail: "" };
  const doc = new FakeDoc(clock, "right");
  const report = await checkAccess(doc, "fixture", expectedTail(row, 3));
  assertEquals(report.ok, true);
  assertEquals(report.content_unchanged, true);
});
Deno.test("audit 30: rich spans cannot split UTF-16 surrogate pairs", () => {
  const source = {
    plain: "a😀b",
    paragraphs: [{ start: 0, end: 4, kind: "normal" }],
    spans: [{ start: 1, end: 3, bold: true }],
  };
  assertEquals(parseRichText(JSON.stringify(source)).plain, source.plain);
  assertThrows(() => parseRichText(JSON.stringify({ ...source, spans: [{ start: 1, end: 2, bold: true }] })));
  assertThrows(() => parseRichText(JSON.stringify({ ...source, spans: [{ start: 2, end: 3, bold: true }] })));
});
Deno.test("audit 6/30: missing Google revisions are not editable, and provider field mask excludes unused top-level metadata", async () => {
  assert(!DOCUMENT_FIELDS.includes("documentStyle"));
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("test-token"),
    () => Promise.resolve(Response.json({ body: {} })),
  );
  const error = await assertRejects(() => provider.readDocument("fixture"), ProviderError);
  assertEquals(error.code, "not_editable");
});
Deno.test("audit 6/30: large formatting is split, preserving the insertion revision and chaining each batch", async () => {
  const calls: { requests: unknown[]; writeControl: { requiredRevisionId: string } }[] = [];
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("test-token"),
    ((url, init) => {
      if (String(url).includes("batchUpdate")) {
        calls.push(JSON.parse(String(init?.body)));
        return Promise.resolve(Response.json({ writeControl: { requiredRevisionId: `r${calls.length + 1}` } }));
      }
      return Promise.resolve(
        Response.json({
          revisionId: "r1",
          body: {
            content: [{ startIndex: 1, endIndex: 2, paragraph: { elements: [{ textRun: { content: "\n" } }] } }],
          },
        }),
      );
    }) as typeof fetch,
  );
  await provider.readDocument("fixture");
  const spans = Array.from({ length: 900 }, (_, i) => ({ start: i, end: i + 1, bold: true }));
  await provider.insertAtEnd("fixture", "x".repeat(900), "r1", { paragraphs: [], spans });
  assertEquals(calls.length, 3);
  assert(calls.every((c) => c.requests.length <= FORMAT_BATCH_SIZE));
  assertEquals(calls.map((c) => c.writeControl.requiredRevisionId), ["r1", "r2", "r3"]);
  assertEquals(calls.flatMap((c) => c.requests).filter((r) => "insertText" in (r as object)).length, 1);
});
Deno.test("audit 17/30: an uncertain first write followed by user text is paused rather than inserted twice", async () => {
  const clock = new Clock();
  const row = makeSession("Test text.", { clock, minutes: 1 });
  const store = new FakeStore(row, clock);
  const doc = new FakeDoc(clock);
  const insert = doc.insertAtEnd.bind(doc);
  doc.insertAtEnd = async (...args) => {
    await insert(...args);
    doc.edit(doc.content + "Concurrent note");
    throw new ProviderError("conflict", "Post-write changed", 409, "write_uncertain");
  };
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "paused");
  assertEquals(doc.writes.length, 1);
  assertEquals(doc.content, "Test text.Concurrent note");
});

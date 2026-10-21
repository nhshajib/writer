import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { planSession, standardPacing } from "../functions/_shared/plan.ts";
import { type EditableSession, replanPaused } from "../functions/_shared/replan.ts";
import { executionText } from "../functions/_shared/drafting.ts";
import { countWords } from "../functions/_shared/chunker.ts";
import { computeProgress, type ProgressInput } from "../functions/_shared/progress.ts";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker } from "./fakes.ts";

const text = "The first sentence stays. The remaining sentence can change. Another sentence follows.";
const request = { unit: "word" as const, seed: 42, pacing: standardPacing(600) };
function fixture(): EditableSession {
  const row = makeSession(text, { clock: new Clock(), minutes: 30 });
  return {
    ...row,
    text,
    chunks_written: 1,
    paused_at: new Date(Date.parse(row.session_started_at) + row.schedule[0]).toISOString(),
  };
}

Deno.test("word groups contain 1–5 words, preserve Unicode and whitespace, and repeat by seed", () => {
  const source = "  café 👩🏽‍💻\t" + "one two three four five six seven eight nine ten.\n".repeat(30);
  const a = planSession({ text: source, unit: "word", seed: 42, plan: "pro", durationSeconds: 3600 });
  const b = planSession({ text: source, unit: "word", seed: 42, plan: "pro", durationSeconds: 3600 });
  const c = planSession({ text: source, unit: "word", seed: 43, plan: "pro", durationSeconds: 3600 });
  assert(a.ok);
  assertEquals(a.source_chunks.join(""), source);
  assertEquals(a.source_chunks, b.source_chunks);
  assert(JSON.stringify(a.source_chunks) !== JSON.stringify(c.source_chunks));
  const sizes = new Set(a.source_chunks.map(countWords));
  assert(sizes.has(1) && sizes.has(3) && sizes.has(5));
  assert([...sizes].every((n) => n >= 1 && n <= 5));
});

Deno.test("replanning retains confirmed edits and keeps new edits after the pause anchor", () => {
  const row = fixture();
  const result = replanPaused(row, request);
  assertEquals(result.chunks[0], row.chunks[0]);
  assertEquals(result.schedule[0], row.schedule[0]);
  assert(result.schedule[1] > result.schedule[0]);
  assertEquals(executionText(result.chunks, result.chunk_deletions, 0, result.chunks.length), text);
  assertEquals(result.source_chunks.join(""), text);
  assertEquals(result.source_unit_ends.at(-1), result.total_chunks);
  assertEquals(result.next_run_at, null);
  assertEquals(result.schedule.length, result.total_chunks);
});

Deno.test("editing remaining text cannot replace the confirmed prefix", () => {
  const row = fixture();
  const result = replanPaused(row, request, "Replacement words, with Unicode café 👩🏽‍💻.");
  const expected = row.chunks[0] + "Replacement words, with Unicode café 👩🏽‍💻.";
  assertEquals(result.source_chunks.join(""), expected);
  assertEquals(executionText(result.chunks, result.chunk_deletions, 0, result.total_chunks), expected);
});

Deno.test("replanning refuses pending writes, unresolved attention, empty text and temporary mistakes", () => {
  const row = fixture();
  assertThrows(() => replanPaused({ ...row, pending_index: 1 }, request));
  assertThrows(() => replanPaused({ ...row, attention: "confirm_last_part" }, request));
  assertThrows(() => replanPaused(row, request, " "));
  assertThrows(() =>
    replanPaused({
      ...row,
      source_chunks: [text],
      source_unit_ends: [3],
      chunks: ["Wrong ", "later", "words"],
      action_kinds: ["false_start", "backspace", "insert"],
    }, request)
  );
});

Deno.test("replanning accepts a partial source unit only when its entered text is approved", () => {
  const row = fixture();
  const prefix = "The first ";
  const result = replanPaused({
    ...row,
    chunks: [prefix, text.slice(prefix.length)],
    total_chunks: 2,
    source_chunks: [text],
    source_unit_ends: [2],
    schedule: [4000, 8000],
  }, request);
  assertEquals(result.source_chunks[0], prefix);
  assertEquals(result.source_unit_ends[0], 1);
  assertEquals(result.source_chunks.join(""), text);
});

Deno.test("changing settings retains Markdown formatting and replacement text retains prior formats", () => {
  const markdown = "# Heading\nFirst **bold** sentence. Second *italic* sentence.";
  const plan = planSession({
    text: markdown,
    format: "markdown",
    unit: "sentence",
    seed: 7,
    plan: "pro",
    durationSeconds: 600,
  });
  assert(plan.ok);
  const base = fixture();
  const row = {
    ...base,
    text: markdown,
    text_format: "markdown" as const,
    chunks: plan.units,
    source_chunks: plan.source_chunks,
    source_unit_ends: plan.source_unit_ends,
    chunk_formats: plan.chunk_formats,
    total_chunks: plan.units.length,
    schedule: plan.schedule,
  };
  const result = replanPaused(row, request);
  assertEquals(result.chunk_formats?.[0], plan.chunk_formats?.[0]);
  assert(result.chunk_formats?.some((f) => f.spans.some((s) => s.bold)));
  assert(result.chunk_formats?.some((f) => f.spans.some((s) => s.italic)));
  const changed = replanPaused(row, request, "New plain words.");
  assertEquals(changed.chunk_formats?.[0], plan.chunk_formats?.[0]);
  assertEquals(changed.source_chunks.join(""), plan.source_chunks[0] + "New plain words.");
});

Deno.test("edited paused sessions resume and finish with exactly the revised text", async () => {
  const clock = new Clock();
  const original = makeSession(text, { clock, minutes: 30 });
  const prefix = original.chunks[0];
  clock.now = Date.parse(original.session_started_at) + original.schedule[0];
  Object.assign(original, {
    chunks_written: 1,
    status: "paused",
    paused_at: new Date(clock.now).toISOString(),
    last_written_at: new Date(clock.now).toISOString(),
    preflight_at: original.session_started_at,
  });
  const patch = replanPaused({ ...original, text }, request, "This is the revised ending.");
  Object.assign(original, patch);
  const doc = new FakeDoc(clock, prefix);
  const store = new FakeStore(original, clock);
  clock.now += 300_000;
  const resumed = await store.resume(doc);
  assert(resumed.ok);
  await runWorker(store, doc, clock, clock.now + 900_000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.content, prefix + "This is the revised ending.");
});

Deno.test("remaining-text editor omits approved text already entered inside a source unit", () => {
  const row = fixture();
  const prefix = "The first ";
  const partial: ProgressInput = {
    ...row,
    chunks: [prefix, text.slice(prefix.length)],
    chunk_deletions: [0, 0],
    action_kinds: ["insert", "insert"],
    total_chunks: 2,
    source_chunks: [text],
    source_unit_ends: [2],
    schedule: [4000, 8000],
    status: "paused",
    word_count: countWords(text),
    next_run_at: null,
    completed_at: null,
  };
  const progress = computeProgress(partial, new Date(row.paused_at!));
  assertEquals(progress.written_text, prefix);
  assertEquals(progress.remaining_text, text.slice(prefix.length));
});

Deno.test("audit 26: a paused edit checks the combined session duration, not only the replacement", () => {
  const row = fixture();
  row.paused_at = new Date(Date.parse(row.session_started_at) + 6.5 * 86400_000).toISOString();
  assertThrows(
    () => replanPaused(row, { ...request, pacing: standardPacing(86400) }),
    Error,
    "including the part already entered",
  );
});

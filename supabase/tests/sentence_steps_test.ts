import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { countWords, splitIntoUnits, splitText } from "../functions/_shared/chunker.ts";
import { executionText } from "../functions/_shared/drafting.ts";
import { planSession } from "../functions/_shared/plan.ts";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker, T0 } from "./fakes.ts";

Deno.test("sentence steps use exactly two balanced, lossless parts only above 20 words", () => {
  for (const count of [1, 19, 20, 21, 22, 39, 40, 41, 1001]) {
    const text = " \t" + Array.from({ length: count }, (_, i) => i % 2 ? "café👩🏽‍💻" : "approved").join(" \t") + ".\n\n";
    const parts = splitText(text, "sentence");
    assertEquals(parts.length, count > 20 ? 2 : 1);
    assertEquals(parts.join(""), text);
    assertEquals(parts.map(countWords), count > 20 ? [Math.ceil(count / 2), Math.floor(count / 2)] : [count]);
    assertEquals(splitIntoUnits(text, "sentence"), [text]); // grammatical boundary detection remains separate
  }
  assertEquals(splitText("", "sentence"), []);
  assertEquals(splitText(" \n\t", "sentence").join(""), " \n\t");
  assertEquals(splitText("中文句子。第二句！", "sentence"), ["中文句子。", "第二句！"]);
});

Deno.test("Natural, Steady and Drafting share sentence parts and pause only at real sentence ends", () => {
  const long = Array.from({ length: 31 }, () => "approved").join(" ") + ". ";
  const plain = long + "A short final sentence.";
  const rich = JSON.stringify({
    plain,
    paragraphs: [{ start: 0, end: plain.length, kind: "normal" }],
    spans: [{ start: 0, end: plain.length, bold: true, underline: true }],
  });
  for (const rhythm of ["natural", "steady", "drafting"] as const) {
    const plan = planSession({
      text: rich,
      format: "rich",
      unit: "sentence",
      rhythm,
      seed: 42,
      plan: "pro",
      durationSeconds: 600,
    });
    assert(plan.ok, JSON.stringify(plan.problems));
    assertEquals(plan.source_chunks.map(countWords), [16, 15, 4]);
    assertEquals(plan.source_chunks.join(""), plain);
    assertEquals(executionText(plan.units, plan.chunk_deletions, 0, plan.units.length), plain);
    assertEquals(plan.drafting_stats.sentence_pauses, rhythm === "steady" ? 0 : 1);
    assertEquals(plan.schedule.at(-1), 600000);
    assertEquals(plan.chunk_formats?.length, plan.units.length);
    assert(plan.chunk_formats?.some((f) => f.spans.some((s) => s.bold && s.underline)));
  }
});

Deno.test("existing stored sentence schedules keep their original unsplit insertion", async () => {
  const text = Array.from({ length: 31 }, () => "approved").join(" ") + ".";
  const clock = new Clock();
  const legacy = {
    ...makeSession(text, { clock, unit: "sentence", minutes: 10 }),
    chunks: [text],
    source_chunks: [text],
    source_unit_ends: [1],
    chunk_deletions: [0],
    action_kinds: ["insert" as const],
    chunk_formats: null,
    total_chunks: 1,
    schedule: [600000],
    next_run_at: new Date(T0 + 600000).toISOString(),
  };
  const store = new FakeStore(legacy, clock);
  const doc = new FakeDoc(clock, "");
  await runWorker(store, doc, clock, T0 + 720000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.content, text);
  assertEquals(doc.writes.map((w) => w.text), [text]);
});

import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  findUnsupportedCharacters,
  type InsertionUnit,
  splitIntoUnits,
  splitText,
} from "../functions/_shared/chunker.ts";
import { planSession } from "../functions/_shared/plan.ts";
import { seededRandom } from "../functions/_shared/schedule.ts";

const UNITS: InsertionUnit[] = ["sentence", "paragraph", "word", "character", "chunk"];

const SAMPLES = [
  "First sentence. Second one! Third? Yes.",
  "Paragraph one.\n\nParagraph two has\nline breaks.\n\n\nParagraph three.",
  "  Leading spaces. Trailing spaces.   ",
  'Quotes say "stop." Then go. (Brackets.) Next.',
  "Mr. Smith met Dr. Jones at 5 p.m. on Main St. today.",
  "Tabs\tand non breaking spaces, zero​width and line separators stay.",
  "Combining: café, naïve. Emoji: 👨‍👩‍👧 🇧🇩 👍🏽 done.",
  "আমি বাংলায় লিখি। এটা পরীক্ষা? হ্যাঁ!",
  "中文句子。第二句！第三句？",
  "مرحبا بالعالم. هذا اختبار؟ نعم.",
  "No punctuation at all",
  "\n\nStarts with blank lines.",
];

Deno.test("every unit joins back to exactly the original text", () => {
  for (const text of SAMPLES) {
    for (const unit of UNITS) {
      assertEquals(splitText(text, unit).join(""), text, `${unit}: ${JSON.stringify(text)}`);
    }
  }
});

Deno.test("random Unicode text survives every unit exactly", () => {
  const pool = [
    "a",
    "Z",
    " ",
    "  ",
    "\n",
    "\n\n",
    "\t",
    ".",
    "!",
    "?",
    "。",
    "।",
    " ",
    "é",
    "é",
    "👨‍👩‍👧",
    "🇧🇩",
    "中",
    "ب",
    " ",
    '"',
    ")",
    "Mr. ",
    "1.5",
    "…",
  ];
  const random = seededRandom(2026);
  for (let round = 0; round < 300; round++) {
    let text = "";
    const length = Math.floor(random() * 60);
    for (let i = 0; i < length; i++) text += pool[Math.floor(random() * pool.length)];
    for (const unit of UNITS) assertEquals(splitText(text, unit).join(""), text, JSON.stringify(text));
  }
});

Deno.test("sentences follow Unicode sentence ends and keep common abbreviations together", () => {
  assertEquals(splitIntoUnits("First sentence. Second one! Third? Yes.", "sentence"), [
    "First sentence. ",
    "Second one! ",
    "Third? ",
    "Yes.",
  ]);
  assertEquals(splitIntoUnits("Mr. Smith left. Then Dr. Jones came.", "sentence"), [
    "Mr. Smith left. ",
    "Then Dr. Jones came.",
  ]);
  assertEquals(splitIntoUnits("中文句子。第二句！", "sentence"), ["中文句子。", "第二句！"]);
  // A blank line stays with the sentence before it rather than becoming its own step.
  assertEquals(splitIntoUnits("One.\n\nTwo.", "sentence"), ["One.\n\n", "Two."]);
});

Deno.test("characters never split an emoji or accent and never step on whitespace alone", () => {
  assertEquals(splitText("Hi 👨‍👩‍👧e\u0301!", "character"), ["H", "i ", "👨‍👩‍👧", "e\u0301", "!"]);
  for (const part of splitText("a  b\n\nc", "character")) assert(/\S/u.test(part));
});

Deno.test("characters Google Docs would drop are found, others are fine", () => {
  assertEquals(findUnsupportedCharacters("ok\ttab\nline 👍  "), []);
  assertEquals(findUnsupportedCharacters("a\r\nb").map((c) => [c.index, c.codePoint]), [[1, "U+000D"]]);
  assertEquals(findUnsupportedCharacters("xy")[0].reason, "private-use character");
  assertEquals(findUnsupportedCharacters("x\uD800y")[0].reason, "broken character (lone surrogate)");
  assertEquals(findUnsupportedCharacters("\u0007")[0].reason, "control character");
});

const base = { seed: 3, plan: "pro" as const };

Deno.test("plan: a one-hour sentence session ends at the one-hour mark", () => {
  const text = Array.from({ length: 24 }, (_, i) => `Sentence number ${i + 1} has a few words in it.`).join(" ");
  const plan = planSession({ ...base, text, unit: "sentence", durationSeconds: 3600 });
  assert(plan.ok);
  assertEquals(plan.units.length, 24);
  assertEquals(plan.schedule.at(-1), 3_600_000);
  assertEquals(plan.units.join(""), text);
  assert(plan.stats!.max_gap_ms > plan.stats!.min_gap_ms);
});

Deno.test("plan: too short a duration is explained with the minimum and units that fit", () => {
  const text = "word ".repeat(200).trim();
  const plan = planSession({ ...base, text, unit: "character", durationSeconds: 600 });
  assertEquals(plan.ok, false);
  const problem = plan.problems.find((p) => p.code === "duration_too_short")!;
  assert(problem.message.includes("need at least"), problem.message);
  assert(problem.message.includes("60 edits a minute"), problem.message);
  assertEquals(plan.schedule, []);
  const words = plan.options.find((o) => o.unit === "word")!;
  assertEquals([words.units, words.minimum_duration_seconds, words.fits], [200, 800, false]);
  assertEquals(plan.options.find((o) => o.unit === "sentence")!.fits, true);
});

Deno.test("plan: unsupported characters, empty text and plan limits are problems", () => {
  const codes = (text: string, extra: Partial<Parameters<typeof planSession>[0]> = {}) =>
    planSession({ ...base, text, unit: "sentence", durationSeconds: 3600, ...extra }).problems.map((p) => p.code);
  assertEquals(codes("a\rb."), ["unsupported_characters"]);
  assertEquals(codes("   "), ["empty"]);
  assertEquals(codes("One. Two.", { plan: "free", durationSeconds: 7200 }), ["duration_over_plan"]);
  assertEquals(codes("w ".repeat(251), { plan: "free" }), ["words_over_plan"]);
});

Deno.test("plan: all at once is one insertion of the whole text", () => {
  const plan = planSession({
    ...base,
    text: "One. Two. Three.",
    unit: "sentence",
    durationSeconds: 0,
    mode: "as_soon_as_possible",
  });
  assert(plan.ok);
  assertEquals(plan.units, ["One. Two. Three."]);
});

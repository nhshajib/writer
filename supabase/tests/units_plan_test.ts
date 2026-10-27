import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  findUnsupportedCharacters,
  type InsertionUnit,
  splitIntoUnits,
  splitText,
} from "../functions/_shared/chunker.ts";
import { planSession, standardPacing } from "../functions/_shared/plan.ts";
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

Deno.test("sentences: decimals, initialisms, dates, quotes, headings and list items", () => {
  const cases: [string, string[]][] = [
    ["Pi is 3.14 today. Next one.", ["Pi is 3.14 today. ", "Next one."]],
    ["The U.S. Army met at 5 p.m. on Jan. 3. Then left.", ["The U.S. Army met at 5 p.m. on Jan. 3. ", "Then left."]],
    ['He said, \u201cStop.\u201d Then he left. "Go!" she said.', [
      "He said, \u201cStop.\u201d ",
      "Then he left. ",
      '"Go!" she said.',
    ]],
    ["Introduction\nThe text begins here. It continues.", [
      "Introduction\n",
      "The text begins here. ",
      "It continues.",
    ]],
    ["List:\n1. Apples\n2. Pears.\n- Milk\n\nDone.", ["List:\n", "1. Apples\n", "2. Pears.\n", "- Milk\n\n", "Done."]],
    ["See e.g. section 2. Version 2.0.1 shipped.", ["See e.g. section 2. ", "Version 2.0.1 shipped."]],
  ];
  for (const [text, expected] of cases) assertEquals(splitIntoUnits(text, "sentence"), expected, text);
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
  assert(words.units >= 40 && words.units <= 200);
  assertEquals(words.minimum_duration_seconds, words.units * 4);
  assertEquals(words.fits, words.minimum_duration_seconds <= 600);
  assertEquals(plan.options.find((o) => o.unit === "sentence")!.fits, true);
});

Deno.test("plan: unsupported characters, empty text and plan limits are problems", () => {
  const codes = (text: string, extra: Partial<Parameters<typeof planSession>[0]> = {}) =>
    planSession({ ...base, text, unit: "sentence", durationSeconds: 3600, ...extra }).problems.map((p) => p.code);
  assertEquals(codes("a\rb."), ["unsupported_characters"]);
  assertEquals(codes("   "), ["empty"]);
  assertEquals(codes("One. Two.", { plan: "free", durationSeconds: 7200 }), ["duration_over_plan"]);
  assertEquals(codes("w ".repeat(251), { plan: "free", durationSeconds: 1800 }), ["words_over_plan"]);
});

Deno.test("plan: Free uses the standard pace, and typing speed is Pro", () => {
  const custom = {
    timing: "duration" as const,
    duration_seconds: 1200,
    variation_pct: 0,
    breaks: {
      enabled: false,
      every_seconds: 60,
      every_variation_pct: 0,
      min_seconds: 30,
      max_seconds: 30,
      align: "any" as const,
    },
  };
  const free = planSession({ ...base, text: "One. Two. Three.", unit: "sentence", plan: "free", pacing: custom });
  assertEquals(free.pacing, standardPacing(1200));
  const pro = planSession({ ...base, text: "One. Two. Three.", unit: "sentence", plan: "pro", pacing: custom });
  assertEquals(pro.pacing, custom);
  const speed = planSession({
    ...base,
    text: "One. Two. Three.",
    unit: "sentence",
    plan: "free",
    pacing: { ...custom, timing: "speed", duration_seconds: undefined, wpm: 40 },
  });
  assertEquals(speed.problems.map((p) => p.code), ["pro_feature"]);
});

Deno.test("plan: typing-speed mode estimates the total including breaks and explains caps", () => {
  const text = "word ".repeat(400).trim(); // 1,999 characters: about 10 minutes of active time at 40 WPM
  const breaks = {
    enabled: true,
    every_seconds: 180,
    every_variation_pct: 0,
    min_seconds: 60,
    max_seconds: 60,
    align: "any" as const,
  };
  const plan = planSession({
    ...base,
    text,
    unit: "sentence",
    pacing: { timing: "speed", wpm: 40, variation_pct: 0, breaks },
  });
  assert(plan.ok);
  assertEquals(plan.active_seconds, 600);
  assertEquals(plan.source_chunks.length, 2); // the long sentence is now two balanced insertion steps
  assertEquals(plan.break_seconds, 60); // one break can fit between them with align: "any"
  assertEquals(plan.duration_seconds, 660);
  const words = planSession({
    ...base,
    text,
    unit: "word",
    pacing: { timing: "speed", wpm: 40, variation_pct: 0, breaks },
  });
  assert(words.ok);
  assert(words.break_seconds >= 60 * 2, `${words.break_seconds}`);
  // Each reported duration is rounded to whole seconds independently.
  assert(Math.abs(words.duration_seconds - words.active_seconds - words.break_seconds) <= 1);
  const chars = planSession({
    ...base,
    text: "Quick note.",
    unit: "character",
    pacing: { timing: "speed", wpm: 100, variation_pct: 0, breaks },
  });
  assertEquals(chars.warnings.map((w) => w.code), ["speed_capped", "no_breaks_fit"]);
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

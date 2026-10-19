import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { checkAccess } from "../functions/_shared/access.ts";
import { textRevision, WordDocProvider, type WordHost, wordText } from "../functions/_shared/providers/word.ts";
import { plannedAt } from "../functions/_shared/schedule.ts";
import { Clock, FakeStore, makeSession, runWorker, T0 } from "./fakes.ts";

const DOC = "https://contoso-my.sharepoint.com/personal/sam/Documents/Essay.docx";

/** A Word document as Word's JavaScript API presents it: a list of paragraphs. */
class FakeWord implements WordHost {
  editable = true;
  batches = 0;
  /** Runs inside the next batch, after the check, before the append (someone typing at that moment). */
  duringNextAppend: (() => void) | null = null;

  constructor(public paragraphs: string[] = [""]) {}

  readParagraphs() {
    return Promise.resolve([...this.paragraphs]);
  }
  appendIf(check: (paragraphs: string[]) => boolean, lines: string[]) {
    this.batches++;
    if (!check([...this.paragraphs])) return Promise.resolve(null);
    this.duringNextAppend?.();
    this.duringNextAppend = null;
    this.paragraphs[this.paragraphs.length - 1] += lines[0];
    for (const line of lines.slice(1)) this.paragraphs.push(line);
    return Promise.resolve([...this.paragraphs]);
  }
  isEditable() {
    return Promise.resolve(this.editable);
  }
  text() {
    return this.paragraphs.join("\n");
  }
}

function setup(text: string, initial: string[] = [""], minutes = 30) {
  const clock = new Clock();
  const word = new FakeWord(initial);
  const provider = new WordDocProvider(word, DOC, "Essay");
  const row = makeSession(text, { clock, minutes, document_id: DOC });
  const store = new FakeStore(row, clock);
  return { clock, word, provider, store, end: T0 + minutes * 60_000 };
}

const ESSAY = "First paragraph, with a tab\tand “quotes”.\nA second line. Dr. Lee measured 3.5 cm.\n\n" +
  "After a blank line: émojis 👨‍👩‍👧 and café stay whole. Last sentence.";

Deno.test("word text matches the Google body shape so the same engine checks apply", () => {
  assertEquals(wordText([""]), "\n");
  assertEquals(wordText(["One", "", "Two\vthree"]), "One\n\nTwo\nthree\n");
  assertEquals(textRevision("a"), textRevision("a"));
  assert(textRevision("a") !== textRevision("b"));
  assert(textRevision("ab\n") !== textRevision("ba\n"));
});

Deno.test("word: every unit lands at its planned time and the document ends with exactly the text", async () => {
  for (const unit of ["sentence", "word", "character"] as const) {
    const clock = new Clock();
    const word = new FakeWord(["Existing title", ""]);
    const provider = new WordDocProvider(word, DOC, "Essay");
    const row = makeSession(ESSAY, { clock, unit, minutes: unit === "character" ? 120 : 30, document_id: DOC });
    const store = new FakeStore(row, clock);
    await runWorker(store, provider, clock, T0 + 3 * 3600_000);
    assertEquals(store.row.status, "completed", unit);
    assertEquals(word.text(), `Existing title\n${ESSAY}`, unit);
    const written = store.events.filter((e) => e.kind === "chunk_written");
    assertEquals(written.length, row.total_chunks, unit);
    for (const e of written) {
      const late = Date.parse(String(e.detail.actual_at)) - plannedAt(store.row, Number(e.detail.index));
      assert(late >= 0 && late < 1000, `${unit} unit ${e.detail.index} late by ${late} ms`);
    }
    const done = store.events.find((e) => e.kind === "completed")!;
    assertEquals([done.detail.text_at_end_matches, done.detail.document_is_baseline_plus_text], [true, true], unit);
  }
});

Deno.test("word: paragraph breaks become real paragraphs, not literal newlines", async () => {
  const { clock, word, provider, store } = setup("One.\n\nTwo.\nThree.");
  await runWorker(store, provider, clock, T0 + 3600_000);
  assertEquals(word.paragraphs, ["One.", "", "Two.", "Three."]);
});

Deno.test("word: the connection check runs first and changes nothing", async () => {
  const word = new FakeWord(["Hello"]);
  const provider = new WordDocProvider(word, DOC, "Essay");
  const report = await checkAccess(provider, DOC, "");
  assertEquals([report.ok, report.content_unchanged], [true, true]);
  assertEquals(word.paragraphs, ["Hello"]);
  assertEquals(word.batches, 0);
});

Deno.test("word: a read-only document pauses before anything is entered", async () => {
  const { clock, word, provider, store } = setup(ESSAY);
  word.editable = false;
  await runWorker(store, provider, clock, T0 + 3600_000);
  assertEquals([store.row.status, store.row.attention], ["paused", "not_editable"]);
  assertEquals(word.text(), "");
});

Deno.test("word: text typed after TypeWit's text pauses the session; nothing is duplicated", async () => {
  const { clock, word, provider, store } = setup(ESSAY);
  clock.at(plannedAt(store.row, 1) + 1000, () => {
    word.paragraphs[word.paragraphs.length - 1] += " (my own note)";
  });
  await runWorker(store, provider, clock, T0 + 3600_000);
  assertEquals([store.row.status, store.row.attention], ["paused", "document_changed"]);
  assert(word.text().endsWith(" (my own note)"));
});

Deno.test("word: typing at the moment of an insertion is refused, re-checked and paused, never interleaved", async () => {
  const { clock, word, provider, store } = setup(ESSAY);
  // The text changes between TypeWit's check and its write for every attempt at unit 1.
  const typing = () => {
    word.paragraphs[word.paragraphs.length - 1] += "x";
  };
  clock.at(plannedAt(store.row, 1) - 1, () => {
    const appendIf = word.appendIf.bind(word);
    word.appendIf = (check, lines) => {
      typing();
      return appendIf(check, lines);
    };
  });
  await runWorker(store, provider, clock, T0 + 3600_000);
  assertEquals(store.row.chunks_written, 1);
  assertEquals(store.row.status, "paused");
  // Only TypeWit's first unit and the user's own typing; no TypeWit text after it.
  assert(!word.text().includes(store.row.chunks[1]));
});

Deno.test("word: a lost confirmation is settled from the document, not repeated", async () => {
  const { clock, word, provider, store } = setup(ESSAY);
  store.failConfirms = 1; // the add-in loses its connection right after the edit
  await runWorker(store, provider, clock, T0 + 3600_000);
  assertEquals(store.row.status, "completed");
  assertEquals(word.text(), ESSAY);
  assert(store.events.some((e) => e.kind === "chunk_written" && e.detail.recovered === true));
});

Deno.test("word: closing the document for an hour moves the rest later instead of bursting", async () => {
  const { clock, word, provider, store } = setup(ESSAY, [""], 10);
  await runWorker(store, provider, clock, T0 + 2 * 60_000);
  const before = store.row.chunks_written;
  assert(before < store.row.total_chunks);
  clock.now = T0 + 70 * 60_000; // the add-in wasn't running
  await runWorker(store, provider, clock, T0 + 3 * 3600_000);
  assertEquals(word.text(), ESSAY);
  const times = store.events.filter((e) => e.kind === "chunk_written").map((e) =>
    Date.parse(String(e.detail.actual_at))
  );
  const afterGap = times.slice(before);
  for (let i = 1; i < afterGap.length; i++) assert(afterGap[i] - afterGap[i - 1] >= 4000);
  assert(store.events.some((e) => e.kind === "schedule_shifted"));
});

Deno.test("word: a session is bound to its own document", async () => {
  const word = new FakeWord(["Other"]);
  const provider = new WordDocProvider(word, "https://example.com/Other.docx", "Other");
  const report = await checkAccess(provider, DOC, "");
  assertEquals([report.ok, report.problem], [false, "not_found"]);
  assertEquals(word.paragraphs, ["Other"]);
});

import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import type { InsertionUnit } from "../functions/_shared/chunker.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";
import { MIN_GAP_SECONDS, plannedAt } from "../functions/_shared/schedule.ts";
import type { ResumeOptions, ResumeResult } from "../functions/_shared/session.ts";
import { seededRandom } from "../functions/_shared/schedule.ts";
import { Clock, FakeDoc, FakeStore, makeSession, runWorker, T0 } from "./fakes.ts";

const ESSAY = "The river rose overnight. By morning, the lower fields were under water, and the old bridge " +
  "had gone quiet.\n\nNeighbours came with boats! Nobody knew how long it would last? We waited.\n" +
  "Tabs\tstay, non breaking spaces stay, and so do “quotes”, émojis 👨‍👩‍👧 and accents (café). " +
  "আমি বাংলায় লিখি। 中文也可以。 Done.  ";

function setup(text: string, opts: { unit?: InsertionUnit; minutes?: number; initial?: string; seed?: number } = {}) {
  const clock = new Clock();
  const doc = new FakeDoc(clock, opts.initial ?? "");
  const store = new FakeStore(
    makeSession(text, { clock, unit: opts.unit, minutes: opts.minutes, seed: opts.seed }),
    clock,
  );
  return { clock, doc, store, end: T0 + (opts.minutes ?? 60) * 60_000 };
}

function gaps(times: number[]): number[] {
  return times.slice(1).map((t, i) => t - times[i]);
}

Deno.test("every unit lands at its planned time and the document ends with exactly the text", async () => {
  for (const unit of ["sentence", "paragraph", "word", "character"] as const) {
    const minutes = unit === "character" ? 120 : 60;
    const { clock, doc, store, end } = setup(ESSAY, { unit, minutes, initial: "Notes before.\n" });
    await runWorker(store, doc, clock, end + 120_000);

    assertEquals(store.row.status, "completed", unit);
    assertEquals(doc.content, "Notes before.\n" + ESSAY, unit);
    assertEquals(doc.writes.map((w) => w.text), store.row.chunks, unit);
    // Each insertion happened at its own planned time, the last at the end of the duration.
    assertEquals(doc.writes.map((w) => w.at), store.row.chunks.map((_, i) => plannedAt(store.row, i)), unit);
    assertEquals(doc.writes.at(-1)!.at, T0 + minutes * 60_000, unit);
    assert(gaps(doc.writes.map((w) => w.at)).every((g) => g >= MIN_GAP_SECONDS * 1000), unit);

    const completed = store.events.find((e) => e.kind === "completed")!;
    assertEquals(completed.detail.text_at_end_matches, true);
    assertEquals(completed.detail.document_is_baseline_plus_text, true);
  }
});

Deno.test("the log records planned and actual times for each insertion", async () => {
  const { clock, doc, store, end } = setup("One. Two. Three.", { minutes: 5 });
  await runWorker(store, doc, clock, end + 60_000);
  const written = store.events.filter((e) => e.kind === "chunk_written");
  assertEquals(written.length, 3);
  for (const e of written) {
    assertEquals(e.detail.actual_at, e.detail.planned_at);
    assertEquals(e.detail.late_seconds, 0);
  }
});

Deno.test("pause and resume shift the rest of the schedule by the pause length", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  const original = store.row.chunks.map((_, i) => plannedAt(store.row, i));
  const pauseAt = T0 + 10 * 60_000 + 7_000;
  const pausedFor = 12 * 60_000;
  clock.at(pauseAt, () => void store.pause());
  clock.at(pauseAt + pausedFor, async () => {
    const result = await store.resume(doc);
    assert(result.ok);
    assertEquals(result.detail.paused_seconds, pausedFor / 1000);
    assertEquals(result.detail.finish_at, new Date(end + pausedFor).toISOString());
  });
  await runWorker(store, doc, clock, end + pausedFor + 120_000);

  assertEquals(doc.content, ESSAY);
  const before = doc.writes.filter((w) => w.at < pauseAt);
  const after = doc.writes.filter((w) => w.at >= pauseAt);
  assert(before.length > 0 && after.length > 0);
  assert(after.every((w) => w.at >= pauseAt + pausedFor), "nothing is entered while paused");
  // Units after the pause keep their spacing, moved later by exactly the pause.
  after.forEach((w, k) => assertEquals(w.at, original[before.length + k] + pausedFor));
  assertEquals(doc.writes.at(-1)!.at, end + pausedFor);
});

Deno.test("a pause during the wait inside a worker window stops that worker before it writes", async () => {
  const { clock, doc, store } = setup("First sentence here. Second sentence here.", { minutes: 10 });
  const second = plannedAt(store.row, 1);
  clock.at(second - 2_000, () => void store.pause());
  await runWorker(store, doc, clock, second + 5 * 60_000);
  assertEquals(doc.writes.length, 1);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.chunks_written, 1);
});

Deno.test("stopping ends the session and nothing more is entered", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 20 });
  clock.at(T0 + 8 * 60_000, () => store.cancel());
  await runWorker(store, doc, clock, end + 60_000);
  assertEquals(store.row.status, "canceled");
  assert(doc.writes.every((w) => w.at < T0 + 8 * 60_000));
  assertEquals(doc.content, store.row.chunks.slice(0, store.row.chunks_written).join(""));
});

Deno.test("a worker that dies after writing does not cause a duplicate", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  store.failConfirms = 1; // the first write lands, then the worker crashes before recording it
  await runWorker(store, doc, clock, end + 10 * 60_000);
  assertEquals(doc.content, ESSAY);
  assertEquals(doc.writes.length, store.row.total_chunks);
  const recovered = store.events.filter((e) => e.kind === "chunk_written" && e.detail.recovered === true);
  assertEquals(recovered.length, 1);
});

Deno.test("a write that landed but whose answer was lost is not repeated", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  doc.failures.write = [{ error: new ProviderError("transient", "timeout"), applied: true }];
  await runWorker(store, doc, clock, end + 10 * 60_000);
  assertEquals(doc.content, ESSAY);
  assertEquals(doc.writes.length, store.row.total_chunks);
  assert(store.kinds().includes("retry_scheduled"));
});

Deno.test("when behind schedule the rest moves later instead of catching up in a burst", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  const planned = store.row.chunks.map((_, i) => plannedAt(store.row, i));
  // Google is down for the 3rd insertion: three failures, retried after 1, 2 and 4 minutes.
  doc.failures.write = [];
  clock.at(planned[2] - 1, () => {
    doc.failures.write = [1, 2, 3].map(() => ({ error: new ProviderError("transient", "503", 503) }));
  });
  await runWorker(store, doc, clock, end + 60 * 60_000);

  assertEquals(doc.content, ESSAY);
  const times = doc.writes.map((w) => w.at);
  const delay = times[2] - planned[2];
  assert(delay >= 7 * 60_000, `retried with backoff (${delay} ms late)`);
  // After the delay, the remaining units keep their planned spacing.
  for (let i = 3; i < times.length; i++) {
    assert(Math.abs(times[i] - times[i - 1] - (planned[i] - planned[i - 1])) <= 1000, `gap ${i}`);
  }
  assert(store.kinds().includes("schedule_shifted"));
  assert(gaps(times).every((g) => g >= MIN_GAP_SECONDS * 1000));
});

Deno.test("a long outage pauses the session for the user instead of failing it", async () => {
  const { clock, doc, store } = setup(ESSAY, { minutes: 30 });
  doc.failures.read = Array.from({ length: 20 }, () => ({ error: new ProviderError("transient", "offline") }));
  await runWorker(store, doc, clock, T0 + 3 * 3600_000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "unreachable");
  assertEquals(doc.writes.length, 0);

  doc.failures.read = [];
  const resumed = await store.resume(doc);
  assert(resumed.ok);
  await runWorker(store, doc, clock, clock.now + 2 * 3600_000);
  assertEquals(doc.content, ESSAY);
});

Deno.test("edits elsewhere in the document don't stop the session", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30, initial: "Title\n" });
  clock.at(T0 + 9 * 60_000, () => doc.edit("Better title\n" + doc.content.slice("Title\n".length)));
  await runWorker(store, doc, clock, end + 60_000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.content, "Better title\n" + ESSAY);
  const completed = store.events.find((e) => e.kind === "completed")!;
  assertEquals(completed.detail.text_at_end_matches, true);
  assertEquals(completed.detail.document_is_baseline_plus_text, false);
});

Deno.test("text added after TypeWit's text pauses the session until the user decides", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  clock.at(T0 + 9 * 60_000, () => doc.edit(doc.content + "my own note"));
  await runWorker(store, doc, clock, T0 + 15 * 60_000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "document_changed");
  const writtenBefore = doc.writes.length;

  // Resuming while the document still doesn't match is refused.
  const refused = await store.resume(doc);
  assertEquals(refused.ok, false);

  // The user removes their note; resuming now works and the text completes exactly.
  doc.edit(doc.content.slice(0, -"my own note".length));
  assert((await store.resume(doc)).ok);
  await runWorker(store, doc, clock, end + 30 * 60_000);
  assertEquals(doc.content, ESSAY);
  assert(doc.writes.length > writtenBefore);
});

Deno.test("the user can continue after their own text at the end", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  clock.at(T0 + 9 * 60_000, () => doc.edit(doc.content + "[note] "));
  await runWorker(store, doc, clock, T0 + 15 * 60_000);
  const written = store.row.chunks_written;
  assert((await store.resume(doc, { continue_from_current_end: true })).ok);
  await runWorker(store, doc, clock, end + 30 * 60_000);
  assertEquals(store.row.status, "completed");
  const parts = store.row.chunks;
  assertEquals(doc.content, parts.slice(0, written).join("") + "[note] " + parts.slice(written).join(""));
});

Deno.test("an edit inside TypeWit's text pauses the session", async () => {
  const { clock, doc, store } = setup(ESSAY, { minutes: 30 });
  clock.at(T0 + 9 * 60_000, () => doc.edit(doc.content.replace("river", "lake")));
  await runWorker(store, doc, clock, T0 + 15 * 60_000);
  assertEquals(store.row.attention, "document_changed");
});

Deno.test("typing at the same moment as an insertion is retried, not duplicated or lost", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  let raced = false;
  const read = doc.readDocument.bind(doc);
  doc.readDocument = async () => {
    const state = await read();
    // The user types a character elsewhere right after TypeWit checked the document.
    if (!raced && store.row.chunks_written === 2) {
      raced = true;
      doc.edit("x" + doc.content);
    }
    return state;
  };
  await runWorker(store, doc, clock, end + 60_000);
  assert(raced);
  assertEquals(doc.content, "x" + ESSAY);
  assertEquals(doc.writes.length, store.row.total_chunks);
});

Deno.test("when the document can't tell whether a part landed, the user is asked", async () => {
  const text = "Yes. Yes. Yes. Done.";
  const { clock, doc, store, end } = setup(text, { minutes: 5 });
  // The 2nd "Yes. " lands, the worker dies, and someone edits elsewhere: the
  // document ends with both "Yes. " and "Yes. Yes. ", so it can't tell.
  store.failConfirms = 0;
  const first = plannedAt(store.row, 1);
  clock.at(first - 1, () => void (store.failConfirms = 1));
  clock.at(first + 1, () => doc.edit("Title\n" + doc.content));
  await runWorker(store, doc, clock, end + 5 * 60_000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "confirm_last_part");

  assert((await store.resume(doc, { last_part: "present" })).ok);
  await runWorker(store, doc, clock, clock.now + 30 * 60_000);
  assertEquals(doc.content, "Title\n" + text);
});

Deno.test("lost Google access and a deleted document pause with a reason", async () => {
  for (
    const [error, attention] of [
      [new ProviderError("auth", "invalid_grant", 401), "reconnect"],
      [new ProviderError("permanent", "not found", 404), "document_unavailable"],
    ] as const
  ) {
    const { clock, doc, store } = setup("One. Two. Three.", { minutes: 5 });
    doc.failures.read = [{ error }];
    await runWorker(store, doc, clock, T0 + 10 * 60_000);
    assertEquals(store.row.status, "paused");
    assertEquals(store.row.attention, attention);
    assertEquals(doc.writes.length, 0);
    assertEquals(store.kinds().slice(-2), ["attention", "paused"]);
  }
});

Deno.test("slow Google responses still land on time without tick-boundary delays", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { unit: "word", minutes: 30 });
  doc.latencyMs = 1_800;
  await runWorker(store, doc, clock, end + 120_000);
  assertEquals(doc.content, ESSAY);
  const late = doc.writes.map((w, i) => w.at - plannedAt(store.row, i));
  // Each write lands one read plus half a request after its planned time.
  assert(late.every((ms) => ms <= 2_700), `max late ${Math.max(...late)} ms`);
  assertEquals(store.kinds().includes("schedule_shifted"), false);
});

Deno.test("fuzz: crashes, lost answers, outages, pauses and edits elsewhere never duplicate or skip text", async () => {
  const words = ["river", "rose", "émoji", "👍🏽", "中文", "a", "the", "bridge"];
  for (let seed = 1; seed <= 60; seed++) {
    const random = seededRandom(seed);
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
    let text = "";
    const sentences = 3 + Math.floor(random() * 10);
    for (let i = 0; i < sentences; i++) {
      text += Array.from({ length: 1 + Math.floor(random() * 6) }, () => pick(words)).join(" ") +
        pick([". ", "! ", "? ", ".\n\n", "。"]);
    }
    const unit = pick(["sentence", "word", "character"] as const);
    const minutes = unit === "character" ? 90 : 20;
    const { clock, doc, store, end } = setup(text, { unit, minutes, initial: "Heading\n", seed });

    // Disruptions at random moments.
    for (let k = 0; k < 6; k++) {
      const at = T0 + Math.floor(random() * minutes * 60_000);
      const what = pick(["crash", "lost", "outage", "pause", "edit"]);
      clock.at(at, () => {
        if (what === "crash") store.failConfirms++;
        if (what === "lost") {
          (doc.failures.write ??= []).push({ error: new ProviderError("transient", "timeout"), applied: true });
        }
        if (what === "outage") (doc.failures.read ??= []).push({ error: new ProviderError("transient", "503", 503) });
        if (what === "edit") doc.edit(doc.content.replace(/^Heading/, "Heading!"));
        if (what === "pause" && store.pause()) {
          clock.at(at + Math.floor(random() * 600_000), () => store.resume(doc).then(() => {}, () => {}));
        }
      });
    }
    await runWorker(store, doc, clock, end + 6 * 3600_000);
    // Paused sessions are resumed as a user would, answering the question a resume asks.
    let asked: boolean = false;
    for (let tries = 0; store.row.status === "paused" && tries < 5; tries++) {
      const confirm: boolean = asked || store.row.attention === "confirm_last_part";
      const answer: ResumeOptions = confirm ? { last_part: "present" } : {};
      // A failed resume is simply tried again.
      const result: ResumeResult | null = await store.resume(doc, answer).catch(() => null);
      asked = result !== null && !result.ok && result.attention === "confirm_last_part";
      await runWorker(store, doc, clock, clock.now + 6 * 3600_000);
    }

    assertEquals(store.row.status, "completed", `seed ${seed}: ${store.row.attention} ${store.row.last_error}`);
    assert(/^Heading!*\n/.test(doc.content), `seed ${seed}`);
    assertEquals(doc.content.replace(/^Heading!*\n/, ""), text, `seed ${seed} (${unit})`);
    assertEquals(store.row.chunks_written, store.row.total_chunks);
    const times = doc.writes.map((w) => w.at);
    assert(gaps(times).every((g) => g >= MIN_GAP_SECONDS * 1000 - 1), `seed ${seed} min gap`);
  }
});

Deno.test("the first run checks the connection and pauses if the document isn't editable", async () => {
  const { clock, doc, store, end } = setup("One. Two. Three.", { minutes: 5 });
  doc.editable = false;
  await runWorker(store, doc, clock, end + 60_000);
  assertEquals([store.row.status, store.row.attention], ["paused", "not_editable"]);
  assertEquals(doc.writes.length, 0);
  assertEquals(store.events[0].kind, "connection_checked");
  assertEquals(store.events[0].detail.ok, false);

  doc.editable = true;
  assert((await store.resume(doc)).ok);
  await runWorker(store, doc, clock, clock.now + 30 * 60_000);
  assertEquals(doc.content, "One. Two. Three.");
  // The check runs once per session, before the first insertion.
  assertEquals(store.kinds().filter((k) => k === "connection_checked").length, 2);
});

Deno.test("an insertion whose answer was lost is logged as uncertain, then confirmed from the document", async () => {
  const { clock, doc, store, end } = setup("One. Two. Three.", { minutes: 5 });
  doc.failures.write = [{ error: new ProviderError("transient", "timeout"), applied: true }];
  await runWorker(store, doc, clock, end + 30 * 60_000);
  const kinds = store.kinds();
  const uncertain = kinds.indexOf("insertion_uncertain");
  assert(uncertain >= 0);
  const recovered = store.events.findIndex((e) => e.kind === "chunk_written" && e.detail.recovered === true);
  assert(recovered > uncertain);
  assertEquals(doc.content, "One. Two. Three.");
  // The log holds counts and times, not the text.
  assert(!JSON.stringify(store.events).includes("Two."));
});

Deno.test("if the worker can't run for hours (sleep, outage), the rest is not entered in a burst", async () => {
  const { clock, doc, store, end } = setup(ESSAY, { minutes: 30 });
  const planned = store.row.chunks.map((_, i) => plannedAt(store.row, i));
  await runWorker(store, doc, clock, T0 + 10 * 60_000);
  const before = doc.writes.length;
  // No ticks at all for three hours.
  await clock.advanceTo(T0 + 3 * 3600_000 + 10 * 60_000);
  await runWorker(store, doc, clock, clock.now + 2 * 3600_000);
  assertEquals(doc.content, ESSAY);
  const times = doc.writes.map((w) => w.at);
  // After the gap, the remaining units keep their planned spacing.
  for (let i = before + 1; i < times.length; i++) {
    assert(Math.abs(times[i] - times[i - 1] - (planned[i] - planned[i - 1])) <= 1000, `gap ${i}`);
  }
  assert(store.kinds().includes("schedule_shifted"));
  assert(times.at(-1)! > end, "the finish moved later instead");
});

import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { Clock, FakeDoc, FakeStore, makeSession, type Row, runWorker, T0 } from "./fakes.ts";
import { computeProgress } from "../functions/_shared/progress.ts";
import { correctionDeleteCount, expectedTail, judgePending, planResume } from "../functions/_shared/session.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";

/** A visible typo, correction, false word and correction, without changing the final source. */
function draftingRow(clock: Clock): Row {
  const row = makeSession("Cat. Next.", { clock, minutes: 1 });
  Object.assign(row, {
    chunks: ["Xat", "", "Cat. ", "wrong ", "", "Next."],
    chunk_deletions: [0, 3, 0, 0, 6, 0],
    action_kinds: ["typo", "backspace", "correction", "false_start", "backspace", "correction"],
    source_chunks: ["Cat. ", "Next."],
    source_unit_ends: [3, 6],
    schedule: [4000, 8000, 12000, 16000, 20000, 24000],
    total_chunks: 6,
    next_run_at: new Date(clock.now + 4000).toISOString(),
  });
  return row;
}

class DraftDoc extends FakeDoc {
  edits: { kind: "insert" | "backspace"; after: string }[] = [];
  loseAt: number | null = null;
  rejectAt: number | null = null;
  rejectKind: "auth" | "transient" = "transient";
  calls = 0;

  private before() {
    this.calls++;
    if (this.calls === this.rejectAt) {
      throw new ProviderError(this.rejectKind, "request rejected", this.rejectKind === "auth" ? 401 : 429);
    }
  }
  private after(kind: "insert" | "backspace") {
    this.edits.push({ kind, after: this.content });
    if (this.calls === this.loseAt) throw new ProviderError("transient", "successful response lost");
  }
  override async insertAtEnd(id: string, text: string, revision?: string) {
    this.before();
    const result = await super.insertAtEnd(id, text, revision);
    this.after("insert");
    return result;
  }
  replaceTail(_id: string, remove: number, text: string, revision: string) {
    this.before();
    if (revision !== `r${this.revision}`) throw new ProviderError("conflict", "revision changed", 400);
    if (remove < 0 || remove > this.content.length) throw new ProviderError("permanent", "invalid deletion");
    this.content = this.content.slice(0, this.content.length - remove) + text;
    this.revision++;
    this.after("backspace");
    return Promise.resolve({ revisionId: `r${this.revision}` });
  }
}

function setup() {
  const clock = new Clock();
  const store = new FakeStore(draftingRow(clock), clock);
  const doc = new DraftDoc(clock, "Existing notes.\n");
  return { clock, store, doc };
}

Deno.test("drafting edits visibly insert and remove temporary text, finishing with exactly the source", async () => {
  const { clock, store, doc } = setup();
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.edits.map((e) => e.after), [
    "Existing notes.\nXat",
    "Existing notes.\n",
    "Existing notes.\nCat. ",
    "Existing notes.\nCat. wrong ",
    "Existing notes.\nCat. ",
    "Existing notes.\nCat. Next.",
  ]);
  assertEquals(doc.content, "Existing notes.\nCat. Next.");
  assertEquals(
    store.events.filter((e) => e.kind === "chunk_written").map((e) => e.detail.action_kind),
    store.row.action_kinds,
  );
  assertEquals(store.events.find((e) => e.kind === "completed")!.detail.document_is_baseline_plus_text, true);
  assertEquals(expectedTail(store.row, 6), "Cat. Next.");
});

Deno.test("lost successful responses during each insert, backspace and correction reconcile without duplicate edits", async () => {
  for (let action = 1; action <= 6; action++) {
    const { clock, store, doc } = setup();
    doc.loseAt = action;
    await runWorker(store, doc, clock, T0 + 20 * 60000);
    assertEquals(store.row.status, "completed", `action ${action}`);
    assertEquals(doc.content, "Existing notes.\nCat. Next.", `action ${action}`);
    assertEquals(doc.edits.length, 6, `action ${action}`);
    assert(store.events.some((e) => e.kind === "chunk_written" && e.detail.recovered === true));
  }
});

Deno.test("a crash after any successful edit recovers the exact execution cursor", async () => {
  for (let action = 1; action <= 6; action++) {
    const { clock, store, doc } = setup();
    const confirm = store.confirm.bind(store);
    let calls = 0;
    store.confirm = (...args) => ++calls === action ? Promise.reject(new Error("worker died")) : confirm(...args);
    await runWorker(store, doc, clock, T0 + 20 * 60000);
    assertEquals(store.row.status, "completed");
    assertEquals(doc.content, "Existing notes.\nCat. Next.");
    assertEquals(doc.edits.length, 6);
  }
});

Deno.test("pausing mid-effect keeps visible temporary text and resume preserves progress and source", async () => {
  const { clock, store, doc } = setup();
  clock.at(T0 + 6000, () => void store.pause());
  await runWorker(store, doc, clock, T0 + 60000);
  assertEquals(store.row.status, "paused");
  assertEquals(doc.content, "Existing notes.\nXat");
  const paused = computeProgress({ ...store.row, word_count: 2 }, new Date(clock.now));
  assertEquals(paused.temporary_edit_active, true);
  assertEquals(paused.written_text, "");
  assertEquals(paused.remaining_text, "Cat. Next.");
  assertEquals(paused.chunks_written, 0);
  assertEquals(paused.chunks_total, 2);
  assertEquals(paused.edits_written, 1);
  const resumed = await store.resume(doc);
  assert(resumed.ok);
  assertEquals(resumed.detail.shift_seconds, Math.ceil((clock.now - (T0 + 6000)) / 1000));
  await runWorker(store, doc, clock, T0 + 10 * 60000);
  assertEquals(store.row.status, "completed");
  assertEquals(doc.content, "Existing notes.\nCat. Next.");
});

Deno.test("stopping mid-effect never edits afterwards or silently removes temporary content", async () => {
  const { clock, store, doc } = setup();
  clock.at(T0 + 6000, () => store.cancel());
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "canceled");
  assertEquals(doc.content, "Existing notes.\nXat");
  assertEquals(doc.edits.length, 1);
});

Deno.test("concurrent user text is never removed by a pending backspace", async () => {
  const { clock, store, doc } = setup();
  clock.at(T0 + 6000, () => doc.edit(doc.content + "USER TEXT"));
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "document_changed");
  assertEquals(doc.edits.length, 1);
  assert(doc.content.endsWith("XatUSER TEXT"));
  const resume = planResume(store.row, clock.now, await doc.readDocument(), { continue_from_current_end: true });
  assertEquals(resume.ok, false);
});

Deno.test("deletion ownership excludes approved text and resync anchors", () => {
  const clock = new Clock();
  const row = draftingRow(clock);
  assertEquals(correctionDeleteCount(row, 1), 3);
  assertEquals(correctionDeleteCount(row, 4), 6);
  row.chunk_deletions![4] = 7;
  let refused = false;
  try {
    correctionDeleteCount(row, 4);
  } catch {
    refused = true;
  }
  assert(refused);
  row.chunk_deletions![4] = 6;
  row.resync_index = 4;
  refused = false;
  try {
    correctionDeleteCount(row, 4);
  } catch {
    refused = true;
  }
  assert(refused);
});

Deno.test("an uncertain deletion with an empty resulting tail needs length evidence", () => {
  const row = draftingRow(new Clock());
  row.pending_revision = "r2";
  row.pending_doc_length = 18;
  assertEquals(judgePending(row, 1, { revisionId: "r3", text: "User replaced content\n" }), "ambiguous");
});

Deno.test("an ambiguous simulated edit cannot be forced to skip a deletion proof", () => {
  const row = draftingRow(new Clock());
  row.pending_index = 1;
  row.pending_revision = "r2";
  row.pending_doc_length = 18;
  row.chunks_written = 1;
  const result = planResume({ ...row, attention: "confirm_last_part" }, T0 + 60000, {
    revisionId: "r3",
    text: "Different user text\n",
  }, { last_part: "present" });
  assertEquals(result.ok, false);
});

Deno.test("auth and rate-limit failures preserve execution and never skip corrections", async () => {
  for (const kind of ["auth", "transient"] as const) {
    const { clock, store, doc } = setup();
    doc.rejectAt = 2;
    doc.rejectKind = kind;
    await runWorker(store, doc, clock, T0 + 180000);
    if (kind === "auth") {
      assertEquals(store.row.status, "paused");
      assertEquals(store.row.chunks_written, 1);
      assertEquals(store.row.attention, "reconnect");
      assert((await store.resume(doc)).ok);
      await runWorker(store, doc, clock, T0 + 10 * 60000);
    }
    assertEquals(doc.content, "Existing notes.\nCat. Next.");
    assertEquals(doc.edits.length, 6);
  }
});

Deno.test("completion remains unconfirmed when final verification fails", async () => {
  const { clock, store, doc } = setup();
  const read = doc.readDocument.bind(doc);
  doc.readDocument = () =>
    store.row.chunks_written === store.row.total_chunks
      ? Promise.reject(new ProviderError("transient", "offline during completion"))
      : read();
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "unreachable");
  assertEquals(doc.content, "Existing notes.\nCat. Next.");
  assert(!store.events.some((e) => e.kind === "completed"));
});

Deno.test("typing after a correction read makes the conditional backspace refuse the edit", async () => {
  const { clock, store, doc } = setup();
  const replace = doc.replaceTail.bind(doc);
  let changed = false;
  doc.replaceTail = (...args) => {
    if (!changed) {
      changed = true;
      doc.edit(doc.content + "USER");
    }
    return replace(...args);
  };
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "document_changed");
  assertEquals(doc.content, "Existing notes.\nXatUSER");
  assertEquals(doc.edits.length, 1);
});

Deno.test("final verification cannot complete a document whose approved end changed", async () => {
  const { clock, store, doc } = setup();
  const insert = doc.insertAtEnd.bind(doc);
  doc.insertAtEnd = async (...args) => {
    const result = await insert(...args);
    if (doc.calls === 6) doc.edit(doc.content + "CHANGED");
    return result;
  };
  await runWorker(store, doc, clock, T0 + 180000);
  assertEquals(store.row.status, "paused");
  assertEquals(store.row.attention, "document_changed");
  assert(!store.events.some((e) => e.kind === "completed"));
});

Deno.test("progress stops identifying temporary text after the backspace removes it", () => {
  const row = draftingRow(new Clock());
  row.chunks_written = 4;
  assertEquals(computeProgress({ ...row, word_count: 2 }, new Date(T0)).temporary_edit_active, true);
  row.chunks_written = 5;
  const progress = computeProgress({ ...row, word_count: 2 }, new Date(T0));
  assertEquals(progress.temporary_edit_active, false);
  assertEquals(progress.written_text, "Cat. ");
  assertEquals(progress.chunks_written, 1);
  assertEquals(progress.remaining_text, "Next.");
});

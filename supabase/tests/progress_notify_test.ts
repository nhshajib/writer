import { assertEquals } from "jsr:@std/assert@1.0.13";
import { computeProgress, type ProgressInput } from "../functions/_shared/progress.ts";
import { buildEmail, buildNotification, sendEmail } from "../functions/_shared/notify.ts";

const NOW = new Date("2026-10-17T12:00:00Z");
const STARTED = "2026-10-17T11:50:00Z";

function drip(overrides: Partial<ProgressInput> = {}): ProgressInput {
  return {
    status: "running",
    chunks: ["One two. ", "Three four. ", "Five six. ", "Seven eight. ", "Nine ten."],
    chunks_written: 2,
    total_chunks: 5,
    word_count: 10,
    // Planned 2, 6, 10.7, 13 and 15 minutes after the start.
    schedule: [120_000, 360_000, 642_000, 780_000, 900_000],
    session_started_at: STARTED,
    schedule_shift_seconds: 0,
    paused_at: null,
    last_written_at: "2026-10-17T11:56:00Z",
    next_run_at: "2026-10-17T12:00:42Z",
    completed_at: null,
    ...overrides,
  };
}

Deno.test("progress for a running session follows its schedule", () => {
  const p = computeProgress(drip(), NOW);
  assertEquals(p.written_text, "One two. Three four. ");
  assertEquals(p.remaining_text, "Five six. Seven eight. Nine ten.");
  assertEquals(p.words_written, 4);
  assertEquals(p.percent, 39);
  assertEquals(p.next_chunk_at, "2026-10-17T12:00:42.000Z");
  assertEquals(p.seconds_until_next_chunk, 42);
  assertEquals(p.finish_at, "2026-10-17T12:05:00.000Z");
});

Deno.test("a shifted schedule moves the next insertion and the finish", () => {
  const p = computeProgress(drip({ schedule_shift_seconds: 300 }), NOW);
  assertEquals(p.next_chunk_at, "2026-10-17T12:05:42.000Z");
  assertEquals(p.finish_at, "2026-10-17T12:10:00.000Z");
});

Deno.test("the minimum gap after the last insertion is respected in the countdown", () => {
  const p = computeProgress(drip({ last_written_at: "2026-10-17T12:00:40Z" }), NOW);
  assertEquals(p.next_chunk_at, "2026-10-17T12:00:44.000Z");
});

Deno.test("progress for a completed session", () => {
  const p = computeProgress(
    drip({ status: "completed", chunks_written: 5, next_run_at: null, completed_at: "2026-10-17T11:59:00Z" }),
    NOW,
  );
  assertEquals(p.percent, 100);
  assertEquals(p.remaining_text, "");
  assertEquals(p.next_chunk_at, null);
  assertEquals(p.seconds_until_next_chunk, null);
  assertEquals(p.finish_at, "2026-10-17T11:59:00Z");
});

Deno.test("a paused session shows when it would finish if resumed now", () => {
  const paused = computeProgress(drip({ status: "paused", next_run_at: null, paused_at: "2026-10-17T11:58:00Z" }), NOW);
  assertEquals([paused.next_chunk_at, paused.finish_at, paused.percent], [null, null, 39]);
  // Paused 2 minutes so far: the 12:05 finish becomes 12:07.
  assertEquals(paused.finish_if_resumed_now, "2026-10-17T12:07:00.000Z");

  const canceled = computeProgress(drip({ status: "canceled", next_run_at: null }), NOW);
  assertEquals([canceled.next_chunk_at, canceled.finish_at], [null, null]);

  const fresh = computeProgress(drip({ status: "scheduled", chunks_written: 0, last_written_at: null }), NOW);
  assertEquals([fresh.percent, fresh.written_text], [0, ""]);
});

Deno.test("countdown never goes negative", () => {
  const p = computeProgress(drip({ schedule: [120_000, 300_000, 400_000, 780_000, 900_000] }), NOW);
  assertEquals(p.seconds_until_next_chunk, 0);
});

Deno.test("sessions from before schedules existed still report progress", () => {
  const p = computeProgress(drip({ schedule: [], session_started_at: null }), NOW);
  assertEquals([p.chunks_written, p.next_chunk_at, p.finish_at], [2, null, null]);
});

const finished = {
  document_title: "My essay",
  document_url: "https://docs.google.com/document/d/abc/edit",
  word_count: 120,
  chunks_written: 5,
  total_chunks: 5,
  last_error: null,
};

Deno.test("notification text", () => {
  assertEquals(buildNotification("drip_completed", finished), {
    title: "Your text is fully written",
    body: 'All 120 words have been added to "My essay".',
  });
  const failed = buildNotification("drip_failed", {
    ...finished,
    chunks_written: 2,
    last_error: "The document account needs to be reconnected.",
  });
  assertEquals(failed.title, "Writing stopped because of an error");
  assertEquals(
    failed.body,
    'Writing into "My essay" stopped after 2 of 5 parts. The document account needs to be reconnected.',
  );
  assertEquals(
    buildNotification("drip_completed", { ...finished, document_title: null }).body.includes("your document"),
    true,
  );
  const attention = buildNotification("drip_attention", { ...finished, chunks_written: 3, last_error: "Reconnect." });
  assertEquals(attention.title, "Your session is paused and needs you");
  assertEquals(attention.body.includes("after 3 of 5 parts. Reconnect."), true);
});

Deno.test("email contains links and escapes HTML", () => {
  const email = buildEmail(
    { title: "T", body: 'Done with <b>"x"</b> & more' },
    finished,
    "https://typewit.example.com",
  );
  assertEquals(email.text.includes(finished.document_url), true);
  assertEquals(email.html.includes("<b>"), false);
  assertEquals(email.html.includes("&#60;b&#62;"), true);
  assertEquals(email.html.includes('href="https://typewit.example.com"'), true);
});

Deno.test("sendEmail skips without a key and reports provider outcomes", async () => {
  const message = { subject: "s", text: "t", html: "<p>t</p>" };
  assertEquals(await sendEmail("a@b.co", message, { from: "W <w@x.co>" }), "skipped");

  const calls: { url: string; init?: RequestInit }[] = [];
  const ok = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as unknown as typeof fetch;
  assertEquals(await sendEmail("a@b.co", message, { apiKey: "k", from: "W <w@x.co>" }, ok), "sent");
  assertEquals(calls[0].url, "https://api.resend.com/emails");
  assertEquals(JSON.parse(String(calls[0].init?.body)).to, ["a@b.co"]);
  assertEquals((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer k");

  const bad = (() => Promise.resolve(new Response("nope", { status: 422 }))) as unknown as typeof fetch;
  assertEquals(await sendEmail("a@b.co", message, { apiKey: "k", from: "f" }, bad), "failed");

  const down = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  assertEquals(await sendEmail("a@b.co", message, { apiKey: "k", from: "f" }, down), "failed");
});

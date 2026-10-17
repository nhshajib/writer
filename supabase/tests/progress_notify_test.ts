import { assertEquals } from "jsr:@std/assert@1.0.13";
import { computeProgress, type ProgressInput } from "../functions/_shared/progress.ts";
import { buildEmail, buildNotification, sendEmail } from "../functions/_shared/notify.ts";
import { splitIntoChunks } from "../functions/_shared/chunker.ts";
import { runDripStep } from "../functions/_shared/tick.ts";
import type { DocProvider } from "../functions/_shared/providers/types.ts";

const NOW = new Date("2026-10-17T12:00:00Z");

function drip(overrides: Partial<ProgressInput> = {}): ProgressInput {
  const chunks = splitIntoChunks("one two three four five six seven eight nine ten", 5);
  return {
    status: "running",
    chunks,
    chunks_written: 2,
    total_chunks: 5,
    interval_seconds: 60,
    word_count: 10,
    next_run_at: "2026-10-17T12:00:42Z",
    completed_at: null,
    ...overrides,
  };
}

Deno.test("progress for a running drip", () => {
  const p = computeProgress(drip(), NOW);
  assertEquals(p.written_text, "one two three four ");
  assertEquals(p.words_written, 4);
  assertEquals(p.percent, 40);
  assertEquals(p.seconds_until_next_chunk, 42);
  assertEquals(p.next_chunk_at, "2026-10-17T12:00:42Z");
  // 3 chunks remain: the next at +42s, the last two minutes after that.
  assertEquals(p.finish_at, "2026-10-17T12:02:42.000Z");
});

Deno.test("progress for a completed drip", () => {
  const p = computeProgress(
    drip({ status: "completed", chunks_written: 5, next_run_at: null, completed_at: "2026-10-17T11:59:00Z" }),
    NOW,
  );
  assertEquals(p.percent, 100);
  assertEquals(p.next_chunk_at, null);
  assertEquals(p.seconds_until_next_chunk, null);
  assertEquals(p.finish_at, "2026-10-17T11:59:00Z");
});

Deno.test("progress for paused, failed and not-yet-started drips", () => {
  const paused = computeProgress(drip({ status: "paused", next_run_at: null }), NOW);
  assertEquals([paused.next_chunk_at, paused.finish_at, paused.percent], [null, null, 40]);

  const failed = computeProgress(drip({ status: "failed", next_run_at: null }), NOW);
  assertEquals(failed.next_chunk_at, null);

  const fresh = computeProgress(drip({ status: "scheduled", chunks_written: 0 }), NOW);
  assertEquals([fresh.percent, fresh.written_text], [0, ""]);
});

Deno.test("countdown never goes negative", () => {
  const p = computeProgress(drip({ next_run_at: "2026-10-17T11:59:50Z" }), NOW);
  assertEquals(p.seconds_until_next_chunk, 0);
});

Deno.test("chunk_written events carry live progress", async () => {
  const provider = { appendText: () => Promise.resolve() } as unknown as DocProvider;
  const chunks = splitIntoChunks("a b c", 3);
  const { events } = await runDripStep(
    {
      id: "d",
      user_id: "u",
      document_id: "x",
      chunks,
      total_chunks: 3,
      chunks_written: 1,
      interval_seconds: 60,
      attempts: 0,
    },
    provider,
    NOW,
  );
  assertEquals(events[0].detail, {
    index: 1,
    chars: 2,
    written: 2,
    total: 3,
    next_run_at: "2026-10-17T12:01:00.000Z",
  });
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
});

Deno.test("email contains links and escapes HTML", () => {
  const email = buildEmail(
    { title: "T", body: 'Done with <b>"x"</b> & more' },
    finished,
    "https://writer.example.com",
  );
  assertEquals(email.text.includes(finished.document_url), true);
  assertEquals(email.html.includes("<b>"), false);
  assertEquals(email.html.includes("&#60;b&#62;"), true);
  assertEquals(email.html.includes('href="https://writer.example.com"'), true);
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

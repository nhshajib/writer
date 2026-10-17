import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { splitIntoChunks } from "../functions/_shared/chunker.ts";
import { type DripRow, MAX_ATTEMPTS, runDripStep } from "../functions/_shared/tick.ts";
import { type DocInfo, type DocProvider, ProviderError } from "../functions/_shared/providers/types.ts";
import { GoogleDocsProvider } from "../functions/_shared/providers/google.ts";

class FakeProvider implements DocProvider {
  readonly name = "test" as const;
  content = "";
  failures: ProviderError[] = [];

  createDoc(title: string): Promise<DocInfo> {
    return Promise.resolve({ id: "doc", title, url: null });
  }
  getDoc(id: string): Promise<DocInfo> {
    return Promise.resolve({ id, title: "Doc", url: null });
  }
  appendText(_id: string, text: string): Promise<void> {
    const failure = this.failures.shift();
    if (failure) return Promise.reject(failure);
    this.content += text;
    return Promise.resolve();
  }
}

function makeDrip(text: string, steps: number, interval = 60): DripRow {
  const chunks = splitIntoChunks(text, steps);
  return {
    id: "d1",
    user_id: "u1",
    document_id: "doc",
    chunks,
    total_chunks: chunks.length,
    chunks_written: 0,
    interval_seconds: interval,
    attempts: 0,
  };
}

const T0 = new Date("2026-10-17T00:00:00Z");

Deno.test("runs a drip to completion and reproduces the text", async () => {
  const text = "The quick brown fox\njumps over the lazy dog.";
  let drip = makeDrip(text, 4);
  const provider = new FakeProvider();
  let now = T0;

  for (let i = 0; i < 4; i++) {
    const { update } = await runDripStep(drip, provider, now);
    drip = { ...drip, chunks_written: update.chunks_written, attempts: update.attempts };
    if (i < 3) {
      assertEquals(update.status, "running");
      assertEquals(update.next_run_at, new Date(now.getTime() + 60_000).toISOString());
    } else {
      assertEquals(update.status, "completed");
      assertEquals(update.next_run_at, null);
      assertEquals(update.completed_at, now.toISOString());
    }
    now = new Date(now.getTime() + 60_000);
  }
  assertEquals(provider.content, text);
});

Deno.test("transient errors back off and keep progress", async () => {
  const drip = makeDrip("one two three", 3);
  const provider = new FakeProvider();
  provider.failures.push(new ProviderError("transient", "rate limited", 429));

  const { update, events } = await runDripStep(drip, provider, T0);
  assertEquals(update.status, "running");
  assertEquals(update.chunks_written, 0);
  assertEquals(update.attempts, 1);
  assertEquals(update.next_run_at, new Date(T0.getTime() + 60_000).toISOString());
  assertEquals(events[0].kind, "retry_scheduled");

  const next = await runDripStep({ ...drip, attempts: 1 }, provider, T0);
  assertEquals(next.update.chunks_written, 1);
  assertEquals(next.update.attempts, 0);
  assertEquals(provider.content, "one ");
});

Deno.test("gives up after MAX_ATTEMPTS transient failures", async () => {
  const drip = { ...makeDrip("one two", 2), attempts: MAX_ATTEMPTS - 1 };
  const provider = new FakeProvider();
  provider.failures.push(new ProviderError("transient", "server error", 503));
  const { update } = await runDripStep(drip, provider, T0);
  assertEquals(update.status, "failed");
  assertEquals(update.last_error, "server error");
});

Deno.test("auth and permanent errors fail immediately", async () => {
  for (const kind of ["auth", "permanent"] as const) {
    const provider = new FakeProvider();
    provider.failures.push(new ProviderError(kind, "nope", kind === "auth" ? 401 : 404));
    const { update } = await runDripStep(makeDrip("a b", 2), provider, T0);
    assertEquals(update.status, "failed");
    assertEquals(update.next_run_at, null);
  }
});

Deno.test("a drip whose chunks were all written completes without writing", async () => {
  const drip = { ...makeDrip("a b", 2), chunks_written: 2 };
  const provider = new FakeProvider();
  const { update } = await runDripStep(drip, provider, T0);
  assertEquals(update.status, "completed");
  assertEquals(provider.content, "");
});

// ---------------------------------------------------------------------------
// Google provider against a fake fetch
// ---------------------------------------------------------------------------

function fakeFetch(responses: Response[], calls: { url: string; init?: RequestInit }[]): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const res = responses.shift();
    return res ? Promise.resolve(res) : Promise.reject(new Error("unexpected request"));
  }) as typeof fetch;
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.test("Google appendText sends insertText at end of segment", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new GoogleDocsProvider(() => Promise.resolve("tok"), fakeFetch([jsonRes({})], calls));
  await provider.appendText("abc", "Hello ");

  assertEquals(calls[0].url, "https://docs.googleapis.com/v1/documents/abc:batchUpdate");
  assertEquals(JSON.parse(String(calls[0].init?.body)), {
    requests: [{ insertText: { text: "Hello ", endOfSegmentLocation: {} } }],
  });
  assertEquals((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer tok");
});

Deno.test("Google provider refreshes once on 401", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const forced: boolean[] = [];
  const provider = new GoogleDocsProvider(
    (force) => {
      forced.push(force);
      return Promise.resolve(force ? "fresh" : "stale");
    },
    fakeFetch([jsonRes({}, 401), jsonRes({ documentId: "abc", title: "My doc" })], calls),
  );
  const doc = await provider.getDoc("abc");
  assertEquals(forced, [false, true]);
  assertEquals(doc, { id: "abc", title: "My doc", url: "https://docs.google.com/document/d/abc/edit" });
});

Deno.test("Google provider classifies errors", async () => {
  const cases: [number, string][] = [[429, "transient"], [500, "transient"], [403, "permanent"], [404, "permanent"]];
  for (const [status, kind] of cases) {
    const provider = new GoogleDocsProvider(
      () => Promise.resolve("tok"),
      fakeFetch([jsonRes({ error: { message: "x" } }, status)], []),
    );
    const error = await assertRejects(() => provider.appendText("abc", "hi"), ProviderError);
    assertEquals(error.kind, kind);
  }

  const provider = new GoogleDocsProvider(
    () => Promise.resolve("tok"),
    fakeFetch([jsonRes({}, 401), jsonRes({}, 401)], []),
  );
  const error = await assertRejects(() => provider.appendText("abc", "hi"), ProviderError);
  assertEquals(error.kind, "auth");
});

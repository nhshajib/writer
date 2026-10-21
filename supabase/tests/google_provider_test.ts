import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { extractText, GoogleDocsProvider, revokeGoogleToken } from "../functions/_shared/providers/google.ts";
import { Clock, makeSession } from "./fakes.ts";
import { planResume } from "../functions/_shared/session.ts";
import { OBJECT_PLACEHOLDER, ProviderError } from "../functions/_shared/providers/types.ts";

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

Deno.test("insertAtEnd sends insertText at the end with the required revision", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("tok"),
    fakeFetch([jsonRes({ writeControl: { requiredRevisionId: "rev-2" } })], calls),
  );
  const result = await provider.insertAtEnd("abc", "Hello\tthere 👋\n", "rev-1");

  assertEquals(result, { revisionId: "rev-2" });
  assertEquals(calls[0].url, "https://docs.googleapis.com/v1/documents/abc:batchUpdate");
  assertEquals(JSON.parse(String(calls[0].init?.body)), {
    requests: [{ insertText: { text: "Hello\tthere 👋\n", endOfSegmentLocation: {} } }],
    writeControl: { requiredRevisionId: "rev-1" },
  });
  assertEquals((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer tok");
});

Deno.test("a refused conditional write is a conflict, not a permanent error", async () => {
  const refused = jsonRes({ error: { code: 400, status: "FAILED_PRECONDITION", message: "Revision mismatch" } }, 400);
  const provider = new GoogleDocsProvider(() => Promise.resolve("tok"), fakeFetch([refused], []));
  const error = await assertRejects(() => provider.insertAtEnd("abc", "x", "rev-1"), ProviderError);
  assertEquals(error.kind, "conflict");

  // The same status without a required revision is a real bad request.
  const plain = new GoogleDocsProvider(
    () => Promise.resolve("tok"),
    fakeFetch([jsonRes({ error: { message: "Invalid requests" } }, 400)], []),
  );
  assertEquals((await assertRejects(() => plain.insertAtEnd("abc", "x"), ProviderError)).kind, "permanent");
});

Deno.test("readDocument returns the exact body text and marks non-text elements", async () => {
  const body = {
    revisionId: "rev-9",
    body: {
      content: [
        { sectionBreak: {} },
        { paragraph: { elements: [{ textRun: { content: "Intro\n" } }] } },
        {
          table: {
            tableRows: [{
              tableCells: [{ content: [{ paragraph: { elements: [{ textRun: { content: "cell\n" } }] } }] }],
            }],
          },
        },
        {
          paragraph: {
            elements: [{ textRun: { content: "Tab\there, " } }, { inlineObjectElement: {} }, {
              textRun: { content: "emoji 👨‍👩‍👧\n" },
            }],
          },
        },
      ],
    },
  };
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new GoogleDocsProvider(() => Promise.resolve("tok"), fakeFetch([jsonRes(body)], calls));
  const doc = await provider.readDocument("abc");
  assertEquals(doc, { revisionId: "rev-9", text: "Intro\n\uFFFCcell\nTab\there, \uFFFCemoji 👨‍👩‍👧\n" });
  assertEquals(calls[0].url, "https://docs.googleapis.com/v1/documents/abc?fields=revisionId,body");
  assertEquals(extractText([]), "");
});

Deno.test("summarizeRevisions counts Drive revisions inside the session", async () => {
  const provider = new GoogleDocsProvider(
    () => Promise.resolve("tok"),
    fakeFetch([
      jsonRes({ nextPageToken: "p2", revisions: [{ modifiedTime: "2026-10-19T08:00:00Z" }] }),
      jsonRes({ revisions: [{ modifiedTime: "2026-10-19T09:10:00Z" }, { modifiedTime: "2026-10-19T09:40:00Z" }] }),
    ], []),
  );
  assertEquals(await provider.summarizeRevisions("abc", "2026-10-19T09:00:00Z", "2026-10-19T10:00:00Z"), {
    count: 3,
    in_window: 2,
    first_modified: "2026-10-19T08:00:00Z",
    last_modified: "2026-10-19T09:40:00Z",
  });
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
    const error = await assertRejects(() => provider.insertAtEnd("abc", "hi"), ProviderError);
    assertEquals(error.kind, kind);
  }

  const provider = new GoogleDocsProvider(
    () => Promise.resolve("tok"),
    fakeFetch([jsonRes({}, 401), jsonRes({}, 401)], []),
  );
  const error = await assertRejects(() => provider.insertAtEnd("abc", "hi"), ProviderError);
  assertEquals(error.kind, "auth");
});

Deno.test("revokeGoogleToken posts the token and reports the result", async () => {
  let body = "";
  const ok = await revokeGoogleToken("refresh-123", (_url, init) => {
    body = String(init?.body);
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  assertEquals(ok, true);
  assertEquals(body, "token=refresh-123");

  const failed = await revokeGoogleToken("x", () => Promise.resolve(new Response("{}", { status: 400 })));
  assertEquals(failed, false);
  const offline = await revokeGoogleToken("x", () => Promise.reject(new Error("offline")));
  assertEquals(offline, false);
});

Deno.test("non-text marker is exactly U+FFFC after serialization", () => {
  assertEquals(OBJECT_PLACEHOLDER.length, 1);
  assertEquals(OBJECT_PLACEHOLDER.codePointAt(0), 0xfffc);
  assertEquals(JSON.parse(JSON.stringify({ marker: OBJECT_PLACEHOLDER })).marker, String.fromCodePoint(0xfffc));
});

Deno.test("resume preserves an existing image anchor but refuses an image added after confirmed text", async () => {
  const clock = new Clock();
  const row = {
    ...makeSession("First sentence. Second sentence.", { clock }),
    chunks_written: 1,
    status: "paused",
    paused_at: new Date(clock.now).toISOString(),
    attention: "document_changed",
    resync_tail: "Existing " + String.fromCodePoint(0xfffc),
  };
  for (const imageAfterText of [false, true]) {
    const elements = [
      { textRun: { content: "Existing " } },
      { inlineObjectElement: { inlineObjectId: "existing-image" } },
      { textRun: { content: row.chunks[0] } },
      ...(imageAfterText ? [{ inlineObjectElement: { inlineObjectId: "new-image" } }] : []),
      { textRun: { content: "\n" } },
    ];
    const provider = new GoogleDocsProvider(
      () => Promise.resolve("tok"),
      fakeFetch([
        jsonRes({ revisionId: "image-revision", body: { content: [{ paragraph: { elements } }] } }),
      ], []),
    );
    const doc = await provider.readDocument("abc");
    const resumed = planResume(row, clock.now + 60_000, doc, {});
    assertEquals(resumed.ok, !imageAfterText);
    if (!resumed.ok) assertEquals(resumed.attention, "document_changed");
    else assertEquals(resumed.patch.schedule_shift_seconds, 60);
  }
});

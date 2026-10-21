import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { GoogleDocsProvider } from "../functions/_shared/providers/google.ts";
import { TestDocProvider } from "../functions/_shared/providers/test.ts";
import { textRevision, WordDocProvider, type WordHost, wordText } from "../functions/_shared/providers/word.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function paragraph(text: string, start = 1, heading?: { headingId: string; namedStyleType: string }) {
  return {
    startIndex: start,
    endIndex: start + text.length,
    paragraph: { elements: [{ textRun: { content: text } }], ...(heading ? { paragraphStyle: heading } : {}) },
  };
}
function google(
  responses: (Response | Error)[],
  calls: { url: string; init?: RequestInit }[],
  target: ConstructorParameters<typeof GoogleDocsProvider>[2] = null,
) {
  return new GoogleDocsProvider(
    () => Promise.resolve("token"),
    ((url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      return next instanceof Error
        ? Promise.reject(next)
        : next
        ? Promise.resolve(next)
        : Promise.reject(new Error("unexpected request"));
    }) as typeof fetch,
    target,
  );
}

Deno.test("drafting Google: backspace uses a guarded exact suffix range and preserves terminal newline", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = google([
    json({ revisionId: "r1", body: { content: [paragraph("Before wrpng\n")] } }),
    json({ writeControl: { requiredRevisionId: "r2" } }),
  ], calls);
  await provider.readDocument("doc");
  assertEquals(await provider.replaceTail("doc", 5, "wrong", "r1"), { revisionId: "r2" });
  assertEquals(JSON.parse(String(calls[1].init?.body)), {
    requests: [
      { deleteContentRange: { range: { startIndex: 8, endIndex: 13 } } },
      { insertText: { text: "wrong", location: { index: 8 } } },
    ],
    writeControl: { requiredRevisionId: "r1" },
  });
});

Deno.test("drafting Google: deletion-only edit sends no empty insert and stays under target heading", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const target = { heading_id: "section", heading_text: "Title", level: 1 };
  const provider = google(
    [
      json({
        revisionId: "r1",
        body: {
          content: [
            paragraph("Title\n", 1, { headingId: "section", namedStyleType: "HEADING_1" }),
            paragraph("wrpng\n", 7),
            paragraph("Next\n", 13, { headingId: "next", namedStyleType: "HEADING_1" }),
            paragraph("Other text\n", 18),
          ],
        },
      }),
      json({ writeControl: { requiredRevisionId: "r2" } }),
    ],
    calls,
    target,
  );
  await provider.readDocument("doc");
  await provider.replaceTail("doc", 5, "", "r1");
  assertEquals(JSON.parse(String(calls[1].init?.body)).requests, [{
    deleteContentRange: { range: { startIndex: 7, endIndex: 12 } },
  }]);
});

Deno.test("drafting Google: invalid counts, paragraph crossing and split emoji are rejected before edits", async () => {
  for (const count of [0, -1, 1.5, 99, 1]) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const provider = google([json({ revisionId: "r1", body: { content: [paragraph("👋\n")] } })], calls);
    await provider.readDocument("doc");
    const error = await assertRejects(() => provider.replaceTail("doc", count, "", "r1"), ProviderError);
    assertEquals(error.kind, "permanent");
    assertEquals(calls.length, 1);
  }
});

Deno.test("drafting Google: changed revision and uncertain write are classified without an unsafe retry", async () => {
  const changed = google([json({ revisionId: "r2", body: { content: [paragraph("wrong\n")] } })], []);
  assertEquals((await assertRejects(() => changed.replaceTail("doc", 5, "", "r1"), ProviderError)).kind, "conflict");
  const calls: { url: string; init?: RequestInit }[] = [];
  const uncertain = google([
    json({ revisionId: "r1", body: { content: [paragraph("wrong\n")] } }),
    new Error("response lost"),
  ], calls);
  await uncertain.readDocument("doc");
  assertEquals((await assertRejects(() => uncertain.replaceTail("doc", 5, "", "r1"), ProviderError)).kind, "transient");
  assertEquals(calls.length, 2); // no internal append/deletion retry
});

class DraftWord implements WordHost {
  lostResponse = false;
  constructor(public paragraphs = ["Before wrong"]) {}
  readParagraphs() {
    return Promise.resolve([...this.paragraphs]);
  }
  isEditable() {
    return Promise.resolve(true);
  }
  appendIf(check: (p: string[]) => boolean, lines: string[]) {
    if (!check(this.paragraphs)) return Promise.resolve(null);
    this.paragraphs[this.paragraphs.length - 1] += lines[0];
    this.paragraphs.push(...lines.slice(1));
    return Promise.resolve([...this.paragraphs]);
  }
  replaceTailIf(check: (p: string[]) => boolean, count: number, text: string) {
    if (!check(this.paragraphs)) return Promise.resolve(null);
    const last = this.paragraphs.length - 1;
    if (count > this.paragraphs[last].length) throw new ProviderError("permanent", "range");
    this.paragraphs[last] = this.paragraphs[last].slice(0, -count) + text;
    if (this.lostResponse) {
      this.lostResponse = false;
      return Promise.reject(new ProviderError("transient", "response lost"));
    }
    return Promise.resolve([...this.paragraphs]);
  }
}

Deno.test("drafting Word: guarded suffix edits preserve preexisting content and document binding", async () => {
  const host = new DraftWord(["Title", "Before wrong"]);
  const provider = new WordDocProvider(host, "doc", "Doc");
  const doc = await provider.readDocument("doc");
  const result = await provider.replaceTail("doc", 5, "right", doc.revisionId);
  assertEquals(host.paragraphs, ["Title", "Before right"]);
  assertEquals(result.revisionId, textRevision(wordText(host.paragraphs)));
  assertEquals(
    (await assertRejects(() => provider.replaceTail("other", 1, "", result.revisionId!), ProviderError)).kind,
    "permanent",
  );
  host.paragraphs[1] += " own note";
  assertEquals(
    (await assertRejects(() => provider.replaceTail("doc", 5, "", result.revisionId!), ProviderError)).kind,
    "conflict",
  );
  assertEquals(host.paragraphs[1], "Before right own note");
});

Deno.test("drafting Word: missing host capability fails explicitly; response loss is recoverable by read", async () => {
  const oldHost: WordHost = {
    readParagraphs: () => Promise.resolve(["Before wrong"]),
    appendIf: () => Promise.resolve(null),
    isEditable: () => Promise.resolve(true),
  };
  const old = new WordDocProvider(oldHost, "doc", "Doc");
  assertEquals((await assertRejects(() => old.replaceTail("doc", 5, "", "revision"), ProviderError)).kind, "permanent");
  const host = new DraftWord();
  const provider = new WordDocProvider(host, "doc", "Doc");
  const before = await provider.readDocument("doc");
  host.lostResponse = true;
  await assertRejects(() => provider.replaceTail("doc", 5, "right", before.revisionId), ProviderError);
  assertEquals((await provider.readDocument("doc")).text, "Before right\n");
  assertEquals(
    (await assertRejects(() => provider.replaceTail("doc", 5, "right", before.revisionId), ProviderError)).kind,
    "conflict",
  );
});

Deno.test("drafting test provider: passes owner, revision and UTF16 count to transactional RPC", async () => {
  let args: unknown;
  const provider = new TestDocProvider({
    rpc: (name: string, input: unknown) => {
      args = [name, input];
      return Promise.resolve({ data: 7, error: null });
    },
  } as unknown as SupabaseClient, "owner");
  assertEquals(await provider.replaceTail("doc", 2, "x", "6"), { revisionId: "7" });
  assertEquals(args, ["replace_test_document_tail_checked", {
    doc_id: "doc",
    owner_id: "owner",
    delete_utf16: 2,
    replacement: "x",
    required_revision: 6,
  }]);
});

Deno.test("drafting Google: explicit empty Markdown format resets inherited bold and italic on a correction", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = google([
    json({ revisionId: "r1", body: { content: [paragraph("Bold prefix\n")] } }),
    json({ writeControl: { requiredRevisionId: "r2" } }),
  ], calls);
  await provider.readDocument("doc");
  await provider.insertAtEnd("doc", " plain text", "r1", { paragraphs: [], spans: [] });
  assertEquals(JSON.parse(String(calls[1].init?.body)).requests, [
    { insertText: { text: " plain text", location: { index: 12 } } },
    {
      updateTextStyle: {
        range: { startIndex: 12, endIndex: 23 },
        textStyle: { bold: false, italic: false },
        fields: "bold,italic",
      },
    },
  ]);
});

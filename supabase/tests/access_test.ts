import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { checkAccess } from "../functions/_shared/access.ts";
import { ProviderError } from "../functions/_shared/providers/types.ts";
import { Clock, FakeDoc } from "./fakes.ts";

Deno.test("test connection passes without changing the document", async () => {
  const doc = new FakeDoc(new Clock(), "Existing text");
  const before = { content: doc.content, revision: doc.revision };
  const report = await checkAccess(doc, "doc");
  assertEquals(report.ok, true);
  assertEquals(report.checks.map((c) => [c.key, c.ok]), [["account", true], ["document", true], ["editable", true], [
    "location",
    true,
  ]]);
  assertEquals(report.content_unchanged, true);
  assertEquals({ content: doc.content, revision: doc.revision }, before);
  assertEquals(doc.writes.length, 0);
});

Deno.test("test connection names the specific problem", async () => {
  const cases: [ProviderError | "not_editable" | "location", string][] = [
    [new ProviderError("auth", "invalid_grant", 401), "permission_missing"],
    [new ProviderError("permanent", "not found", 404), "not_found"],
    [new ProviderError("permanent", "forbidden", 403), "permission_missing"],
    [new ProviderError("transient", "backend error", 503), "editor_unavailable"],
    [new ProviderError("transient", "fetch failed"), "connection_interrupted"],
    ["not_editable", "not_editable"],
    ["location", "location_uncertain"],
  ];
  for (const [failure, problem] of cases) {
    const doc = new FakeDoc(new Clock(), "Mine. Someone else's text");
    if (failure === "not_editable") doc.editable = false;
    else if (failure !== "location") doc.failures.read = [{ error: failure }];
    const report = await checkAccess(doc, "doc", failure === "location" ? "Mine. " : null);
    assertEquals([report.ok, report.problem], [false, problem], String(failure));
    assert(report.message.length > 20);
    assertEquals(doc.writes.length, 0);
  }
});

Deno.test("test connection says so when the document changes during the check", async () => {
  const doc = new FakeDoc(new Clock(), "Existing text");
  // Google gives a new revision id even for an edit that changes nothing; only the text counts.
  doc.probeEdit = (_id: string, revisionId: string) => {
    doc.edit(`${doc.content} typed meanwhile`);
    return Promise.resolve({ revisionId });
  };
  const report = await checkAccess(doc, "doc");
  assertEquals([report.ok, report.content_unchanged], [true, false]);
  assert(!report.message.includes("Nothing in the document was changed"));
});

Deno.test("test connection before a new document checks the account only", async () => {
  const report = await checkAccess(new FakeDoc(new Clock()), null);
  assertEquals(report.ok, true);
  assertEquals(report.checks.map((c) => c.key), ["account", "document"]);
});

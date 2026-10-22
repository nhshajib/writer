import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { splitText } from "../functions/_shared/chunker.ts";
import { compileDrafting, DEFAULT_DRAFTING, executionText } from "../functions/_shared/drafting.ts";
import { parseFormatted } from "../functions/_shared/markdown.ts";
import { planSession, standardPacing } from "../functions/_shared/plan.ts";
import { validatePacing } from "../functions/_shared/pacing.ts";

Deno.test("single-word entry survives preset normalization on Free, Day Pass and Pro", () => {
  const text = "  One\tword, then another.\n\nEmoji 👩🏽‍💻 stays.  ";
  for (const plan of ["free", "day_pass", "pro"] as const) {
    for (const rhythm of ["natural", "steady", ...(plan === "pro" ? ["drafting"] as const : [])] as const) {
      const result = planSession({
        text,
        unit: "word",
        seed: 7,
        plan,
        rhythm,
        pacing: { ...standardPacing(600), word_grouping: "single" },
      });
      assert(result.ok, JSON.stringify(result.problems));
      assertEquals(result.source_chunks, splitText(text, "word"));
      assertEquals(result.pacing?.word_grouping, "single");
      assertEquals(executionText(result.units, result.chunk_deletions, 0, result.units.length), text);
      assertEquals(result.schedule.at(-1), 600000);
    }
  }
});

Deno.test("omitted grouping keeps the exact legacy random split and invalid grouping is refused", () => {
  const request = { text: "Approved words. ".repeat(12), unit: "word" as const, seed: 8, plan: "pro" as const };
  const old = planSession({ ...request, pacing: standardPacing(600) });
  const explicit = planSession({ ...request, pacing: { ...standardPacing(600), word_grouping: "random" } });
  assertEquals(old.source_chunks, explicit.source_chunks);
  assertEquals(old.schedule, explicit.schedule);
  assert(old.source_chunks.some((s) => splitText(s, "word").length > 1));
  const invalid = { ...standardPacing(600), word_grouping: "invalid" as "single" };
  assert(validatePacing(invalid));
  assert(
    planSession({ ...request, plan: "free", rhythm: "natural", pacing: invalid }).problems.some((p) =>
      p.code === "invalid_settings"
    ),
  );
});

Deno.test("single words explain when a short duration cannot fit instead of merging words", () => {
  const result = planSession({
    text: "word ".repeat(100),
    unit: "word",
    seed: 2,
    plan: "free",
    rhythm: "steady",
    pacing: { ...standardPacing(60), word_grouping: "single" },
  });
  assert(!result.ok);
  assertEquals(result.source_chunks.length, 100);
  assert(result.problems.some((p) => p.code === "duration_too_short"));
});

Deno.test("multi-word final review restores every source boundary, rich spans and existing content", () => {
  const parsed = parseFormatted("**First approved phrase.**", "markdown")!;
  for (const chunks of [[parsed.plain], ["First ", "approved phrase."], ["👩🏽‍💻\n", "Approved phrase."]]) {
    const script = compileDrafting(
      chunks,
      { ...DEFAULT_DRAFTING, revision_sweep: true },
      7,
      chunks.join("") === parsed.plain ? parsed : null,
    );
    assert(script.chunk_deletions.filter((n) => n > 0).length >= 4);
    let from = 0;
    script.source_unit_ends.forEach((to, i) => {
      assertEquals(executionText(script.chunks, script.chunk_deletions, from, to), chunks[i]);
      from = to;
    });
    for (let to = 0; to <= script.chunks.length; to++) {
      assert(
        executionText(script.chunks, script.chunk_deletions, 0, to, "Existing collaborator notes.\n").startsWith(
          "Existing collaborator notes.\n",
        ),
      );
    }
    assertEquals(executionText(script.chunks, script.chunk_deletions, 0, script.chunks.length), chunks.join(""));
    assert(script.chunk_deletions.every((n) => n <= 128));
    if (script.chunk_formats) assert(script.chunk_formats.at(-1)?.spans.some((span) => span.bold));
  }
  const long = "word ".repeat(1000);
  const bounded = compileDrafting([long], { ...DEFAULT_DRAFTING, revision_sweep: true }, 7);
  assertEquals(bounded.chunks.length, 7); // source insertion plus at most three edit/restore pairs.
});

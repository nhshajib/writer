import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { validatePlanSource } from "../functions/_shared/input.ts";
import { HttpError } from "../functions/_shared/http.ts";
import { MAX_TEXT_CHARS } from "../functions/_shared/limits.ts";

Deno.test("security: source validation accepts the exact limit and refuses oversized text before planning", () => {
  validatePlanSource("");
  validatePlanSource("x".repeat(MAX_TEXT_CHARS));
  validatePlanSource(JSON.stringify({ plain: "<script>fixture</script>", paragraphs: [], spans: [] }));
  const error = assertThrows(() => validatePlanSource("x".repeat(MAX_TEXT_CHARS + 1)), HttpError);
  assertEquals(error.status, 400);
});

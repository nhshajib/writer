import { assertEquals } from "jsr:@std/assert@1.0.13";
import { groupEvenly, splitIntoUnits, tokenize } from "../functions/_shared/chunker.ts";
import { sha256Hex } from "../functions/_shared/crypto.ts";

const samples = [
  "First sentence. Second one! Third? Yes.",
  "Paragraph one.\n\nParagraph two has\nline breaks.\n\n\nParagraph three.",
  "No punctuation at all",
  "  Leading spaces. Trailing spaces.   ",
  'Quotes say "stop." Then go.',
  "Ünïcode — 中文。 Done! 🎉 Fine.",
];

Deno.test("sentence and paragraph splits keep every character", () => {
  for (const text of samples) {
    assertEquals(splitIntoUnits(text, "sentence").join(""), text);
    assertEquals(splitIntoUnits(text, "paragraph").join(""), text);
    assertEquals(groupEvenly(splitIntoUnits(text, "sentence"), 2).join(""), text);
  }
});

Deno.test("sentences split at sentence ends", () => {
  assertEquals(splitIntoUnits("First sentence. Second one! Third? Yes.", "sentence"), [
    "First sentence. ",
    "Second one! ",
    "Third? ",
    "Yes.",
  ]);
});

Deno.test("paragraphs split at blank lines", () => {
  assertEquals(splitIntoUnits("One.\n\nTwo\nlines.\n\nThree.", "paragraph"), [
    "One.\n\n",
    "Two\nlines.\n\n",
    "Three.",
  ]);
});

Deno.test("groupEvenly keeps units whole and sizes balanced", () => {
  const units = ["a ", "b ", "c ", "d ", "e "];
  assertEquals(groupEvenly(units, 2), ["a b c ", "d e "]);
  assertEquals(groupEvenly(units, 99), units);
  assertEquals(groupEvenly([], 3), []);
  assertEquals(tokenize("x y").length, 2);
});

Deno.test("sha256Hex matches a known digest", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assertEquals((await sha256Hex("a")) === (await sha256Hex("b")), false);
});

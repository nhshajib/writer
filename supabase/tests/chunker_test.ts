import { assertEquals } from "jsr:@std/assert@1.0.13";
import { countWords, splitIntoChunks, tokenize } from "../functions/_shared/chunker.ts";

const samples = [
  "Hello world",
  "  leading and trailing spaces  ",
  "Line one.\nLine two.\n\nNew paragraph\twith tab.",
  "Ünïcödé — émojis 🎉🎉 and 中文字符 mixed in.",
  "single",
  "a b c d e f g h i j k l m n o p q r s t u v w x y z",
];

Deno.test("tokenize round-trips exactly", () => {
  for (const text of samples) {
    assertEquals(tokenize(text).join(""), text);
  }
});

Deno.test("tokenize handles empty and whitespace-only text", () => {
  assertEquals(tokenize(""), []);
  assertEquals(tokenize("   \n\t "), []);
  assertEquals(countWords("  \n "), 0);
});

Deno.test("countWords counts whitespace-separated words", () => {
  assertEquals(countWords("Hello world"), 2);
  assertEquals(countWords("Line one.\nLine two.\n\nNew paragraph\twith tab."), 8);
});

Deno.test("splitIntoChunks round-trips for every chunk count", () => {
  for (const text of samples) {
    const words = countWords(text);
    for (let n = 1; n <= words + 2; n++) {
      const chunks = splitIntoChunks(text, n);
      assertEquals(chunks.join(""), text, `text=${JSON.stringify(text)} n=${n}`);
      assertEquals(chunks.length, Math.min(n, words));
    }
  }
});

Deno.test("splitIntoChunks keeps word counts within one of each other", () => {
  const text = Array.from({ length: 103 }, (_, i) => `w${i}`).join(" ");
  const sizes = splitIntoChunks(text, 10).map(countWords);
  assertEquals(sizes.reduce((a, b) => a + b, 0), 103);
  assertEquals(Math.max(...sizes) - Math.min(...sizes) <= 1, true);
});

Deno.test("splitIntoChunks clamps bad counts", () => {
  assertEquals(splitIntoChunks("a b c", 0), ["a b c"]);
  assertEquals(splitIntoChunks("a b c", -5), ["a b c"]);
  assertEquals(splitIntoChunks("", 3), []);
});

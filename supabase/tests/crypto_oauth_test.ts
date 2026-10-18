import { assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { decrypt, encrypt, safeEqual, sign, verify } from "../functions/_shared/crypto.ts";
import { allowedRedirect } from "../functions/_shared/oauth.ts";

Deno.test("encrypt/decrypt round-trip with random IVs", async () => {
  const a = await encrypt("ya29.secret-token", "key-1");
  const b = await encrypt("ya29.secret-token", "key-1");
  assertNotEquals(a, b);
  assertEquals(await decrypt(a, "key-1"), "ya29.secret-token");
});

Deno.test("decrypt fails with the wrong key or tampered data", async () => {
  const token = await encrypt("secret", "key-1");
  await assertRejects(() => decrypt(token, "key-2"));
  const [v, iv, data] = token.split(".");
  const flipped = data.slice(0, -2) + (data.at(-2) === "A" ? "B" : "A") + data.at(-1);
  await assertRejects(() => decrypt(`${v}.${iv}.${flipped}`, "key-1"));
});

Deno.test("sign/verify detects tampering", async () => {
  const token = await sign({ uid: "u1", exp: 123 }, "key");
  assertEquals(await verify(token, "key"), { uid: "u1", exp: 123 });
  assertEquals(await verify(token, "other"), null);
  const forged = (await sign({ uid: "attacker", exp: 123 }, "other")).split(".")[0] + "." + token.split(".")[1];
  assertEquals(await verify(forged, "key"), null);
  assertEquals(await verify("garbage", "key"), null);
});

Deno.test("safeEqual", () => {
  assertEquals(safeEqual("abc", "abc"), true);
  assertEquals(safeEqual("abc", "abd"), false);
  assertEquals(safeEqual("abc", "abcd"), false);
  assertEquals(safeEqual("", ""), true);
});

Deno.test("allowedRedirect only allows the app origin", () => {
  const app = "https://typewit.example.com";
  assertEquals(
    allowedRedirect("https://typewit.example.com/settings?x=1", app),
    "https://typewit.example.com/settings?x=1",
  );
  assertEquals(allowedRedirect("https://evil.example.com/", app), null);
  assertEquals(allowedRedirect("javascript:alert(1)", app), null);
  assertEquals(allowedRedirect("https://typewit.example.com/", undefined), null);
  assertEquals(allowedRedirect(null, app), null);
});

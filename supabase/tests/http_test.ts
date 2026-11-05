import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { allowedOrigin, HttpError, MAX_BODY_BYTES, readJson, readTextBounded } from "../functions/_shared/http.ts";
import { testProviderEnabled } from "../functions/_shared/env.ts";

Deno.test("body budget counts streamed bytes despite missing or dishonest length and cancels oversized reads", async () => {
  for (const length of [undefined, "0", "1"]) {
    let canceled = false;
    const req = new Request("https://edge.invalid", {
      method: "POST",
      headers: length === undefined ? {} : { "Content-Length": length },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("123456789"));
        },
        cancel() {
          canceled = true;
        },
      }),
    });
    const error = await assertRejects(() => readTextBounded(req, 8), HttpError);
    assertEquals(error.status, 413);
    assertEquals(canceled, true);
  }
});

Deno.test("body budget preserves exact signature text and UTF-8 characters split across stream chunks", async () => {
  const raw = ' { "text": "Approved 😀 text" }\n';
  const bytes = new TextEncoder().encode(raw);
  const req = new Request("https://edge.invalid", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
  });
  assertEquals(await readTextBounded(req, bytes.length), raw);
  const normal = { text: "x".repeat(200_000), spans: [{ start: 0, end: 200_000, bold: true }] };
  assertEquals(
    await readJson(new Request("https://edge.invalid", { method: "POST", body: JSON.stringify(normal) })),
    normal,
  );
  const oversized = new Request("https://edge.invalid", {
    method: "POST",
    headers: { "Content-Length": String(MAX_BODY_BYTES + 1) },
    body: "{}",
  });
  assertEquals((await assertRejects(() => readJson(oversized), HttpError)).status, 413);
});

Deno.test("second audit: request bodies must be JSON objects, not null or primitives", async () => {
  const request = (body: unknown) =>
    new Request("https://edge.invalid", { method: "POST", body: JSON.stringify(body) });
  for (const body of [null, [], 1, "text", false]) {
    const error = await assertRejects(() => readJson(request(body)), HttpError, "JSON object");
    assertEquals(error.status, 400);
  }
  assertEquals(await readJson(request({ text: "Approved text" })), { text: "Approved text" });
});

Deno.test("CORS allows the app, local development and configured extras only", () => {
  Deno.env.set("APP_URL", "https://app.example.com/");
  Deno.env.set("CORS_EXTRA_ORIGINS", "https://preview.example.net/, ");
  try {
    assertEquals(allowedOrigin("https://typewit.com"), "https://typewit.com");
    assertEquals(allowedOrigin("https://www.typewit.com"), "https://www.typewit.com");
    assertEquals(allowedOrigin("https://app.example.com"), "https://app.example.com");
    assertEquals(allowedOrigin("https://preview.example.net"), "https://preview.example.net");
    assertEquals(allowedOrigin("http://localhost:3000"), "http://localhost:3000");
    assertEquals(allowedOrigin("http://127.0.0.1"), "http://127.0.0.1");
    assertEquals(allowedOrigin("https://evil.example"), null);
    assertEquals(allowedOrigin("https://typewit.com.evil.example"), null);
    assertEquals(allowedOrigin("http://localhost.evil.example"), null);
    assertEquals(allowedOrigin(null), null);
  } finally {
    Deno.env.delete("APP_URL");
    Deno.env.delete("CORS_EXTRA_ORIGINS");
  }
});

Deno.test("the test provider is off unless explicitly turned on", () => {
  const before = Deno.env.get("ENABLE_TEST_PROVIDER");
  try {
    Deno.env.delete("ENABLE_TEST_PROVIDER");
    assertEquals(testProviderEnabled(), false);
    Deno.env.set("ENABLE_TEST_PROVIDER", "yes");
    assertEquals(testProviderEnabled(), false);
    Deno.env.set("ENABLE_TEST_PROVIDER", "true");
    assertEquals(testProviderEnabled(), true);
  } finally {
    if (before === undefined) Deno.env.delete("ENABLE_TEST_PROVIDER");
    else Deno.env.set("ENABLE_TEST_PROVIDER", before);
  }
});

Deno.test("email preferences: a master switch, then one choice per kind of update", async () => {
  const { wantsEmail } = await import("../functions/_shared/notifyUser.ts");
  assertEquals(wantsEmail(null, "drip_completed"), true);
  assertEquals(wantsEmail({ email_notifications: false, email_on_completed: true }, "drip_completed"), false);
  assertEquals(wantsEmail({ email_notifications: true, email_on_completed: false }, "drip_completed"), false);
  assertEquals(wantsEmail({ email_notifications: true, email_on_completed: false }, "drip_attention"), true);
  assertEquals(wantsEmail({ email_notifications: true, email_on_attention: false }, "drip_attention"), false);
});

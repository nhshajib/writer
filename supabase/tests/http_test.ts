import { assertEquals } from "jsr:@std/assert@1.0.13";
import { allowedOrigin } from "../functions/_shared/http.ts";
import { testProviderEnabled } from "../functions/_shared/env.ts";

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

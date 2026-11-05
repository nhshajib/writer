import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { acceptClientDiagnostic } from "../functions/_shared/clientDiagnostics.ts";
import { HttpError, serve } from "../functions/_shared/http.ts";

Deno.test("client diagnostics accept fixed categories only and never log supplied message/text fields", async () => {
  const original = console.error;
  const logs: unknown[][] = [];
  console.error = (...values: unknown[]) => {
    logs.push(values);
  };
  const valid = { kind: "runtime", surface: "dashboard", status: 0, release: "local" };
  const request = (body: unknown) =>
    new Request("https://edge.invalid", { method: "POST", body: JSON.stringify(body) });
  try {
    for (
      const bad of [
        { ...valid, text: "Fixture sensitive marker" },
        { ...valid, kind: ["runtime"] },
        { ...valid, status: 400 },
        { ...valid, release: "Fixture sensitive marker" },
        { ...valid, request_id: "fixture@example.invalid" },
      ]
    ) assertEquals((await assertRejects(() => acceptClientDiagnostic(request(bad)), HttpError)).status, 400);
    assertEquals(logs.length, 0);
    assertEquals(
      (await assertRejects(() => acceptClientDiagnostic(request({ ...valid, text: "x".repeat(3000) })), HttpError))
        .status,
      413,
    );
    assertEquals(await (await acceptClientDiagnostic(request(valid))).json(), { accepted: true });
    assertEquals(logs, [["typewit.client_error", { source: "client", ...valid }]]);
    assert(!JSON.stringify(logs).includes("Fixture sensitive marker"));
  } finally {
    console.error = original;
  }
});

Deno.test("server diagnostics correlate errors without raw messages and preserve redirects and friendly limits", async () => {
  const original = console.error, originalServe = Deno.serve;
  const logs: unknown[][] = [];
  let handler!: (req: Request) => Promise<Response>;
  console.error = (...values: unknown[]) => {
    logs.push(values);
  };
  Object.defineProperty(Deno, "serve", {
    value: (fn: typeof handler) => {
      handler = fn;
    },
    configurable: true,
    writable: true,
  });
  try {
    serve(() => Promise.reject(new Error("Fixture private failure message")));
    const response = await handler(new Request("https://edge.invalid/functions/v1/billing/private-fixture-marker"));
    assertEquals(response.status, 500);
    assert(response.headers.get("x-request-id"));
    assertEquals((logs[0][1] as { request_id: string }).request_id, response.headers.get("x-request-id"));
    assert(!JSON.stringify(logs).includes("private"));
    assertEquals(response.headers.get("access-control-expose-headers"), "x-request-id");
    logs.length = 0;
    serve(() => Promise.reject(new Error("active_drip_limit:3")));
    const limited = await handler(new Request("https://edge.invalid/functions/v1/drips"));
    assertEquals(limited.status, 422);
    assertEquals(logs.length, 0);
    serve(() => Promise.resolve(Response.redirect("https://example.invalid/back", 302)));
    const redirect = await handler(new Request("https://edge.invalid/functions/v1/google-oauth-callback"));
    assertEquals(redirect.status, 302);
    assertEquals(redirect.headers.get("location"), "https://example.invalid/back");
    assert(redirect.headers.get("x-request-id"));
  } finally {
    console.error = original;
    Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
  }
});

Deno.test("client diagnostic route requires a verified signed-in user", async () => {
  const originalServe = Deno.serve;
  let handler!: (req: Request) => Promise<Response>;
  Object.defineProperty(Deno, "serve", {
    value: (fn: typeof handler) => {
      handler = fn;
    },
    configurable: true,
    writable: true,
  });
  try {
    await import("../functions/drips/index.ts?diagnostics-auth-fixture");
    const response = await handler(
      new Request("https://edge.invalid/functions/v1/drips/client-errors", { method: "POST", body: "{}" }),
    );
    assertEquals(response.status, 401);
  } finally {
    Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
  }
});

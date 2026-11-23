import { assertEquals } from "jsr:@std/assert@1.0.13";

type Handler = (request: Request) => Promise<Response>;

Deno.test("security: another user's session cannot be read, paused or controlled by changing its ID", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map((name) => Deno.env.get(name));
  const originalFetch = globalThis.fetch, originalServe = Deno.serve;
  const owner = crypto.randomUUID(), outsider = crypto.randomUUID(), id = crypto.randomUUID();
  let handler!: Handler;
  let unauthorizedWrites = 0;
  let failBudget = false;
  try {
    Deno.env.set(names[0], "http://database.invalid");
    Deno.env.set(names[1], "fixture-service");
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") {
        const caller = new Headers(init?.headers).get("authorization")?.endsWith("fixture-owner") ? owner : outsider;
        return Response.json({ id: caller, role: "authenticated" });
      }
      if (url.pathname.endsWith("/profiles")) return Response.json({ eligibility_blocked_at: null, plan: "pro" });
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) {
        return failBudget ? Response.json({ message: "Fixture counter outage" }, { status: 503 }) : Response.json(true);
      }
      if (url.pathname.endsWith("/drips")) {
        // Service-role reads without an owner filter would see this foreign row.
        const ownerFilter = url.searchParams.get("user_id");
        const authorized = ownerFilter === null || ownerFilter === `eq.${owner}`;
        if (init?.method === "HEAD") {
          return new Response(null, { headers: { "Content-Range": authorized ? "*/1" : "*/0" } });
        }
        if (init?.method === "PATCH" && authorized) unauthorizedWrites++;
        return Response.json(
          authorized
            ? {
              id,
              user_id: owner,
              provider: "microsoft",
              document_id: "fixture-document",
              status: "running",
              lease_id: null,
              chunks_written: 0,
              total_chunks: 1,
            }
            : null,
        );
      }
      throw new Error(`Unexpected fixture path: ${url.pathname}`);
    }) as typeof fetch;
    Object.defineProperty(Deno, "serve", {
      value: (fn: Handler) => {
        handler = fn;
      },
      configurable: true,
      writable: true,
    });
    await import("../functions/drips/index.ts?security-ownership");
    Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
    const request = (suffix: string, method = "GET", caller = "fixture-outsider") =>
      handler(
        new Request(`http://edge.invalid/functions/v1/drips/${id}${suffix}`, {
          method,
          headers: { Authorization: `Bearer ${caller}`, "Content-Type": "application/json" },
          ...(method === "POST" ? { body: JSON.stringify({ op: "control" }) } : {}),
        }),
      );
    assertEquals((await request("/engine", "POST", "fixture-owner")).status, 200);
    assertEquals((await request("")).status, 404);
    assertEquals((await request("/engine", "POST")).status, 404);
    assertEquals((await request("/pause", "POST")).status, 404);
    assertEquals(unauthorizedWrites, 0);
    const rich = JSON.stringify({
      plain: "x".repeat(1000),
      paragraphs: [{ start: 0, end: 1000, kind: "normal" }],
      spans: Array.from({ length: 1000 }, () => ({ start: 0, end: 1000, bold: true })),
    });
    const complex = await handler(
      new Request("http://edge.invalid/functions/v1/drips/plan", {
        method: "POST",
        headers: { Authorization: "Bearer fixture-owner", "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rich,
          text_format: "rich",
          insertion_unit: "character",
          duration_minutes: 100,
        }),
      }),
    );
    assertEquals(complex.status, 413);
    assertEquals((await complex.json()).error.includes("Choose larger steps"), true);
    failBudget = true;
    const blocked = await handler(
      new Request("http://edge.invalid/functions/v1/drips/plan", {
        method: "POST",
        headers: { Authorization: "Bearer fixture-owner", "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Approved fixture.", duration_minutes: 1 }),
      }),
    );
    assertEquals(blocked.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
    names.forEach((name, i) => before[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, before[i]!));
  }
});

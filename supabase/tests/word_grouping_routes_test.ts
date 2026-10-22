import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { standardPacing } from "../functions/_shared/plan.ts";

type Handler = (req: Request) => Promise<Response>;
Deno.test("real plan route retains single-word requests through parsing and rejects invalid values", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map((n) => Deno.env.get(n));
  const fetch = globalThis.fetch, serve = Deno.serve;
  let handler!: Handler;
  try {
    Deno.env.set(names[0], "http://database.invalid");
    Deno.env.set(names[1], "fixture-service");
    globalThis.fetch = (async (input) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") return Response.json({ id: "fixture-owner", role: "authenticated" });
      if (url.pathname.endsWith("/profiles")) return Response.json({ plan: "free", eligibility_blocked_at: null });
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json(true);
      throw new Error(`Unexpected fixture request: ${url.pathname}`);
    }) as typeof globalThis.fetch;
    Object.defineProperty(Deno, "serve", { value: (fn: Handler) => handler = fn, configurable: true, writable: true });
    await import(`../functions/drips/index.ts?word-grouping-routes`);
    assert(handler);
    for (const grouping of ["single", "random", "invalid", null]) {
      const response = await handler(
        new Request("http://local.invalid/drips/plan", {
          method: "POST",
          headers: { authorization: "Bearer fixture", "content-type": "application/json" },
          body: JSON.stringify({
            text: "One approved sentence. Another follows.",
            insertion_unit: "word",
            rhythm: "natural",
            pacing: { ...standardPacing(600), word_grouping: grouping },
          }),
        }),
      );
      const { plan } = await response.json();
      assertEquals(response.status, 200);
      assertEquals(plan.ok, grouping === "single" || grouping === "random");
      if (grouping === "single") {
        assertEquals(plan.source_unit_count, 5);
        assertEquals(plan.pacing.word_grouping, "single");
      }
      if (grouping === "invalid" || grouping === null) {
        assert(plan.problems.some((p: { code: string }) => p.code === "invalid_settings"));
      }
    }
  } finally {
    globalThis.fetch = fetch;
    Object.defineProperty(Deno, "serve", { value: serve, configurable: true, writable: true });
    names.forEach((name, i) => before[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, before[i]!));
  }
});

import { assertEquals } from "jsr:@std/assert@1.0.13";
import { reconcileBilling } from "../functions/_shared/billingReconcile.ts";

Deno.test("billing recovery is bounded, preserves access on Stripe outages and defers bad legacy customers", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const rows = Array.from(
    { length: 5 },
    (_, i) => ({ user_id: crypto.randomUUID(), stripe_customer_id: `cus_fixture_${i}` }),
  );
  let reads = 0, writes = 0, deferred = 0;
  try {
    Deno.env.delete("STRIPE_SECRET_KEY");
    assertEquals(await reconcileBilling(), { checked: 0, failed: 0 });
    ["http://database.invalid", "fixture-service", "fixture-stripe"].forEach((v, i) => Deno.env.set(names[i], v));
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname.endsWith("/rpc/begin_stripe_sync")) return Response.json(1);
      if (url.hostname === "api.stripe.com") {
        reads++;
        if (url.searchParams.get("customer") === rows[0].stripe_customer_id) {
          return Response.json({ error: { message: "Fixture outage" } }, { status: 503 });
        }
        return Response.json({ data: [{ id: "sub_fixture", status: "active", trial_end: null }], has_more: false });
      }
      if (url.pathname.endsWith("/profiles")) {
        if (init?.method === "PATCH") {
          const body = JSON.parse(String(init.body));
          if (Object.keys(body).length === 1) {
            assertEquals(Object.keys(body), ["stripe_event_at"]);
            deferred++;
            return Response.json(null);
          }
          assertEquals(body.plan, "pro");
          assertEquals(url.searchParams.get("stripe_sync_generation"), "eq.1");
          assertEquals(url.searchParams.get("stripe_customer_id"), `eq.${body.stripe_customer_id}`);
          writes++;
          return Response.json([{ user_id: "fixture" }]);
        }
        assertEquals(url.searchParams.get("limit"), "5");
        assertEquals(url.searchParams.get("order"), "stripe_event_at.asc.nullsfirst");
        return Response.json(rows);
      }
      throw new Error(`Unexpected fixture path ${url.pathname}`);
    }) as typeof fetch;
    assertEquals(await reconcileBilling(), { checked: 5, failed: 1 });
    assertEquals([reads, writes, deferred], [5, 4, 1]);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

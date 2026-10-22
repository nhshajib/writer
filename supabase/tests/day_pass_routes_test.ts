import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { grantDayPass } from "../functions/_shared/dayPass.ts";
type Handler = (req: Request) => Promise<Response>;
Deno.test("Day Pass checkout verifies fulfillment events, charges $4.99 once and verifies the returning owner", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "APP_URL"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch, serve = Deno.serve;
  const owner = crypto.randomUUID();
  let handler!: Handler;
  let expire: string | null = null;
  let grants = 0, refunds = 0, configured = 0;
  let paid = true, wrongOwner = false, refunded = false, failEndpoint = false;
  let saved: URLSearchParams | null = null;
  const session = () => ({
    id: "cs_fixture_pass",
    mode: "payment",
    customer: "fixture-customer",
    payment_intent: "pi_fixture_pass",
    currency: "usd",
    amount_subtotal: 499,
    payment_status: paid ? "paid" : "unpaid",
    metadata: { typewit_price: "typewit-day-pass-499-usd", user_id: wrongOwner ? crypto.randomUUID() : owner },
  });
  try {
    ["http://database.invalid", "fixture-service", "fixture-stripe", "https://app.example.invalid"].forEach((v, i) =>
      Deno.env.set(names[i], v)
    );
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: owner, email: "fixture@example.invalid", role: "authenticated" });
      }
      if (url.pathname.endsWith("/profiles")) {
        return Response.json({
          user_id: owner,
          stripe_customer_id: "fixture-customer",
          eligibility_blocked_at: null,
          age_confirmed_at: new Date().toISOString(),
          birth_year: 1980,
          birth_month: 1,
          day_pass_expires_at: expire,
        });
      }
      if (url.pathname.endsWith("/rpc/hit_rate_limit") || url.pathname.endsWith("/rpc/acquire_billing_checkout")) {
        return Response.json(true);
      }
      if (url.pathname.endsWith("/billing_checkout_locks")) return Response.json(null);
      if (url.pathname.endsWith("/rpc/grant_day_pass")) {
        grants++;
        assertEquals(JSON.parse(String(init?.body)).owner, owner);
        return Response.json(new Date(Date.now() + 86400000).toISOString());
      }
      if (url.pathname.endsWith("/rpc/refund_day_pass")) {
        refunds++;
        return Response.json(null);
      }
      if (url.pathname === "/v1/subscriptions") return Response.json({ data: [], has_more: false });
      if (url.pathname === "/v1/webhook_endpoints") {
        return Response.json({
          data: failEndpoint ? [] : [{
            id: "fixture-endpoint",
            status: "enabled",
            url: "http://database.invalid/functions/v1/stripe-webhook",
            enabled_events: ["customer.subscription.updated"],
          }],
          has_more: false,
        });
      }
      if (url.pathname === "/v1/webhook_endpoints/fixture-endpoint") {
        configured++;
        const values = [...new URLSearchParams(String(init?.body)).values()];
        assert(values.includes("customer.subscription.updated"));
        assert(values.includes("charge.refunded"));
        assert(values.includes("checkout.session.completed"));
        return Response.json({});
      }
      if (url.pathname === "/v1/checkout/sessions") {
        if (init?.method === "POST") {
          saved = new URLSearchParams(String(init.body));
          return Response.json({ url: "https://checkout.example.invalid/pass" });
        }
        return Response.json({ data: [], has_more: false });
      }
      if (url.pathname === "/v1/checkout/sessions/cs_fixture_pass") return Response.json(session());
      if (url.pathname === "/v1/payment_intents/pi_fixture_pass") return Response.json({ latest_charge: { refunded } });
      throw new Error(`Unexpected fixture path ${url.pathname}`);
    }) as typeof fetch;
    Object.defineProperty(Deno, "serve", {
      value: (fn: Handler) => {
        handler = fn;
      },
      configurable: true,
      writable: true,
    });
    await import("../functions/billing/index.ts?day-pass-fixture");
    Object.defineProperty(Deno, "serve", { value: serve, configurable: true, writable: true });
    const send = (action: string, body: unknown) =>
      handler(
        new Request(`http://edge.invalid/functions/v1/billing/${action}`, {
          method: "POST",
          headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    assertEquals((await send("checkout", { interval: "day" })).status, 200);
    const params = saved as unknown as URLSearchParams;
    assertEquals(params.get("mode"), "payment");
    assertEquals(params.get("line_items[0][price_data][unit_amount]"), "499");
    assertEquals(params.get("line_items[0][price_data][currency]"), "usd");
    assertEquals(params.get("subscription_data[trial_period_days]"), null);
    assertEquals(params.get("line_items[0][price_data][recurring][interval]"), null);
    assert(params.get("success_url")?.includes("{CHECKOUT_SESSION_ID}"));
    assertEquals(configured, 1);
    expire = new Date(Date.now() + 10000).toISOString();
    assertEquals((await send("checkout", { interval: "day" })).status, 409);
    expire = null;
    failEndpoint = true;
    assertEquals((await send("checkout", { interval: "day" })).status, 503);
    assertEquals((await send("activate-pass", { session_id: "../other" })).status, 400);
    wrongOwner = true;
    assertEquals((await send("activate-pass", { session_id: "cs_fixture_pass" })).status, 404);
    assertEquals(grants, 0);
    wrongOwner = false;
    paid = false;
    assertEquals(await (await send("activate-pass", { session_id: "cs_fixture_pass" })).json(), { active: false });
    assertEquals(grants, 0);
    paid = true;
    assertEquals(await (await send("activate-pass", { session_id: "cs_fixture_pass" })).json(), { active: true });
    assertEquals(grants, 1);
    refunded = true;
    assertEquals((await send("activate-pass", { session_id: "cs_fixture_pass" })).status, 409);
    assertEquals(refunds, 1);
    assertEquals(grants, 1);
    assertEquals(await grantDayPass({ ...session(), amount_subtotal: 499, mode: "subscription" }), false);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(Deno, "serve", { value: serve, configurable: true, writable: true });
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

Deno.test("playback is owner-scoped, Pro-only and never exposes unconfirmed source", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map((n) => Deno.env.get(n));
  const fetchBefore = globalThis.fetch, serve = Deno.serve;
  const owner = crypto.randomUUID(), id = crypto.randomUUID();
  let tier = "pro";
  let handler!: Handler;
  try {
    Deno.env.set(names[0], "http://database.invalid");
    Deno.env.set(names[1], "fixture-service");
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      assert(!init?.method || init.method === "GET");
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, role: "authenticated" });
      if (url.pathname.endsWith("/profiles")) return Response.json({ plan: tier, eligibility_blocked_at: null });
      if (url.pathname.endsWith("/drips")) {
        assertEquals(url.searchParams.get("user_id"), `eq.${owner}`);
        return Response.json(
          url.searchParams.get("id") === `eq.${id}`
            ? {
              chunks: ["confirmed", "not entered"],
              chunk_deletions: null,
              chunks_written: 1,
              schedule: [1000, 2000],
              session_started_at: new Date().toISOString(),
            }
            : null,
        );
      }
      throw new Error(`Unexpected fixture read ${url.pathname}`);
    }) as typeof fetch;
    Object.defineProperty(Deno, "serve", {
      value: (fn: Handler) => {
        handler = fn;
      },
      writable: true,
      configurable: true,
    });
    await import("../functions/drips/index.ts?playback-fixture");
    Object.defineProperty(Deno, "serve", { value: serve, writable: true, configurable: true });
    const read = (sessionId: string) =>
      handler(
        new Request(`http://edge.invalid/functions/v1/drips/${sessionId}/playback`, {
          headers: { Authorization: "Bearer fixture" },
        }),
      );
    const result = await read(id);
    assertEquals(result.status, 200);
    const data = await result.json();
    assertEquals(data.playback.chunks, ["confirmed"]);
    assertEquals(data.playback.timing, "planned");
    assertEquals((await read(crypto.randomUUID())).status, 404);
    tier = "free";
    assertEquals((await read(id)).status, 403);
  } finally {
    globalThis.fetch = fetchBefore;
    Object.defineProperty(Deno, "serve", { value: serve, writable: true, configurable: true });
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

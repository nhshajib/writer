import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { sha256Hex } from "../functions/_shared/crypto.ts";

type Handler = (request: Request) => Promise<Response>;
async function capture(load: () => Promise<unknown>): Promise<Handler> {
  const original = Deno.serve;
  let handler: Handler | undefined;
  Object.defineProperty(Deno, "serve", {
    value: (fn: Handler) => {
      handler = fn;
    },
    configurable: true,
    writable: true,
  });
  try {
    await load();
  } finally {
    Object.defineProperty(Deno, "serve", { value: original, configurable: true, writable: true });
  }
  assert(handler);
  return handler;
}

Deno.test("second audit: slow document creation does not strand a word reservation when the start time passes", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TICK_SECRET"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const owner = crypto.randomUUID();
  const connection = crypto.randomUUID();
  const id = crypto.randomUUID();
  const now = originalNow();
  let reserved = 0;
  let saved = 0;
  try {
    ["http://database.invalid", "fixture-key", "fixture-tick"].forEach((v, i) => Deno.env.set(names[i], v));
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: owner, aud: "authenticated", role: "authenticated" });
      }
      if (url.pathname.endsWith("/profiles")) return Response.json({ plan: "pro", agreed_terms_version: "2026-10-21" });
      if (url.pathname.endsWith("/provider_connections")) {
        return Response.json({ id: connection, user_id: owner, provider: "test" });
      }
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json(true);
      if (url.pathname.endsWith("/rpc/reserve_words")) {
        reserved++;
        return Response.json(true);
      }
      if (url.pathname.endsWith("/rpc/release_words")) {
        reserved--;
        return Response.json(null);
      }
      if (url.pathname.endsWith("/test_documents") && init?.method === "POST") {
        // Reproduce a provider response arriving after the one-minute grace period.
        Date.now = () => now + 120_000;
        return Response.json({ id: "fixture-document", title: "Fixture" });
      }
      if (url.pathname.endsWith("/drips")) {
        if (init?.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/0" } });
        if (init?.method === "POST") {
          saved++;
          return Response.json({ id });
        }
        return Response.json(null);
      }
      if (url.pathname.endsWith("/drip_events")) return Response.json(null, { status: 201 });
      if (url.pathname.endsWith("/drip-tick")) return Response.json({ claimed: 0 });
      throw new Error(`Unexpected fake path: ${url.pathname}`);
    }) as typeof fetch;
    const handler = await capture(() => import("../functions/drips/index.ts"));
    const text = "Approved test text.";
    const response = await handler(
      new Request("http://edge.invalid/functions/v1/drips", {
        method: "POST",
        headers: { Authorization: "Bearer fixture-jwt", "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: connection,
          new_document_title: "Fixture",
          text,
          insertion_unit: "sentence",
          mode: "as_soon_as_possible",
          start_at: new Date(now + 1000).toISOString(),
          approval: { confirmed: true, text_sha256: await sha256Hex(text) },
        }),
      }),
    );
    assertEquals(response.status, 201, await response.text());
    assertEquals(saved, 1);
    assertEquals(reserved, 1); // Reservation belongs to the saved session, not a failed request.
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

Deno.test("second audit: age-blocked accounts can cancel billing but cannot buy or upgrade", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "APP_URL"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const owner = crypto.randomUUID();
  let portalCalls = 0;
  let rejectCancellation = false;
  try {
    ["http://database.invalid", "fixture-key", "fixture-stripe", "https://app.example.invalid"].forEach((v, i) =>
      Deno.env.set(names[i], v)
    );
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: owner, aud: "authenticated", role: "authenticated" });
      }
      if (url.pathname.endsWith("/profiles")) {
        return Response.json({
          eligibility_blocked_at: new Date().toISOString(),
          stripe_customer_id: "fixture-customer",
        });
      }
      if (url.hostname === "api.stripe.com" && url.pathname === "/v1/subscriptions") {
        return Response.json({ data: [{ id: "fixture-subscription", status: "active" }], has_more: false });
      }
      if (url.hostname === "api.stripe.com" && url.pathname === "/v1/billing_portal/sessions") {
        portalCalls++;
        const params = new URLSearchParams(String(init?.body));
        assertEquals(params.get("flow_data[type]"), "subscription_cancel");
        assertEquals(params.get("flow_data[subscription_cancel][subscription]"), "fixture-subscription");
        return rejectCancellation
          ? Response.json({ error: { message: "flow disabled" } }, { status: 400 })
          : Response.json({ url: "https://billing.example.invalid/cancel" });
      }
      throw new Error(`Unexpected fake path: ${url.pathname}`);
    }) as typeof fetch;
    const handler = await capture(() => import("../functions/billing/index.ts"));
    const send = (action: string, body = {}) =>
      handler(
        new Request(`http://edge.invalid/functions/v1/billing/${action}`, {
          method: "POST",
          headers: { Authorization: "Bearer fixture-jwt", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    assertEquals((await send("checkout", { interval: "year" })).status, 403);
    assertEquals((await send("reprice")).status, 403);
    assertEquals((await send("portal", { flow: "subscription_update" })).status, 200);
    assertEquals(portalCalls, 1);
    rejectCancellation = true;
    assertEquals((await send("portal")).status, 503);
    assertEquals(portalCalls, 2); // Never fall back to an unrestricted upgrade portal.
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

Deno.test("second audit: checkout serializes double clicks, reuses open payment links and safely switches intervals", async () => {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "APP_URL",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_YEARLY",
  ];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const owner = crypto.randomUUID();
  let lock: string | null = null;
  let customer: string | null = null;
  let created = 0;
  let customerKey = "";
  let subscriptionStatus: string | null = null;
  let failLookup = false;
  let entered!: () => void;
  let release!: () => void;
  const enteredCustomer = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const customerGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let pending: {
    id: string;
    mode: string;
    url: string;
    cancel_url: string;
    metadata: { typewit_price: string; typewit_checkout_flow: string };
  }[] = [];
  try {
    [
      "http://database.invalid",
      "fixture-key",
      "fixture-stripe",
      "https://app.example.invalid",
      "fixture-month",
      "fixture-year",
    ].forEach((v, i) => Deno.env.set(names[i], v));
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") {
        return Response.json({
          id: owner,
          email: "fixture@example.invalid",
          aud: "authenticated",
          role: "authenticated",
        });
      }
      if (url.pathname.endsWith("/profiles")) {
        if (init?.method === "PATCH") {
          customer = JSON.parse(String(init.body)).stripe_customer_id;
          return Response.json(null);
        }
        return Response.json({
          eligibility_blocked_at: null,
          stripe_customer_id: customer,
          age_confirmed_at: new Date().toISOString(),
          birth_year: 1980,
          birth_month: 1,
        });
      }
      if (url.pathname.endsWith("/rpc/acquire_billing_checkout")) {
        const body = JSON.parse(String(init?.body));
        assertEquals(body.owner, owner);
        if (lock) return Response.json(false);
        lock = body.lease;
        return Response.json(true);
      }
      if (url.pathname.endsWith("/billing_checkout_locks") && init?.method === "DELETE") {
        assertEquals(url.searchParams.get("lease_id"), `eq.${lock}`);
        assertEquals(url.searchParams.get("user_id"), `eq.${owner}`);
        lock = null;
        return Response.json(null);
      }
      if (url.pathname.endsWith("/rpc/trial_available")) return Response.json(true);
      if (url.hostname === "api.stripe.com") {
        const params = new URLSearchParams(String(init?.body ?? ""));
        if (url.pathname === "/v1/customers") {
          customerKey = new Headers(init?.headers).get("Idempotency-Key") ?? "";
          assert(customerKey.startsWith(`typewit-customer-${owner}-`));
          entered();
          await customerGate;
          return Response.json({ id: "fixture-customer" });
        }
        if (url.pathname === "/v1/subscriptions") {
          if (failLookup) return Response.json({ error: { message: "fixture outage" } }, { status: 503 });
          return Response.json({
            data: subscriptionStatus ? [{ id: "fixture-sub", status: subscriptionStatus }] : [],
            has_more: false,
          });
        }
        if (url.pathname === "/v1/checkout/sessions") {
          if (init?.method === "POST") {
            assert(new Headers(init.headers).get("Idempotency-Key")?.startsWith("typewit-checkout-"));
            created++;
            const session = {
              id: `fixture-checkout-${created}`,
              mode: "subscription",
              url: `https://checkout.example.invalid/${created}`,
              cancel_url: params.get("cancel_url")!,
              metadata: {
                typewit_price: params.get("metadata[typewit_price]")!,
                typewit_checkout_flow: params.get("metadata[typewit_checkout_flow]")!,
              },
            };
            pending.push(session);
            return Response.json(session);
          }
          return Response.json({ data: pending, has_more: false });
        }
        if (url.pathname.endsWith("/expire")) {
          const id = url.pathname.split("/").at(-2);
          pending = pending.filter((s) => s.id !== id);
          return Response.json({});
        }
      }
      throw new Error(`Unexpected fake checkout path: ${url.pathname}`);
    }) as typeof fetch;
    const handler = await capture(() => import("../functions/billing/index.ts?checkout-second-pass"));
    const send = (interval = "month") =>
      handler(
        new Request("http://edge.invalid/functions/v1/billing/checkout", {
          method: "POST",
          headers: { Authorization: "Bearer fixture-jwt", "Content-Type": "application/json" },
          body: JSON.stringify({ interval }),
        }),
      );
    const first = send();
    await enteredCustomer;
    assertEquals((await send()).status, 409);
    release();
    const firstResponse = await first;
    assertEquals(firstResponse.status, 200);
    const firstBody = await firstResponse.json();
    assertEquals(created, 1);
    assertEquals(lock, null);
    assertEquals(await (await send()).json(), firstBody);
    assertEquals(created, 1);
    assertEquals((await send("year")).status, 200);
    assertEquals(created, 2);
    assertEquals(pending.length, 1);
    assertEquals(pending[0].metadata.typewit_price, "fixture-year");
    subscriptionStatus = "unpaid";
    assertEquals((await send()).status, 409);
    assertEquals(created, 2);
    assertEquals(lock, null);
    subscriptionStatus = null;
    failLookup = true;
    assertEquals((await send()).status, 502);
    assertEquals(lock, null);
    failLookup = false;
    assertEquals((await send("year")).status, 200);
    assertEquals(created, 2);
  } finally {
    release();
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

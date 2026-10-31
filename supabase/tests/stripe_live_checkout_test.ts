import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { isMissingStripeCustomer, StripeError, stripeGet } from "../functions/_shared/stripe.ts";

type Handler = (req: Request) => Promise<Response>;
async function fixture() {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "APP_URL",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_YEARLY",
    "STRIPE_PRICE_DAY",
  ];
  const before = names.map((n) => Deno.env.get(n));
  [
    "http://database.invalid",
    "fixture-service",
    "sk_live_fixture",
    "https://app.example.invalid",
    "price_fixture_month",
    "price_fixture_year",
    "price_fixture_day",
  ].forEach((v, i) => Deno.env.set(names[i], v));
  const originalFetch = globalThis.fetch, originalServe = Deno.serve;
  const owner = crypto.randomUUID(), oldCustomer = "cus_fixture_sandbox";
  const state = {
    customer: oldCustomer,
    status: null as string | null,
    failure: "missing_customer",
    priceFailure: "",
    creates: 0,
    patches: 0,
    sessions: 0,
    expired: [] as string[],
    releases: 0,
    locked: false,
    trial: false,
    trialCalls: 0,
    customerKey: "",
    checkoutVersion: "",
    params: new URLSearchParams(),
    open: null as Record<string, unknown> | null,
  };
  globalThis.fetch = (async (input, init) => {
    await Promise.resolve();
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") {
      return Response.json({
        id: owner,
        email: "fixture@example.invalid",
        role: "authenticated",
        aud: "authenticated",
      });
    }
    if (url.pathname.endsWith("/profiles")) {
      if (init?.method === "PATCH") {
        const patch = JSON.parse(String(init.body));
        assertEquals(Object.keys(patch), ["stripe_customer_id"]);
        state.customer = patch.stripe_customer_id;
        state.patches++;
        return Response.json(null);
      }
      return Response.json({
        stripe_customer_id: state.customer,
        subscription_status: state.status,
        eligibility_blocked_at: null,
        age_confirmed_at: new Date().toISOString(),
        birth_year: 1980,
        birth_month: 1,
        day_pass_expires_at: null,
      });
    }
    if (url.pathname.endsWith("/rpc/acquire_billing_checkout")) {
      if (state.locked) return Response.json(false);
      state.locked = true;
      return Response.json(true);
    }
    if (url.pathname.endsWith("/billing_checkout_locks") && init?.method === "DELETE") {
      state.releases++;
      state.locked = false;
      return Response.json(null);
    }
    if (url.pathname.endsWith("/rpc/trial_available")) {
      state.trialCalls++;
      return Response.json(state.trial);
    }
    if (url.hostname === "api.stripe.com") {
      const version = new Headers(init?.headers).get("Stripe-Version");
      if (!(url.pathname === "/v1/checkout/sessions" && init?.method === "POST")) {
        assertEquals(version, null, "Existing non-Checkout calls must retain their API version");
      }
      if (url.pathname === "/v1/subscriptions") {
        if (state.customer === oldCustomer && state.failure) {
          const code = state.failure === "missing_customer" || state.failure === "missing_price"
            ? "resource_missing"
            : "api_error";
          const param = state.failure === "missing_price" ? "price" : "customer";
          const status = state.failure === "unauthorized" ? 401 : state.failure === "outage" ? 503 : 400;
          return Response.json({ error: { message: "Fixture Stripe lookup failure", code, param } }, { status });
        }
        return Response.json({
          data: state.status ? [{ id: "sub_fixture", status: state.status }] : [],
          has_more: false,
        });
      }
      if (url.pathname.startsWith("/v1/prices/")) {
        if (state.priceFailure === "missing") {
          return Response.json({
            error: { message: "Fixture price missing", code: "resource_missing", param: "price" },
          }, { status: 404 });
        }
        const interval = url.pathname.endsWith("year") ? "year" : "month", day = url.pathname.endsWith("day");
        return Response.json({
          active: state.priceFailure !== "inactive",
          currency: state.priceFailure === "currency" ? "eur" : "usd",
          unit_amount: state.priceFailure === "amount" ? 1 : day ? 399 : interval === "month" ? 699 : 6000,
          type: day ? "one_time" : "recurring",
          recurring: day
            ? null
            : { interval: state.priceFailure === "interval" ? "week" : interval, interval_count: 1 },
          product: { active: state.priceFailure !== "product" },
        });
      }
      if (url.pathname === "/v1/webhook_endpoints") {
        return Response.json({
          data: [{
            id: "we_fixture",
            status: "enabled",
            url: "http://database.invalid/functions/v1/stripe-webhook",
            enabled_events: ["*"],
          }],
          has_more: false,
        });
      }
      if (url.pathname === "/v1/customers") {
        state.creates++;
        state.customerKey = new Headers(init?.headers).get("Idempotency-Key") ?? "";
        const params = new URLSearchParams(String(init?.body));
        assertEquals(params.get("metadata[user_id]"), owner);
        return Response.json({ id: "cus_fixture_live" });
      }
      if (url.pathname === "/v1/checkout/sessions/cs_fixture_old/expire") {
        state.expired.push("cs_fixture_old");
        state.open = null;
        return Response.json({ id: "cs_fixture_old", status: "expired" });
      }
      if (url.pathname === "/v1/checkout/sessions") {
        if (init?.method === "POST") {
          state.checkoutVersion = version ?? "";
          if (version !== "2026-09-30.endive") {
            return Response.json({
              error: { message: "Invalid ui_mode: hosted_page on the account default API version", param: "ui_mode" },
            }, { status: 400 });
          }
          state.sessions++;
          state.params = new URLSearchParams(String(init.body));
          state.open = {
            id: "cs_fixture",
            mode: state.params.get("mode"),
            url: "https://checkout.example.invalid/session",
            metadata: { typewit_price: state.params.get("metadata[typewit_price]"), user_id: owner },
            line_items: { data: [{ price: { id: state.params.get("line_items[0][price]") } }] },
          };
          return Response.json(state.open);
        }
        return Response.json({ data: state.open ? [state.open] : [], has_more: false });
      }
    }
    throw new Error(`Unexpected fixture path: ${url.pathname}`);
  }) as typeof fetch;
  let handler!: Handler;
  Object.defineProperty(Deno, "serve", {
    value: (fn: Handler) => {
      handler = fn;
    },
    configurable: true,
    writable: true,
  });
  await import(`../functions/billing/index.ts?live-fixture=${crypto.randomUUID()}`);
  Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
  return {
    state,
    owner,
    send: (interval = "month") =>
      handler(
        new Request("http://edge.invalid/functions/v1/billing/checkout", {
          method: "POST",
          headers: { Authorization: "Bearer fixture-jwt", "Content-Type": "application/json" },
          body: JSON.stringify({ interval }),
        }),
      ),
    restore: () => {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
      names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
    },
  };
}
Deno.test("Stripe missing-customer recovery requires a typed customer error and preserves structured API details", async () => {
  const e = await assertRejects(
    () =>
      stripeGet(
        "fixture-secret",
        "subscriptions",
        {},
        (() =>
          Promise.resolve(
            Response.json({ error: { message: "Fixture missing", code: "resource_missing", param: "customer" } }, {
              status: 400,
            }),
          )) as typeof fetch,
      ),
    StripeError,
  );
  assertEquals(e.code, "resource_missing");
  assertEquals(e.param, "customer");
  assert(isMissingStripeCustomer(e));
  assert(!isMissingStripeCustomer(new StripeError(503, "Fixture missing", "resource_missing", "customer")));
  assert(!isMissingStripeCustomer(new StripeError(400, "Fixture missing", "resource_missing", "price")));
  assert(!isMissingStripeCustomer(new StripeError(400, "No such customer")));
});
Deno.test("checkout recovers a missing sandbox customer for each plan without resetting trial eligibility", async () => {
  for (const interval of ["month", "year", "day"]) {
    const f = await fixture();
    try {
      const response = await f.send(interval);
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { url: "https://checkout.example.invalid/session", trial: false });
      assertEquals(f.state.customer, "cus_fixture_live");
      assertEquals(f.state.creates, 1);
      assertEquals(f.state.patches, 1);
      assert(f.state.customerKey.includes("-replace-"));
      assertEquals(f.state.params.get("customer"), "cus_fixture_live");
      assertEquals(f.state.params.get("metadata[user_id]"), f.owner);
      assertEquals(f.state.params.get("subscription_data[trial_period_days]"), null);
      assertEquals((await f.send(interval)).status, 200);
      assertEquals(f.state.creates, 1);
      assertEquals(f.state.sessions, 1);
      assertEquals(f.state.releases, 2);
      assert(!f.state.locked);
    } finally {
      f.restore();
    }
  }
});
Deno.test("checkout never replaces a customer for ongoing subscriptions, unrelated Stripe failures or invalid replacement prices", async () => {
  const cases = [
    ...["active", "trialing", "past_due", "unpaid", "incomplete"].map((status) => ({
      status,
      failure: "missing_customer",
      priceFailure: "",
      expected: 409,
    })),
    ...["unauthorized", "outage", "missing_price"].map((failure) => ({
      status: null,
      failure,
      priceFailure: "",
      expected: 502,
    })),
    ...["missing", "inactive", "interval", "amount", "currency", "product"].map((priceFailure) => ({
      status: null,
      failure: "missing_customer",
      priceFailure,
      expected: priceFailure === "missing" ? 502 : 503,
    })),
  ];
  for (const item of cases) {
    const f = await fixture();
    try {
      Object.assign(f.state, item);
      const response = await f.send();
      assertEquals(response.status, item.expected);
      const body = await response.text();
      assert(!body.includes("sk_live_fixture"));
      assert(!body.includes("Fixture Stripe lookup failure"));
      assertEquals(f.state.creates, 0);
      assertEquals(f.state.patches, 0);
      assertEquals(f.state.customer, "cus_fixture_sandbox");
      assertEquals(f.state.releases, 1);
      assert(!f.state.locked);
    } finally {
      f.restore();
    }
  }
});
Deno.test("Checkout Studio options retain plan prices, owner metadata, subscription trials and one-time Day Pass semantics", async () => {
  for (const interval of ["month", "year", "day"]) {
    const f = await fixture();
    try {
      f.state.failure = "";
      f.state.trial = true;
      assertEquals((await f.send(interval)).status, 200);
      assertEquals(f.state.checkoutVersion, "2026-09-30.endive");
      const p = f.state.params;
      for (
        const [key, value] of Object.entries({
          ui_mode: "hosted_page",
          billing_address_collection: "required",
          "phone_number_collection[enabled]": "false",
          "automatic_tax[enabled]": "false",
          allow_promotion_codes: "true",
          submit_type: "auto",
          "name_collection[individual][enabled]": "true",
          "saved_payment_method_options[payment_method_save]": "enabled",
          integration_identifier: "hosted_mobile_app_0001",
          origin_context: "mobile_app",
        })
      ) assertEquals(p.get(key), value);
      assertEquals(p.get("line_items[0][price]"), `price_fixture_${interval}`);
      assertEquals(p.get("client_reference_id"), f.owner);
      assertEquals(p.get("metadata[user_id]"), f.owner);
      assertEquals(p.get("cancel_url"), "https://app.example.invalid/pricing?checkout=canceled");
      if (interval === "day") {
        assertEquals(p.get("mode"), "payment");
        assertEquals(p.get("payment_method_collection"), null);
        assertEquals(p.get("invoice_creation[enabled]"), "true");
        assertEquals(p.get("payment_intent_data[metadata][user_id]"), f.owner);
        assertEquals(p.get("metadata[typewit_price]"), "typewit-day-pass-399-usd");
        assert(p.get("success_url")?.includes("{CHECKOUT_SESSION_ID}"));
        assertEquals(f.state.trialCalls, 0);
      } else {
        assertEquals(p.get("mode"), "subscription");
        assertEquals(p.get("payment_method_collection"), "always");
        assertEquals(p.get("subscription_data[trial_period_days]"), "7");
        assertEquals(p.get("subscription_data[metadata][user_id]"), f.owner);
        assertEquals(p.get("success_url"), "https://app.example.invalid/account?checkout=success");
      }
      assertEquals(f.state.creates, 0);
      assertEquals(f.state.patches, 0);
    } finally {
      f.restore();
    }
  }
});

Deno.test("new Day Pass checkout retires an old-price link instead of charging the previous amount", async () => {
  const f = await fixture();
  try {
    f.state.failure = "";
    f.state.open = {
      id: "cs_fixture_old",
      mode: "payment",
      url: "https://checkout.example.invalid/old-price",
      metadata: { typewit_price: "typewit-day-pass-499-usd", user_id: f.owner },
      line_items: { data: [{ price: { id: "price_fixture_old" } }] },
    };
    assertEquals((await f.send("day")).status, 200);
    assertEquals(f.state.expired, ["cs_fixture_old"]);
    assertEquals(f.state.sessions, 1);
    assertEquals(f.state.params.get("metadata[typewit_price]"), "typewit-day-pass-399-usd");
    assertEquals(f.state.params.get("line_items[0][price]"), "price_fixture_day");
    assertEquals(f.state.creates, 0);
  } finally {
    f.restore();
  }
});

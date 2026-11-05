import { assert, assertEquals } from "jsr:@std/assert@1.0.13";

Deno.test("account deletion verifies billing, explicit cancellation and exclusive checkout ownership before erasure", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch, originalServe = Deno.serve;
  const owner = crypto.randomUUID();
  const state = {
    status: "active",
    cancelFails: false,
    leaseStolen: false,
    raced: false,
    openOwner: owner,
    open: true,
    cancels: 0,
    deletes: 0,
    stops: 0,
    expires: 0,
    lease: "",
    initialLease: "",
    order: [] as string[],
  };
  const reset = () =>
    Object.assign(state, {
      status: "active",
      cancelFails: false,
      leaseStolen: false,
      raced: false,
      openOwner: owner,
      open: true,
      cancels: 0,
      deletes: 0,
      stops: 0,
      expires: 0,
      lease: "",
      initialLease: "",
      order: [],
    });
  try {
    ["http://database.invalid", "fixture-service", "fixture-stripe"].forEach((v, i) => Deno.env.set(names[i], v));
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      const rawBody = String(init?.body ?? "");
      const body = rawBody.startsWith("{") ? JSON.parse(rawBody) : {};
      if (url.pathname === "/auth/v1/user") {
        return Response.json({
          id: owner,
          email: "fixture@example.invalid",
          aud: "authenticated",
          role: "authenticated",
        });
      }
      if (url.pathname.endsWith("/profiles")) {
        return Response.json({
          eligibility_blocked_at: null,
          stripe_customer_id: "cus_fixture",
          subscription_status: "active",
        });
      }
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json(true);
      if (url.pathname.endsWith("/rpc/acquire_billing_checkout")) {
        assertEquals(body.owner, owner);
        state.lease = state.initialLease = body.lease;
        return Response.json(true);
      }
      if (url.hostname === "api.stripe.com") {
        if (url.pathname === "/v1/subscriptions") {
          assertEquals(url.searchParams.get("customer"), "cus_fixture");
          return Response.json({
            data: [{ id: "sub_fixture", status: state.raced && state.cancels ? "active" : state.status }],
            has_more: false,
          });
        }
        if (url.pathname === "/v1/checkout/sessions") {
          return Response.json({
            data: state.open
              ? [{ id: "cs_fixture", client_reference_id: state.openOwner, metadata: { user_id: state.openOwner } }]
              : [],
            has_more: false,
          });
        }
        if (url.pathname === "/v1/checkout/sessions/cs_fixture/expire") {
          state.expires++;
          state.open = false;
          state.order.push("expire");
          return Response.json({ status: "expired" });
        }
        if (url.pathname === "/v1/subscriptions/sub_fixture" && init?.method === "DELETE") {
          assertEquals(url.searchParams.get("prorate"), "false");
          assertEquals(url.searchParams.get("invoice_now"), "false");
          state.cancels++;
          if (state.cancelFails) {
            return Response.json({ error: { message: "Fixture cancellation outage" } }, { status: 503 });
          }
          state.status = "canceled";
          state.order.push("cancel");
          return Response.json({ status: "canceled" });
        }
      }
      if (url.pathname.endsWith("/drips") && init?.method === "PATCH") {
        assertEquals(url.searchParams.get("user_id"), `eq.${owner}`);
        assertEquals(body.status, "canceled");
        state.stops++;
        state.order.push("stop");
        return Response.json(null);
      }
      if (url.pathname.endsWith("/provider_connections")) return Response.json([]);
      if (url.pathname.endsWith("/billing_checkout_locks")) {
        assertEquals(url.searchParams.get("user_id"), `eq.${owner}`);
        assertEquals(url.searchParams.get("lease_id"), `eq.${state.initialLease}`);
        if (init?.method === "PATCH") {
          if (state.leaseStolen) {
            state.lease = "fixture-newer-lease";
            return Response.json([]);
          }
          assert(Date.parse(body.expires_at) > Date.now() + 170_000);
          state.order.push("renew");
          return Response.json([{ user_id: owner }]);
        }
        if (state.lease === state.initialLease) state.lease = "";
        state.order.push("release");
        return Response.json(null);
      }
      if (url.pathname === `/auth/v1/admin/users/${owner}` && init?.method === "DELETE") {
        assert(state.order.includes("renew"));
        state.deletes++;
        state.order.push("delete");
        return Response.json({ id: owner });
      }
      throw new Error(`Unexpected deletion fixture path ${url.pathname}`);
    }) as typeof fetch;
    let handler!: (req: Request) => Promise<Response>;
    Object.defineProperty(Deno, "serve", {
      value: (fn: typeof handler) => {
        handler = fn;
      },
      configurable: true,
      writable: true,
    });
    await import("../functions/drips/index.ts?account-deletion-fixture");
    const send = (cancel: unknown = false, email: unknown = "fixture@example.invalid") =>
      handler(
        new Request("http://edge.invalid/functions/v1/drips/account/delete", {
          method: "POST",
          headers: { Authorization: "Bearer fixture-jwt" },
          body: JSON.stringify({ confirm_email: email, cancel_subscription: cancel }),
        }),
      );
    assertEquals((await send(true, 123)).status, 400);
    assertEquals((await send("true")).status, 400);
    assertEquals((await send()).status, 409);
    assertEquals([state.cancels, state.deletes, state.expires], [0, 0, 0]);
    reset();
    assertEquals((await send(true)).status, 200);
    assertEquals(state.order, ["expire", "cancel", "stop", "renew", "delete", "release"]);
    assertEquals(state.deletes, 1);
    reset();
    state.cancelFails = true;
    assertEquals((await send(true)).status, 503);
    assertEquals([state.deletes, state.stops], [0, 0]);
    reset();
    state.raced = true;
    assertEquals((await send(true)).status, 503);
    assertEquals([state.deletes, state.stops], [0, 0]);
    reset();
    state.openOwner = crypto.randomUUID();
    assertEquals((await send(true)).status, 409);
    assertEquals([state.deletes, state.cancels, state.expires], [0, 0, 0]);
    reset();
    state.leaseStolen = true;
    assertEquals((await send(true)).status, 409);
    assertEquals(state.deletes, 0);
    assertEquals(state.lease, "fixture-newer-lease");
    reset();
    state.status = "canceled";
    state.open = false;
    assertEquals((await send()).status, 200);
    assertEquals([state.deletes, state.cancels], [1, 0]);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(Deno, "serve", { value: originalServe, configurable: true, writable: true });
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

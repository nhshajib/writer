// Actual route handlers with a fake Supabase transport. No listening socket,
// production credentials, provider requests or customer records are used.
import { encrypt } from "../functions/_shared/crypto.ts";
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";

type Handler = (request: Request) => Promise<Response>;
async function capture(path: string): Promise<Handler> {
  const serve = Deno.serve;
  let handler: Handler | undefined;
  Object.defineProperty(Deno, "serve", {
    value: (fn: Handler) => {
      handler = fn;
    },
    configurable: true,
    writable: true,
  });
  try {
    await import(path);
  } finally {
    Object.defineProperty(Deno, "serve", { value: serve, configurable: true, writable: true });
  }
  assert(handler);
  return handler;
}
Deno.test("audit routes: Word confirmations cannot revive or rewrite sessions; database outages do not pause writing", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TICK_SECRET", "TOKEN_ENCRYPTION_KEY"];
  const before = names.map((name) => Deno.env.get(name));
  const originalFetch = globalThis.fetch;
  const owner = crypto.randomUUID();
  const id = crypto.randomUUID();
  const lease = crypto.randomUUID();
  const connection = crypto.randomUUID();
  let status = "running";
  let written = 0;
  let updates = 0;
  let failControl = false;
  let sharedGrant = false;
  let revocations = 0;
  const cipher = await encrypt("fixture-refresh-token", "fixture-encryption");
  const row = {
    id,
    user_id: owner,
    connection_id: connection,
    provider: "microsoft",
    document_id: "fixture",
    status,
    lease_id: lease,
    chunks_written: 0,
    total_chunks: 1,
    chunks: ["Approved test."],
    schedule: [0],
    session_started_at: new Date().toISOString(),
    schedule_shift_seconds: 0,
    attempts: 0,
    pending_index: null,
    pending_revision: null,
    pending_doc_length: null,
    retry_at: null,
    last_revision_id: null,
    last_written_at: null,
    resync_index: 0,
    resync_tail: "",
    document_baseline_length: null,
    preflight_at: new Date().toISOString(),
    next_run_at: new Date().toISOString(),
    document_title: "Fixture",
    document_url: null,
    word_count: 2,
    chunk_deletions: null,
  };
  try {
    Deno.env.set(names[0], "http://database.invalid");
    Deno.env.set(names[1], "fixture-key");
    Deno.env.set(names[2], "fixture-tick");
    Deno.env.set(names[3], "fixture-encryption");
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: owner, aud: "authenticated", role: "authenticated" });
      }
      if (url.pathname.endsWith("/profiles")) return Response.json({ eligibility_blocked_at: null });
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json(true);
      if (url.pathname.endsWith("/rpc/claim_due_worker_drips")) {
        return Response.json([{ ...row, provider: "test", status: "running", lease_id: lease }]);
      }
      if (url.hostname === "oauth2.googleapis.com") {
        revocations++;
        return Response.json({});
      }
      if (url.pathname.endsWith("/provider_connections")) {
        if (init?.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/1" } });
        const record = {
          id: connection,
          user_id: owner,
          provider: sharedGrant ? "google" : "test",
          account_email: "fixture@example.invalid",
          refresh_token_enc: cipher,
        };
        return Response.json(url.searchParams.get("id")?.startsWith("eq.") ? record : [record]);
      }
      if (url.pathname.endsWith("/test_documents")) return Response.json({ content: "right", revision: 1 });
      if (url.pathname.endsWith("/worker_heartbeat")) {
        return Response.json({ last_cleanup_at: new Date().toISOString() });
      }
      if (url.pathname.endsWith("/drips")) {
        if (init?.method === "PATCH") {
          updates++;
          const patch = JSON.parse(String(init.body));
          const allowed = url.searchParams.get("status") === "in.(running,paused)" &&
            ["running", "paused"].includes(status) && written === 0;
          if (allowed) written = patch.chunks_written;
          return Response.json(allowed ? [{ id }] : []);
        }
        if (failControl && url.searchParams.get("select")?.includes("lease_id")) {
          return Response.json({ message: "temporary database outage" }, { status: 500 });
        }
        const source = { ...row, status, chunks_written: written };
        const selected = (url.searchParams.get("select") ?? "").split(",").map((k) => k.trim());
        return Response.json(Object.fromEntries(Object.entries(source).filter(([k]) => selected.includes(k))));
      }
      if (url.pathname.endsWith("/drip_events")) return Response.json([]);
      throw new Error(`Unexpected fake request: ${url.pathname}`);
    }) as typeof fetch;
    const drips = await capture("../functions/drips/index.ts");
    const request = (body: unknown) =>
      new Request(`http://edge.invalid/functions/v1/drips/${id}/engine`, {
        method: "POST",
        headers: { Authorization: "Bearer fixture-jwt", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assertEquals((await (await drips(request({ op: "control" }))).json()).chunks_written, 0);
    assertEquals(
      (await drips(request({ op: "confirm", expected: 0, patch: { chunks_written: 1, status: "running" } }))).status,
      400,
    );
    assertEquals(updates, 0);
    status = "canceled";
    assertEquals(await (await drips(request({ op: "confirm", expected: 0, patch: { chunks_written: 1 } }))).json(), {
      ok: false,
    });
    assertEquals(written, 0);
    status = "paused";
    assertEquals(await (await drips(request({ op: "confirm", expected: 0, patch: { chunks_written: 1 } }))).json(), {
      ok: true,
    });
    assertEquals(written, 1);
    // Test connection projects the exact real query, so omitting deletions
    // would reproduce the old false "location uncertain" warning.
    row.chunks = ["wrong", "", "right"];
    row.chunk_deletions = [0, 5, 0] as never;
    row.total_chunks = 3;
    written = 3;
    status = "paused";
    const check = await drips(
      new Request(`http://edge.invalid/functions/v1/drips/${id}/check`, {
        method: "POST",
        headers: { Authorization: "Bearer fixture-jwt" },
      }),
    );
    assertEquals(check.status, 200);
    assertEquals((await check.json()).report.ok, true);
    sharedGrant = true;
    const disconnected = await drips(
      new Request(`http://edge.invalid/functions/v1/drips/connections/${connection}/disconnect`, {
        method: "POST",
        headers: { Authorization: "Bearer fixture-jwt" },
      }),
    );
    assertEquals(disconnected.status, 200);
    assertEquals(revocations, 0);
    sharedGrant = false;
    row.chunks = ["Approved test."];
    row.chunk_deletions = null;
    row.total_chunks = 1;
    status = "running";
    written = 0;
    updates = 0;
    failControl = true;
    const tick = await capture("../functions/drip-tick/index.ts");
    const response = await tick(
      new Request("http://edge.invalid/functions/v1/drip-tick", {
        method: "POST",
        headers: { "x-tick-secret": "fixture-tick" },
      }),
    );
    const result = await response.json();
    assertEquals(result.results, [{ id, outcome: "lost" }]);
    assertEquals(updates, 0);
    const health = await (await tick(new Request("http://edge.invalid/functions/v1/drip-tick/health"))).json();
    assertEquals("configured" in health, false);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => before[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, before[i]!));
  }
});

Deno.test("audit OAuth routes: matching browser only, single use, required scope, null identity and exchange errors", async () => {
  const { pkceChallenge } = await import("../functions/_shared/oauth.ts");
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TOKEN_ENCRYPTION_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APP_URL",
  ];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const owner = crypto.randomUUID();
  const verifier = "v".repeat(64);
  const challenge = await pkceChallenge(verifier);
  let nonce: { nonce: string; user_id: string; browser_hash: string; expires_at: string } | null = null;
  let returned = false;
  let used = false;
  let connections = 0;
  let mode = "ok";
  try {
    [
      "http://database.invalid",
      "fixture-key",
      "fixture-encryption",
      "fixture-client",
      "fixture-secret",
      "https://app.example.invalid",
    ]
      .forEach((v, i) => Deno.env.set(names[i], v));
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body).startsWith("{") ? String(init.body) : "{}") : {};
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: owner, aud: "authenticated", role: "authenticated" });
      }
      if (url.pathname.endsWith("/profiles")) return Response.json({ eligibility_blocked_at: null });
      if (url.pathname.endsWith("/rpc/hit_rate_limit")) return Response.json(true);
      if (url.pathname.endsWith("/google_oauth_nonces")) {
        if (init?.method === "POST") {
          nonce = body;
          returned = used = false;
          return Response.json(null, { status: 201 });
        }
        if (returned || used) return Response.json([]);
        returned = true;
        return Response.json([{ nonce: nonce!.nonce }]);
      }
      if (url.pathname.endsWith("/rpc/consume_google_oauth_nonce")) {
        const ok = !used && returned && body.owner === owner && body.flow === nonce!.nonce &&
          body.verifier_hash === nonce!.browser_hash;
        if (ok) used = true;
        return Response.json(ok);
      }
      if (url.hostname === "oauth2.googleapis.com") {
        assertEquals(new URLSearchParams(String(init?.body)).get("code_verifier"), verifier);
        return mode === "exchange-error"
          ? Response.json({ error_description: "raw sensitive provider details" }, { status: 400 })
          : Response.json({
            access_token: "fixture-access",
            refresh_token: "fixture-refresh",
            expires_in: 3600,
            scope: mode === "scope-missing" ? "email" : "email https://www.googleapis.com/auth/drive.file",
          });
      }
      if (url.hostname === "openidconnect.googleapis.com") {
        return Response.json(mode === "no-email" ? {} : { email: "fixture@example.invalid" });
      }
      if (url.pathname.endsWith("/provider_connections") && init?.method === "POST") {
        connections++;
        return Response.json(null, { status: 201 });
      }
      throw new Error(`Unexpected fake path: ${url.pathname}`);
    }) as typeof fetch;
    const start = await capture("../functions/google-oauth-start/index.ts");
    const callback = await capture("../functions/google-oauth-callback/index.ts");
    const begin = async () => {
      const response = await start(
        new Request(
          `http://edge.invalid/google-oauth-start?redirect_to=${
            encodeURIComponent("https://app.example.invalid/app/connections/")
          }&browser_challenge=${challenge}`,
          {
            headers: { Authorization: "Bearer fixture-jwt" },
          },
        ),
      );
      assertEquals(response.status, 200);
      const consent = new URL((await response.json()).url);
      assertEquals(consent.searchParams.get("code_challenge"), challenge);
      const state = consent.searchParams.get("state")!;
      const redirect = await callback(
        new Request(`http://edge.invalid/google-oauth-callback?state=${encodeURIComponent(state)}&code=fixture-code`),
      );
      assertEquals(redirect.status, 302);
      const target = new URL(redirect.headers.get("location")!);
      assertEquals(target.origin, "https://app.example.invalid");
      assertEquals(new URLSearchParams(target.hash.slice(1)).get("google_code"), "fixture-code");
      assertEquals(connections, 0);
      return state;
    };
    const finish = (state: string, proof: string) =>
      callback(
        new Request("http://edge.invalid/google-oauth-callback", {
          method: "POST",
          headers: { Authorization: "Bearer fixture-jwt", "Content-Type": "application/json" },
          body: JSON.stringify({ state, code: "fixture-code", verifier: proof }),
        }),
      );
    const state = await begin();
    assertEquals((await finish(state, "x".repeat(64))).status, 400);
    assertEquals(connections, 0);
    assertEquals((await finish(state, verifier)).status, 200);
    assertEquals(connections, 1);
    assertEquals((await finish(state, verifier)).status, 400);
    assertEquals(connections, 1);
    for (const failure of ["scope-missing", "no-email", "exchange-error"]) {
      mode = failure;
      connections = 0;
      const fresh = await begin();
      const response = await finish(fresh, verifier);
      assertEquals(response.status, 400);
      assertEquals(connections, 0);
      assert(!(await response.text()).includes("raw sensitive"));
    }
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

Deno.test("audit billing routes: same-second deletion cannot remove Pro and a crash before completion is retried", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const owner = crypto.randomUUID();
  const receipts = new Map<string, { processed_at: string | null }>();
  let generation = 0;
  let plan = "pro";
  let failProfile = true;
  let profileWrites = 0;
  let failLookup = false;
  let failTrialUser = false;
  try {
    ["http://database.invalid", "fixture-key", "fixture-webhook", "fixture-stripe"].forEach((v, i) =>
      Deno.env.set(names[i], v)
    );
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.pathname.endsWith("/stripe_events")) {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? body.id;
        if (init?.method === "POST") {
          if (!receipts.has(id)) receipts.set(id, { processed_at: null });
          return Response.json(null, { status: 201 });
        }
        if (init?.method === "PATCH") {
          receipts.set(id, body);
          return Response.json(null);
        }
        return Response.json(receipts.get(id));
      }
      if (url.pathname.endsWith("/rpc/begin_stripe_sync")) return Response.json(++generation);
      if (url.pathname.endsWith("/profiles") && init?.method !== "PATCH") {
        return failLookup
          ? Response.json({ message: "fake lookup outage" }, { status: 500 })
          : Response.json({ user_id: owner });
      }
      if (url.pathname.includes("/auth/v1/admin/users/")) {
        return failTrialUser
          ? Response.json({ message: "fake auth outage" }, { status: 503 })
          : Response.json({ id: owner, email: "fixture@example.invalid" });
      }
      if (url.pathname.endsWith("/rpc/claim_trial")) return Response.json(null);
      if (url.hostname === "api.stripe.com") {
        return Response.json({
          data: [
            { id: "fixture-ended", customer: "fixture-customer", status: "canceled", trial_end: null },
            { id: "fixture-live", customer: "fixture-customer", status: "active", trial_end: null },
          ],
          has_more: false,
        });
      }
      if (url.pathname.endsWith("/profiles") && init?.method === "PATCH") {
        profileWrites++;
        if (failProfile) return Response.json({ message: "fake write outage" }, { status: 500 });
        assertEquals(url.searchParams.get("stripe_sync_generation"), `eq.${generation}`);
        plan = body.plan;
        return Response.json([{ user_id: owner }]);
      }
      throw new Error(`Unexpected fake billing path: ${url.pathname}`);
    }) as typeof fetch;
    const handler = await capture("../functions/stripe-webhook/index.ts");
    const timestamp = Math.floor(Date.now() / 1000);
    const send = async (type: string, id: string, metadata = true, trial = false) => {
      const payload = JSON.stringify({
        id,
        type,
        created: timestamp,
        data: {
          object: {
            id: "fixture-ended",
            customer: "fixture-customer",
            status: "canceled",
            trial_end: trial ? timestamp + 86400 : null,
            ...(metadata ? { metadata: { user_id: owner } } : {}),
          },
        },
      });
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode("fixture-webhook"),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
      const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
      return handler(
        new Request("http://edge.invalid/stripe-webhook", {
          method: "POST",
          body: payload,
          headers: { "stripe-signature": `t=${timestamp},v1=${sig}` },
        }),
      );
    };
    assertEquals((await send("customer.subscription.updated", "fixture-event-a")).status, 500);
    assertEquals(receipts.get("fixture-event-a")?.processed_at, null);
    failProfile = false;
    assertEquals((await send("customer.subscription.updated", "fixture-event-a")).status, 200);
    assertEquals(plan, "pro");
    assert(receipts.get("fixture-event-a")?.processed_at);
    assertEquals((await send("customer.subscription.deleted", "fixture-event-b")).status, 200);
    assertEquals(plan, "pro");
    const writes = profileWrites;
    assertEquals((await send("customer.subscription.deleted", "fixture-event-b")).status, 200);
    assertEquals(profileWrites, writes);
    // A transient lookup is not an unknown/deleted customer: Stripe must retry.
    failLookup = true;
    assertEquals((await send("customer.subscription.updated", "fixture-event-lookup", false)).status, 500);
    assertEquals(receipts.get("fixture-event-lookup")?.processed_at, null);
    failLookup = false;
    assertEquals((await send("customer.subscription.updated", "fixture-event-lookup", false)).status, 200);
    failTrialUser = true;
    assertEquals((await send("customer.subscription.updated", "fixture-event-trial", true, true)).status, 500);
    assertEquals(receipts.get("fixture-event-trial")?.processed_at, null);
    failTrialUser = false;
    assertEquals((await send("customer.subscription.updated", "fixture-event-trial", true, true)).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

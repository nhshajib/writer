import { assertEquals } from "jsr:@std/assert@1.0.13";
import { planForSubscriptionStatus, verifyStripeSignature } from "../functions/_shared/stripe.ts";

async function sign(payload: string, secret: string, t: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

const NOW = 1_800_000_000_000;
const T = NOW / 1000;
const payload = '{"id":"evt_1","type":"customer.subscription.created"}';

Deno.test("accepts a valid Stripe signature", async () => {
  const v1 = await sign(payload, "whsec_test", T);
  assertEquals(await verifyStripeSignature(payload, `t=${T},v1=${v1}`, "whsec_test", 300, NOW), true);
  // Extra (rotated) signatures are fine as long as one matches.
  assertEquals(await verifyStripeSignature(payload, `t=${T},v1=deadbeef,v1=${v1}`, "whsec_test", 300, NOW), true);
});

Deno.test("rejects tampered, wrong-secret, stale or malformed signatures", async () => {
  const v1 = await sign(payload, "whsec_test", T);
  assertEquals(await verifyStripeSignature(payload + " ", `t=${T},v1=${v1}`, "whsec_test", 300, NOW), false);
  assertEquals(await verifyStripeSignature(payload, `t=${T},v1=${v1}`, "whsec_other", 300, NOW), false);
  assertEquals(await verifyStripeSignature(payload, `t=${T},v1=${v1}`, "whsec_test", 300, NOW + 301_000), false);
  assertEquals(await verifyStripeSignature(payload, null, "whsec_test", 300, NOW), false);
  assertEquals(await verifyStripeSignature(payload, "garbage", "whsec_test", 300, NOW), false);
  assertEquals(await verifyStripeSignature(payload, `t=${T}`, "whsec_test", 300, NOW), false);
});

Deno.test("plan follows subscription status", () => {
  assertEquals(["trialing", "active", "past_due"].map(planForSubscriptionStatus), ["pro", "pro", "pro"]);
  assertEquals(["canceled", "unpaid", "incomplete", "incomplete_expired", null].map(planForSubscriptionStatus), [
    "free",
    "free",
    "free",
    "free",
    "free",
  ]);
});

Deno.test("audit 9/10: an older live subscription wins over a newer canceled one", async () => {
  const { preferredSubscription, subscriptionHasNotEnded, customerSubscriptions } = await import(
    "../functions/_shared/stripe.ts"
  );
  const current = preferredSubscription([{ id: "ended", status: "canceled" }, { id: "live", status: "active" }]);
  assertEquals(planForSubscriptionStatus(current?.status), "pro");
  assertEquals(["unpaid", "incomplete", "past_due", "paused"].map(subscriptionHasNotEnded), [true, true, true, true]);
  assertEquals(["canceled", "incomplete_expired", null].map(subscriptionHasNotEnded), [false, false, false]);
  let page = 0;
  const all = await customerSubscriptions(
    "fixture-secret",
    "fixture-customer",
    false,
    (() => {
      page++;
      return Promise.resolve(Response.json(
        page === 1
          ? { data: [{ id: "ended", status: "canceled" }], has_more: true }
          : { data: [{ id: "live", status: "active" }], has_more: false },
      ));
    }) as typeof fetch,
  );
  assertEquals(page, 2);
  assertEquals(preferredSubscription(all)?.id, "live");
});

// Stripe webhook. Keeps profiles.plan in sync with the user's subscription and
// records trial claims. Deployed with verify_jwt = false: requests are
// authenticated by the Stripe-Signature header instead.

import { grantDayPass } from "../_shared/dayPass.ts";
import { adminClient, requireEnv } from "../_shared/env.ts";
import { HttpError, json, readTextBounded, serve } from "../_shared/http.ts";
import { stripeGet, verifyStripeSignature } from "../_shared/stripe.ts";
import { syncCustomerBilling } from "../_shared/billingSync.ts";

interface StripeEvent {
  id: string;
  type: string;
  /** Unix seconds. */
  created: number;
  data: { object: Record<string, unknown> };
}

interface Subscription {
  id: string;
  customer: string;
  status: string;
  trial_end: number | null;
  metadata?: { user_id?: string };
}

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");

  const payload = await readTextBounded(req);
  const valid = await verifyStripeSignature(
    payload,
    req.headers.get("stripe-signature"),
    requireEnv("STRIPE_WEBHOOK_SECRET"),
  );
  if (!valid) throw new HttpError(400, "Invalid signature.");

  const event = JSON.parse(payload) as StripeEvent;
  const db = adminClient();

  // Receipt is not completion. A crash leaves processed_at null so retries
  // re-read Stripe and finish the idempotent profile/trial updates.
  const { error: receiptError } = await db.from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true });
  if (receiptError) throw new Error("The payment update could not be recorded.");
  const { data: receipt, error: seenError } = await db.from("stripe_events").select("processed_at")
    .eq("id", event.id).single();
  if (seenError) throw new Error("The payment update could not be checked.");
  if (receipt.processed_at) return json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await grantDayPass(event.data.object);
        break;
      case "charge.refunded":
        if (event.data.object.refunded === true && typeof event.data.object.payment_intent === "string") {
          const { error } = await db.rpc("refund_day_pass", { intent: event.data.object.payment_intent });
          if (error) throw new Error("The Day Pass refund could not be recorded.");
        }
        await syncCustomerEvent(event.data.object);
        console.warn("typewit.billing_review", { type: event.type, event_id: event.id });
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        await syncCustomerEvent(event.data.object);
        break;
      case "charge.dispute.created":
      case "radar.early_fraud_warning.created": {
        const charge = event.data.object.charge;
        const id = referenceId(charge);
        const object = id
          ? await stripeGet<{ customer?: unknown }>(
            requireEnv("STRIPE_SECRET_KEY"),
            `charges/${encodeURIComponent(id)}`,
          )
          : event.data.object;
        await syncCustomerEvent(object);
        console.warn("typewit.billing_review", { type: event.type, event_id: event.id });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as unknown as Subscription, event.type, event.created);
        break;
      default:
        break;
    }
  } catch (error) {
    throw error; // Keep the unprocessed receipt for Stripe's retry.
  }
  const { error: processedError } = await db.from("stripe_events").update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);
  if (processedError) throw new Error("The payment update could not be completed.");
  return json({ received: true });
});

async function syncSubscription(subscription: Subscription, _eventType: string, _created: number): Promise<void> {
  const owner = await findOwner(subscription.customer, subscription.metadata?.user_id);
  if (!owner) return;
  await syncCustomerBilling({
    ...owner,
    customer: subscription.customer,
    secret: requireEnv("STRIPE_SECRET_KEY"),
    fallbackTrial: subscription,
  });
}

function referenceId(value: unknown): string | null {
  const id = typeof value === "string"
    ? value
    : value && typeof value === "object"
    ? (value as { id?: unknown }).id
    : null;
  return typeof id === "string" && id.length > 0 && id.length <= 255 ? id : null;
}

async function syncCustomerEvent(object: { customer?: unknown }): Promise<void> {
  const customer = referenceId(object.customer);
  if (!customer) return;
  const owner = await findOwner(customer);
  if (!owner) return; // Deleted/unmapped accounts must not be recreated by retries.
  await syncCustomerBilling({ ...owner, customer, secret: requireEnv("STRIPE_SECRET_KEY") });
}

async function findOwner(
  customer: string,
  metadataOwner?: string,
): Promise<{ owner: string; expectedCustomer: string | null } | null> {
  const db = adminClient();
  const { data, error } = await db.from("profiles").select("user_id,stripe_customer_id").eq(
    "stripe_customer_id",
    customer,
  ).maybeSingle();
  if (error) throw new Error("The billing account could not be checked. Stripe will retry.");
  if (data) return { owner: data.user_id, expectedCustomer: customer };
  if (!metadataOwner) return null;
  const { data: fallback, error: fallbackError } = await db.from("profiles").select("user_id,stripe_customer_id").eq(
    "user_id",
    metadataOwner,
  ).maybeSingle();
  if (fallbackError) throw new Error("The billing account could not be checked. Stripe will retry.");
  if (!fallback || (fallback.stripe_customer_id && fallback.stripe_customer_id !== customer)) return null;
  return { owner: fallback.user_id, expectedCustomer: fallback.stripe_customer_id ?? null };
}

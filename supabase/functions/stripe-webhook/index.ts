// Stripe webhook. Keeps profiles.plan in sync with the user's subscription and
// records trial claims. Deployed with verify_jwt = false: requests are
// authenticated by the Stripe-Signature header instead.

import { grantDayPass } from "../_shared/dayPass.ts";
import { adminClient, requireEnv } from "../_shared/env.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import {
  customerSubscriptions,
  planForSubscriptionStatus,
  preferredSubscription,
  verifyStripeSignature,
} from "../_shared/stripe.ts";

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

  const payload = await req.text();
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
        break;
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

async function syncSubscription(subscription: Subscription, _eventType: string, created: number): Promise<void> {
  const db = adminClient();
  const userId = await findUserId(subscription);
  if (!userId) {
    console.error("No TypeWit user for Stripe customer", subscription.customer);
    return;
  }

  // Acquire a generation BEFORE reading Stripe. If another webhook starts
  // a newer read, this result may not overwrite it even within the same second.
  const { data: generation, error: generationError } = await db.rpc("begin_stripe_sync", { owner: userId });
  if (generationError || generation == null) throw new Error("The billing account could not be synchronized.");
  const subscriptions = await customerSubscriptions<Subscription>(
    requireEnv("STRIPE_SECRET_KEY"),
    subscription.customer,
  );
  const current = preferredSubscription(subscriptions);
  const status = current?.status ?? "canceled";
  const { data: updated, error } = await db.from("profiles").update({
    subscription_status: status,
    plan: planForSubscriptionStatus(status),
    stripe_customer_id: subscription.customer,
    stripe_event_at: new Date(created * 1000).toISOString(),
  }).eq("user_id", userId).eq("stripe_sync_generation", generation).select("user_id");
  if (error || !updated?.length) throw new Error("A newer billing update is being applied. Stripe will retry.");

  // A subscription that starts in trial uses up this person's one trial.
  if (subscription.trial_end) {
    const { data, error: userError } = await db.auth.admin.getUserById(userId);
    if (userError) throw new Error("The trial account could not be checked. Stripe will retry.");
    const email = data?.user?.email;
    if (email) {
      const { error: claimError } = await db.rpc("claim_trial", {
        email,
        claimant: userId,
        subscription_id: subscription.id,
      });
      if (claimError) throw new Error(claimError.message);
    }
  }
}

async function findUserId(subscription: Subscription): Promise<string | null> {
  if (subscription.metadata?.user_id) return subscription.metadata.user_id;
  const { data, error } = await adminClient()
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", subscription.customer)
    .maybeSingle();
  if (error) throw new Error("The billing account could not be checked. Stripe will retry.");
  return data?.user_id ?? null;
}

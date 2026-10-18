// Stripe webhook. Keeps profiles.plan in sync with the user's subscription and
// records trial claims. Deployed with verify_jwt = false: requests are
// authenticated by the Stripe-Signature header instead.

import { adminClient, requireEnv } from "../_shared/env.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import { planForSubscriptionStatus, verifyStripeSignature } from "../_shared/stripe.ts";

interface StripeEvent {
  id: string;
  type: string;
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

  // Process each event once; Stripe retries deliveries.
  const { data: fresh, error: seenError } = await db
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (seenError) throw new Error(seenError.message);
  if (!fresh?.length) return json({ received: true, duplicate: true });

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as unknown as Subscription, event.type);
      break;
    default:
      break;
  }
  return json({ received: true });
});

async function syncSubscription(subscription: Subscription, eventType: string): Promise<void> {
  const db = adminClient();
  const userId = await findUserId(subscription);
  if (!userId) {
    console.error("No TypeWit user for Stripe customer", subscription.customer);
    return;
  }

  const status = eventType === "customer.subscription.deleted" ? "canceled" : subscription.status;
  const { error } = await db
    .from("profiles")
    .update({
      subscription_status: status,
      plan: planForSubscriptionStatus(status),
      stripe_customer_id: subscription.customer,
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  // A subscription that starts in trial uses up this person's one trial.
  if (subscription.trial_end) {
    const { data } = await db.auth.admin.getUserById(userId);
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
  const { data } = await adminClient()
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", subscription.customer)
    .maybeSingle();
  return data?.user_id ?? null;
}

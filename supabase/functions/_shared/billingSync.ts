import { adminClient } from "./env.ts";
import {
  type CustomerSubscription,
  customerSubscriptions,
  planForSubscriptionStatus,
  preferredSubscription,
} from "./stripe.ts";

/** All writers use the same generation and customer guard, including recovery. */
export async function syncCustomerBilling(input: {
  owner: string;
  customer: string;
  secret: string;
  expectedCustomer?: string | null;
  fallbackTrial?: CustomerSubscription;
  observedAt?: number;
  deadline?: number;
}): Promise<void> {
  const db = adminClient();
  const deadline = input.deadline ?? Date.now() + 60_000;
  const signal = () => {
    if (Date.now() >= deadline) throw new Error("Billing synchronization timed out. Please retry.");
    return AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now())));
  };
  const { data: generation, error: generationError } = await db.rpc("begin_stripe_sync", { owner: input.owner })
    .abortSignal(signal());
  if (generationError || generation == null) throw new Error("The billing account could not be synchronized.");
  const subscriptions = await customerSubscriptions<CustomerSubscription>(
    input.secret,
    input.customer,
    false,
    (url, init) => fetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal()]) : signal() }),
  );
  const current = preferredSubscription(subscriptions);
  const status = current?.status ?? "canceled";
  const update = db.from("profiles").update({
    subscription_status: status,
    plan: planForSubscriptionStatus(status),
    stripe_customer_id: input.customer,
    // Legacy column also records recovery observations; ordering uses generation.
    stripe_event_at: new Date(input.observedAt ?? Date.now()).toISOString(),
  }).eq("user_id", input.owner).eq("stripe_sync_generation", generation);
  const guarded = input.expectedCustomer === null
    ? update.is("stripe_customer_id", null)
    : update.eq("stripe_customer_id", input.expectedCustomer ?? input.customer);
  const { data: updated, error } = await guarded.select("user_id").abortSignal(signal());
  if (error || !updated?.length) throw new Error("A newer billing update is being applied. Stripe will retry.");

  const trial = subscriptions.find((s) => s.trial_end) ?? (input.fallbackTrial?.trial_end ? input.fallbackTrial : null);
  if (trial) {
    signal();
    const { data, error: userError } = await db.auth.admin.getUserById(input.owner);
    if (userError) throw new Error("The trial account could not be checked. Stripe will retry.");
    if (data?.user?.email) {
      const { error: claimError } = await db.rpc("claim_trial", {
        email: data.user.email,
        claimant: input.owner,
        subscription_id: trial.id,
      }).abortSignal(signal());
      if (claimError) throw new Error("The trial could not be recorded. Stripe will retry.");
    }
  }
}

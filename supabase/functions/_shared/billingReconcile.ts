import { adminClient } from "./env.ts";
import { syncCustomerBilling } from "./billingSync.ts";

/** Bounded, oldest-first recovery; does not start/cancel charges or writing sessions. */
export async function reconcileBilling(now = Date.now()): Promise<{ checked: number; failed: number }> {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) return { checked: 0, failed: 0 };
  const db = adminClient();
  const deadline = Date.now() + 5_000;
  const { data, error } = await db.from("profiles").select("user_id,stripe_customer_id")
    .not("stripe_customer_id", "is", null)
    .or(`stripe_event_at.is.null,stripe_event_at.lt.${new Date(now - 3_600_000).toISOString()}`)
    .order("stripe_event_at", { ascending: true, nullsFirst: true }).limit(5)
    .abortSignal(AbortSignal.timeout(5_000));
  if (error) {
    console.error("typewit.billing_reconcile", { stage: "list", failed: true });
    return { checked: 0, failed: 1 };
  }
  const results = await Promise.all((data ?? []).map(async (row) => {
    try {
      await syncCustomerBilling({
        owner: row.user_id,
        customer: row.stripe_customer_id,
        secret,
        observedAt: now,
        deadline,
      });
      return true;
    } catch {
      console.error("typewit.billing_reconcile", { stage: "customer", failed: true });
      // Defer this failed observation without changing access. A bad legacy
      // customer must not starve every account behind it in the next batch.
      await db.from("profiles").update({ stripe_event_at: new Date(now).toISOString() })
        .eq("user_id", row.user_id).eq("stripe_customer_id", row.stripe_customer_id)
        .abortSignal(AbortSignal.timeout(1_000));
      return false;
    }
  }));
  return { checked: results.length, failed: results.filter((ok) => !ok).length };
}

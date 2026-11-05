import { adminClient, requireEnv } from "./env.ts";
import { HttpError } from "./http.ts";
import { customerSubscriptions, stripeDelete, stripeGet, stripeRequest, subscriptionHasNotEnded } from "./stripe.ts";

/** Serialize against checkout, resolve billing, and renew the lease before erasure. */
export async function withAccountDeletionBilling<T>(
  owner: string,
  endPro: boolean,
  remove: (confirmExclusive: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const db = adminClient();
  const lease = crypto.randomUUID();
  const { data: acquired, error } = await db.rpc("acquire_billing_checkout", { owner, lease });
  if (error) throw new HttpError(503, "Your billing status could not be checked. Please try again.");
  if (!acquired) {
    throw new HttpError(409, "Billing is being updated. Please wait a moment before deleting your account.");
  }
  try {
    try {
      const { data: profile, error: profileError } = await db.from("profiles").select(
        "stripe_customer_id,subscription_status",
      ).eq("user_id", owner).maybeSingle();
      if (profileError || !profile) throw new Error("Billing profile unavailable");
      if (!profile.stripe_customer_id && subscriptionHasNotEnded(profile.subscription_status)) {
        throw new Error("Billing customer unavailable");
      }
      if (profile.stripe_customer_id) {
        const secret = requireEnv("STRIPE_SECRET_KEY");
        const deadline = Date.now() + 90_000;
        const boundedFetch: typeof fetch = (url, init) => {
          if (Date.now() >= deadline) throw new Error("Billing deadline reached");
          const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
          return fetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal });
        };
        const subscriptions = await customerSubscriptions(secret, profile.stripe_customer_id, false, boundedFetch);
        const ongoing = subscriptions.filter((s) => subscriptionHasNotEnded(s.status));
        if (ongoing.length && !endPro) {
          throw new HttpError(
            409,
            "To delete now, select End Pro now in the confirmation, or cancel Pro in Plan & billing first.",
          );
        }
        const open = await stripeGet<
          { data: { id: string; client_reference_id?: string; metadata?: { user_id?: string } }[]; has_more?: boolean }
        >(
          secret,
          "checkout/sessions",
          { customer: profile.stripe_customer_id, status: "open", limit: "100" },
          boundedFetch,
        );
        if (open.has_more || open.data.length > 20 || ongoing.length > 10) {
          throw new HttpError(409, "Please contact support to resolve your pending billing before deletion.");
        }
        for (const session of open.data) {
          const reference = session.client_reference_id ?? session.metadata?.user_id;
          if (reference !== owner || (session.metadata?.user_id && session.metadata.user_id !== owner)) {
            throw new HttpError(409, "Please contact support to check a pending payment before deletion.");
          }
        }
        for (let i = 0; i < open.data.length; i += 2) {
          await Promise.all(
            open.data.slice(i, i + 2).map((s) =>
              stripeRequest(secret, `checkout/sessions/${encodeURIComponent(s.id)}/expire`, {}, boundedFetch)
            ),
          );
        }
        for (let i = 0; i < ongoing.length; i += 2) {
          await Promise.all(
            ongoing.slice(i, i + 2).map((s) =>
              stripeDelete(secret, `subscriptions/${encodeURIComponent(s.id)}`, {
                invoice_now: "false",
                prorate: "false",
              }, boundedFetch)
            ),
          );
        }
        if (
          (await customerSubscriptions(secret, profile.stripe_customer_id, false, boundedFetch)).some((s) =>
            subscriptionHasNotEnded(s.status)
          )
        ) throw new Error("Billing is still ongoing");
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        "Billing could not be resolved safely. Your account has not been deleted. Please retry or contact support.",
      );
    }
    return await remove(async () => {
      const { data: renewed, error: renewError } = await db.from("billing_checkout_locks").update({
        expires_at: new Date(Date.now() + 180_000).toISOString(),
      }).eq("user_id", owner).eq("lease_id", lease).select("user_id");
      if (renewError || !renewed?.length) {
        throw new HttpError(409, "Billing changed during deletion. Your account has not been deleted. Please retry.");
      }
    });
  } finally {
    const { error: releaseError } = await db.from("billing_checkout_locks").delete().eq("user_id", owner).eq(
      "lease_id",
      lease,
    );
    if (releaseError) console.error("Account deletion lock release failed");
  }
}

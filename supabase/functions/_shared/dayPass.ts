/** Verified Stripe payment fulfillment shared by webhook and checkout return. */
import { adminClient } from "./env.ts";
export const DAY_PASS_PRICE = "typewit-day-pass-399-usd";
export const DAY_PASS_AMOUNT = 399;
/** Old paid/pending checkouts must still activate at their original verified price. */
export function dayPassAmount(offer: unknown): number | undefined {
  if (offer === DAY_PASS_PRICE) return DAY_PASS_AMOUNT;
  if (offer === "typewit-day-pass-499-usd") return 499;
  return undefined;
}
export async function grantDayPass(session: Record<string, unknown>, expectedOwner?: string): Promise<boolean> {
  const metadata = session.metadata as Record<string, string> | undefined;
  const amount = dayPassAmount(metadata?.typewit_price);
  if (session.mode !== "payment" || amount === undefined || session.payment_status !== "paid") {
    return false;
  }
  if (
    session.currency !== "usd" || (session.amount_subtotal ?? session.amount_total) !== amount ||
    typeof session.id !== "string" || typeof session.customer !== "string" ||
    typeof session.payment_intent !== "string" || !metadata?.user_id ||
    (expectedOwner && expectedOwner !== metadata.user_id)
  ) {
    throw new Error("The Day Pass payment could not be verified.");
  }
  const db = adminClient();
  const { data: profile, error } = await db.from("profiles").select("user_id,stripe_customer_id").eq(
    "user_id",
    metadata.user_id,
  ).maybeSingle();
  if (error) throw new Error("The Day Pass account could not be checked.");
  if (!profile) return false;
  if (profile.stripe_customer_id !== session.customer) throw new Error("The payment account does not match.");
  const { data, error: grantError } = await db.rpc("grant_day_pass", {
    owner: profile.user_id,
    checkout: session.id,
    intent: session.payment_intent,
  });
  if (grantError) throw new Error("Day Pass activation could not complete. Please try again.");
  return typeof data === "string" && Date.parse(data) > Date.now();
}

/** Verified Stripe payment fulfillment shared by webhook and checkout return. */
import { adminClient } from "./env.ts";
export const DAY_PASS_PRICE = "typewit-day-pass-499-usd";
export async function grantDayPass(session: Record<string, unknown>, expectedOwner?: string): Promise<boolean> {
  const metadata = session.metadata as Record<string, string> | undefined;
  if (session.mode !== "payment" || metadata?.typewit_price !== DAY_PASS_PRICE || session.payment_status !== "paid") {
    return false;
  }
  if (
    session.currency !== "usd" || (session.amount_subtotal ?? session.amount_total) !== 499 ||
    typeof session.id !== "string" || typeof session.customer !== "string" ||
    typeof session.payment_intent !== "string" || !metadata.user_id ||
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

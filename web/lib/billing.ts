import { api } from "./api";
import { ADULT_AGE, ageFrom } from "./age";
import type { Profile } from "./dashboard";

export type CheckoutOffer = "year" | "month" | "day";

/** Opens Stripe Checkout for Pro (yearly or monthly) or a Day Pass. Throws with a readable message. */
export async function startCheckout(offer: CheckoutOffer): Promise<void> {
  const { url } = await api<{ url: string }>("billing/checkout", { method: "POST", body: { interval: offer } });
  window.location.assign(url);
}

/** Paid plans have to be bought by an adult; the server refuses under-18s too. */
export function isMinor(profile: Pick<Profile, "birth_year" | "birth_month">): boolean {
  return profile.birth_year != null && profile.birth_month != null && ageFrom(profile.birth_year, profile.birth_month) < ADULT_AGE;
}

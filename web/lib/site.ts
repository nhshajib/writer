/** Business details shown across the site. */
export const SUPPORT_EMAIL = "support@typewit.com";
export const LEGAL_UPDATED = "20 October 2026";

/** Pro prices as shown on the site; they must match the Stripe prices (see README, Launch checklist). */
export const PRO_PRICE = {
  year: { amount: "$9", note: "/ month", saving: "$108 billed yearly · save 40%" },
  month: { amount: "$15", note: "/ month", saving: undefined },
} as const;

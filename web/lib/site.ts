/** Business details shown across the site. */
export const SUPPORT_EMAIL = "support@typewit.com";
export const LEGAL_UPDATED = "31 October 2026";

/** Pro prices as shown on the site; they must match the Stripe prices (see README, Launch checklist). */
export const PRO_PRICE = {
  year: { amount: "$5", note: "/ month", saving: "$60 billed yearly · save 28%" },
  month: { amount: "$6.99", note: "/ month", saving: undefined },
} as const;
/** On the Yearly toggle: $60 a year against 12 × $6.99 = $83.88. */
export const YEARLY_SAVING = "save 28%";
export const DAY_PASS_PRICE = "$3.99";

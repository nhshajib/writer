import { PRO_PRICE } from "@/lib/site";

/**
 * What each plan includes, in one place so the homepage, pricing page and app say the same thing.
 * The numbers match PLAN_LIMITS (lib/dashboard.tsx) and the server (supabase/functions/_shared/limits.ts).
 */
export const FREE_FEATURES = [
  "150 words a day",
  "Sessions up to 30 minutes",
  "Standard pacing with breaks",
  "Every insertion mode and accessibility feature",
];

export const PRO_FEATURES = [
  "Unlimited words",
  "Sessions up to a week, 3 at once",
  "Typing speed and custom timing",
  "Saved pace presets",
  "Start sessions later",
  "Permanent milestones in Google Docs version history",
  "Priority email support",
];

/** The comparison table on the pricing page. */
export const PLAN_COMPARISON: { feature: string; free: string; pro: string }[] = [
  { feature: "Words per day", free: "150", pro: "Unlimited" },
  { feature: "Longest session", free: "30 minutes", pro: "1 week" },
  { feature: "Documents in progress at once", free: "1", pro: "3" },
  { feature: "Sentence, word, paragraph or even-part steps", free: "Yes", pro: "Yes" },
  { feature: "Standard pacing with breaks", free: "Yes", pro: "Yes" },
  { feature: "Typing speed and custom timing", free: "No", pro: "Yes" },
  { feature: "Saved pace presets", free: "No", pro: "Yes" },
  { feature: "Start a session later", free: "No", pro: "Yes" },
  { feature: "Pause, resume and stop", free: "Yes", pro: "Yes" },
  { feature: "Activity log with download", free: "Yes", pro: "Yes" },
  { feature: "Permanent milestones in Google Docs version history", free: "No", pro: "Yes" },
  { feature: "Google Docs and Microsoft Word", free: "Yes", pro: "Yes" },
  { feature: "Every accessibility feature", free: "Yes", pro: "Yes" },
  { feature: "Email support", free: "Yes", pro: "Priority" },
];

export const PRO_PRICE_LINE = `${PRO_PRICE.year.amount}/month billed yearly, or ${PRO_PRICE.month.amount} monthly`;

import { PRO_PRICE } from "@/lib/site";
import { PLAN_LIMITS as SERVER_PLAN_LIMITS, type PlanTier } from "../../supabase/functions/_shared/limits";

export type PaidPlan = Exclude<PlanTier, "free">;

/**
 * The lowest plan that includes each gated feature, so every lock in the app names the right plan.
 * The server enforces the same rules (supabase/functions/_shared/limits.ts, plan.ts, drips/index.ts).
 */
export const FEATURE_PLAN = {
  unlimitedWords: "day_pass",
  writingHours: "day_pass",
  writingBlocks: "day_pass",
  drafting: "pro",
  typingSpeed: "pro",
  customPace: "pro",
  presets: "pro",
  revisionPass: "pro",
  startLater: "pro",
  headingPlacement: "pro",
  import: "pro",
  pausedEdit: "pro",
  playback: "pro",
} as const satisfies Record<string, PaidPlan>;
export type Feature = keyof typeof FEATURE_PLAN;

const RANK: Record<PlanTier, number> = { free: 0, day_pass: 1, pro: 2 };
export const PLAN_NAME: Record<PlanTier, string> = { free: "Free", day_pass: "Day Pass", pro: "Pro" };

/** Whether `plan` includes everything `required` does. */
export function includes(plan: PlanTier, required: PlanTier): boolean {
  return RANK[plan] >= RANK[required];
}

/** Whether `plan` includes `feature`. */
export function canUse(plan: PlanTier, feature: Feature): boolean {
  return includes(plan, FEATURE_PLAN[feature]);
}

/** The lowest plan whose longest session fits `minutes`. */
export function planForMinutes(minutes: number): PlanTier {
  return (["free", "day_pass", "pro"] as const).find((p) => SERVER_PLAN_LIMITS[p].maxDurationSeconds >= minutes * 60) ?? "pro";
}

/**
 * What each plan includes, in one place so the homepage, pricing page and app say the same thing.
 * The numbers match PLAN_LIMITS (lib/dashboard.tsx) and the server (supabase/functions/_shared/limits.ts).
 */
export const FREE_FEATURES = [
  "250 words a day",
  "Sessions up to 60 minutes",
  "Natural and Steady rhythms, ready to use",
  "Paste formatted text without Markdown",
  "Single words or random groups, sentence pauses and accessibility tools",
];

export const PRO_FEATURES = [
  "Unlimited words",
  "Sessions up to a week, 3 at once",
  "Drafting rhythm with occasional corrected mistakes",
  "Adjustable cadence: 20–150 WPM with timing variation",
  "Neighbor-key typos: temporary letter slips, automatically corrected",
  "False starts: temporary wrong words, deleted and replaced",
  "Natural breaks: short sentence pauses with adjustable variation",
  "Custom longer breaks up to 8 hours",
  "Insert under a heading (Google Docs)",
  "Import .docx, .md and .txt files",
  "Edit remaining text and settings while paused",
  "Saved pace presets",
  "Writing hours in your time zone",
  "Custom writing blocks with breaks up to 8 hours",
  "Optional final revision pass (exact approved text restored)",
  "Read-only session playback",
  "Priority worker dispatch",
  "Start sessions later",
  "Priority email support",
];

/** The comparison table on the pricing page. */
export const DAY_PASS_FEATURES = ["$4.99 once · no renewal", "24 hours from payment confirmation", "Unlimited words · one active session", "Sessions up to 24 hours, within remaining access", "Writing hours, custom writing blocks and priority dispatch", "Existing Google Docs and background entry", "Natural and Steady rhythms, formatted paste and activity log"];

const BASE_COMPARISON: { feature: string; free: string; pro: string }[] = [
  { feature: "Words per day", free: "250", pro: "Unlimited" },
  { feature: "Longest session", free: "60 minutes", pro: "1 week" },
  { feature: "Documents in progress at once", free: "1", pro: "3" },
  { feature: "Sentence steps (long sentences split in two), plus other modes", free: "Yes", pro: "Yes" },
  { feature: "Natural and Steady ready-made rhythms", free: "Both included", pro: "Both included" },
  { feature: "Adjustable cadence (typing speed)", free: "No", pro: "20–150 WPM + timing variation" },
  { feature: "Neighbor-key typos", free: "No", pro: "Adjustable rate; automatically corrected" },
  { feature: "False starts", free: "No", pro: "Adjustable rate; wrong words deleted and replaced" },
  { feature: "Natural breaks after sentences", free: "Included in Natural rhythm", pro: "Fully adjustable" },
  { feature: "Paste headings, emphasis, lists, alignment and highlights", free: "Yes", pro: "Yes" },
  { feature: "Insert under a heading (Google Docs)", free: "No", pro: "Yes" },
  { feature: "Import .docx, .md and .txt files", free: "No", pro: "Yes" },
  { feature: "Edit remaining text and settings while paused", free: "No", pro: "Yes" },
  { feature: "Saved pace presets", free: "No", pro: "Yes" },
  { feature: "Start a session later", free: "No", pro: "Yes" },
  { feature: "Pause, resume and stop", free: "Yes", pro: "Yes" },
  { feature: "Activity log with download", free: "Yes", pro: "Yes" },
  { feature: "Google Docs and Microsoft Word", free: "Yes", pro: "Yes" },
  { feature: "Every accessibility feature", free: "Yes", pro: "Yes" },
  { feature: "Email support", free: "Yes", pro: "Priority" },
  { feature: "Use an existing Google Doc", free: "Ongoing access", pro: "Ongoing access" },
  { feature: "Background Google Docs entry", free: "Yes", pro: "Yes" },
  { feature: "Custom duration within your plan limit", free: "Yes", pro: "Yes" },
  { feature: "Custom writing blocks and long breaks", free: "No", pro: "5 min–12 hour blocks; 15 min–8 hour breaks" },
  { feature: "Writing hours (work window)", free: "No", pro: "Yes, with time zone" },
  { feature: "Single-word or random 1–5-word entry", free: "Both included", pro: "Both included" },
  { feature: "Final revision pass", free: "No", pro: "Optional, exact text restored" },
  { feature: "Session playback", free: "Activity log", pro: "Replay confirmed actions" },
  { feature: "Queue dispatch", free: "Standard", pro: "Priority, with fair scheduling" },
  { feature: "Access window", free: "Ongoing", pro: "While subscription is active" },
];

const DAY_VALUES: Record<string, string> = { "Custom writing blocks and long breaks": "Custom lengths, within remaining pass access", "Words per day": "Unlimited", "Longest session": "24 hours, within remaining access", "Writing hours (work window)": "Yes, with time zone", "Queue dispatch": "Priority, with fair scheduling", "Access window": "24 hours · no renewal" };
export const PLAN_COMPARISON = BASE_COMPARISON.map(row => ({ ...row, day: DAY_VALUES[row.feature] ?? row.free }));

export const PRO_PRICE_LINE = `${PRO_PRICE.year.amount}/month billed yearly, or ${PRO_PRICE.month.amount} monthly`;

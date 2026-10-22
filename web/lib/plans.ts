import { PRO_PRICE } from "@/lib/site";

/**
 * What each plan includes, in one place so the homepage, pricing page and app say the same thing.
 * The numbers match PLAN_LIMITS (lib/dashboard.tsx) and the server (supabase/functions/_shared/limits.ts).
 */
export const FREE_FEATURES = [
  "250 words a day",
  "Sessions up to 60 minutes",
  "Natural and Steady rhythms, ready to use",
  "Paste formatted text without Markdown",
  "Random word groups, sentence pauses and accessibility tools",
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
  "Optional final revision pass (exact approved text restored)",
  "Read-only session playback",
  "Priority worker dispatch",
  "Start sessions later",
  "Priority email support",
];

/** The comparison table on the pricing page. */
export const DAY_PASS_FEATURES = ["$4.99 once · no renewal", "24 hours from payment confirmation", "Unlimited words · one active session", "Sessions up to 24 hours, within remaining access", "Writing hours and priority worker dispatch", "Existing Google Docs and background entry", "Natural and Steady rhythms, formatted paste and activity log"];

const BASE_COMPARISON: { feature: string; free: string; pro: string }[] = [
  { feature: "Words per day", free: "250", pro: "Unlimited" },
  { feature: "Longest session", free: "60 minutes", pro: "1 week" },
  { feature: "Documents in progress at once", free: "1", pro: "3" },
  { feature: "Sentence, word, paragraph or even-part steps", free: "Yes", pro: "Yes" },
  { feature: "Natural and Steady ready-made rhythms", free: "Both included", pro: "Both included" },
  { feature: "Adjustable cadence (typing speed)", free: "No", pro: "20–150 WPM + timing variation" },
  { feature: "Neighbor-key typos", free: "No", pro: "Adjustable rate; automatically corrected" },
  { feature: "False starts", free: "No", pro: "Adjustable rate; wrong words deleted and replaced" },
  { feature: "Natural breaks after sentences", free: "Included in Natural rhythm", pro: "Fully adjustable" },
  { feature: "Paste headings, bold, italic, bullets and highlights", free: "Yes", pro: "Yes" },
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
  { feature: "Writing hours (work window)", free: "No", pro: "Yes, with time zone" },
  { feature: "Final revision pass", free: "No", pro: "Optional, exact text restored" },
  { feature: "Session playback", free: "Activity log", pro: "Replay confirmed actions" },
  { feature: "Queue dispatch", free: "Standard", pro: "Priority, with fair scheduling" },
  { feature: "Access window", free: "Ongoing", pro: "While subscription is active" },
];

const DAY_VALUES: Record<string, string> = { "Words per day": "Unlimited", "Longest session": "24 hours, within remaining access", "Writing hours (work window)": "Yes, with time zone", "Queue dispatch": "Priority, with fair scheduling", "Access window": "24 hours · no renewal" };
export const PLAN_COMPARISON = BASE_COMPARISON.map(row => ({ ...row, day: DAY_VALUES[row.feature] ?? row.free }));

export const PRO_PRICE_LINE = `${PRO_PRICE.year.amount}/month billed yearly, or ${PRO_PRICE.month.amount} monthly`;

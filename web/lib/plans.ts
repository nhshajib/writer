import { PRO_PRICE } from "@/lib/site";

/**
 * What each plan includes, in one place so the homepage, pricing page and app say the same thing.
 * The numbers match PLAN_LIMITS (lib/dashboard.tsx) and the server (supabase/functions/_shared/limits.ts).
 */
export const FREE_FEATURES = [
  "150 words a day",
  "Sessions up to 30 minutes",
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
  "Start sessions later",
  "Priority email support",
];

/** The comparison table on the pricing page. */
export const PLAN_COMPARISON: { feature: string; free: string; pro: string }[] = [
  { feature: "Words per day", free: "150", pro: "Unlimited" },
  { feature: "Longest session", free: "30 minutes", pro: "1 week" },
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
];

export const PRO_PRICE_LINE = `${PRO_PRICE.year.amount}/month billed yearly, or ${PRO_PRICE.month.amount} monthly`;

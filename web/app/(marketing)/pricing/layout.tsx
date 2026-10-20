import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/pricing/", "Pricing", "TypeWit is free for 150 words a day. Pro gives unlimited words, sessions up to a week, custom pacing, saved presets and scheduled starts, with 7 days free.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/pricing/", "Pricing", "TypeWit is free for 250 words a day. Pro gives unlimited words, sessions up to a week and 3 documents at once, with 7 days free.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

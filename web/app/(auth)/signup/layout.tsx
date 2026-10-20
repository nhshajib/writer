import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/signup/", "Create your free account", "Create a free TypeWit account with Google or a personal email. 250 words a day, no card needed.", { robots: { index: false, follow: true } });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { privateMeta } from "@/lib/seo";

export const metadata: Metadata = privateMeta("/signup/", "Create your free account", "Create a free TypeWit account with Google, Discord or a personal email. 250 words a day, no card needed.", { index: false, follow: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

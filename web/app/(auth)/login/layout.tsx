import type { Metadata } from "next";
import { privateMeta } from "@/lib/seo";

export const metadata: Metadata = privateMeta("/login/", "Sign in", "Sign in to TypeWit to start, pause or review your Google Docs and Word sessions.", { index: false, follow: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

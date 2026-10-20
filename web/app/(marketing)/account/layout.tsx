import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

// Old address kept for Stripe's return links; it forwards to Plan & usage.
export const metadata: Metadata = { title: "Plan & usage", robots: NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

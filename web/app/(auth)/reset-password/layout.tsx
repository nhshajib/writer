import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Choose a new password", robots: NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

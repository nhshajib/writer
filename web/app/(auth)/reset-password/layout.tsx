import type { Metadata } from "next";
import { privateMeta } from "@/lib/seo";

export const metadata: Metadata = privateMeta("/reset-password/", "Choose a new password", "Set a new password for your TypeWit account.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

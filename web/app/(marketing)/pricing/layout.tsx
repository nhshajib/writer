import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/pricing/", "Auto Typer Pricing: Free, Monthly & Yearly", "Compare TypeWit Free, Pro Monthly at $6.99 and Pro Yearly at $60/year. Formatted paste is included on Free. Yearly saves 28% versus monthly.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><div className="container"><Breadcrumbs items={[{ name: "Pricing", path: "/pricing/" }]} /></div>{children}</>;
}

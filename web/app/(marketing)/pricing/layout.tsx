import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/pricing/", "TypeWit Pricing: Free, Day Pass & Pro", "Compare TypeWit Free, a $3.99 Day Pass and Pro at $6.99/month or $60/year. See word limits, session lengths and included controls before choosing.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><div className="container"><Breadcrumbs items={[{ name: "Pricing", path: "/pricing/" }]} /></div>{children}</>;
}

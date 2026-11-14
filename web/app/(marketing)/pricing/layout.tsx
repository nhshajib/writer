import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta } from "@/lib/seo";
import { PAGE_UPDATED } from "@/lib/search-content";
import { SOFTWARE, webPage } from "@/lib/structured-data";

const TITLE = "TypeWit Pricing: Free, Day Pass & Pro";
const DESCRIPTION = "Compare TypeWit Free, a $3.99 Day Pass and Pro at $6.99/month or $60/year. See word limits, session lengths and included controls before choosing.";
export const metadata: Metadata = pageMeta("/pricing/", TITLE, DESCRIPTION);

/** The plans, with prices and billing periods, on the page that shows them. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [{ ...webPage({ path: "/pricing/", name: TITLE, description: DESCRIPTION, published: "2026-10-16", updated: PAGE_UPDATED["/pricing/"] }), mainEntity: { "@id": SOFTWARE["@id"] } }, SOFTWARE],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><div className="container"><Breadcrumbs items={[{ name: "Pricing", path: "/pricing/" }]} /></div>{children}<JsonLd data={STRUCTURED_DATA} /></>;
}

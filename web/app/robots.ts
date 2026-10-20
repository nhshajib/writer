import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

// Private and sign-in pages are kept out of search with a noindex tag, not here:
// a crawler blocked by robots.txt could never see that tag. Accounts are protected
// by sign-in either way.
export default function robots(): MetadataRoute.Robots {
  return INDEXABLE
    ? { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` }
    : { rules: { userAgent: "*", allow: "/" } };
}

import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";
import { PUBLIC_PAGES, CONTENT_UPDATED } from "@/lib/search-content";
export const dynamic = "force-static";
/** Canonical public pages only. No fake build-time freshness or ignored priority/changefreq values. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!INDEXABLE) return [];
  return PUBLIC_PAGES.map(path => ({ url: `${SITE_URL}${path}`, lastModified: CONTENT_UPDATED }));
}

import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

/** Only the public pages meant to be found in search. */
const PAGES = ["", "pricing", "support", "responsible-use", "privacy", "terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!INDEXABLE) return [];
  return PAGES.map((page) => ({
    url: `${SITE_URL}/${page ? `${page}/` : ""}`,
    changeFrequency: page === "" || page === "pricing" ? "weekly" : "monthly",
    priority: page === "" ? 1 : 0.6,
  }));
}

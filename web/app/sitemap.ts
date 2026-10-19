import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const PAGES = ["", "pricing", "responsible-use", "support", "privacy", "terms", "signup", "login"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: `https://typewit.com/${page ? `${page}/` : ""}`,
    changeFrequency: page === "" || page === "pricing" ? "weekly" : "monthly",
    priority: page === "" ? 1 : 0.6,
  }));
}

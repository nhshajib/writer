import type { Metadata } from "next";
import { allowIndexing } from "./indexing";

/** Canonicals always use the public site, including on deployment previews. */
export const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://typewit.com").origin;
export const INDEXABLE = allowIndexing({
  VERCEL: process.env.VERCEL, VERCEL_ENV: process.env.VERCEL_ENV, NETLIFY: process.env.NETLIFY, CONTEXT: process.env.CONTEXT,
  NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_NOINDEX: process.env.NEXT_PUBLIC_NOINDEX,
  NEXT_PUBLIC_ALLOW_INDEXING: process.env.NEXT_PUBLIC_ALLOW_INDEXING,
});
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };
export const PUBLIC_ROBOTS: Metadata["robots"] = INDEXABLE
  ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
  : NOINDEX;

export function pageMeta(path: string, title: string, description: string, extra: Metadata = {}): Metadata {
  const includesBrand = /\bTypeWit\b/i.test(title);
  const brandedTitle = includesBrand ? title : `${title} · TypeWit`;
  const base: Metadata = {
    title: includesBrand ? { absolute: title } : title, description, robots: PUBLIC_ROBOTS,
    alternates: { canonical: path },
    openGraph: {
      title: brandedTitle, description, url: `${SITE_URL}${path}`, siteName: "TypeWit", type: "website",
      images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: "TypeWit automated text entry for Google Docs and Word" }],
    },
    twitter: { card: "summary_large_image", title: brandedTitle, description, images: [`${SITE_URL}/twitter-image.png`] },
  };
  return { ...base, ...extra, openGraph: { ...base.openGraph, ...extra.openGraph }, twitter: { ...base.twitter, ...extra.twitter } };
}

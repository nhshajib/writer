import type { Metadata } from "next";

/**
 * The public address of the site. Set NEXT_PUBLIC_SITE_URL in the host's build
 * settings; production is typewit.com (served by Netlify).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://typewit.com").replace(/\/$/, "");

/**
 * Whether search engines may index this build. Vercel builds are test copies
 * (typewit.com is served from Netlify), so they are never indexed unless
 * NEXT_PUBLIC_ALLOW_INDEXING=true; NEXT_PUBLIC_NOINDEX=true turns indexing off anywhere.
 */
export const INDEXABLE = process.env.NEXT_PUBLIC_NOINDEX !== "true" &&
  (!process.env.VERCEL || process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true");

/** Pages that are never indexed: the signed-in app, sign-in pages and the Word add-in. */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/** Title, description, canonical address and share card for one public page. `path` ends with "/". */
export function pageMeta(path: string, title: string, description: string, extra: Metadata = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · TypeWit`, description, url: `${SITE_URL}${path}`, siteName: "TypeWit", type: "website" },
    ...extra,
  };
}

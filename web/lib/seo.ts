import type { Metadata } from "next";

export const SITE_URL = "https://typewit.com";

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

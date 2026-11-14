import { INDEXABLE, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

// Written by hand rather than with Next's robots helper, which can't express Content-Signal.
// Private and sign-in pages are kept out of search with a noindex tag, not here:
// a crawler blocked by robots.txt could never see that tag. Accounts are protected
// by sign-in either way.
// Content-Signal states how content may be used: search and AI answers yes; training is left unstated.
export function GET() {
  const body = INDEXABLE
    ? [
      "User-Agent: *",
      "Content-Signal: search=yes, ai-input=yes",
      "Allow: /",
      "Disallow: /functions/v1/",
      "Disallow: /__test/",
      "",
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      "",
    ].join("\n")
    : "User-Agent: *\nAllow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

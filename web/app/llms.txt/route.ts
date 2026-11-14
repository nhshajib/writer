import { GUIDES } from "@/lib/search-content";
import { SITE_URL } from "@/lib/seo";
import { DAY_PASS_PRICE, PRO_PRICE } from "@/lib/site";

export const dynamic = "force-static";

/** A short Markdown map of the public site for AI assistants (llms.txt). Search engines ignore it. */
export function GET() {
  const link = (path: string, name: string, note: string) => `- [${name}](${SITE_URL}${path}): ${note}`;
  const body = [
    "# TypeWit",
    "",
    `> TypeWit enters text you have written and approved into Google Docs and Microsoft Word over a schedule you choose. Google Docs sessions run in the cloud with no browser extension; Word uses an add-in that runs while the document is open. Plans: Free (250 words a day), a ${DAY_PASS_PRICE} Day Pass (24 hours, no renewal) and Pro (${PRO_PRICE.month.amount} a month or ${PRO_PRICE.year.total} a year).`,
    "",
    "TypeWit does not write or rewrite text. It is for authorized document-entry testing; academic cheating and false authorship claims are prohibited by its Responsible Use Agreement.",
    "",
    "## Product",
    link("/google-docs-auto-typer/", "Google Docs auto typer", "cloud entry into new or existing Google Docs, no extension"),
    link("/word-auto-typer/", "Microsoft Word auto typer", "the Word add-in and its open-document requirement"),
    link("/how-it-works/", "How it works", "paste, choose a rhythm, review and start"),
    link("/features/", "Features", "rhythms, formatting, pause and resume, activity log"),
    link("/pricing/", "Pricing", "Free, Day Pass and Pro compared"),
    link("/faq/", "FAQ", "common questions"),
    "",
    "## Guides",
    ...GUIDES.map((g) => link(`/guides/${g.slug}/`, g.title, g.description)),
    "",
    "## Policies",
    link("/responsible-use/", "Responsible Use Agreement", "what TypeWit may and may not be used for"),
    link("/privacy/", "Privacy Policy", "what is stored and why; Google access is limited to chosen files"),
    link("/support/", "Support", "help with connections, sessions and billing"),
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}

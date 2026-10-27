import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { pageMeta } from "@/lib/seo";
import { GUIDES } from "@/lib/search-content";
export const metadata = pageMeta("/guides/", "Google Docs & Word Auto Typer Guides", "Guides to auto typing in Google Docs and Word: scheduling text, keeping pasted formatting, voice typing, extension vs. cloud auto typers and version history.");
export default function Guides() {
  return <article className="prose seo-hub"><Breadcrumbs items={[{ name: "Guides", path: "/guides/" }]} />
    <p className="kicker">TypeWit guides</p><h1>Document entry, explained.</h1>
    <p>Learn how to set up automated text entry in Google Docs and Word, preserve supported formatting, dictate instead of typing, choose between extension and cloud auto typers, and understand what your document’s history can and cannot show.</p>
    <div className="seo-cards">{GUIDES.map(guide => <Link href={`/guides/${guide.slug}/`} key={guide.slug}><h2>{guide.title}</h2><p>{guide.summary}</p><span>Read guide →</span></Link>)}</div>
    <h2>Choose your document provider</h2><p>Explore the <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link> for cloud sessions or the <Link href="/word-auto-typer/">Microsoft Word auto typer</Link> for the Word add-in. See <Link href="/pricing/">Free, Day Pass and Pro plans</Link> before choosing advanced settings.</p>
  </article>;
}

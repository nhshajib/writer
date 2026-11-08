import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = pageMeta("/about/", "About TypeWit — Scheduled Document Entry", "Learn what TypeWit does: approved text entry into Google Docs in the cloud and Microsoft Word through an add-in, with formatting and session controls.");

export default function AboutPage() {
  return <article className="prose seo-landing">
    <Breadcrumbs items={[{ name: "About TypeWit", path: "/about/" }]} />
    <p className="kicker">About the product</p>
    <h1>TypeWit: your text, entered on your schedule.</h1>
    <p className="seo-summary">TypeWit is a web app that enters text you approve into Google Docs or Microsoft Word over time. It is operated by Typewit Organization. You supply the words, review the destination and formatting, and control the session.</p>
    <h2>Two document workflows, one dashboard</h2>
    <p>The <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link> runs on TypeWit’s servers through Google’s API. No Chrome extension is needed, and an approved session can continue after you close the dashboard. Connect your Google account and create a document or select an existing file through Google Drive’s picker.</p>
    <p>The <Link href="/word-auto-typer/">Microsoft Word auto typer</Link> uses the TypeWit add-in. Word and the add-in panel must remain open while it runs. Word sessions do not continue in the cloud after the panel closes.</p>
    <h2>Prepared text, with controls you can understand</h2>
    <p>Paste text with supported formatting, choose a rhythm and duration, and review it before starting. Sentence steps are the default. Pause, resume or stop a session from its controls. Available scheduling, editing and pacing options depend on your plan; the <Link href="/pricing/">plan comparison</Link> lists those differences.</p>
    <p>TypeWit is not an AI writer or rewriter. Supported formatting does not include complete document layout, images or tables. Google controls how edits appear in version history; automated entries do not establish human authorship or guarantee separate visible versions.</p>
    <h2>Built for authorized document-entry testing</h2>
    <p>Use TypeWit for workflow tests, product demonstrations and typing simulations you have permission to run. Academic cheating, fabricated writing histories and false authorship claims are prohibited by the <Link href="/responsible-use/">Responsible Use Agreement</Link>.</p>
    <h2>Product guidance and support</h2>
    <p>The TypeWit team maintains the <Link href="/guides/">setup and troubleshooting guides</Link>. Each guide shows its update date, distinguishes product behavior from provider limits, and links to official references where relevant. If a step no longer matches your experience, send the page address and a description to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Do not include passwords or sensitive document text.</p>
    <p>Read <Link href="/privacy/">how TypeWit handles data</Link>, see <Link href="/subprocessors/">service providers</Link>, or visit <Link href="/support/">support</Link>. Our public <a href="https://www.saashub.com/typewit">TypeWit listing on SaaSHub</a> describes the same product.</p>
    <div className="row"><Link href="/how-it-works/" className="btn btn-primary">See how TypeWit works</Link><Link href="/pricing/" className="btn btn-secondary">Compare plans</Link></div>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", "@id": `${SITE_URL}/about/#webpage`, url: `${SITE_URL}/about/`, name: "About TypeWit", about: { "@id": `${SITE_URL}/#software` }, isPartOf: { "@id": `${SITE_URL}/#website` }, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en" }} />
  </article>;
}

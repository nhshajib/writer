import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { FACEBOOK_URL, SAASHUB_URL, SUPPORT_EMAIL } from "@/lib/site";

export const metadata = pageMeta("/about/", "About TypeWit — Scheduled Document Entry", "Learn what TypeWit does: approved text entry into Google Docs in the cloud and Microsoft Word through an add-in, with formatting and session controls.");

export default function AboutPage() {
  return <article className="prose seo-landing">
    <Breadcrumbs items={[{ name: "About TypeWit", path: "/about/" }]} />
    <p className="kicker">About the product</p>
    <h1>About TypeWit, the auto typer for Google Docs and Word</h1>
    <p className="seo-summary">TypeWit is a web app that enters text you approve into Google Docs or Microsoft Word over time. It is operated by Typewit Organization. You supply the words, review the destination and formatting, and control the session. TypeWit (typewit.com) is not related to Typewise, the AI keyboard app.</p>
    <h2>Two document workflows, one dashboard</h2>
    <p>The <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link> runs on TypeWit’s servers through Google’s API. No Chrome extension is needed, and an approved session can continue after you close the dashboard. The setup page explains account permissions and document selection.</p>
    <p>The <Link href="/word-auto-typer/">Microsoft Word auto typer</Link> uses the TypeWit add-in. Keep Word and its add-in panel open while entry runs.</p>
    <h2>Prepared text, with controls you can understand</h2>
    <p>You approve the text and destination before entry begins. Session controls and an activity log help you monitor the result. The <Link href="/pricing/">plan comparison</Link> explains scheduling, pacing and editing access.</p>
    <p>TypeWit is not an AI writer or rewriter. Supported formatting does not include complete document layout, images or tables. How edits show up in Google’s version history is explained in <Link href="/guides/google-docs-version-history/">our version history guide</Link>.</p>
    <h2>Built for authorized document-entry testing</h2>
    <p>Use TypeWit for workflow tests, product demonstrations and typing simulations you have permission to run. Academic cheating, fabricated writing histories and false authorship claims are prohibited by the <Link href="/responsible-use/">Responsible Use Agreement</Link>.</p>
    <h2>Product guidance and support</h2>
    <p>The TypeWit team maintains the <Link href="/guides/">setup and troubleshooting guides</Link>. Each guide shows its update date, distinguishes product behavior from provider limits, and links to official references where relevant. If a step no longer matches your experience, send the page address and a description to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Do not include passwords or sensitive document text.</p>
    <p>Read <Link href="/privacy/">how TypeWit handles data</Link>, see <Link href="/subprocessors/">service providers</Link>, or visit <Link href="/support/">support</Link>. Follow <a href={FACEBOOK_URL} rel="me noopener">TypeWit on Facebook</a> for demos and updates; our <a href={SAASHUB_URL}>SaaSHub listing</a> describes the same product.</p>
    <div className="row"><Link href="/how-it-works/" className="btn btn-primary">See how TypeWit works</Link><Link href="/pricing/" className="btn btn-secondary">Compare plans</Link></div>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", "@id": `${SITE_URL}/about/#webpage`, url: `${SITE_URL}/about/`, name: "About TypeWit", about: { "@id": `${SITE_URL}/#software` }, isPartOf: { "@id": `${SITE_URL}/#website` }, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en" }} />
  </article>;
}

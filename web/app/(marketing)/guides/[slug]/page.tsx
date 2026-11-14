import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageByline } from "@/components/seo/PageByline";
import { GUIDES, RELATED_GUIDES } from "@/lib/search-content";
import { pageMeta, SITE_URL } from "@/lib/seo";
export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map(g => ({ slug: g.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = GUIDES.find(g => g.slug === slug);
  return guide ? pageMeta(`/guides/${slug}/`, guide.title, guide.description, { openGraph: { type: "article", publishedTime: guide.published, modifiedTime: guide.updated, images: [{ url: `${SITE_URL}/guides/${slug}/og.png`, width: 1200, height: 630, alt: guide.title }] }, twitter: { images: [`${SITE_URL}/guides/${slug}/og.png`] } }) : {};
}
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = GUIDES.find(g => g.slug === slug);
  if (!guide) notFound();
  const path = `/guides/${slug}/`;
  const related = GUIDES.filter(g => RELATED_GUIDES[slug]?.includes(g.slug));
  return <article className="prose seo-article"><Breadcrumbs items={[{ name: "Guides", path: "/guides/" }, { name: guide.title, path }]} />
    <p className="kicker">Practical guide</p><h1>{guide.title}</h1>
    <PageByline updated={guide.updated} /><p className="seo-summary">{guide.summary}</p>
    <nav className="seo-toc" aria-label="On this page"><strong>In this guide</strong><ul>{guide.sections.map((s,i) => <li key={s.heading}><a href={`#section-${i+1}`}>{s.heading}</a></li>)}</ul></nav>
    {guide.sections.map((section, i) => <section key={section.heading} aria-labelledby={`section-${i+1}`}><h2 id={`section-${i+1}`}>{section.heading}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}{section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}</section>)}
    <h2>Official references</h2><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul>
    <aside className="seo-related" aria-label="Related guides"><h2>Related reading</h2><ul>{related.map(g => <li key={g.slug}><Link href={`/guides/${g.slug}/`}>{g.title}</Link></li>)}</ul><p>{slug === "auto-type-text-microsoft-word" ? <Link href="/word-auto-typer/">Microsoft Word auto typer</Link> : <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link>} · <Link href="/pricing/">Compare plans</Link> · <Link href="/responsible-use/">Responsible use</Link></p></aside>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", "@id": `${SITE_URL}${path}#article`, headline: guide.title, description: guide.description, mainEntityOfPage: `${SITE_URL}${path}`, datePublished: guide.published, dateModified: guide.updated, image: `${SITE_URL}${path}og.png`, author: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "TypeWit", url: `${SITE_URL}/` }, publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "TypeWit", url: `${SITE_URL}/`, logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/mark-512.png` } }, isPartOf: { "@id": `${SITE_URL}/#website` }, about: { "@id": `${SITE_URL}/#software` } }} />
  </article>;
}

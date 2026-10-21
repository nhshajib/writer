import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { GUIDES, CONTENT_UPDATED } from "@/lib/search-content";
import { pageMeta, SITE_URL } from "@/lib/seo";
export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map(g => ({ slug: g.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = GUIDES.find(g => g.slug === slug);
  return guide ? pageMeta(`/guides/${slug}/`, guide.title, guide.description, { openGraph: { type: "article", publishedTime: CONTENT_UPDATED, modifiedTime: CONTENT_UPDATED } }) : {};
}
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = GUIDES.find(g => g.slug === slug);
  if (!guide) notFound();
  const path = `/guides/${slug}/`;
  return <article className="prose seo-article"><Breadcrumbs items={[{ name: "Guides", path: "/guides/" }, { name: guide.title, path }]} />
    <p className="kicker">Practical guide</p><h1>{guide.title}</h1>
    <p className="updated">By the TypeWit team · Updated 21 October 2026</p><p className="seo-summary">{guide.summary}</p>
    <nav className="seo-toc" aria-label="On this page"><strong>In this guide</strong><ul>{guide.sections.map((s,i) => <li key={s.heading}><a href={`#section-${i+1}`}>{s.heading}</a></li>)}</ul></nav>
    {guide.sections.map((section, i) => <section key={section.heading} aria-labelledby={`section-${i+1}`}><h2 id={`section-${i+1}`}>{section.heading}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}{section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}</section>)}
    <h2>Official references</h2><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul>
    <aside className="seo-related" aria-label="Related guides"><h2>Keep exploring</h2><ul>{GUIDES.filter(g => g.slug !== slug).map(g => <li key={g.slug}><Link href={`/guides/${g.slug}/`}>{g.title}</Link></li>)}</ul><p><Link href="/google-docs-auto-typer/">Explore Google Docs sessions</Link> · <Link href="/pricing/">Compare plans</Link> · <Link href="/responsible-use/">Responsible use</Link></p></aside>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", "@id": `${SITE_URL}${path}#article`, headline: guide.title, description: guide.description, mainEntityOfPage: `${SITE_URL}${path}`, datePublished: CONTENT_UPDATED, dateModified: CONTENT_UPDATED, image: `${SITE_URL}/opengraph-image.png`, author: { "@type": "Organization", name: "TypeWit", url: `${SITE_URL}/` }, publisher: { "@type": "Organization", name: "TypeWit", url: `${SITE_URL}/`, logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/mark-512.png` } } }} />
  </article>;
}

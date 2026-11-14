import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { LivePreview } from "@/components/marketing/LivePreview";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { GUIDES } from "@/lib/search-content";
import { DAY_PASS_PRICE, FACEBOOK_URL, PRO_PRICE, SAASHUB_URL, SUPPORT_EMAIL } from "@/lib/site";
import { ORGANIZATION_ID, SOFTWARE } from "@/lib/structured-data";

const HOME_TITLE = "TypeWit — Auto Typer for Google Docs & Word";
const HOME_DESCRIPTION = "TypeWit schedules text entry into Google Docs without a Chrome extension, plus Microsoft Word via an add-in. Keep formatting and start free.";

export const metadata: Metadata = {
  ...pageMeta(
    "/",
    "Auto Typer for Google Docs & Word",
    HOME_DESCRIPTION,
    { openGraph: { title: HOME_TITLE }, twitter: { title: HOME_TITLE } },
  ),
  title: { absolute: HOME_TITLE },
};

/** The guides most visitors start with, by task. */
const FEATURED_GUIDES = ["choose-google-docs-auto-typer", "paste-text-keep-formatting-google-docs", "auto-type-text-microsoft-word"]
  .map((slug) => GUIDES.find((g) => g.slug === slug)!);

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "TypeWit",
      alternateName: ["Typewit", "Type Wit"],
      legalName: "Typewit Organization",
      address: { "@type": "PostalAddress", addressCountry: "BD" },
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/mark-512.png`,
      email: SUPPORT_EMAIL,
      sameAs: [FACEBOOK_URL, SAASHUB_URL],
      description: "Operator of TypeWit, the scheduled text-entry app for Google Docs and Microsoft Word.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "TypeWit",
      alternateName: ["Typewit", "Type Wit", "typewit.com"],
      url: `${SITE_URL}/`,
      inLanguage: "en",
      description: HOME_DESCRIPTION,
      publisher: { "@id": ORGANIZATION_ID },
    },
    SOFTWARE,
  ],
};

export default function Home() {
  return (
    <>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-copy">
          <h1 id="hero-title" className="home-eyebrow">TypeWit: auto typer for Google Docs and Word</h1>
          <p className="home-slogan">
            <span>Your words.</span>
            <br />Entered at<br className="desktop-break" /> your pace.
          </p>
          <p className="home-description">
            TypeWit is an auto typer for Google Docs and Word. Paste formatted
            text, choose a rhythm, and control every session.
          </p>
          <div className="home-actions">
            <Link href="/signup/" className="btn btn-primary" id="hero-cta">
              <Icon.arrowRight />Get started free
            </Link>
            <Link href="/how-it-works/" className="btn btn-secondary">
              See how it works
            </Link>
          </div>
          <ul className="home-benefits">
            <li>250 words daily</li>
            <li>No card needed</li>
            <li>Pause anytime</li>
          </ul>
        </div>
        <div className="home-visual">
          <span className="home-orbit" aria-hidden="true" />
          <span className="home-visual-label">
            <Icon.check /> Your text. Always approved.
          </span>
          <LivePreview />
          <span className="home-break-note">
            <Icon.clock />Write. Rest. Continue.<small>
              Custom blocks with Day Pass &amp; Pro
            </small>
          </span>
        </div>
      </section>

      <div className="home-more">
        <section className="home-intro" aria-labelledby="what-title">
          <h2 id="what-title">What is TypeWit?</h2>
          <p>
            TypeWit is an auto typer that enters text you have already written into a Google Doc or a Microsoft Word
            document, gradually, over a time you choose. Paste your text with its headings, bold, italic, bullets and
            highlights, pick a rhythm such as Natural or Steady, review the exact words and approve. TypeWit then enters
            them in steps and keeps an activity log you can download. You can pause, resume or stop from your phone or
            computer at any point.
          </p>
          <p>
            It doesn&apos;t write or rewrite anything: the words are yours. It&apos;s built for authorized document-entry
            testing, demonstrations and accessible entry, under the <Link href="/responsible-use/">Responsible Use Agreement</Link>.
          </p>
        </section>

        <section className="home-providers" aria-labelledby="where-title">
          <h2 id="where-title">Works where you write</h2>
          <div className="home-cards">
            <Link href="/google-docs-auto-typer/" className="home-card">
              <h3>Google Docs auto typer</h3>
              <p>Runs in the cloud with no Chrome extension, so you can close the tab or the laptop. Use a new document or one you choose in Google&apos;s file picker.</p>
              <span>Google Docs details <Icon.arrowRight /></span>
            </Link>
            <Link href="/word-auto-typer/" className="home-card">
              <h3>Microsoft Word auto typer</h3>
              <p>A Word add-in for Word on the web, which your organization can also deploy to Word for Windows and Mac. Word sessions run while that document is open.</p>
              <span>Word details <Icon.arrowRight /></span>
            </Link>
          </div>
        </section>

        <section className="home-plans" aria-labelledby="plans-title">
          <h2 id="plans-title">Plans</h2>
          <ul>
            <li><strong>Free</strong><span>250 words a day and one-hour sessions, with no card.</span></li>
            <li><strong>Day Pass · {DAY_PASS_PRICE}</strong><span>Unlimited words for 24 hours. Pay once, no renewal.</span></li>
            <li><strong>Pro · {PRO_PRICE.month.amount}/month</strong><span>Or {PRO_PRICE.year.total} a year. Drafting rhythm, scheduled starts and sessions up to a week.</span></li>
          </ul>
          <Link href="/pricing/">Compare plans <Icon.arrowRight /></Link>
        </section>

        <section className="home-guides" aria-labelledby="guides-title">
          <h2 id="guides-title">Guides</h2>
          <ul>
            {FEATURED_GUIDES.map((g) => <li key={g.slug}><Link href={`/guides/${g.slug}/`}>{g.title}</Link></li>)}
          </ul>
          <Link href="/guides/">All guides <Icon.arrowRight /></Link>
        </section>
      </div>
      <JsonLd data={STRUCTURED_DATA} />
    </>
  );
}

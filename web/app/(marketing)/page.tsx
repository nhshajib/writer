import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { LivePreview } from "@/components/marketing/LivePreview";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { PRO_PRICE, SUPPORT_EMAIL } from "@/lib/site";

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

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "TypeWit",
      legalName: "Typewit Organization",
      address: { "@type": "PostalAddress", addressCountry: "BD" },
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/mark-512.png`,
      email: SUPPORT_EMAIL,
      description: "Operator of TypeWit, the scheduled text-entry app for Google Docs and Microsoft Word.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "TypeWit",
      alternateName: "typewit.com",
      url: `${SITE_URL}/`,
      inLanguage: "en",
      description: HOME_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      publisher: { "@id": `${SITE_URL}/#organization` },
      name: "TypeWit",
      url: `${SITE_URL}/`,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      sameAs: ["https://www.saashub.com/typewit"],
      description:
        "Schedules automated entry of approved text into Google Docs and Microsoft Word for authorized testing, with supported formatting and adjustable pacing.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        {
          "@type": "Offer",
          name: "Day Pass — 24 hours, no renewal",
          price: "3.99",
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing/`,
        },
        {
          "@type": "Offer",
          name: "Pro Monthly",
          price: PRO_PRICE.month.amount.replace("$", ""),
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing/`,
        },
        {
          "@type": "Offer",
          name: "Pro Yearly",
          price: "60",
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing/`,
        },
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-copy">
          <p className="home-eyebrow">TYPEWIT AUTO TYPER</p>
          <h1 id="hero-title">
            <span>Your words.</span>
            <br />Entered at<br className="desktop-break" /> your pace.
          </h1>
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
      <JsonLd data={STRUCTURED_DATA} />
    </>
  );
}

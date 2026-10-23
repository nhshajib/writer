import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { LivePreview } from "@/components/marketing/LivePreview";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { PRO_PRICE, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta(
    "/",
    "Auto Typer for Google Docs & Word",
    "Schedule approved text entry into Google Docs and Word. Keep supported formatting, choose a typing rhythm and pause anytime. Free plan available.",
  ),
  title: { absolute: "Auto Typer for Google Docs & Word · TypeWit" },
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
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "TypeWit",
      url: `${SITE_URL}/`,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      publisher: { "@id": `${SITE_URL}/#organization` },
      name: "TypeWit",
      url: `${SITE_URL}/`,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      description:
        "Schedules automated entry of approved text into Google Docs and Microsoft Word for authorized testing, with supported formatting and adjustable pacing.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        {
          "@type": "Offer",
          name: "Day Pass — 24 hours, no renewal",
          price: "4.99",
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
          <p className="home-eyebrow">AUTOMATED DOCUMENT ENTRY</p>
          <h1 id="hero-title">
            <span>Your words.</span>
            <br />Entered at<br className="desktop-break" /> your pace.
          </h1>
          <p className="home-description">
            Your approved text, entered into Google Docs or Word. Keep your
            formatting, choose a rhythm, and stay in control.
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

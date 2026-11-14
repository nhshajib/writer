import { SITE_URL } from "./seo";
import { DAY_PASS_PRICE, PRO_PRICE, SAASHUB_URL } from "./site";

/** Shared Schema.org nodes, so the homepage, pricing and provider pages describe TypeWit the same way. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

const amount = (price: string) => price.replace("$", "");
const PRICING_URL = `${SITE_URL}/pricing/`;
const IN_STOCK = "https://schema.org/InStock";

/** Plans as offers; Pro carries its billing period so monthly and yearly prices can't be confused. */
export const OFFERS = [
  { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", availability: IN_STOCK, url: PRICING_URL },
  {
    "@type": "Offer", name: "Day Pass — 24 hours, no renewal", price: amount(DAY_PASS_PRICE), priceCurrency: "USD", availability: IN_STOCK, url: PRICING_URL,
  },
  {
    "@type": "Offer", name: "Pro Monthly", price: amount(PRO_PRICE.month.amount), priceCurrency: "USD", availability: IN_STOCK, url: PRICING_URL,
    priceSpecification: { "@type": "UnitPriceSpecification", price: amount(PRO_PRICE.month.amount), priceCurrency: "USD", billingDuration: "P1M", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
  },
  {
    "@type": "Offer", name: "Pro Yearly", price: amount(PRO_PRICE.year.total), priceCurrency: "USD", availability: IN_STOCK, url: PRICING_URL,
    priceSpecification: { "@type": "UnitPriceSpecification", price: amount(PRO_PRICE.year.total), priceCurrency: "USD", billingDuration: "P1Y", unitCode: "ANN", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "ANN" } },
  },
];

export const SOFTWARE = {
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  publisher: { "@id": ORGANIZATION_ID },
  name: "TypeWit",
  alternateName: ["Typewit", "Type Wit"],
  url: `${SITE_URL}/`,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  sameAs: [SAASHUB_URL],
  description:
    "Schedules automated entry of approved text into Google Docs and Microsoft Word for authorized testing, with supported formatting and adjustable pacing.",
  offers: OFFERS,
};

/** A dated page about TypeWit, published by the organization. */
export function webPage({ path, name, description, published, updated }: {
  path: string; name: string; description: string; published: string; updated: string;
}) {
  return {
    "@type": "WebPage",
    "@id": `${SITE_URL}${path}#webpage`,
    url: `${SITE_URL}${path}`,
    name,
    description,
    inLanguage: "en",
    datePublished: published,
    dateModified: updated,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": SOFTWARE_ID },
    author: { "@type": "Organization", "@id": ORGANIZATION_ID, name: "TypeWit" },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

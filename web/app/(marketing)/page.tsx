import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { GetStartedBar } from "@/components/marketing/GetStartedBar";
import { LivePreview } from "@/components/marketing/LivePreview";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { DAY_PASS_PRICE, PRO_PRICE, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta(
    "/",
    "Auto Typer for Google Docs & Word",
    "Schedule approved text entry into Google Docs and Word. Keep supported formatting, choose a typing rhythm and pause anytime. Free plan available.",
  ),
  title: { absolute: "Auto Typer for Google Docs & Word · TypeWit" },
};

/** Who uses it, shown as a short list under the features heading. */
const USES = ["Document workflow testing", "Formatting checks", "Pacing experiments", "Accessible document entry"];

const STEPS = [
  { icon: Icon.doc, title: "Paste your text", text: "Paste formatted text or dictate it. Headings, bold, italics, bullets and highlights come with it." },
  { icon: Icon.sliders, title: "Choose a rhythm", text: "Natural or Steady, a finish time, and a new or existing document. Then read and approve the exact text." },
  { icon: Icon.play, title: "Let it run", text: "TypeWit enters the text on schedule. Pause, resume or stop from any device; Google Docs keeps going when you close the tab." },
];

const FEATURES = [
  { icon: Icon.check, title: "You approve every word", text: "Sessions enter exactly the text you approved. Change it and you approve again." },
  { icon: Icon.clock, title: "Your pace", text: "Word groups, sentences or paragraphs, spread over minutes, hours or up to a week." },
  { icon: Icon.pause, title: "Pause, resume or stop", text: "Control any session from your phone or computer, whenever you need to." },
  { icon: Icon.list, title: "A clear record", text: "Every step is in the session’s activity log, ready to download." },
  { icon: Icon.hand, title: "Accessible by default", text: "Works with the keyboard alone and with screen readers, in light and dark mode." },
  { icon: Icon.lock, title: "Private by design", text: "Opens only the documents it creates or you choose. Your text never trains AI." },
];

const PLANS = [
  {
    name: "Free", price: "$0", per: "forever", note: "No card needed",
    items: ["250 words a day", "Sessions up to 60 minutes", "Natural and Steady rhythms", "Google Docs and Word"],
    cta: { label: "Start free", href: "/signup/" },
  },
  {
    name: "Day Pass", price: DAY_PASS_PRICE, per: "once", note: "24 hours · never renews",
    items: ["Unlimited words for 24 hours", "Sessions up to a day", "Writing hours and customizable long breaks", "No subscription"],
    cta: { label: "Get a Day Pass", href: "/pricing/" },
  },
  {
    name: "Pro", price: PRO_PRICE.year.amount, per: "/ month, billed yearly", note: `$60 a year · or ${PRO_PRICE.month.amount} monthly`, badge: "7 days free", featured: true,
    items: ["Unlimited words, sessions up to a week", "Up to 3 sessions at once", "Drafting rhythm and custom pace", "Scheduled starts, file import and paused editing"],
    cta: { label: "Try Pro free", href: "/pricing/" },
  },
];

const FAQ = [
  {
    q: "Is using TypeWit cheating?",
    a: "TypeWit is for authorized testing of automated text entry. Optional rhythms simulate timing, temporary typos and corrections; they are not evidence of human authorship. Academic cheating, fabricated writing histories and deceptive authorship claims are prohibited.",
  },
  {
    q: "Does it work with Microsoft Word?",
    a: "Yes. Add the TypeWit add-in to Word on the web (your organisation can deploy it to Word for Windows and Mac). Word sessions run while the document and the TypeWit panel are open.",
  },
  {
    q: "Can TypeWit see my other Google Drive files?",
    a: "No. It only has access to the Google Docs it creates for you and the ones you choose in Google's file picker (the drive.file permission).",
  },
  {
    q: "Do I need to keep the page open?",
    a: "Not for Google Docs: sessions run on TypeWit's servers, so you can close the tab or turn off your computer. For Word, keep the document and the TypeWit panel open.",
  },
  {
    q: "Can I use it with dictation?",
    a: "Yes. Dictate with your device's voice input (or any dictation app), paste the text into TypeWit, approve it, and choose the pace.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Free includes 250 words a day and sessions up to 60 minutes, with every insertion mode and accessibility feature, and no card needed. A $4.99 Day Pass removes the word limit for 24 hours with no subscription. Pro adds week-long sessions, custom pacing, saved presets and scheduled starts, with 7 days free.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "TypeWit", legalName: "Typewit Organization", address: { "@type": "PostalAddress", addressCountry: "BD" }, url: `${SITE_URL}/`, logo: `${SITE_URL}/brand/mark-512.png`, email: SUPPORT_EMAIL },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "TypeWit", url: `${SITE_URL}/`, publisher: { "@id": `${SITE_URL}/#organization` } },
    {
      "@type": "SoftwareApplication",
      publisher: { "@id": `${SITE_URL}/#organization` },
      name: "TypeWit",
      url: `${SITE_URL}/`,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      description: "Schedules automated entry of approved text into Google Docs and Microsoft Word for authorized testing, with supported formatting and adjustable pacing.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Day Pass — 24 hours, no renewal", price: "4.99", priceCurrency: "USD", url: `${SITE_URL}/pricing/` },
        { "@type": "Offer", name: "Pro Monthly", price: PRO_PRICE.month.amount.replace("$", ""), priceCurrency: "USD", url: `${SITE_URL}/pricing/` },
        { "@type": "Offer", name: "Pro Yearly", price: "60", priceCurrency: "USD", url: `${SITE_URL}/pricing/` },
      ],
    },

  ],
};

export default function Home() {
  return (
    <>
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="container lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-chip">
              <span className="lp-chip-icon gdoc" aria-hidden="true"><Icon.doc /></span>
              <span className="lp-chip-icon word" aria-hidden="true">W</span>
              For Google Docs and Microsoft Word
            </p>
            <h1 id="hero-title" className="lp-display">Auto typer for Google&nbsp;Docs and&nbsp;Word.</h1>
            <p className="lp-lead">
              Paste formatted text, choose a rhythm, and let TypeWit enter it into your document on schedule. Built for authorized testing, with your approval before every session.
            </p>
            <div className="lp-actions">
              <Link href="/signup/" className="btn btn-primary btn-lg" id="hero-cta">Get started free</Link>
              <a href="#how" className="btn btn-secondary btn-lg">See how it works</a>
            </div>
            <ul className="lp-trust">
              <li><Icon.check />Free plan, no card</li>
              <li><Icon.check />No browser extension</li>
              <li><Icon.check />Screen-reader friendly</li>
            </ul>
          </div>
          <LivePreview />
        </div>
      </section>

      <section id="how" className="lp-section" aria-labelledby="how-title">
        <div className="container">
          <header className="lp-head">
            <p className="lp-kicker">How it works</p>
            <h2 id="how-title" className="lp-h2">Three steps. You stay in control.</h2>
          </header>
          <ol className="lp-steps">
            {STEPS.map(({ icon: StepIcon, title, text }, i) => (
              <li key={title}>
                <span className="lp-step-top"><span className="lp-num" aria-hidden="true">{i + 1}</span><span className="lp-icon" aria-hidden="true"><StepIcon /></span></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="lp-section lp-alt" aria-labelledby="features-title">
        <div className="container">
          <header className="lp-head">
            <p className="lp-kicker">Why TypeWit</p>
            <h2 id="features-title" className="lp-h2">Calm, clear and always in your control.</h2>
            <ul className="lp-uses" aria-label="Used for">
              {USES.map((use) => <li key={use}>{use}</li>)}
            </ul>
          </header>
          <ul className="lp-features">
            {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
              <li key={title}><span className="lp-icon" aria-hidden="true"><FeatureIcon /></span><h3>{title}</h3><p>{text}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="lp-section" aria-labelledby="plans-title">
        <div className="container">
          <header className="lp-head lp-center">
            <p className="lp-kicker">Pricing</p>
            <h2 id="plans-title" className="lp-h2">Start free. Upgrade when it gets long.</h2>
          </header>
          <ul className="lp-plans">
            {PLANS.map((plan) => (
              <li key={plan.name} className={plan.featured ? "lp-plan featured" : "lp-plan"}>
                <h3>{plan.name}{plan.badge && <span className="badge badge-blue">{plan.badge}</span>}</h3>
                <p className="lp-price"><strong>{plan.price}</strong><span>{plan.per}</span></p>
                <p className="lp-price-note">{plan.note}</p>
                <ul className="lp-ticks">{plan.items.map((item) => <li key={item}><Icon.check />{item}</li>)}</ul>
                <Link href={plan.cta.href} className={`btn btn-lg btn-block ${plan.featured ? "btn-primary" : "btn-secondary"}`}>{plan.cta.label}</Link>
              </li>
            ))}
          </ul>
          <p className="lp-more-link"><Link href="/pricing/">Compare every feature<Icon.arrowRight /></Link></p>
        </div>
      </section>

      <section className="lp-section lp-alt" aria-labelledby="where-title">
        <div className="container">
          <header className="lp-head">
            <p className="lp-kicker">Where it works</p>
            <h2 id="where-title" className="lp-h2">Made for the documents you already use.</h2>
          </header>
          <div className="lp-links">
            <Link href="/google-docs-auto-typer/"><span className="lp-link-icon gdoc" aria-hidden="true"><Icon.doc /></span><h3>Google Docs auto typer</h3><p>Runs in the cloud with no browser extension. Keeps going after you close your laptop.</p><span className="lp-go">Learn more<Icon.arrowRight /></span></Link>
            <Link href="/word-auto-typer/"><span className="lp-link-icon word" aria-hidden="true">W</span><h3>Microsoft Word auto typer</h3><p>An add-in that enters approved text into the open document, with the same rhythms.</p><span className="lp-go">Learn more<Icon.arrowRight /></span></Link>
            <Link href="/guides/"><span className="lp-link-icon" aria-hidden="true"><Icon.list /></span><h3>Guides</h3><p>Scheduling, formatted paste, voice typing and version history, explained.</p><span className="lp-go">Read the guides<Icon.arrowRight /></span></Link>
          </div>
        </div>
      </section>

      <section id="faq" className="lp-section" aria-labelledby="faq-title">
        <div className="container lp-faq">
          <header className="lp-faq-head">
            <p className="lp-kicker">Questions</p>
            <h2 id="faq-title" className="lp-h2">Good to know</h2>
            <p>Still have a question? <Link href="/support/">Contact support</Link></p>
          </header>
          <div className="faq">
            {FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="lp-section lp-final" aria-labelledby="cta-title">
        <div className="container">
          <div className="lp-cta">
            <h2 id="cta-title">Your next document, without the typing.</h2>
            <p>Set up in about two minutes. Free plan, no card needed.</p>
            <Link href="/signup/" className="btn btn-lg">Create your free account</Link>
          </div>
        </div>
      </section>
      <GetStartedBar />
      <JsonLd data={STRUCTURED_DATA} />
    </>
  );
}

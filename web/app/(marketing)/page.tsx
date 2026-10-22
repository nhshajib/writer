import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { GetStartedBar } from "@/components/marketing/GetStartedBar";
import { PreviewCarousel } from "@/components/marketing/PreviewCarousel";
import { Logo } from "@/components/Logo";
import { MoreList } from "@/components/marketing/MoreList";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { FREE_FEATURES, PRO_FEATURES } from "@/lib/plans";
import { PRO_PRICE, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta(
    "/",
    "Auto Typer for Google Docs & Word",
    "Schedule approved text entry into Google Docs and Word. Keep supported formatting, choose a typing rhythm and pause anytime. Free plan available.",
  ),
  title: { absolute: "Auto Typer for Google Docs & Word · TypeWit" },
};

const WHO = [
  { icon: Icon.doc, title: "Document workflow testing", text: "Try approved text entry in new or existing test documents, with a clear activity log." },
  { icon: Icon.layers, title: "Formatting checks", text: "Check how supported headings, bold, italic, bullets and highlights transfer into your document." },
  { icon: Icon.clock, title: "Pacing experiments", text: "Compare ready-made rhythms or Pro timing controls without building your own automation." },
  { icon: Icon.person, title: "Accessible controls", text: "Use keyboard navigation, screen readers and large controls to review and manage a test session." },
];

const STEPS = [
  { icon: Icon.doc, title: "Add your text", text: "Paste or dictate your text into TypeWit, using any input method you prefer." },
  { icon: Icon.sliders, title: "Approve and set your pace", text: "Read the exact text, make any changes, and choose a pace that works for you." },
  { icon: Icon.list, title: "Follow your progress", text: "TypeWit enters your approved text into your document while you stay in control." },
];

const FEATURES = [
  { icon: Icon.check, title: "You approve every word", text: "The completed session is designed to match your approved text. Pro simulations may temporarily enter and correct mistakes; changed text needs fresh approval." },
  { icon: Icon.clock, title: "Your pace", text: "Sentence or paragraph steps, spread over minutes, hours or up to a week, with optional breaks." },
  { icon: Icon.pause, title: "Pause, resume or stop", text: "Control any session from any device. Google Docs sessions keep running when you close the tab." },
  { icon: Icon.list, title: "A clear record", text: "Every step is in the session's activity log, ready to download, next to your document's own version history." },
  { icon: Icon.hand, title: "Accessible by default", text: "Works with the keyboard alone and with screen readers, in light and dark mode, with large targets." },
  { icon: Icon.lock, title: "Private by design", text: "TypeWit opens only the documents it creates or you choose. Your text is never used to train AI." },
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
    a: "Yes. Free includes 250 words a day and sessions up to 60 minutes, with every insertion mode and accessibility feature, and no card needed. Pro removes the daily limit and adds week-long sessions, custom pacing, saved presets and scheduled starts, with 7 days free.",
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
      <section className="mk-hero" aria-labelledby="hero-title">
        <div className="container mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-chip">
              <span className="mk-chip-icon gdoc" aria-hidden="true"><Icon.doc /></span>
              <span className="mk-chip-icon word" aria-hidden="true">W</span>
              For Google Docs and Microsoft Word
            </span>
            <h1 id="hero-title" className="mk-display">Auto typer for<br />Google Docs and Word.</h1>
            <p className="mk-lead">
              Paste formatted text, choose a rhythm, and schedule automated entry into your document. Built for authorized testing, with your approval before every session.
            </p>
            <div className="app-id">
              <span className="app-id-icon" aria-hidden="true"><Logo className="app-id-logo" /></span>
              <span className="app-id-text"><strong>TypeWit</strong><span>Free · Google Docs and Word</span></span>
              <Link href="/signup/" className="app-id-get" id="hero-cta">Get started</Link>
            </div>
            <dl className="app-facts">
              <div><dt>Free plan</dt><dd>$0</dd><dd>250 words a day</dd></div>
              <div><dt>Works with</dt><dd><Icon.doc /></dd><dd>Docs and Word</dd></div>
              <div><dt>Built for</dt><dd><Icon.person /></dd><dd>Accessibility</dd></div>
            </dl>
            <div className="mk-cta">
              <Link href="/signup/" className="btn btn-primary btn-lg">Get started free</Link>
              <a href="#how" className="btn btn-outline btn-lg"><span className="play" aria-hidden="true"><Icon.play /></span>See how it works</a>
            </div>
            <ul className="mk-trust">
              <li><Icon.check />Google Docs and Word</li>
              <li><Icon.check />Free plan, no card</li>
              <li><Icon.check />Keyboard and screen-reader friendly</li>
            </ul>
          </div>

          <PreviewCarousel />
        </div>
      </section>

      <section className="mk-band" aria-labelledby="band-title">
        <div className="container">
          <h2 id="band-title">Your text, entered at the pace you choose.</h2>
          <p>Explore the Google Docs auto typer, the Word add-in, and practical guides to formatting and scheduled text entry.</p>
        </div>
      </section>

      <section id="how" className="mk-section" aria-labelledby="how-title">
        <div className="container">
          <p className="mk-kicker">How it works</p>
          <h2 id="how-title" className="mk-h2">Three steps. You stay in control.</h2>
          <ol className="mk-steps">
            {STEPS.map(({ icon: StepIcon, title, text }, i) => (
              <li key={title}>
                <span className="mk-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="mk-step-icon" aria-hidden="true"><StepIcon /></span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="who" className="mk-section" aria-labelledby="who-title">
        <div className="container">
          <p className="mk-kicker">Who it&apos;s for</p>
          <h2 id="who-title" className="mk-h2">For teams and people testing document entry.</h2>
          <ul className="mk-needs">
            {WHO.map(({ icon: WhoIcon, title, text }) => (
              <li key={title}><span className="mk-need-icon" aria-hidden="true"><WhoIcon /></span><div><h3>{title}</h3><p>{text}</p></div></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section mk-alt" aria-labelledby="features-title">
        <div className="container">
          <p className="mk-kicker">What you get</p>
          <h2 id="features-title" className="mk-h2">Calm, clear and always in your control.</h2>
          <MoreList className="mk-features" shown={3} total={FEATURES.length} label="features">
            {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
              <li key={title}><span className="mk-need-icon" aria-hidden="true"><FeatureIcon /></span><h3>{title}</h3><p>{text}</p></li>
            ))}
          </MoreList>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="plans-title">
        <div className="container">
          <p className="mk-kicker">Pricing</p>
          <h2 id="plans-title" className="mk-h2">Free to start. Pro when it gets long.</h2>
          <ul className="price-rows">
            <li>
              <span className="pr-main"><strong>Free</strong><span>250 words a day · sessions up to 60 minutes</span></span>
              <span className="pr-price">$0</span>
            </li>
            <li>
              <span className="pr-main"><strong>Pro <span className="badge badge-blue">7 days free</span></strong><span>Unlimited words · week-long sessions · custom pacing and presets</span></span>
              <span className="pr-price"><span>{PRO_PRICE.year.amount}<small>/mo</small></span><em>$60 billed yearly · or {PRO_PRICE.month.amount} monthly</em></span>
            </li>
            <li><span className="pr-main"><strong>Day Pass</strong><span>Unlimited words for 24 hours · no renewal</span></span><span className="pr-price">$4.99</span></li>
            <li><Link href="/pricing/" className="pr-link">Compare plans<Icon.chevronRight /></Link></li>
          </ul>
          <p className="hint">Need only a day? <Link href="/pricing/">Get a $4.99 Day Pass</Link>: unlimited words, one active session and writing hours for 24 hours, with no subscription.</p>
          <div className="mk-plans">
            <div className="mk-plan">
              <h3>Free</h3>
              <p className="mk-plan-price"><strong>$0</strong><span>forever</span></p>
              <ul className="mk-ticks">
                {FREE_FEATURES.map((f) => <li key={f}><Icon.check />{f}</li>)}
              </ul>
              <Link href="/signup/" className="btn btn-secondary btn-lg btn-block">Start free</Link>
            </div>
            <div className="mk-plan featured">
              <h3>Pro <span className="badge badge-blue">7 days free</span></h3>
              <p className="mk-plan-price"><strong>{PRO_PRICE.year.amount}</strong><span>/ month, billed yearly</span></p>
              <p className="mk-plan-alt">$60 billed yearly · or {PRO_PRICE.month.amount} billed monthly</p>
              <ul className="mk-ticks">
                {PRO_FEATURES.map((f) => <li key={f}><Icon.check />{f}</li>)}
              </ul>
              <Link href="/pricing/" className="btn btn-primary btn-lg btn-block">Compare plans</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mk-section mk-alt" aria-labelledby="faq-title">
        <div className="container mk-faq">
          <div className="mk-faq-head">
            <p className="mk-kicker">Questions</p>
            <h2 id="faq-title" className="mk-h2">Good to know</h2>
            <p className="muted">Still have a question? <Link href="/support/">Contact support</Link></p>
          </div>
          <div className="faq">
            {FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="mk-section mk-final" aria-labelledby="cta-title">
        <div className="container">
          <div className="mk-cta-card">
            <h2 id="cta-title">Your next document, without the typing.</h2>
            <p>Set up in about two minutes. Free plan, no card needed.</p>
            <Link href="/signup/" className="btn btn-lg">Create your free account</Link>
          </div>
        </div>
      </section>

      <section className="mk-section"><div className="container"><h2 className="mk-h2">Explore TypeWit</h2><div className="seo-cards">
        <Link href="/google-docs-auto-typer/"><h3>Google Docs auto typer</h3><p>Cloud sessions, formatted paste and scheduled starts without a browser extension.</p></Link>
        <Link href="/word-auto-typer/"><h3>Microsoft Word auto typer</h3><p>Use the Word add-in to enter approved text into an open document.</p></Link>
        <Link href="/guides/"><h3>Setup and writing guides</h3><p>Learn about formatted paste, session timing and document version history.</p></Link>
      </div></div></section>
      <GetStartedBar />
      <JsonLd data={STRUCTURED_DATA} />
    </>
  );
}

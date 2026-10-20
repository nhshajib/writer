import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { PRO_PRICE, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta(
    "/",
    "Enter your text into Google Docs and Word without typing",
    "TypeWit enters text you dictate or paste into Google Docs and Microsoft Word, step by step, at the pace you choose. For people who find typing difficult, slow or painful. Free plan.",
  ),
  title: { absolute: "TypeWit · Your words in Google Docs and Word, without typing" },
};

const WHO = [
  { icon: Icon.hand, title: "Pain or fatigue", text: "RSI, arthritis or tired hands. Dictate or paste once, and let TypeWit enter it into your document." },
  { icon: Icon.mic, title: "Voice and dictation", text: "Use the dictation you already have, then let TypeWit put the words into Google Docs or Word." },
  { icon: Icon.person, title: "Limited hand movement", text: "Large controls and full keyboard and screen-reader support. Nothing to do once a session starts." },
  { icon: Icon.layers, title: "Dyslexia and dyspraxia", text: "Draft wherever it's easiest, check it at your own speed, then have it placed in the document for you." },
];

const STEPS = [
  { icon: Icon.doc, title: "Add your text", text: "Paste or dictate your text into TypeWit, using any input method you prefer." },
  { icon: Icon.sliders, title: "Approve and set your pace", text: "Read the exact text, make any changes, and choose a pace that works for you." },
  { icon: Icon.list, title: "Follow your progress", text: "TypeWit enters your approved text into your document while you stay in control." },
];

const FEATURES = [
  { icon: Icon.check, title: "You approve every word", text: "TypeWit enters exactly the text you approved, character for character. Change it and you approve it again." },
  { icon: Icon.clock, title: "Your pace", text: "Sentence or paragraph steps, spread over minutes, hours or up to a week, with optional breaks." },
  { icon: Icon.pause, title: "Pause, resume or stop", text: "Control any session from any device. Google Docs sessions keep running when you close the tab." },
  { icon: Icon.list, title: "A clear record", text: "Every step is in the session's activity log, ready to download, next to your document's own version history." },
  { icon: Icon.hand, title: "Accessible by default", text: "Works with the keyboard alone and with screen readers, in light and dark mode, with large targets." },
  { icon: Icon.lock, title: "Private by design", text: "TypeWit opens only the documents it creates or you choose. Your text is never used to train AI." },
];

const FAQ = [
  {
    q: "Is using TypeWit cheating?",
    a: "TypeWit doesn't write anything. It enters text you wrote, dictated or approved, and every session is labelled as automated text entry. It never imitates human typing. If your school or workplace has rules about writing tools, follow them.",
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
    a: "Yes. Free includes 250 words a day and sessions up to an hour, with no card needed. Pro removes the daily limit and starts with 7 days free.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "TypeWit", url: `${SITE_URL}/`, logo: `${SITE_URL}/brand/mark-512.png`, email: SUPPORT_EMAIL },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "TypeWit", url: `${SITE_URL}/`, publisher: { "@id": `${SITE_URL}/#organization` } },
    {
      "@type": "SoftwareApplication",
      publisher: { "@id": `${SITE_URL}/#organization` },
      name: "TypeWit",
      url: `${SITE_URL}/`,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      description: "Enters text you dictate or paste into Google Docs and Microsoft Word, step by step, for people who find typing difficult.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: PRO_PRICE.month.amount.replace("$", ""), priceCurrency: "USD" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
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
            <h1 id="hero-title" className="mk-display">Your words.<br /> Without the typing.</h1>
            <p className="mk-lead">
              Paste or dictate your text, approve it, and let TypeWit enter it into your document at the pace you choose.
            </p>
            <div className="mk-cta">
              <Link href="/signup/" className="btn btn-primary btn-lg">Get started free</Link>
              <a href="#how" className="btn btn-outline btn-lg"><span className="play" aria-hidden="true"><Icon.play /></span>See how it works</a>
            </div>
            <p className="fine">Free plan · No card needed</p>
          </div>

          <div className="mk-demo" aria-hidden="true">
            <div className="mk-doc">
              <div className="mk-doc-head">
                <span className="mk-doc-mark"><Icon.doc /></span>
                <div>
                  <strong>Research notes</strong>
                  <span className="mk-menu"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Tools</span><span>Help</span></span>
                </div>
              </div>
              <div className="mk-toolbar">
                <span>↶</span><span>↷</span><span className="mk-field">Normal text ▾</span><span className="mk-field">Inter ▾</span><span className="mk-field">11 ▾</span>
                <b>B</b><i>I</i><u>U</u>
              </div>
              <div className="mk-page">
                <p>
                  Rural communities face unique challenges in accessing healthcare, including distance, transportation and
                  limited specialist availability. <span className="arriving">Telehealth can help reduce these barriers and
                  increase access to care.</span><span className="caret" />
                </p>
              </div>
            </div>
            <div className="mk-panel">
              <div className="mk-panel-head"><Logo className="mk-logo" /><strong>TypeWit</strong><span className="mk-dots">···</span></div>
              <div className="mk-row"><span>Session progress</span><span>248 / 400 words</span></div>
              <div className="mk-bar"><span style={{ width: "62%" }}>62%</span></div>
              <div className="mk-status"><span className="mk-running"><i />Running</span><span>Automated text entry into your document.</span></div>
              <div className="mk-pause"><Icon.pause />Pause</div>
              <div className="mk-row mk-last"><span>Finish in</span><span className="mk-select">1 hour ▾</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-band" aria-labelledby="band-title">
        <div className="container">
          <h2 id="band-title">Built for people who find typing difficult, slow or painful.</h2>
          <p>Whether you use a keyboard, voice dictation or another way to write, TypeWit helps you get your words into Google Docs and Word.</p>
        </div>
      </section>

      <section id="how" className="mk-section" aria-labelledby="how-title">
        <div className="container">
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
          <h2 id="who-title" className="mk-h2">Designed around your needs.</h2>
          <ul className="mk-needs">
            {WHO.map(({ icon: WhoIcon, title, text }) => (
              <li key={title}><span className="mk-need-icon" aria-hidden="true"><WhoIcon /></span><div><h3>{title}</h3><p>{text}</p></div></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="features-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">What you get</p>
            <h2 id="features-title">Calm, clear and always in your control.</h2>
          </div>
          <ul className="feature-grid">
            {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
              <li key={title}><FeatureIcon /><div><h3>{title}</h3><p>{text}</p></div></li>
            ))}
          </ul>
        </div>
      </section>

      <section id="trust" className="section" aria-labelledby="trust-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">Honest and private</p>
            <h2 id="trust-title">Clearly labelled. Only what it needs.</h2>
          </div>
          <div className="split-2">
            <div className="panel">
              <h3><Icon.shield />Labelled, never disguised</h3>
              <p>
                TypeWit enters text you wrote or approved, and nothing else. It never adds typos, fake pauses or made-up
                corrections to look like a person typing, and every session is shown as automated text entry.
              </p>
              <p>
                Everyone agrees to the <Link href="/responsible-use/">Responsible Use Agreement</Link> before starting. If your
                school or workplace has rules about writing tools, those rules come first.
              </p>
            </div>
            <div className="panel" id="google-data">
              <h3><Icon.lock />What TypeWit does with your Google account</h3>
              <p>TypeWit asks Google for two things, and uses them only to enter the text you approve:</p>
              <ul>
                <li>
                  <strong>Your name and email address</strong> (<code>openid</code>, <code>email</code>, <code>profile</code>),
                  to sign you in and show which Google account is connected.
                </li>
                <li>
                  <strong>The files you use with TypeWit</strong> (<code>drive.file</code>): Google Docs it creates for you and
                  ones you pick in Google&apos;s file picker. It can&apos;t see anything else in your Drive.
                </li>
              </ul>
              <p>
                Tokens are stored encrypted and never sold, shared, used for advertising or used to train AI models.
                Disconnect any time. TypeWit follows the{" "}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. More in the <Link href="/privacy/">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="plans-title">
        <div className="container">
          <div className="price-strip">
            <div>
              <p className="kicker">Pricing</p>
              <h2 id="plans-title">Free to start. Pro when it gets long.</h2>
            </div>
            <dl>
              <div><dt>Free</dt><dd><strong>$0</strong> 250 words a day, sessions up to 1 hour</dd></div>
              <div><dt>Pro <span className="badge badge-blue">7 days free</span></dt><dd><strong>{PRO_PRICE.year.amount}</strong>/month billed yearly · unlimited words, sessions up to a week, 3 at once</dd></div>
            </dl>
            <Link href="/pricing/" className="btn btn-secondary">Compare plans <Icon.arrowRight /></Link>
          </div>
        </div>
      </section>

      <section id="faq" className="section" aria-labelledby="faq-title">
        <div className="container narrow">
          <div className="section-head"><p className="kicker">Questions</p><h2 id="faq-title">Good to know</h2></div>
          <div className="faq">
            {FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
          </div>
        </div>
      </section>

      <div className="container">
        <section className="cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Your next document, without the typing.</h2>
          <p>Set up in about two minutes. Free plan, no card needed.</p>
          <div className="cta-row">
            <Link href="/signup/" className="btn btn-primary btn-lg">Create your free account</Link>
          </div>
        </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
    </>
  );
}

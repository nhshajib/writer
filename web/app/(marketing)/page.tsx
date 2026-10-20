import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { PRO_PRICE } from "@/lib/site";

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
  { icon: Icon.layers, title: "Dyslexia and dyspraxia", text: "Draft wherever it's easiest, check it at your own speed, then have it placed in the document for you." },
  { icon: Icon.mic, title: "Voice and dictation users", text: "Turn what you dictated into a Google Doc or Word document without fighting the cursor." },
  { icon: Icon.check, title: "Limited hand movement", text: "Large controls and full keyboard and screen-reader support. Nothing to do once a session starts." },
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
    {
      "@type": "SoftwareApplication",
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
      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <span className="chip"><span className="dot" aria-hidden="true" /> For Google Docs and Microsoft Word</span>
          <h1 id="hero-title" className="display">
            Your words in Google Docs and Word, <span className="soft">without typing.</span>
          </h1>
          <p className="lead">
            Paste or dictate your text, approve it, and TypeWit enters it into your document at the pace you choose.
            Built for people who find typing difficult, slow or painful.
          </p>
          <div className="cta-row">
            <Link href="/signup/" className="btn btn-primary btn-lg">Get started free</Link>
            <a href="#how" className="btn btn-secondary btn-lg">See how it works</a>
          </div>
          <p className="fine">Free plan · No card needed</p>

          <div className="product" aria-hidden="true">
            <div className="product-window">
              <div className="product-bar">
                <span className="lights"><i /><i /><i /></span>
                <span className="title"><Icon.doc /> History essay · Google Docs</span>
              </div>
              <div className="product-body">
                <div className="doc-pane">
                  <div className="doc-page">
                    <h4>The printing press and the spread of ideas</h4>
                    <p>
                      Within fifty years of Gutenberg&apos;s press, books that once took months to copy could be produced in
                      days. Ideas began to travel faster than any authority could answer them.
                    </p>
                    <p>
                      That speed had consequences nobody predicted.{" "}
                      <span className="arriving">Pamphlets spread arguments across borders, and readers began to compare
                      sources for themselves.</span>
                      <span className="caret" />
                    </p>
                    <span className="ghost" style={{ width: "92%" }} />
                    <span className="ghost" style={{ width: "78%" }} />
                    <span className="ghost" style={{ width: "85%" }} />
                  </div>
                </div>
                <div className="tw-pane">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="badge badge-blue"><span className="dot" /> Writing</span>
                    <span className="label-sm">Sentence by sentence</span>
                  </div>
                  <div>
                    <div className="label-sm">Progress</div>
                    <div className="big">62%</div>
                    <div className="progress lg" style={{ marginTop: "0.6rem" }}><span style={{ width: "62%" }} /></div>
                  </div>
                  <div className="tw-kv">
                    <div><span className="label-sm">Words</span><strong>248 / 400</strong></div>
                    <div><span className="label-sm">Next in</span><strong>0:42</strong></div>
                  </div>
                  <ul className="tw-log">
                    <li><time>10:24</time><span>Sentence 7 entered</span></li>
                    <li><time>10:23</time><span>Sentence 6 entered</span></li>
                    <li><time>10:15</time><span>You approved the text</span></li>
                  </ul>
                  <div className="row">
                    <span className="btn btn-secondary btn-sm">Pause</span>
                    <span className="btn btn-ghost btn-sm">Stop</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section id="who" className="section" aria-labelledby="who-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">Who it&apos;s for</p>
            <h2 id="who-title">For anyone who finds typing hard.</h2>
            <p>You bring the words: written slowly, dictated, or drafted elsewhere. TypeWit does the typing part.</p>
          </div>
          <ul className="who-grid">
            {WHO.map(({ icon: WhoIcon, title, text }) => (
              <li key={title}><span className="who-icon" aria-hidden="true"><WhoIcon /></span><h3>{title}</h3><p>{text}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">How it works</p>
            <h2 id="how-title">Three steps, then nothing to do.</h2>
          </div>
          <ol className="steps">
            <li><h3>Add your text</h3><p>Paste it, or dictate it with your device&apos;s voice input. Edit it as much as you like first.</p></li>
            <li><h3>Approve it and pick a pace</h3><p>Read the exact text, then choose sentence or paragraph steps over minutes, hours or days.</p></li>
            <li><h3>TypeWit enters it</h3><p>Your Google Doc or Word document fills in on schedule. Pause, resume or stop whenever you like.</p></li>
          </ol>
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

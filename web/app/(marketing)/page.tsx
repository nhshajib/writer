import Link from "next/link";
import { Icon } from "@/components/Icons";
import { PRO_PRICE } from "@/lib/site";

const ticks = (items: string[]) => (
  <ul className="ticks">
    {items.map((t) => <li key={t}><Icon.check /><span>{t}</span></li>)}
  </ul>
);

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <span className="chip"><span className="dot" aria-hidden="true" /> Assistive writing for Google Docs and Word</span>
          <h1 id="hero-title" className="display">
            Your words in Google Docs and Word, <span className="soft">without typing.</span>
          </h1>
          <p className="lead">
            Paste or dictate your text, approve it, and TypeWit enters it into your document at the pace you choose.
            Built for people who find typing difficult, slow or painful.
          </p>
          <div className="cta-row">
            <Link href="/signup" className="btn btn-primary btn-lg">Get started free</Link>
            <Link href="/#how" className="btn btn-secondary btn-lg">See how it works</Link>
          </div>
          <p className="fine">Free plan · No card required · Sign up with Google</p>

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

          <div className="values">
            <div><Icon.hand /><p><strong>Made for accessibility</strong><span>Keyboard and screen reader friendly, with large controls.</span></p></div>
            <div><Icon.check /><p><strong>Nothing without approval</strong><span>You review the exact text before a word goes in.</span></p></div>
            <div><Icon.lock /><p><strong>Private by design</strong><span>TypeWit only opens documents it creates for you.</span></p></div>
          </div>
        </div>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">How it works</p>
            <h2 id="how-title">Three steps. No typing.</h2>
          </div>
          <ol className="steps">
            <li><h3>Paste or dictate</h3><p>Bring text you wrote or dictated. Edit it as much as you like first.</p></li>
            <li><h3>Approve it</h3><p>Read the exact text and confirm. If it changes, you approve it again.</p></li>
            <li><h3>Watch it arrive</h3><p>Sentences or paragraphs appear in your Google Doc or Word document at the pace you set.</p></li>
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="features-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">Designed around you</p>
            <h2 id="features-title">Calm, clear and always in your control.</h2>
          </div>
          <div className="bento">
            <div className="tile wide">
              <h3>You approve every word</h3>
              <p>TypeWit enters exactly what you approved, character for character, and nothing else.</p>
              <div className="vignette" aria-hidden="true">
                <p className="muted small" style={{ marginBottom: "0.5rem" }}>Text to enter</p>
                <p style={{ color: "var(--text-2)" }}>The results show a clear link between sleep and memory&hellip;</p>
                <div className="row" style={{ marginTop: "0.9rem", gap: "0.5rem" }}>
                  <span className="badge badge-green"><span className="dot" /> Approved</span>
                  <span className="muted small">412 words · fingerprint saved</span>
                </div>
              </div>
            </div>
            <div className="tile narrow">
              <h3>Pause any time</h3>
              <p>Pause, resume or stop. Close the tab and it keeps going.</p>
              <div className="vignette row" aria-hidden="true" style={{ gap: "0.5rem" }}>
                <span className="btn btn-secondary btn-sm">Pause</span>
                <span className="btn btn-ghost btn-sm">Stop</span>
              </div>
            </div>
            <div className="tile narrow">
              <h3>Your pace</h3>
              <p>Sentence by sentence, paragraph by paragraph, over minutes or days.</p>
              <div className="vignette" aria-hidden="true">
                <div className="seg" style={{ "--n": 2, "--i": 0 } as React.CSSProperties}>
                  <button type="button" tabIndex={-1} aria-pressed="true">Sentence</button>
                  <button type="button" tabIndex={-1}>Paragraph</button>
                </div>
              </div>
            </div>
            <div className="tile wide">
              <h3>A clear record of everything</h3>
              <p>Every approval and every step is in your activity log, ready to download. Google Docs and Word keep their own version history too.</p>
              <div className="vignette" aria-hidden="true">
                <ul className="tw-log">
                  <li><time>10:24</time><span>Sentence 7 entered</span></li>
                  <li><time>10:23</time><span>Sentence 6 entered</span></li>
                  <li><time>10:15</time><span>You approved the text</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="plans-title">
        <div className="container">
          <div className="section-head">
            <p className="kicker">Pricing</p>
            <h2 id="plans-title">Start free. Upgrade when it matters.</h2>
          </div>
          <div className="plans">
            <div className="plan">
              <h3>Free</h3>
              <p className="desc">For short pieces and trying TypeWit.</p>
              <div className="price"><strong>$0</strong><span>forever</span></div>
              {ticks(["250 words a day", "Sessions up to 1 hour", "One document at a time"])}
              <Link href="/signup" className="btn btn-secondary btn-block">Get started</Link>
            </div>
            <div className="plan featured">
              <div className="plan-top"><h3>Pro</h3><span className="badge badge-blue">7 days free</span></div>
              <p className="desc">For essays, reports and anything long.</p>
              <div className="price"><strong>{PRO_PRICE.year.amount}</strong><span>/ month, billed yearly</span></div>
              {ticks(["Unlimited words", "Sessions up to 1 week", "3 documents at once", "Priority support"])}
              <Link href="/pricing" className="btn btn-primary btn-block">Try Pro free</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Start writing without typing.</h2>
          <p>Free forever for short pieces. Everyone agrees to our <Link href="/responsible-use" style={{ color: "inherit", textDecoration: "underline" }}>Responsible Use Agreement</Link>.</p>
          <div className="cta-row">
            <Link href="/signup" className="btn btn-primary btn-lg">Get started free</Link>
          </div>
        </section>
      </div>
    </>
  );
}

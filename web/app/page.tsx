import Link from "next/link";
import { Icon } from "@/components/Icons";

const steps = [
  { title: "Paste or dictate", body: "Bring text you wrote, dictated or prepared. Review and edit it before anything happens." },
  { title: "Approve it", body: "Read the exact text and confirm. TypeWit never enters anything you haven't approved." },
  { title: "Watch it arrive", body: "TypeWit adds it to your Google Doc sentence by sentence or paragraph by paragraph, at your pace." },
];

const features = [
  { icon: Icon.hand, title: "Built for accessibility", body: "Works fully with a keyboard and screen readers, with large controls and clear focus." },
  { icon: Icon.pause, title: "You stay in control", body: "Pause, resume or stop at any moment. Progress updates live as each step lands." },
  { icon: Icon.cloud, title: "Keeps going without you", body: "Close the tab or turn off your computer. TypeWit carries on and lets you know when it's done." },
  { icon: Icon.list, title: "A clear record", body: "Every approval and insertion is in your activity log, which you can download any time." },
  { icon: Icon.shield, title: "Private by design", body: "TypeWit can only open documents it creates or that you choose. Nothing else in your Drive." },
  { icon: Icon.check, title: "Exactly your words", body: "What you approve is what goes in, character for character, including spacing and line breaks." },
];

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow rise">Assistive writing for Google Docs</p>
        <h1 id="hero-title" className="rise">
          Your words in your document.
          <br />
          <span className="gradient-text">Without the typing.</span>
        </h1>
        <p className="lead rise delay-1">
          TypeWit enters text you approve into Google Docs for you. Made for people who find typing difficult, slow or
          painful.
        </p>
        <div className="actions rise delay-2">
          <Link href="/signup" className="button large">Start free</Link>
          <Link href="/pricing" className="button large pro">Try Pro free for 7 days</Link>
        </div>
        <p className="fine-print">Free forever plan. Sign up with Google in one click.</p>

        <div className="showcase rise delay-2" aria-hidden="true">
          <div className="window">
            <div className="window-bar"><span /><span /><span /></div>
            <div className="window-body">
              <div className="window-doc">
                <p><strong>History essay · Draft 2</strong></p>
                <p>The printing press changed how ideas travelled across Europe. Within fifty years, books that once took months to copy could be produced in days.</p>
                <p>That speed had consequences nobody predicted.</p>
                <p className="faded">Pamphlets spread arguments faster than authorities could answer them, and readers began to…</p>
              </div>
              <div className="window-side">
                <div>
                  <div className="label">Progress</div>
                  <div className="value">62%</div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: "62%" }} /></div>
                </div>
                <div>
                  <div className="label">Next sentence in</div>
                  <div className="value">0:42</div>
                </div>
                <div className="mini-controls"><span>Pause</span><span>Stop</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title">Three steps. No typing.</h2>
          <p>Connect Google once. After that, every piece of writing takes less than a minute to set up.</p>
        </div>
        <ol className="grid steps">
          {steps.map((step, i) => (
            <li key={step.title} className="card">
              <span className="step-number" aria-hidden="true">{i + 1}</span>
              <h3><span className="sr-only">Step {i + 1}: </span>{step.title}</h3>
              <p className="muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="features-title">
        <div className="section-head">
          <p className="eyebrow">Designed around you</p>
          <h2 id="features-title">Easy for every hand.</h2>
        </div>
        <div className="grid three">
          {features.map(({ icon: FeatureIcon, title, body }) => (
            <div key={title} className="card">
              <span className="icon-badge"><FeatureIcon /></span>
              <h3>{title}</h3>
              <p className="muted" style={{ margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section pro-band" aria-labelledby="pro-title">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <p className="eyebrow">TypeWit Pro</p>
          <h2 id="pro-title">For the essay, the report, <span className="gradient-text">the whole book.</span></h2>
          <p>
            Free covers about a page a day. Pro removes the limits, so long pieces go in at the pace that suits you, in
            one go.
          </p>
        </div>
        <div className="grid">
          <div className="card">
            <span className="icon-badge"><Icon.infinity /></span>
            <p className="stat-big">Unlimited</p>
            <p className="muted" style={{ margin: 0 }}>words every day, instead of 250. A 2,000-word essay goes in today, not over eight days.</p>
          </div>
          <div className="card">
            <span className="icon-badge"><Icon.calendar /></span>
            <p className="stat-big">7 days</p>
            <p className="muted" style={{ margin: 0 }}>per session, instead of 1 hour. Spread long work out as gently as you like.</p>
          </div>
          <div className="card">
            <span className="icon-badge"><Icon.layers /></span>
            <p className="stat-big">3 at once</p>
            <p className="muted" style={{ margin: 0 }}>documents in progress at the same time, instead of one.</p>
          </div>
        </div>
        <div className="actions" style={{ marginTop: "2.5rem" }}>
          <Link href="/pricing" className="button large pro">Start your free week</Link>
          <Link href="/pricing#pro-steps" className="button large quiet">How to get Pro</Link>
        </div>
        <p className="fine-print" style={{ textAlign: "center" }}>
          From $9 a month, billed yearly. Nothing to pay for 7 days, and you can cancel anytime from your account.
        </p>
      </section>

      <section className="section" aria-labelledby="responsible-title">
        <div className="card raised narrow" style={{ textAlign: "center", padding: "2.5rem" }}>
          <span className="icon-badge"><Icon.shield /></span>
          <h2 id="responsible-title" style={{ fontSize: "1.8rem" }}>Honest by design</h2>
          <p className="muted" style={{ maxWidth: 560, margin: "0 auto 1.5rem" }}>
            TypeWit is an assistive tool. It doesn't disguise automated input, and everyone agrees to use it honestly
            and follow the rules of their school or workplace.
          </p>
          <Link href="/responsible-use" className="button secondary">Read the Responsible Use Agreement</Link>
        </div>
      </section>

      <section className="section cta-band" aria-labelledby="final-title">
        <h2 id="final-title">Start writing without typing.</h2>
        <p className="lead">Create your account in seconds. Upgrade only if you need more.</p>
        <div className="actions">
          <Link href="/signup" className="button large">Create free account</Link>
          <Link href="/pricing" className="button large secondary">Compare plans</Link>
        </div>
      </section>
    </>
  );
}

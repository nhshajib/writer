import Link from "next/link";
import { HeroIllustration } from "@/components/HeroIllustration";
import { Icon, Sparkle } from "@/components/Icons";

const steps = [
  { title: "Paste or dictate", body: "Bring text you wrote or dictated. Edit it as much as you like first." },
  { title: "Approve it", body: "Read the exact text and confirm. Nothing goes in without your approval." },
  { title: "Watch it arrive", body: "TypeWit adds it to Google Docs sentence by sentence, at the pace you choose." },
];

const features = [
  {
    icon: Icon.hand, tone: "blue", title: "Accessible by design",
    points: ["Full keyboard and screen reader support", "Large controls, clear focus", "Light and dark mode"],
  },
  {
    icon: Icon.pause, tone: "green", title: "You stay in control",
    points: ["Pause, resume or stop any time", "Live progress as each step lands", "Keeps going when you close the tab"],
  },
  {
    icon: Icon.shield, tone: "yellow", title: "Private and exact",
    points: ["Opens only documents it creates", "Your words, character for character", "Every step in your activity log"],
  },
];

export default function Home() {
  return (
    <>
      <section className="hero-split" aria-labelledby="hero-title">
        <div>
          <span className="badge-pill rise">
            <span className="chip">New</span> Assistive writing for Google Docs
          </span>
          <h1 id="hero-title" className="rise">
            Your words in Google Docs. <span className="gradient-text">No typing needed.</span>
          </h1>
          <p className="lead rise delay-1">
            Paste or dictate your text, approve it, and TypeWit enters it into your document for you. Made for people who
            find typing difficult, slow or painful.
          </p>
          <div className="actions rise delay-2">
            <Link href="/signup" className="button large">Start free</Link>
            <Link href="/#how" className="button large secondary">How it works</Link>
          </div>
          <div className="stats-row">
            <div><strong>1 min</strong><span>to set up a session</span></div>
            <div><strong>250</strong><span>words a day free, forever</span></div>
            <div><strong>7 days</strong><span>of Pro, free to try</span></div>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="blob" />
          <Sparkle className="sparkle s1" />
          <Sparkle className="sparkle s2" />
          <Sparkle className="sparkle s3" />
          <HeroIllustration className="hero-svg" />
        </div>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <div className="section-head">
          <span className="badge-pill center"><span className="g-dots"><i /><i /><i /><i /></span> How it works</span>
          <h2 id="how-title" style={{ marginTop: "1rem" }}>Three steps. No typing.</h2>
        </div>
        <ol className="grid steps">
          {steps.map((step, i) => (
            <li key={step.title} className={i === 0 ? "card dark" : "card outline"}>
              <span className="step-number" aria-hidden="true">{i + 1}</span>
              <h3><span className="sr-only">Step {i + 1}: </span>{step.title}</h3>
              <p className="muted" style={{ margin: 0 }}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="features-title">
        <div className="section-head">
          <h2 id="features-title">Made for every hand.</h2>
        </div>
        <div className="grid">
          {features.map(({ icon: FeatureIcon, tone, title, points }) => (
            <div key={title} className="card">
              <span className={`tile ${tone}`}><FeatureIcon /></span>
              <h3>{title}</h3>
              <ul className="feature-list">
                {points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section pro-strip" aria-labelledby="pro-title">
        <div>
          <p className="eyebrow pro-eyebrow">TypeWit Pro</p>
          <h2 id="pro-title">For essays, reports and anything long.</h2>
          <ul className="plan-features">
            <li><span><strong>Unlimited</strong> words every day</span></li>
            <li><span>Sessions up to <strong>1 week</strong></span></li>
            <li><span><strong>3 documents</strong> at once, plus priority support</span></li>
          </ul>
        </div>
        <div>
          <p className="price" style={{ margin: 0 }}>$9 <small>/ month, billed yearly</small></p>
          <p className="muted">or $15 monthly. Cancel any time.</p>
          <Link href="/pricing" className="button pro large block">Try Pro free for 7 days</Link>
          <p className="fine-print" style={{ textAlign: "center" }}>Nothing to pay today.</p>
        </div>
      </section>

      <p className="note-row">
        <Icon.shield />
        <span>TypeWit is an honest assistive tool. Everyone agrees to use it responsibly.</span>
        <Link href="/responsible-use">Read the agreement</Link>
      </p>
    </>
  );
}

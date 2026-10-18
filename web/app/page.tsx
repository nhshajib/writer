import Link from "next/link";

const steps = [
  { title: "Write or paste", body: "Bring text you wrote, dictated or prepared. You can review and edit it first." },
  { title: "Approve", body: "Check the exact text and confirm. TypeWit never enters anything you haven't approved." },
  { title: "TypeWit enters it", body: "Your text goes into Google Docs sentence by sentence or paragraph by paragraph, at the pace you choose." },
];

const features = [
  { title: "Built for accessibility", body: "Works fully with a keyboard and screen readers, with clear focus and large controls." },
  { title: "You stay in control", body: "Pause, resume or stop at any time. Follow progress live and see what's been entered." },
  { title: "Clear records", body: "Every approval and insertion is listed in your activity log, and Google Docs keeps its own version history." },
  { title: "Keeps working", body: "Close the tab or turn off your computer. TypeWit carries on and lets you know when it's done." },
];

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Your words, in your document.</h1>
        <p className="lead">
          TypeWit enters text you approve into Google Docs for you, for people who find typing difficult, slow or painful.
        </p>
        <div className="actions">
          <Link href="/signup" className="button">Get started free</Link>
          <Link href="/pricing" className="button secondary">See pricing</Link>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title" className="section-title">How it works</h2>
        <ol className="grid" style={{ listStyle: "none", padding: 0 }}>
          {steps.map((step, i) => (
            <li key={step.title} className="card">
              <p className="muted" aria-hidden="true">Step {i + 1}</p>
              <h3>{step.title}</h3>
              <p className="muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="features-title">
        <h2 id="features-title" className="section-title">Made to be easy</h2>
        <div className="grid">
          {features.map((feature) => (
            <div key={feature.title} className="card">
              <h3>{feature.title}</h3>
              <p className="muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section card" aria-labelledby="responsible-title" style={{ textAlign: "center" }}>
        <h2 id="responsible-title">Used responsibly</h2>
        <p className="muted" style={{ maxWidth: 620, margin: "0 auto 1.25rem" }}>
          TypeWit is an assistive tool. It doesn't disguise automated input, and everyone agrees to use it honestly and
          follow the rules of their school or workplace.
        </p>
        <Link href="/responsible-use" className="button secondary">Read the Responsible Use Agreement</Link>
      </section>
    </>
  );
}

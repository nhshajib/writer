"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { FREE_FEATURES, PLAN_COMPARISON, PRO_FEATURES } from "@/lib/plans";
import { PRO_PRICE, YEARLY_SAVING } from "@/lib/site";
import { supabase } from "@/lib/supabase";

type Interval = "year" | "month";


const COMPARE = PLAN_COMPARISON;

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does the free trial work?",
    a: "You get every Pro feature free for 7 days. Stripe asks for a card when you start, but nothing is charged until the trial ends. Cancel before then and you pay nothing. Each person can use the trial once.",
  },
  {
    q: "What happens when the trial ends?",
    a: "If you keep Pro, your plan continues automatically at the price you chose. If you cancel, you move back to Free and keep your account, your sessions and your activity log.",
  },
  {
    q: "How do I cancel?",
    a: "Go to Plan & usage in your dashboard and choose Manage billing. You can cancel there at any time. You keep Pro until the end of the period you've already paid for.",
  },
  {
    q: "Is my payment secure?",
    a: "Payments are handled by Stripe. TypeWit never sees or stores your card number.",
  },
  {
    q: "Which email can I sign up with?",
    a: "Use Continue with Google, or a personal email from a common provider such as Gmail, Outlook, Yahoo or iCloud. Work, school and temporary addresses aren't accepted for sign-up.",
  },
  {
    q: "Is Free really free?",
    a: "Yes. The Free plan has no time limit and doesn't need a card. It includes 150 words a day (about half a page) and sessions up to 30 minutes, with Natural and Steady rhythms, sentence pauses, every insertion mode and accessibility feature.",
  },
];

function PricingContent() {
  const router = useRouter();
  // Read after load (not useSearchParams), so the whole page is in the pre-rendered HTML for search engines.
  const [canceled, setCanceled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    setCanceled(new URLSearchParams(window.location.search).get("checkout") === "canceled");
  }, []);

  async function startPro(interval: Interval) {
    if (!signedIn) {
      router.push("/signup?next=/pricing");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("billing/checkout", { method: "POST", body: { interval } });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(false);
    }
  }

  const tick = (t: React.ReactNode, key: string) => <li key={key}><Icon.check /><span>{t}</span></li>;

  return (
    <>
      <section className="hero" aria-labelledby="pricing-title" style={{ paddingTop: "4.5rem" }}>
        <div className="container">
          <p className="kicker">Pricing</p>
          <h1 id="pricing-title" className="display" style={{ marginTop: 0, fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}>
            Simple pricing. <span className="soft">Start free.</span>
          </h1>
          <p className="lead">Try every Pro feature free for 7 days. Cancel any time.</p>
          {canceled && (
            <p className="alert alert-info" role="status" style={{ maxWidth: 460, margin: "1.5rem auto 0" }}>
              Checkout was canceled. You haven't been charged.
            </p>
          )}
        </div>
      </section>

      <section className="container pricing-grid-section" aria-label="Plans and comparison">
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <div className="pricing-cards">
          <div className="pricing-intro"><p className="kicker">Your testing toolkit</p><h2>Start small.<br />Get more control with Pro.</h2><p className="muted">Both paid plans include every Pro feature. Yearly costs $23.88 less than 12 monthly payments.</p></div>
          <section className="plan" aria-labelledby="free-title">
            <h2 id="free-title">Free</h2><p className="desc">Try a short document session.</p>
            <div className="price"><strong>$0</strong><span>/ month</span></div><p className="price-note">Free forever · no card needed</p>
            <Link href={signedIn ? "/app/new/" : "/signup/"} className="btn btn-secondary btn-block">{signedIn ? "Start a session" : "Start free"}</Link>
            <ul className="ticks">{FREE_FEATURES.map(f => tick(f, f))}</ul>
          </section>
          <section className="plan" aria-labelledby="monthly-title">
            <h2 id="monthly-title">Monthly</h2><p className="desc">All Pro features, billed monthly.</p>
            <div className="price"><strong>{PRO_PRICE.month.amount}</strong><span>/ month</span></div><p className="price-note">$6.99 billed each month after trial</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => startPro("month")} disabled={busy}>{busy ? "Opening checkout…" : "Try Monthly free"}</button>
            <ul className="ticks">{["Unlimited words · up to 3 sessions at once", "Drafting rhythm and all advanced controls", "Import files and edit paused sessions"].map(f => tick(f,f))}</ul>
          </section>
          <section className="plan featured" aria-labelledby="yearly-title">
            <div className="plan-top"><h2 id="yearly-title">Yearly</h2><span className="badge badge-blue">Best value</span></div><p className="desc">All Pro features, at our lowest rate.</p>
            <div className="price"><strong>{PRO_PRICE.year.amount}</strong><span>/ month equivalent</span></div><p className="price-note"><span className="save">$60 billed yearly · {YEARLY_SAVING}</span></p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => startPro("year")} disabled={busy}>{busy ? "Opening checkout…" : "Try Yearly free"}</button>
            <ul className="ticks">{["Everything in Monthly", "$23.88 less per year than paying monthly", "One annual payment · cancel renewal anytime"].map(f => tick(f,f))}</ul>
          </section>
        </div>
        <p className="hint pricing-disclosure">Eligible new Pro subscribers get 7 days free with a card. Then $6.99/month or $60/year, paid upfront and renewed automatically until canceled. Cancel before the trial ends to avoid the first charge. Taxes may apply. Existing subscribers can manage their plan in <Link href="/app/billing/">Plan &amp; usage</Link>.</p>
        <h2 id="compare-title" className="section-title">Compare every feature</h2>
        <div className="compare-wrap pricing-comparison">
          <table className="compare">
            <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Monthly</th><th scope="col">Yearly</th></tr></thead>
            <tbody>{COMPARE.map(row => <tr key={row.feature}><th scope="row">{row.feature}</th><td data-label="Free">{row.free}</td><td data-label="Monthly">{row.pro}</td><td data-label="Yearly"><strong>{row.pro}</strong></td></tr>)}</tbody>
          </table>
        </div>
        <details className="more pricing-pro-list"><summary>Explore the Pro toolkit</summary><ul className="ticks">{PRO_FEATURES.map(f => tick(f,f))}</ul></details>
        <p className="hint">For authorized testing only. Simulated edits are automated; Google controls how edits appear in version history. <Link href="/responsible-use/">Read the Responsible Use Agreement</Link>.</p>
      </section>

      <section id="pro-steps" className="section" aria-labelledby="steps-title">
        <div className="container">
          <div className="section-head"><h2 id="steps-title">Getting Pro takes a minute.</h2></div>
          <ol className="steps">
            <li><h3>Create your account</h3><p>Continue with Google or a personal email, and accept the Responsible Use Agreement.</p></li>
            <li><h3>Start your free week</h3><p>Pick yearly or monthly above and add a card on Stripe&apos;s secure page.</p></li>
            <li><h3>Test with more control</h3><p>Pro starts right away. Cancel any time in Plan &amp; usage.</p></li>
          </ol>
        </div>
      </section>

      <section id="faq" className="section" aria-labelledby="faq-title">
        <div className="container narrow">
          <div className="section-head"><h2 id="faq-title">Questions</h2></div>
          <div className="faq">
            {FAQ.map((item) => (
              <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function PricingPage() {
  return <PricingContent />;
}

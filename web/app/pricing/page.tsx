"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type Interval = "year" | "month";

const PRO_PRICE: Record<Interval, { amount: string; note: string; saving?: string }> = {
  year: { amount: "$9", note: "/ month", saving: "Billed $108 a year. Save $72 (40%)" },
  month: { amount: "$15", note: "/ month" },
};

const COMPARE: { feature: string; free: string; pro: string }[] = [
  { feature: "Words per day", free: "250", pro: "Unlimited" },
  { feature: "Longest session", free: "1 hour", pro: "1 week" },
  { feature: "Documents in progress at once", free: "1", pro: "3" },
  { feature: "Sentence, paragraph or chunk steps", free: "Yes", pro: "Yes" },
  { feature: "Pause, resume and stop", free: "Yes", pro: "Yes" },
  { feature: "Live progress and preview", free: "Yes", pro: "Yes" },
  { feature: "Activity log with download", free: "Yes", pro: "Yes" },
  { feature: "Notification when a session finishes", free: "Yes", pro: "Yes" },
  { feature: "Email support", free: "Yes", pro: "Priority" },
];

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
    a: "Go to Account and choose Manage billing. You can cancel there at any time. You keep Pro until the end of the period you've already paid for.",
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
    a: "Yes. The Free plan has no time limit and doesn't need a card. It includes 250 words a day, which is roughly one page.",
  },
];

function PricingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [interval, setInterval] = useState<Interval>("year");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  async function startPro() {
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

  const price = PRO_PRICE[interval];

  return (
    <>
      <section className="hero" aria-labelledby="pricing-title">
        <span className="badge-pill center"><span className="g-dots"><i /><i /><i /><i /></span> Pricing</span>
        <h1 id="pricing-title" style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", margin: "1rem 0 0.75rem" }}>
          Start free. <span className="gradient-text">Go Pro</span> when it matters.
        </h1>
        <p className="lead" style={{ marginBottom: "1.5rem" }}>Try every Pro feature free for 7 days.</p>
        {params.get("checkout") === "canceled" && (
          <p className="notice narrow" role="status">Checkout was canceled. You haven't been charged.</p>
        )}
        <div className="toggle" role="group" aria-label="Billing period" data-active={interval === "month" ? "2" : "1"}>
          <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>
            Yearly · save 40%
          </button>
          <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>
            Monthly
          </button>
        </div>
      </section>

      <div className="plans">
        <section className="plan" aria-labelledby="free-title">
          <h2 id="free-title">Free</h2>
          <p className="muted" style={{ margin: 0 }}>For short pieces and trying TypeWit.</p>
          <p className="price">$0 <small>forever</small></p>
          <p className="muted" style={{ minHeight: "1.6em" }}>No card needed.</p>
          <ul className="plan-features">
            <li>250 words a day</li>
            <li>Sessions up to 1 hour</li>
            <li>One document at a time</li>
            <li>Every accessibility feature</li>
          </ul>
          <Link href="/signup" className="button secondary block">Start free</Link>
        </section>

        <section className="plan featured" aria-labelledby="pro-title">
          <span className="ribbon">7 days free</span>
          <h2 id="pro-title">Pro</h2>
          <p className="muted" style={{ margin: 0 }}>For essays, reports and anything long.</p>
          <p className="price">{price.amount} <small>{price.note}</small></p>
          <p style={{ minHeight: "1.6em" }}>
            {price.saving ? <span className="saving">{price.saving}</span> : <span className="muted">Billed monthly</span>}
          </p>
          <ul className="plan-features">
            <li><span><strong>Unlimited</strong> words every day</span></li>
            <li><span>Sessions up to <strong>1 week</strong></span></li>
            <li><span><strong>3 documents</strong> in progress at once</span></li>
            <li><span><strong>Priority</strong> email support</span></li>
            <li>Everything in Free</li>
          </ul>
          <button type="button" className="button pro block large" onClick={startPro} disabled={busy}>
            {busy ? "Opening secure checkout…" : "Start 7-day free trial"}
          </button>
          <p className="fine-print" style={{ textAlign: "center" }}>
            Nothing to pay today. Cancel anytime before the trial ends and you won't be charged.
          </p>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      </div>

      <section id="pro-steps" className="section" aria-labelledby="steps-title">
        <div className="section-head">
          <h2 id="steps-title">Pro in three easy steps.</h2>
        </div>
        <ol className="grid steps">
          <li className="card dark">
            <span className="step-number" aria-hidden="true">1</span>
            <h3><span className="sr-only">Step 1: </span>Create your account</h3>
            <p className="muted">Continue with Google or a personal email, and accept the Responsible Use Agreement.</p>
          </li>
          <li className="card outline">
            <span className="step-number" aria-hidden="true">2</span>
            <h3><span className="sr-only">Step 2: </span>Start your free week</h3>
            <p className="muted">Pick yearly or monthly above and add a card on Stripe's secure page. Nothing is charged today.</p>
          </li>
          <li className="card outline">
            <span className="step-number" aria-hidden="true">3</span>
            <h3><span className="sr-only">Step 3: </span>Write without limits</h3>
            <p className="muted">Pro starts right away. Cancel any time in Plan & billing.</p>
          </li>
        </ol>
      </section>

      <section className="section narrow" aria-labelledby="compare-title">
        <div className="section-head">
          <h2 id="compare-title">Compare plans</h2>
        </div>
        <div className="table-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Free</th>
                <th scope="col">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <td>{row.free}</td>
                  <td><strong>{row.pro}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="faq" className="section narrow" aria-labelledby="faq-title">
        <div className="section-head">
          <h2 id="faq-title">Questions, answered</h2>
        </div>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

    </>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

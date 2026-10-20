"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { PRO_PRICE } from "@/lib/site";
import { supabase } from "@/lib/supabase";

type Interval = "year" | "month";


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
          {params.get("checkout") === "canceled" && (
            <p className="alert alert-info" role="status" style={{ maxWidth: 460, margin: "1.5rem auto 0" }}>
              Checkout was canceled. You haven't been charged.
            </p>
          )}
          <div style={{ marginTop: "2rem" }}>
            <div className="seg" role="group" aria-label="Billing period" style={{ "--n": 2, "--i": interval === "year" ? 0 : 1 } as React.CSSProperties}>
              <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly · save 40%</button>
              <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ marginTop: "2.5rem" }}>
        <div className="plans">
          <section className="plan" aria-labelledby="free-title">
            <h2 id="free-title">Free</h2>
            <p className="desc">For short pieces and trying TypeWit.</p>
            <div className="price"><strong>$0</strong><span>forever</span></div>
            <p className="price-note">No card needed</p>
            <ul className="ticks">
              {tick("250 words a day", "a")}
              {tick("Sessions up to 1 hour", "b")}
              {tick("One document at a time", "c")}
              {tick("Every accessibility feature", "d")}
            </ul>
            <Link href="/signup" className="btn btn-secondary btn-block">Get started</Link>
          </section>

          <section className="plan featured" aria-labelledby="pro-title">
            <div className="plan-top"><h2 id="pro-title">Pro</h2><span className="badge badge-blue">7 days free</span></div>
            <p className="desc">For essays, reports and anything long.</p>
            <div className="price"><strong>{price.amount}</strong><span>{price.note}</span></div>
            <p className="price-note">{price.saving ? <span className="save">{price.saving}</span> : "Billed monthly"}</p>
            <ul className="ticks">
              {tick(<><strong>Unlimited</strong> words every day</>, "a")}
              {tick(<>Sessions up to <strong>1 week</strong></>, "b")}
              {tick(<><strong>3 documents</strong> at once</>, "c")}
              {tick(<><strong>Priority</strong> email support</>, "d")}
            </ul>
            <button type="button" className="btn btn-primary btn-block" onClick={startPro} disabled={busy}>
              {busy ? "Opening secure checkout…" : "Start 7-day free trial"}
            </button>
            <p className="price-note center" style={{ marginTop: "0.75rem" }}>Nothing to pay today. Cancel before day 7 and you won't be charged.</p>
            {error && <p className="alert alert-error" role="alert" style={{ marginTop: "0.75rem" }}>{error}</p>}
          </section>
        </div>
      </div>

      <section id="pro-steps" className="section" aria-labelledby="steps-title">
        <div className="container">
          <div className="section-head"><h2 id="steps-title">Getting Pro takes a minute.</h2></div>
          <ol className="steps">
            <li><h3>Create your account</h3><p>Continue with Google or a personal email, and accept the Responsible Use Agreement.</p></li>
            <li><h3>Start your free week</h3><p>Pick yearly or monthly above and add a card on Stripe&apos;s secure page.</p></li>
            <li><h3>Write without limits</h3><p>Pro starts right away. Cancel any time in Plan &amp; usage.</p></li>
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="compare-title">
        <div className="container narrow">
          <div className="section-head"><h2 id="compare-title">Compare plans</h2></div>
          <div className="compare-wrap">
            <table className="compare">
              <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.feature}><th scope="row">{row.feature}</th><td>{row.free}</td><td><strong>{row.pro}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
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
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

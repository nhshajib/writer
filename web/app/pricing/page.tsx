"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type Interval = "year" | "month";

const PRO_PRICE: Record<Interval, { amount: string; note: string }> = {
  year: { amount: "$9", note: "per month, billed $108 yearly" },
  month: { amount: "$15", note: "per month, billed monthly" },
};

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

  return (
    <>
      <section className="hero" aria-labelledby="pricing-title">
        <h1 id="pricing-title">Simple pricing</h1>
        <p className="lead">Start free. Upgrade when you need more. Cancel anytime.</p>
        {params.get("checkout") === "canceled" && (
          <p className="notice" role="status">Checkout was canceled. You haven't been charged.</p>
        )}
        <div className="toggle" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>
            Yearly · save 40%
          </button>
          <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>
            Monthly
          </button>
        </div>
      </section>

      <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
        <section className="card raised" aria-labelledby="free-title">
          <h2 id="free-title">Free</h2>
          <p className="price">$0</p>
          <p className="muted">For trying Writer and short pieces.</p>
          <ul className="plan-features">
            <li>250 words a day</li>
            <li>Sessions up to 1 hour</li>
            <li>One session at a time</li>
            <li>Sentence, paragraph or chunk steps</li>
            <li>Activity log and progress</li>
          </ul>
          <Link href="/signup" className="button secondary" style={{ width: "100%" }}>Start free</Link>
        </section>

        <section className="card raised" aria-labelledby="pro-title" style={{ borderColor: "var(--accent)" }}>
          <h2 id="pro-title">Pro</h2>
          <p className="price">
            {PRO_PRICE[interval].amount} <small>{PRO_PRICE[interval].note}</small>
          </p>
          <p className="muted">7-day free trial, once per person. Card required; cancel before it ends and you won't be charged.</p>
          <ul className="plan-features">
            <li>Unlimited words</li>
            <li>Sessions up to 1 week</li>
            <li>Up to 3 sessions at once</li>
            <li>Email when a session finishes</li>
            <li>Everything in Free</li>
          </ul>
          <button type="button" className="button" style={{ width: "100%" }} onClick={startPro} disabled={busy}>
            {busy ? "Opening checkout…" : "Start 7-day free trial"}
          </button>
          {error && <p className="error" role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
        </section>
      </div>

      <section className="section" aria-labelledby="faq-title" style={{ maxWidth: 720, margin: "4rem auto 0" }}>
        <h2 id="faq-title">Questions</h2>
        <h3>How does the free trial work?</h3>
        <p className="muted">
          You get Pro free for 7 days. Stripe asks for a card at the start and charges only if you don't cancel before
          the trial ends. Each person can use the trial once.
        </p>
        <h3>Can I cancel anytime?</h3>
        <p className="muted">Yes. Manage or cancel your plan from your account page. You keep Pro until the end of the period you paid for.</p>
        <h3>Which email can I sign up with?</h3>
        <p className="muted">A personal address from a common provider such as Gmail, Outlook, Yahoo or iCloud.</p>
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

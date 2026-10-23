"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { DAY_PASS_FEATURES, FREE_FEATURES, PLAN_COMPARISON } from "@/lib/plans";
import { DAY_PASS_PRICE, PRO_PRICE, YEARLY_SAVING } from "@/lib/site";
import { supabase } from "@/lib/supabase";

type Interval = "year" | "month" | "day";


const COMPARE = PLAN_COMPARISON;

const FAQ: { q: string; a: string }[] = [
  { q: "Can I take long breaks between writing blocks?", a: "Yes, with Day Pass or Pro. Choose writing blocks from 5 minutes to 12 hours and rests from 15 minutes to 8 hours. Long breaks are added to the writing time. Google Docs continues automatically even with the browser closed; Word needs its document and add-in open. Every restart and the finish must fit Day Pass access. Service delays can move the resume time later; separate Google version-history groups are not guaranteed." },
  { q: "How does the Day Pass work?", a: "Pay $4.99 once for 24 hours from payment confirmation. No subscription, trial or renewal. It includes unlimited words, one active session, writing hours, customizable writing blocks with rests up to 8 hours, and priority dispatch. Restarts and the finish must fit the remaining access window. At expiry, unfinished pass sessions pause; existing document text and your activity log remain. Buy another pass after expiry or upgrade to Pro to resume. Pro adds advanced drafting, playback and the final revision pass." },
  { q: "Can I continue an existing or shared Google Doc?", a: "Yes, on every plan, without a three-day restriction. Choose the document from Google Drive. TypeWit appends your approved text to the same document, or Pro can target a heading. If collaborators change the insertion point, entry pauses for your review. It does not overwrite their work." },
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
    a: "Yes. The Free plan has no time limit and doesn't need a card. It includes 250 words a day (about half a page) and sessions up to 60 minutes, with Natural and Steady rhythms, sentence pauses, every insertion mode and accessibility feature.",
  },
];

function PricingContent() {
  const router = useRouter();
  // Read after load (not useSearchParams), so the whole page is in the pre-rendered HTML for search engines.
  const [canceled, setCanceled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<"month" | "year">("year");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    setCanceled(new URLSearchParams(window.location.search).get("checkout") === "canceled");
  }, []);

  async function startPro(interval: Interval) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // A click can arrive before the initial effect updates signedIn.
      // Resolve the persisted session before deciding this is a guest.
      const { data, error: sessionError } = await supabase().auth.getSession();
      if (sessionError) throw new Error("Couldn't check your sign-in. Please try again.");
      if (!data.session) {
        router.push("/signup?next=/pricing");
        setBusy(false);
        return;
      }
      setSignedIn(true);
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
      <section className="hero pricing-hero" aria-labelledby="pricing-title">
        <div className="container">
          <p className="kicker">Pricing</p>
          <h1 id="pricing-title" className="display pricing-display">
            Choose the plan <span className="soft">that fits.</span>
          </h1>
          <p className="lead">Try every Pro feature free for 7 days. Cancel any time.</p>
          {canceled && (
            <p className="alert alert-info pricing-note" role="status">
              Checkout was canceled. You haven't been charged.
            </p>
          )}
        </div>
      </section>

      <section className="container pricing-grid-section" aria-label="Plans and comparison">
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <div className="billing-choice" role="group" aria-label="Pro billing period">
          <button type="button" aria-pressed={billing === "month"} disabled={busy} onClick={() => setBilling("month")}>Monthly</button>
          <button type="button" aria-pressed={billing === "year"} disabled={busy} onClick={() => setBilling("year")}>Yearly <span>Save 28%</span></button>
        </div>
        <p className="pricing-intro muted">Monthly and Yearly include the same Pro features; Yearly costs $23.88 less than 12 monthly payments. A Day Pass gives you one day without a subscription.</p>
        <div className="pricing-cards">
          <section className="plan" aria-labelledby="free-title">
            <h2 id="free-title">Free</h2><p className="desc">Try a short document session.</p>
            <div className="price"><strong>$0</strong><span>/ month</span></div><p className="price-note">Free forever · no card needed</p>
            <Link href={signedIn ? "/app/new/" : "/signup/"} className="btn btn-secondary btn-block">{signedIn ? "Start a session" : "Start free"}</Link>
            <ul className="ticks">{FREE_FEATURES.map(f => tick(f, f))}</ul>
          </section>
          <section className="plan" aria-labelledby="day-pass-title">
            <h2 id="day-pass-title">Day Pass</h2><p className="desc">One focused day, no subscription.</p>
            <div className="price"><strong>{DAY_PASS_PRICE}</strong><span>/ 24 hours</span></div><p className="price-note">One-time payment · never renews</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => startPro("day")} disabled={busy}>{busy ? "Opening checkout…" : "Get Day Pass"}</button>
            <ul className="ticks">{DAY_PASS_FEATURES.slice(1, 6).map(f => tick(f, f))}</ul>
          </section>
          <section className="plan featured" aria-labelledby="pro-title">
            <div className="plan-top"><h2 id="pro-title">Pro</h2><span className="badge badge-blue">{billing === "year" ? "Best value" : "Full control"}</span></div><p className="desc">Every Pro feature, with the billing that suits you.</p>
            <div className="price"><strong>{billing === "year" ? PRO_PRICE.year.amount : PRO_PRICE.month.amount}</strong><span>{billing === "year" ? "/ month equivalent" : "/ month"}</span></div>
            <p className="price-note">{billing === "year" ? <span className="save">$60 billed yearly · {YEARLY_SAVING}</span> : "$6.99 billed each month after trial"}</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => startPro(billing)} disabled={busy}>{busy ? "Opening checkout…" : billing === "year" ? "Try Yearly free" : "Try Monthly free"}</button>
            <ul className="ticks">{["Unlimited words · up to 3 sessions at once", "Drafting rhythm and all advanced controls", "Import files and edit paused sessions", "7 days free for eligible new subscribers"].map(f => tick(f,f))}</ul>
          </section>
        </div>
        <p className="hint pricing-disclosure">Eligible new Pro subscribers get 7 days free with a card. Then $6.99/month or $60/year, paid upfront and renewed automatically until canceled. Cancel before the trial ends to avoid the first charge. Taxes may apply. Existing subscribers can manage their plan in <Link href="/app/billing/">Plan &amp; usage</Link>.</p>
        <h2 id="compare-title" className="section-title">Compare every feature</h2>
        <p id="compare-note" className="pricing-compare-note">Compare three levels of access: Free, Day Pass and Pro. <strong>Monthly and yearly Pro include exactly the same features.</strong> Choose monthly for flexibility, or yearly to save 28%.</p>
        <div className="compare-wrap pricing-comparison">
          <table className="compare" aria-labelledby="compare-title" aria-describedby="compare-note">
            <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Day Pass</th><th scope="col">Pro<span className="compare-tier-note">Monthly or yearly</span></th></tr></thead>
            <tbody>{COMPARE.map(row => <tr key={row.feature}><th scope="row">{row.feature}</th><td data-label="Free">{row.free}</td><td data-label="Day Pass">{row.day}</td><td data-label="Pro"><strong>{row.pro}</strong></td></tr>)}</tbody>
          </table>
        </div>
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

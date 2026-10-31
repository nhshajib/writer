"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { ACTIVE_STATUSES, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { PRO_PRICE, YEARLY_SAVING } from "@/lib/site";
import { PRO_FEATURES } from "@/lib/plans";
import { isMinor, startCheckout } from "@/lib/billing";
import { dailyResetTime, span, when } from "@/lib/time";

type Interval = "year" | "month";

const STATUS_TEXT: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment problem",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Payment incomplete",
};

/** "250 words a day, sessions up to 60 minutes, one at a time." from the plan's limits. */
function describeLimits(limits: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS]): string {
  const words = limits.dailyWords ? `${limits.dailyWords} words a day` : "Unlimited words";
  const atOnce = limits.activeSessions === 1 ? "one at a time" : `${limits.activeSessions} at once`;
  return `${words}, sessions up to ${span(limits.maxMinutes * 60_000)}, ${atOnce}.`;
}

export default function BillingPage() {
  const { profile, drips, wordsToday, refresh } = useDashboard();
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("checkout");
    setCheckout(value);
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (value === "success" && sessionId) {
      let cancelled = false;
      api<{ active: boolean }>("billing/activate-pass", { method: "POST", body: { session_id: sessionId } })
        .then(() => { if (!cancelled) refresh(); })
        .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Payment verification is pending. Please refresh."); });
      return () => { cancelled = true; };
    }
    // The webhook can land a moment after Stripe sends people back.
    if (value === "success") {
      const timer = setTimeout(refresh, 2500);
      return () => clearTimeout(timer);
    }
  }, [refresh]);

  const isPro = profile.plan === "pro";
  const limits = PLAN_LIMITS[profile.plan];
  const active = drips.filter((d) => ACTIVE_STATUSES.has(d.status)).length;
  // Pro has to be bought by an adult (the server refuses under-18s too).
  const minor = isMinor(profile);
  const usagePercent = limits.dailyWords ? Math.min(100, Math.round((wordsToday / limits.dailyWords) * 100)) : 0;

  async function startTrial(offer: Interval | "day") {
    setBusy(true);
    setError(null);
    try {
      await startCheckout(offer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(false);
    }
  }

  const tick = (t: React.ReactNode, key: string) => <li key={key}><Icon.check /><span>{t}</span></li>;

  return (
    <>
      <div className="billing-page">
      <div className="page-head">
        <div>
          <h1>Plan &amp; usage</h1>
          <p>Your usage at a glance. Choose more access when you need it.</p>
        </div>
        {(isPro || profile.day_pass_expires_at || profile.subscription_status === "canceled") && (
          <Link href="/app/billing/manage/" className="btn btn-secondary btn-sm">
            <Icon.card />{isPro ? "Manage billing" : "Billing history"}
          </Link>
        )}
      </div>

      <div className="stack-4 mb-5" hidden={!(checkout || profile.subscription_status === "past_due" || error)}>
        {checkout === "success" && (
          <p className="alert alert-success" role="status">
            <span>Thank you! {isPro ? "You're on Pro." : profile.plan === "day_pass" ? "Your Day Pass is active." : "Your plan is updating; this can take a few seconds."}{" "}
              {profile.plan === "free" && <button type="button" className="link-btn" onClick={refresh}>Refresh</button>}</span>
          </p>
        )}
        {checkout === "canceled" && <p className="alert alert-info" role="status">Checkout was canceled. You haven&apos;t been charged.</p>}
        {profile.subscription_status === "past_due" && (
          <p className="alert alert-error" role="alert">Your last payment didn&apos;t go through. Update your card in Manage billing to keep Pro.</p>
        )}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
      </div>

      <section className="billing-overview" aria-labelledby="plan-title">
        <div className="billing-plan-heading">
          <div>
            <p className="eyebrow">Current plan</p>
            <h2 id="plan-title">{isPro ? "Pro" : profile.plan === "day_pass" ? "Day Pass" : "Free"}</h2>
            <p className="muted small">{describeLimits(limits)}</p>
          </div>
          {profile.subscription_status && <span className="badge">{STATUS_TEXT[profile.subscription_status] ?? profile.subscription_status}</span>}
        </div>
        {profile.plan === "day_pass" && profile.day_pass_expires_at && (
          <p className="billing-expiry"><Icon.clock /><span>Expires {when(profile.day_pass_expires_at)} · no renewal. Unfinished pass sessions pause at expiry; your document text stays.</span></p>
        )}
        <div className="billing-usage">
          <section aria-labelledby="usage-title">
            <h3 id="usage-title">Words today</h3>
            <p className="billing-stat">{wordsToday.toLocaleString()}<span>{limits.dailyWords ? ` / ${limits.dailyWords}` : " · unlimited"}</span></p>
            {limits.dailyWords ? <>
              <div className="billing-meter" role="meter" aria-label="Words used today" aria-valuemin={0} aria-valuemax={limits.dailyWords} aria-valuenow={Math.min(wordsToday, limits.dailyWords)}>
                <span style={{ width: `${usagePercent}%`, background: usagePercent >= 90 ? "var(--amber)" : undefined }} />
              </div>
              <p className="hint">Resets at {dailyResetTime()} (midnight UTC)</p>
            </> : <p className="hint">No daily word limit</p>}
          </section>
          <section aria-labelledby="active-title">
            <h3 id="active-title">Active sessions</h3>
            <p className="billing-stat">{active}<span> / {limits.activeSessions}</span></p>
            <p className="hint">Each can run up to {span(limits.maxMinutes * 60_000)}</p>
          </section>
        </div>
        {isPro && <details className="billing-inclusions">
          <summary>Included in your Pro plan</summary>
          <ul className="ticks">{PRO_FEATURES.map(f => tick(f, f))}</ul>
          <p className="small muted mt-4">Need help? <Link href="/support/?priority=1">Priority support</Link>: Pro emails are answered first.</p>
        </details>}
      </section>

      {!isPro && <section className="billing-options" aria-labelledby="options-title">
        <div className="billing-section-heading">
          <div><h2 id="options-title">{profile.plan === "day_pass" ? "Want ongoing access?" : "Need more room?"}</h2><p className="muted small">{profile.plan === "day_pass" ? "Keep writing with Pro after your pass ends." : "One focused day or ongoing access. You choose."}</p></div>
          <Link href="/pricing/" className="small">Compare every feature <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={`billing-offers${profile.plan === "day_pass" ? " single" : ""}`}>
          {profile.plan === "free" && <section className="billing-offer" aria-labelledby="buy-pass-title">
            <div><h3 id="buy-pass-title">Day Pass</h3><p className="muted small">For one focused day.</p></div>
            <div><p className="price"><strong>$3.99</strong><span> once</span></p><p className="hint">24 hours of access · no renewal</p></div>
            <ul className="ticks">
              {tick("Unlimited words · one active session", "words")}
              {tick("Sessions up to 24 hours", "duration")}
              {tick("Writing hours, longer breaks & priority dispatch", "timing")}
            </ul>
            <div className="billing-offer-action">
              <button type="button" className="btn btn-secondary btn-block" disabled={busy || minor} onClick={() => startTrial("day")}>{busy ? "Opening checkout…" : "Get Day Pass · $3.99"}</button>
              <p className="hint">Sessions must fit your remaining access. Unfinished sessions pause when your pass expires.</p>
            </div>
          </section>}
          <section className="billing-offer billing-offer-pro" aria-labelledby="upgrade-title">
            <div className="billing-offer-title"><div><h3 id="upgrade-title">Upgrade to Pro</h3><p className="muted small">More control, every day.</p></div><span className="badge badge-blue">7 days free</span></div>
            <div>
              <div className="seg" role="group" aria-label="Billing period" style={{ "--n": 2, "--i": interval === "year" ? 0 : 1 } as React.CSSProperties}>
                <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly · {YEARLY_SAVING}</button>
                <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
              </div>
              <p className="price"><strong>{PRO_PRICE[interval].amount}</strong><span>/ month</span></p>
              <p className="hint">{PRO_PRICE[interval].saving || "Billed monthly"}</p>
            </div>
            <ul className="ticks">
              {tick("Unlimited words · 3 active sessions", "words")}
              {tick("Sessions up to a week", "duration")}
              {tick("Drafting controls, paused edits & saved presets", "controls")}
            </ul>
            <div className="billing-offer-action">
              {!minor && <><button type="button" className="btn btn-primary btn-block" onClick={() => startTrial(interval)} disabled={busy}>{busy ? "Opening secure checkout…" : "Start 7-day free trial"}</button><p className="hint">Nothing to pay today.</p></>}
            </div>
          </section>
        </div>
        {minor && <p className="alert alert-info"><span>Paid plans have to be bought by an adult. A parent or guardian can contact us from the <Link href="/support/">help page</Link> to set it up for you.</span></p>}
        <p className="billing-purchase-note hint">Adults only. By purchasing, you accept the <Link href="/terms/">Terms</Link> and <Link href="/responsible-use/">Responsible Use Agreement</Link>.</p>
        <details className="billing-inclusions">
          <summary>See all Pro features</summary>
          <ul className="ticks">{PRO_FEATURES.map(f => tick(f, f))}</ul>
        </details>
      </section>}

      <section className="billing-page-help" aria-labelledby="billing-faq-title">
        <h2 id="billing-faq-title" className="card-title billing-faq-title">Questions</h2>
        <div className="faq">
          <details><summary>How do I cancel?</summary><p>Choose Manage billing, then Cancel plan. You keep Pro until the end of the period you&apos;ve paid for.</p></details>
          <details><summary>Where are my invoices?</summary><p>In Manage billing. Stripe keeps every invoice and receipt for you to download.</p></details>
          <details><summary>Something looks wrong with a charge</summary><p>Email us from the <Link href="/support">support page</Link> and we&apos;ll look into it.</p></details>
        </div>
      </section>
      </div>
    </>
  );
}

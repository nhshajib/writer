"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProgressRing } from "@/components/app/Charts";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { ACTIVE_STATUSES, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { PRO_PRICE, YEARLY_SAVING } from "@/lib/site";
import { PRO_FEATURES } from "@/lib/plans";
import { ADULT_AGE, ageFrom } from "@/lib/age";
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
  const minor = profile.birth_year != null && profile.birth_month != null && ageFrom(profile.birth_year, profile.birth_month) < ADULT_AGE;
  const usagePercent = limits.dailyWords ? Math.min(100, Math.round((wordsToday / limits.dailyWords) * 100)) : 0;

  async function startTrial(offer: Interval | "day") {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("billing/checkout", { method: "POST", body: { interval: offer } });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(false);
    }
  }

  const tick = (t: React.ReactNode, key: string) => <li key={key}><Icon.check /><span>{t}</span></li>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plan &amp; usage</h1>
          <p>Your plan, what you&apos;ve used today, and payments.</p>
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

      <div className="kpis three mb-6">
        <section className="kpi" aria-labelledby="plan-title">
          <div className="kpi-text">
            <h2 id="plan-title" className="kpi-label">Current plan</h2>
            <p className="kpi-value">{isPro ? "Pro" : profile.plan === "day_pass" ? "Day Pass" : "Free"}</p>
            {profile.plan === "day_pass" && profile.day_pass_expires_at && <p className="hint">Expires {when(profile.day_pass_expires_at)} · no renewal. Unfinished pass sessions pause at expiry; your document text stays.</p>}
            <p className="kpi-note">
              {profile.subscription_status ? `${STATUS_TEXT[profile.subscription_status] ?? profile.subscription_status} · ` : ""}{describeLimits(limits)}
            </p>
          </div>
          <span className="kpi-icon" aria-hidden="true"><Icon.card /></span>
        </section>
        <section className="kpi" aria-labelledby="usage-title">
          <div className="kpi-text">
            <h2 id="usage-title" className="kpi-label">Words today</h2>
            <p className="kpi-value">{wordsToday.toLocaleString()}<small>{limits.dailyWords ? ` / ${limits.dailyWords}` : ""}</small></p>
            <p className="kpi-note">{limits.dailyWords ? `Resets at ${dailyResetTime()} (midnight UTC)` : "No daily limit"}</p>
          </div>
          {limits.dailyWords && (
            <span role="meter" aria-label="Words used today" aria-valuemin={0} aria-valuemax={limits.dailyWords} aria-valuenow={Math.min(wordsToday, limits.dailyWords)}>
              <ProgressRing value={usagePercent} tone={usagePercent >= 90 ? "warn" : "accent"} />
            </span>
          )}
        </section>
        <section className="kpi" aria-labelledby="active-title">
          <div className="kpi-text">
            <h2 id="active-title" className="kpi-label">Active sessions</h2>
            <p className="kpi-value">{active}<small> / {limits.activeSessions}</small></p>
            <p className="kpi-note">Each can run up to {span(limits.maxMinutes * 60_000)}</p>
          </div>
          <span className="kpi-icon" aria-hidden="true"><Icon.activity /></span>
        </section>
      </div>

      {isPro && (
        <section className="card mb-6 pro-perks" aria-labelledby="perks-title">
          <h2 id="perks-title" className="card-title">Included in your Pro plan</h2>
          <ul className="ticks">{PRO_FEATURES.map((f) => tick(f, f))}</ul>
          <p className="small muted mt-4">
            Need help? <Link href="/support/?priority=1">Priority support</Link>: Pro emails are answered first.
          </p>
        </section>
      )}

      {profile.plan === "free" && <section className="card mb-6" aria-labelledby="buy-pass-title"><h2 id="buy-pass-title">Need one focused day?</h2><p>$4.99 once for 24 hours: unlimited words, one active session, writing hours and priority dispatch. No subscription or renewal. A session must fit the remaining access time; unfinished pass sessions pause at expiry.</p><button type="button" className="btn btn-secondary" disabled={busy || minor} onClick={() => startTrial("day")}>{busy ? "Opening checkout…" : "Get Day Pass · $4.99"}</button><p className="hint">Adults only. By purchasing, you accept the <Link href="/terms/">Terms</Link> and <Link href="/responsible-use/">Responsible Use Agreement</Link>. You can upgrade to Pro whenever you need its advanced tools.</p></section>}
      {!isPro && (
        <section className="plan featured upgrade-card mb-6" aria-labelledby="upgrade-title">
          <div className="row upgrade-head">
            <div>
              <div className="plan-top upgrade-title">
                <h2 id="upgrade-title">Upgrade to Pro</h2><span className="badge badge-blue">7 days free</span>
              </div>
              <p className="desc">For essays, reports and anything long.</p>
            </div>
            <div className="seg" role="group" aria-label="Billing period" style={{ "--n": 2, "--i": interval === "year" ? 0 : 1 } as React.CSSProperties}>
              <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly · {YEARLY_SAVING}</button>
              <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
            </div>
          </div>
          <div className="grid-2 upgrade-body">
            <ul className="ticks">
              {PRO_FEATURES.map((f) => tick(f, f))}
            </ul>
            <div>
              <div className="price"><strong>{PRO_PRICE[interval].amount}</strong><span>/ month</span></div>
              <p className="price-note">{PRO_PRICE[interval].saving ? <span className="save">{PRO_PRICE[interval].saving}</span> : "Billed monthly"}</p>
              {minor
                ? (
                  <p className="alert alert-info">
                    <span>Pro has to be bought by an adult. A parent or guardian can contact us from the <Link href="/support/">help page</Link> to set it up for you.</span>
                  </p>
                )
                : (
                  <>
                    <button type="button" className="btn btn-primary btn-block" onClick={() => startTrial(interval)} disabled={busy}>
                      {busy ? "Opening secure checkout…" : "Start 7-day free trial"}
                    </button>
                    <p className="price-note center mt-2">Nothing to pay today.</p>
                  </>
                )}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="billing-faq-title">
        <h2 id="billing-faq-title" className="card-title billing-faq-title">Questions</h2>
        <div className="faq">
          <details><summary>How do I cancel?</summary><p>Choose Manage billing, then Cancel plan. You keep Pro until the end of the period you&apos;ve paid for.</p></details>
          <details><summary>Where are my invoices?</summary><p>In Manage billing. Stripe keeps every invoice and receipt for you to download.</p></details>
          <details><summary>Something looks wrong with a charge</summary><p>Email us from the <Link href="/support">support page</Link> and we&apos;ll look into it.</p></details>
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ACTIVE_STATUSES, PLAN_LIMITS, useDashboard } from "@/lib/dashboard";

type Interval = "year" | "month";

const STATUS_TEXT: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment problem",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Payment incomplete",
};

export default function BillingPage() {
  const { profile, drips, wordsToday, refresh } = useDashboard();
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("checkout");
    setCheckout(value);
    // The webhook can land a moment after Stripe sends people back.
    if (value === "success") {
      const timer = setTimeout(refresh, 2500);
      return () => clearTimeout(timer);
    }
  }, [refresh]);

  const isPro = profile.plan === "pro";
  const limits = PLAN_LIMITS[profile.plan];
  const active = drips.filter((d) => ACTIVE_STATUSES.has(d.status)).length;
  const usagePercent = limits.dailyWords ? Math.min(100, Math.round((wordsToday / limits.dailyWords) * 100)) : 0;

  async function startTrial() {
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

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("billing/portal", { method: "POST", body: {} });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open billing.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Plan & billing</h1>
          <p>Your plan, today's usage and payments.</p>
        </div>
      </div>

      {checkout === "success" && (
        <p className="notice success" role="status">
          Thank you! {isPro ? "You're on Pro." : "Your plan is updating; this can take a few seconds."}{" "}
          {!isPro && <button type="button" className="link-button" onClick={refresh}>Refresh</button>}
        </p>
      )}
      {checkout === "canceled" && <p className="notice" role="status">Checkout was canceled. You haven't been charged.</p>}
      {profile.subscription_status === "past_due" && (
        <p className="notice error" role="alert">
          Your last payment didn't go through. Update your card in Manage billing to keep Pro.
        </p>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}

      <div className="dash-grid cols-2" style={{ marginBottom: "1.25rem" }}>
        <section className={isPro ? "panel" : "panel"} aria-labelledby="plan-title">
          <div className="panel-head">
            <h2 id="plan-title">Current plan</h2>
          </div>
          <p className="price" style={{ fontSize: "2.4rem", margin: "0 0 0.25rem" }}>
            {isPro ? "Pro" : "Free"}
          </p>
          <p className="muted">
            {profile.subscription_status ? STATUS_TEXT[profile.subscription_status] ?? profile.subscription_status : "No subscription"}
          </p>
          {isPro
            ? (
              <>
                <p className="muted">
                  Change your card, download invoices, switch off renewal or cancel, all in Stripe's secure billing page.
                </p>
                <button type="button" className="button" onClick={openPortal} disabled={busy}>
                  {busy ? "Opening…" : "Manage billing"}
                </button>
              </>
            )
            : (
              <p className="muted">250 words a day, sessions up to 1 hour, one session at a time.</p>
            )}
          {!isPro && profile.subscription_status === "canceled" && (
            <p className="fine-print">
              Need an old invoice? <button type="button" className="link-button" onClick={openPortal}>Open billing history</button>
            </p>
          )}
        </section>

        <section className="panel" aria-labelledby="usage-title">
          <div className="panel-head">
            <h2 id="usage-title">Usage</h2>
            <span className="row-sub">Resets at midnight UTC</span>
          </div>
          <dl className="kv">
            <dt>Words today</dt>
            <dd>{wordsToday.toLocaleString()} {limits.dailyWords ? `of ${limits.dailyWords}` : "(unlimited)"}</dd>
            <dt>Active sessions</dt>
            <dd>{active} of {limits.activeSessions}</dd>
            <dt>Longest session</dt>
            <dd>{isPro ? "1 week" : "1 hour"}</dd>
          </dl>
          {limits.dailyWords && (
            <div
              className={`meter${usagePercent >= 90 ? " warn" : ""}`}
              role="meter"
              aria-label="Words used today"
              aria-valuemin={0}
              aria-valuemax={limits.dailyWords}
              aria-valuenow={wordsToday}
              style={{ marginTop: "1rem" }}
            >
              <span style={{ width: `${usagePercent}%` }} />
            </div>
          )}
        </section>
      </div>

      {!isPro && (
        <section className="pro-band" aria-labelledby="upgrade-title" style={{ padding: "2rem" }}>
          <div className="dash-head" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>TypeWit Pro</p>
              <h2 id="upgrade-title" style={{ fontSize: "1.9rem", margin: 0 }}>Write without limits</h2>
            </div>
            <div className="toggle" role="group" aria-label="Billing period" data-active={interval === "month" ? "2" : "1"}>
              <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly · save 40%</button>
              <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
            </div>
          </div>
          <div className="dash-grid cols-2">
            <ul className="plan-features" style={{ margin: 0 }}>
              <li><span><strong>Unlimited</strong> words every day</span></li>
              <li><span>Sessions up to <strong>1 week</strong></span></li>
              <li><span><strong>3 documents</strong> in progress at once</span></li>
              <li><span><strong>Priority</strong> email support</span></li>
            </ul>
            <div>
              <p className="price" style={{ margin: 0 }}>
                {interval === "year" ? "$9" : "$15"} <small>/ month</small>
              </p>
              <p style={{ minHeight: "1.6em" }}>
                {interval === "year" ? <span className="saving">Billed $108 a year. Save $72</span> : <span className="muted">Billed monthly</span>}
              </p>
              <button type="button" className="button pro large block" onClick={startTrial} disabled={busy}>
                {busy ? "Opening secure checkout…" : "Start 7-day free trial"}
              </button>
              <p className="fine-print">Nothing to pay today. Cancel any time before the trial ends and you won't be charged.</p>
            </div>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="billing-faq-title" style={{ marginTop: "1.25rem" }}>
        <h2 id="billing-faq-title" style={{ fontSize: "1.15rem" }}>Billing questions</h2>
        <div className="faq">
          <details>
            <summary>How do I cancel?</summary>
            <p>Choose Manage billing, then Cancel plan. You keep Pro until the end of the period you've paid for.</p>
          </details>
          <details>
            <summary>Where are my invoices?</summary>
            <p>In Manage billing. Stripe keeps every invoice and receipt for you to download.</p>
          </details>
          <details>
            <summary>Something looks wrong with a charge</summary>
            <p>Email us from the <Link href="/support">support page</Link> and we'll look into it.</p>
          </details>
        </div>
      </section>
    </>
  );
}

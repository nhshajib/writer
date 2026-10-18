"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
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

  const tick = (t: React.ReactNode, key: string) => <li key={key}><Icon.check /><span>{t}</span></li>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plan &amp; billing</h1>
          <p>Your plan, today&apos;s usage and payments.</p>
        </div>
      </div>

      <div className="stack" style={{ marginBottom: "1.25rem" }}>
        {checkout === "success" && (
          <p className="alert alert-success" role="status">
            <span>Thank you! {isPro ? "You're on Pro." : "Your plan is updating; this can take a few seconds."}{" "}
              {!isPro && <button type="button" className="link-btn" onClick={refresh}>Refresh</button>}</span>
          </p>
        )}
        {checkout === "canceled" && <p className="alert alert-info" role="status">Checkout was canceled. You haven&apos;t been charged.</p>}
        {profile.subscription_status === "past_due" && (
          <p className="alert alert-error" role="alert">Your last payment didn&apos;t go through. Update your card in Manage billing to keep Pro.</p>
        )}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
      </div>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <section className="card" aria-labelledby="plan-title">
          <div className="card-head">
            <h2 id="plan-title">Current plan</h2>
            {profile.subscription_status && <span className="badge">{STATUS_TEXT[profile.subscription_status] ?? profile.subscription_status}</span>}
          </div>
          <p style={{ fontSize: "1.75rem", fontWeight: 650, letterSpacing: "-0.03em" }}>{isPro ? "Pro" : "Free"}</p>
          <p className="small muted" style={{ marginTop: "0.25rem" }}>
            {isPro ? "Unlimited words, sessions up to a week, 3 at once." : "250 words a day, sessions up to 1 hour, one at a time."}
          </p>
          {(isPro || profile.subscription_status === "canceled") && (
            <div className="row" style={{ marginTop: "1.25rem" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={openPortal} disabled={busy}>
                {busy ? "Opening…" : isPro ? "Manage billing" : "Billing history"}
              </button>
              {isPro && <span className="small muted">Card, invoices and cancellation</span>}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="usage-title">
          <div className="card-head">
            <h2 id="usage-title">Usage today</h2>
            <span className="small muted">Resets at midnight UTC</span>
          </div>
          <p style={{ fontSize: "1.75rem", fontWeight: 650, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
            {wordsToday.toLocaleString()} <span className="small muted" style={{ fontWeight: 450, letterSpacing: 0 }}>{limits.dailyWords ? `of ${limits.dailyWords} words` : "words · unlimited"}</span>
          </p>
          {limits.dailyWords && (
            <div className={`progress lg${usagePercent >= 90 ? " warn" : ""}`} role="meter" aria-label="Words used today"
              aria-valuemin={0} aria-valuemax={limits.dailyWords} aria-valuenow={wordsToday} style={{ marginTop: "0.9rem" }}>
              <span style={{ width: `${usagePercent}%` }} />
            </div>
          )}
          <dl className="kv" style={{ marginTop: "1.25rem" }}>
            <dt>Active sessions</dt><dd>{active} of {limits.activeSessions}</dd>
            <dt>Longest session</dt><dd>{isPro ? "1 week" : "1 hour"}</dd>
          </dl>
        </section>
      </div>

      {!isPro && (
        <section className="plan featured" aria-labelledby="upgrade-title" style={{ marginBottom: "1.5rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="plan-top" style={{ justifyContent: "flex-start", gap: "0.6rem" }}>
                <h2 id="upgrade-title">Upgrade to Pro</h2><span className="badge badge-blue">7 days free</span>
              </div>
              <p className="desc">For essays, reports and anything long.</p>
            </div>
            <div className="seg" role="group" aria-label="Billing period" style={{ "--n": 2, "--i": interval === "year" ? 0 : 1 } as React.CSSProperties}>
              <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly · save 40%</button>
              <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
            </div>
          </div>
          <div className="grid-2" style={{ alignItems: "end", marginTop: "0.5rem" }}>
            <ul className="ticks" style={{ margin: "1rem 0 0" }}>
              {tick(<><strong>Unlimited</strong> words every day</>, "a")}
              {tick(<>Sessions up to <strong>1 week</strong></>, "b")}
              {tick(<><strong>3 documents</strong> at once</>, "c")}
              {tick(<><strong>Priority</strong> email support</>, "d")}
            </ul>
            <div>
              <div className="price" style={{ marginTop: "1rem" }}><strong>{interval === "year" ? "$9" : "$15"}</strong><span>/ month</span></div>
              <p className="price-note" style={{ marginBottom: "1rem" }}>{interval === "year" ? <span className="save">$108 billed yearly · save 40%</span> : "Billed monthly"}</p>
              <button type="button" className="btn btn-primary btn-block" onClick={startTrial} disabled={busy}>
                {busy ? "Opening secure checkout…" : "Start 7-day free trial"}
              </button>
              <p className="price-note center" style={{ marginTop: "0.6rem" }}>Nothing to pay today.</p>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="billing-faq-title">
        <h2 id="billing-faq-title" style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>Questions</h2>
        <div className="faq">
          <details><summary>How do I cancel?</summary><p>Choose Manage billing, then Cancel plan. You keep Pro until the end of the period you&apos;ve paid for.</p></details>
          <details><summary>Where are my invoices?</summary><p>In Manage billing. Stripe keeps every invoice and receipt for you to download.</p></details>
          <details><summary>Something looks wrong with a charge</summary><p>Email us from the <Link href="/support">support page</Link> and we&apos;ll look into it.</p></details>
        </div>
      </section>
    </>
  );
}

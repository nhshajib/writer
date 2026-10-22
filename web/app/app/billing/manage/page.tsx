"use client";

import Link from "next/link";
import { Skeleton } from "@/components/app/Skeleton";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";

type Flow = "payment_method_update" | "subscription_cancel" | "subscription_update" | "switch_interval";

interface Summary {
  email: string | null;
  subscription: {
    status: string;
    interval: string | null;
    amount: number | null;
    currency: string;
    period_start: number | null;
    period_end: number | null;
    cancel_at_period_end: boolean;
    trial_end: number | null;
  } | null;
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
  /** Today's Pro price for the subscription's interval, and whether the subscription is on an older, higher one. */
  current_price?: { amount: number | null; currency: string; interval: string | null } | null;
  outdated_price?: boolean;
  invoices: {
    id: string;
    number: string | null;
    created: number;
    amount: number;
    currency: string;
    status: string | null;
    description: string | null;
    url: string | null;
    pdf: string | null;
  }[];
}

const STATUS: Record<string, { text: string; tone: string }> = {
  trialing: { text: "Free trial", tone: "info" },
  active: { text: "Active", tone: "info" },
  past_due: { text: "Payment problem", tone: "warn" },
  unpaid: { text: "Unpaid", tone: "warn" },
  incomplete: { text: "Payment incomplete", tone: "warn" },
  canceled: { text: "Canceled", tone: "muted" },
};

const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", jcb: "JCB", unionpay: "UnionPay", diners: "Diners Club" };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const moneyExact = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const date = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
const shortDate = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function ManageBillingPage() {
  const { profile } = useDashboard();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repricing, setRepricing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSummary(await api<Summary>("billing/summary", { method: "POST", body: {} }));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your billing details.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Every change happens in Stripe's own pages, which confirm it there. */
  async function openPortal(key: string, flow?: Flow) {
    setOpening(key);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("billing/portal", { method: "POST", body: flow ? { flow } : {} });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open billing.");
      setOpening(null);
    }
  }

  async function moveToTodaysPrice() {
    setRepricing(true);
    setError(null);
    try {
      setSummary(await api<Summary>("billing/reprice", { method: "POST", body: {} }));
      setNotice("Done. Your subscription is on today's price from your next payment.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the price.");
    } finally {
      setRepricing(false);
    }
  }

  const sub = summary?.subscription;
  const status = sub ? STATUS[sub.status] ?? { text: sub.status, tone: "muted" } : null;
  const yearly = sub?.interval === "year";
  const live = sub && sub.status !== "canceled";

  const invoicePanel = summary && (
          <section className="card card-flush billing-invoices" aria-labelledby="inv-title">
            <div className="card-head">
              <div>
                <h2 id="inv-title">Invoices</h2>
                <p className="small muted">Your recent payments.</p>
              </div>
              <button type="button" className="link-btn" onClick={() => openPortal("all")} disabled={opening !== null}>View all</button>
            </div>
            {summary.invoices.length === 0
              ? <p className="small muted pad">No invoices yet.</p>
              : (
                <table className="table invoice-table">
                  <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Invoice</th></tr></thead>
                  <tbody>
                    {summary.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td data-label="Date">{shortDate(inv.created)}</td>
                        <td data-label="Description">{inv.description ?? "TypeWit payment"}</td>
                        <td data-label="Amount">{moneyExact(inv.amount, inv.currency)}</td>
                        <td data-label="Status">
                          {inv.status === "paid" ? <span className="tag info"><Icon.check />Paid</span> : <span className="tag warn">{inv.status === "open" ? "Due" : inv.status ?? "—"}</span>}
                        </td>
                        <td data-label="Invoice">
                          {inv.pdf
                            ? <a href={inv.pdf} target="_blank" rel="noopener noreferrer" className="dl-link"><Icon.download />Download<span className="sr-only"> invoice from {shortDate(inv.created)} (PDF, opens in a new tab)</span></a>
                            : inv.url ? <a href={inv.url} target="_blank" rel="noopener noreferrer">View<span className="sr-only"> invoice from {shortDate(inv.created)} (opens in a new tab)</span></a> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </section>
  );

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/app/account/">Account</Link><span aria-hidden="true">/</span>
        <Link href="/app/billing/">Plan &amp; usage</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Manage billing</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>Manage billing</h1>
          <p>Your subscription, payments and invoices.</p>
        </div>
        <Link href="/app/billing/" className="btn btn-secondary btn-sm desktop-only"><span className="flip" aria-hidden="true"><Icon.arrowRight /></span>Back to plan &amp; usage</Link>
      </div>

      {error && <p className="alert alert-error mb-5" role="alert">{error}</p>}
      {loadError && (
        <div className="alert alert-error mb-5" role="alert">
          <span>{loadError}</span> <button type="button" className="link-btn" onClick={load}>Try again</button>
        </div>
      )}
      {!summary && !loadError && <Skeleton label="Loading your billing details…" variant="card" />}

      {summary && !sub && (
        <section className="card empty" aria-labelledby="free-title">
          <div className="icon"><Icon.card /></div>
          <h2 id="free-title">{profile.plan === "day_pass" ? "Your Day Pass is active" : profile.day_pass_expires_at ? "Your Day Pass has ended" : "You’re on the Free plan"}</h2>
          <p>{profile.plan === "day_pass" ? "Your pass does not renew. View your payment receipt below, or upgrade to Pro for ongoing access." : profile.day_pass_expires_at ? "Your payment history remains available below. Renew access or explore Pro in Plan & usage." : "There’s nothing to manage yet. Pro removes the daily word limit and starts with 7 days free."}</p>
          <Link href="/app/billing/" className="btn btn-primary btn-sm">See Pro</Link>
        </section>
      )}

      {summary && !sub && invoicePanel}

      {notice && <p className="alert alert-success mb-5" role="status">{notice}</p>}

      {summary && sub && (
        <>
          {summary.outdated_price && summary.current_price?.amount != null && sub.amount != null && (
            <section className="alert alert-info mb-5 price-move" aria-labelledby="move-title">
              <div>
                <h2 id="move-title">Pro costs less now</h2>
                <p>
                  You&apos;re on an earlier price of {moneyExact(sub.amount, sub.currency)} a {sub.interval ?? "period"}. Pro is now{" "}
                  {moneyExact(summary.current_price.amount, summary.current_price.currency)} a {summary.current_price.interval ?? sub.interval}.
                  Moving applies from {sub.status === "trialing" && sub.trial_end ? `the end of your trial on ${date(sub.trial_end)}` : sub.period_end ? `your next payment on ${date(sub.period_end)}` : "your next payment"}, and nothing is charged now.
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={moveToTodaysPrice} disabled={repricing || opening !== null}>
                {repricing ? "Moving…" : "Move to the new price"}
              </button>
            </section>
          )}
          <div className="billing-grid">
            <section className="card billing-sub" aria-labelledby="sub-title">
              <div className="card-head">
                <h2 id="sub-title">Subscription</h2>
                <span className="row-tags">
                  {profile.plan === "pro" && <span className="tag info">Pro</span>}
                  {status && <span className={`tag ${status.tone}`}>{status.text}</span>}
                </span>
              </div>
              <p className="plan-name">TypeWit Pro</p>
              {sub.amount != null && (
                <>
                  <p className="plan-price">{money(yearly ? Math.round(sub.amount / 12) : sub.amount, sub.currency)} <span>/ month</span></p>
                  <p className="small muted">{yearly ? `Billed yearly at ${money(sub.amount, sub.currency)}` : "Billed monthly"}</p>
                </>
              )}
              <dl className="billing-rows">
                <div>
                  <dt>Next payment</dt>
                  <dd>
                    {!live
                      ? "None"
                      : sub.cancel_at_period_end && sub.period_end
                      ? `None · Pro ends on ${date(sub.period_end)}`
                      : sub.status === "trialing" && sub.trial_end && sub.amount != null
                      ? `${moneyExact(sub.amount, sub.currency)} on ${date(sub.trial_end)}, after the free trial`
                      : sub.period_end && sub.amount != null
                      ? `${moneyExact(sub.amount, sub.currency)} on ${date(sub.period_end)}`
                      : "—"}
                  </dd>
                </div>
                {sub.period_start && sub.period_end && <div><dt>Billing period</dt><dd>{date(sub.period_start)} – {date(sub.period_end)}</dd></div>}
                <div>
                  <dt>Billing email</dt>
                  <dd className="with-action">
                    <span>{summary.email ?? "—"}</span>
                    <button type="button" className="link-btn" onClick={() => openPortal("email")} disabled={opening !== null}>Edit<span className="sr-only"> billing email</span></button>
                  </dd>
                </div>
              </dl>
              {live && (
                <div className="billing-actions">
                  <button type="button" className="btn btn-primary" onClick={() => openPortal("change", "subscription_update")} disabled={opening !== null}>
                    {opening === "change" ? "Opening…" : "Change plan"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => openPortal("switch", "switch_interval")} disabled={opening !== null}>
                    {opening === "switch" ? "Opening…" : yearly ? "Switch to monthly" : "Switch to yearly"}
                  </button>
                </div>
              )}
            </section>

            <section className="card billing-card" aria-labelledby="card-title">
              <h2 id="card-title" className="card-title">Payment method</h2>
              {summary.card
                ? (
                  <div className="pay-method">
                    <span className="pay-icon" aria-hidden="true"><Icon.card /></span>
                    <div>
                      <p className="pay-name">{BRANDS[summary.card.brand] ?? summary.card.brand} ending in {summary.card.last4}</p>
                      <p className="small muted">Expires {String(summary.card.exp_month).padStart(2, "0")}/{summary.card.exp_year}</p>
                    </div>
                    <span className="tag info">Default</span>
                  </div>
                )
                : <p className="muted pay-none">No card on file.</p>}
              <button type="button" className="btn btn-secondary btn-block" onClick={() => openPortal("card", "payment_method_update")} disabled={opening !== null}>
                {opening === "card" ? "Opening…" : summary.card ? "Update payment method" : "Add a payment method"}
              </button>
              <p className="small muted secure"><Icon.lock />Payments securely handled by Stripe.</p>
            </section>
          </div>

          {invoicePanel}

          <div className="billing-help">
            <section className="card" aria-labelledby="change-title">
              <h2 id="change-title">Need to make a change?</h2>
              <p className="muted">
                {sub.cancel_at_period_end
                  ? "Renewal is off. You can turn it back on in Stripe until your paid period ends."
                  : "You can cancel renewal and keep Pro until your paid period ends."}
              </p>
              {live && !sub.cancel_at_period_end && (
                <button type="button" className="link-btn danger" onClick={() => openPortal("cancel", "subscription_cancel")} disabled={opening !== null}>
                  {opening === "cancel" ? "Opening…" : "Cancel subscription"}
                </button>
              )}
              {live && sub.cancel_at_period_end && (
                <button type="button" className="link-btn" onClick={() => openPortal("renew")} disabled={opening !== null}>Turn renewal back on</button>
              )}
            </section>
            <section className="card" aria-labelledby="help-title">
              <h2 id="help-title">Questions about a payment?</h2>
              <p className="muted">We can help you understand a charge.</p>
              <Link href="/support/" className="link-arrow">Contact support <Icon.arrowRight /></Link>
            </section>
          </div>
          <p className="small muted secure center-row"><Icon.lock />Billing changes are completed securely through Stripe.</p>
        </>
      )}
    </>
  );
}

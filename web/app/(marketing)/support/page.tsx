import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMeta("/support/", "Support", "Get help with TypeWit: email a real person, and quick answers about Google Docs access, stopped sessions, billing and deleting your account.");

export default function SupportPage() {
  return (
    <article className="prose">
      <p className="kicker">Support</p>
      <h1>How can we help?</h1>
      <p className="updated support-lead">
        Email us and a real person will reply. Pro members get priority.
      </p>

      <div className="card support-card">
        <h2>Email support</h2>
        <p className="muted">Tell us what you were doing and what happened. Screenshots help.</p>
        <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <p className="hint">Please don't send passwords or card numbers. We'll never ask for them.</p>
      </div>

      <div className="card support-card">
        <h2>Pro members: priority support</h2>
        <p className="muted">
          Emails from Pro accounts are answered first. Send it from the address on your account, or start the subject
          with [Pro].
        </p>
        <a className="btn btn-secondary" href={`mailto:${SUPPORT_EMAIL}?subject=%5BPro%5D%20`}>Email priority support</a>
      </div>

      <h2>Quick answers</h2>
      <h3>TypeWit says it can't reach my Google account</h3>
      <p>Go to your <Link href="/app">dashboard</Link> and choose Connect Google again. This happens if access was removed in your Google account settings.</p>
      <h3>My session stopped with an error</h3>
      <p>Open the session to see the reason in the activity log. Most problems are fixed by reconnecting Google and starting a new session with the remaining text.</p>
      <h3>How do I cancel Pro?</h3>
      <p>Go to <Link href="/app/billing/">Plan &amp; usage</Link> and choose Manage billing. You keep Pro until the end of the period you've paid for.</p>
      <h3>How do I delete my account?</h3>
      <p>Go to <Link href="/app/settings/">Settings</Link> and choose Delete my account. It takes effect straight away. Cancel any Pro subscription first. You can also email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20account`}>{SUPPORT_EMAIL}</a> from the address you signed up with.</p>
      <h3>Something else?</h3>
      <p>See the <Link href="/pricing/#faq">pricing questions</Link>, or just email us.</p>
    </article>
  );
}

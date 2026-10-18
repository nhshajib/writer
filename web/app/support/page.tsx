import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <article className="prose">
      <p className="eyebrow">Support</p>
      <h1>How can we help?</h1>
      <p className="lead" style={{ margin: "0 0 2rem" }}>
        Email us and a real person will reply. Pro members get priority.
      </p>

      <div className="card raised" style={{ textAlign: "center", padding: "2rem" }}>
        <h2 style={{ marginTop: 0 }}>Email support</h2>
        <p className="muted">Tell us what you were doing and what happened. Screenshots help.</p>
        <a className="button large" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <p className="fine-print">Please don't send passwords or card numbers. We'll never ask for them.</p>
      </div>

      <h2>Quick answers</h2>
      <h3>TypeWit says it can't reach my Google account</h3>
      <p>Go to your <Link href="/app">dashboard</Link> and choose Connect Google again. This happens if access was removed in your Google account settings.</p>
      <h3>My session stopped with an error</h3>
      <p>Open the session to see the reason in the activity log. Most problems are fixed by reconnecting Google and starting a new session with the remaining text.</p>
      <h3>How do I cancel Pro?</h3>
      <p>Go to <Link href="/account">Account</Link> and choose Manage billing. You keep Pro until the end of the period you've paid for.</p>
      <h3>How do I delete my account?</h3>
      <p>Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20account`}>{SUPPORT_EMAIL}</a> from the address you signed up with and we'll delete your account and data. Cancel any Pro subscription first.</p>
      <h3>Something else?</h3>
      <p>See the <Link href="/pricing#faq">pricing questions</Link>, or just email us.</p>
    </article>
  );
}

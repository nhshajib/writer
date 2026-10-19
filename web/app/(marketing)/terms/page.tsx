import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <article className="prose">
      <h1>Terms of Service</h1>
      <p className="updated">Last updated {LEGAL_UPDATED}</p>

      <p>
        These terms are an agreement between you and TypeWit (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for your use of
        typewit.com and the TypeWit service. By creating an account or using TypeWit, you agree to these terms, our{" "}
        <Link href="/privacy">Privacy Policy</Link> and the <Link href="/responsible-use">Responsible Use Agreement</Link>.
      </p>

      <h2>1. What TypeWit does</h2>
      <p>
        TypeWit is an assistive tool. It enters text that you provide and approve into Google Docs in your connected
        account, in sentence, paragraph or larger steps over a time you choose. TypeWit does not write content for you.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 13 years old, and old enough to agree to these terms where you live (or have a parent or guardian's permission).</li>
        <li>Sign up with Continue with Google or a personal email address. Keep your sign-in details secure; you're responsible for activity on your account.</li>
        <li>Give accurate information and keep it up to date.</li>
      </ul>

      <h2>3. Responsible use</h2>
      <p>
        You agree to follow the <Link href="/responsible-use">Responsible Use Agreement</Link>. In particular, you'll
        only use text you wrote or have the right to use, and you'll follow the rules of your school, employer or any
        other organisation that applies to your work, including any rules about disclosing assistive tools. You must
        not use TypeWit to break the law, infringe others' rights, or misrepresent automated input as manual typing.
      </p>

      <h2>4. Your content</h2>
      <p>
        You own the text you submit. You give us permission to store and process it only as needed to provide
        TypeWit: to enter it into your documents, show your progress and keep your activity log. You're responsible
        for your content and for having the right to use it.
      </p>

      <h2>5. Google services</h2>
      <p>
        TypeWit works with your Google account through Google's APIs. Your use of Google Docs is also subject to
        Google's terms. We're not responsible for Google's services, outages or changes that affect TypeWit.
      </p>

      <h2>6. Plans, trials and billing</h2>
      <ul>
        <li><strong>Free</strong> is free with the limits shown on our <Link href="/pricing">pricing page</Link>.</li>
        <li>
          <strong>Pro</strong> is a subscription billed monthly or yearly in advance through Stripe. It renews
          automatically at the end of each period until you cancel.
        </li>
        <li>
          <strong>Free trial:</strong> new Pro subscribers may get one 7-day free trial per person. A payment card is
          required. If you don't cancel before the trial ends, your subscription starts and you're charged. We may
          refuse a trial where we reasonably believe it isn't a person's first.
        </li>
        <li>
          <strong>Cancelling:</strong> cancel any time from Plan &amp; billing in your dashboard, then Manage billing. You keep Pro until the end of
          the period you've paid for, and you won't be charged again.
        </li>
        <li>
          <strong>Refunds:</strong> payments are non-refundable, including for partly used periods, except where the
          law requires otherwise. If you think you were charged by mistake, email {email} and we'll look into it.
        </li>
        <li>
          <strong>Price changes:</strong> we'll tell you before any price change applies to your subscription, and you
          can cancel before it takes effect.
        </li>
        <li>Prices are shown in US dollars. Taxes may apply depending on where you live.</li>
      </ul>

      <h2>7. Acceptable use of the service</h2>
      <p>
        Don't try to get around plan limits or free-trial rules, interfere with or overload the service, access other
        people's accounts or data, or reverse engineer TypeWit except where the law allows.
      </p>

      <h2>8. Suspension and ending</h2>
      <p>
        You can stop using TypeWit and ask us to delete your account at any time. We may suspend or close accounts that
        break these terms or the Responsible Use Agreement, or where needed to protect users or the service. Where
        reasonable, we'll tell you first.
      </p>

      <h2>9. Availability and changes</h2>
      <p>
        We work to keep TypeWit reliable, but it may sometimes be unavailable, and sessions can be delayed or stop
        because of problems with Google or other services. You can always see what was entered in your activity log.
        We may improve or change features over time.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        TypeWit is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make
        no warranties beyond those stated in these terms, including that the service will be uninterrupted or
        error-free. Always check your document before relying on it or submitting it.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the extent the law allows, TypeWit isn't liable for indirect, incidental or consequential losses, or for lost
        data, grades, profits or opportunities. Our total liability for any claim is limited to the amount you paid us
        in the 12 months before the claim, or US$50 if greater. Nothing in these terms limits liability that can't be
        limited by law.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        We may update these terms. We'll change the date above and, for significant changes, tell you by email or in
        the app before they apply. If you keep using TypeWit after that, the new terms apply.
      </p>

      <h2>13. Contact</h2>
      <p>Questions about these terms? Email {email}.</p>
    </article>
  );
}

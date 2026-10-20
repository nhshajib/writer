import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

/** The Privacy Policy text, shared by its page and the pop-up on the sign-in pages. */
export function PrivacyBody() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <>
      <div className="summary">
        <strong>The short version</strong>
        <ul>
          <li>We collect only what TypeWit needs to work: your account, the text you approve, and the documents you choose.</li>
          <li>We don't sell your data, show ads, or use your text to train AI models.</li>
          <li>TypeWit can only open Google Docs it creates or that you choose, nothing else in your Drive.</li>
          <li>You can ask us to delete your data at any time.</li>
        </ul>
      </div>

      <p>
        This policy explains what information TypeWit (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects when you use
        typewit.com, how we use it, and the choices you have. Questions: {email}.
      </p>

      <h2>What we collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>Your email address, and your password if you sign up with email (stored only as a secure hash).</li>
        <li>If you use Continue with Google: your name, email address and Google account ID, which Google shares when you sign in.</li>
        <li>Your name, if you choose to give it, so the app can greet you.</li>
        <li>
          Your country and the month and year you were born, to check that you are old enough to use TypeWit where you
          live, and whether a parent or guardian needs to buy Pro for you. We never ask for the day.
        </li>
        <li>Which version of the Responsible Use Agreement you accepted, and when.</li>
      </ul>
      <h3>Your Google Docs connection</h3>
      <ul>
        <li>
          When you connect Google Docs, Google gives us access tokens for the <code>drive.file</code> permission. This
          only covers documents TypeWit creates or that you choose. We store these tokens encrypted.
        </li>
        <li>The title, ID and link of each document you write into.</li>
      </ul>
      <h3>Text and activity</h3>
      <ul>
        <li>The text you approve for each session, how it's split into steps, and your approval (including a fingerprint of the exact text).</li>
        <li>An activity log of each step: when it was entered, paused, resumed or stopped.</li>
      </ul>
      <h3>Billing</h3>
      <ul>
        <li>
          If you subscribe to Pro, Stripe processes your payment. We receive your Stripe customer ID, your plan and
          subscription status. <strong>We never see or store your card number.</strong>
        </li>
        <li>To make sure each person gets one free trial, we keep a record of trial use linked to a normalised form of your email address.</li>
      </ul>
      <h3>Technical information</h3>
      <ul>
        <li>Our hosting providers keep standard server logs (such as IP address, browser type and time of request) for security and troubleshooting.</li>
        <li>We store your sign-in session in your browser's local storage. We don't use advertising or analytics cookies.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide TypeWit: create your account, connect Google, and enter your approved text into your documents.</li>
        <li>To show your progress and activity log, and to notify you when a session finishes or stops.</li>
        <li>To run billing, apply plan limits and prevent free-trial abuse.</li>
        <li>To keep TypeWit secure, fix problems and answer support requests.</li>
      </ul>
      <p>We don't sell or rent your personal information, and we don't use your text for advertising or to train AI models.</p>

      <h2>Google user data</h2>
      <p>
        TypeWit's use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We use Google access only to create documents and insert the text you
        approve. We don't read other files in your Drive, and no person at TypeWit reads your documents unless you ask
        us to for support, it's needed for security, or the law requires it.
      </p>

      <h2>Who we share it with</h2>
      <p>We share information only with service providers that help us run TypeWit, and only as much as they need:</p>
      <ul>
        <li><strong>Supabase</strong>: database, sign-in and server functions.</li>
        <li><strong>Netlify</strong>: website hosting.</li>
        <li><strong>Google</strong>: sign-in and Google Docs, at your request.</li>
        <li><strong>Stripe</strong>: payments and subscription management.</li>
        <li><strong>Resend</strong>: notification emails, if email notifications are turned on.</li>
      </ul>
      <p>We may also disclose information if the law requires it, or to protect the rights and safety of our users or TypeWit.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account, sessions and activity log while your account is open, so you can see your history. You
        can delete finished sessions at any time, or delete your whole account in Settings: that removes your sessions,
        their text and logs, your notifications and your Google connection straight away. If you ask us by email
        instead, we do it within 30 days. We keep records we must keep by law (such as billing records), and, if you used
        the free trial, your email address (lower-cased) and the date of the trial, so a trial can only be used once.
        Short-lived records are deleted automatically: read notifications after 90 days, and security and duplicate-
        request records after 2 to 90 days.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Turn email notifications on or off from <Link href="/app/settings/">Settings</Link>.</li>
        <li>Disconnect TypeWit from Google at any time in your Google Account under Security, Third-party access.</li>
        <li>Ask for a copy of your data, a correction, or deletion by emailing {email}.</li>
      </ul>
      <p>Depending on where you live, you may have additional rights under local privacy laws. Contact us and we'll help.</p>

      <h2>Security</h2>
      <p>
        We use encryption in transit, encrypt Google tokens at rest, and restrict each account to its own data. No
        system is perfectly secure, but we work to protect your information and will notify you if a breach affects
        you.
      </p>

      <h2>Children</h2>
      <p>
        TypeWit isn&apos;t for children under 13, or for anyone below the age of digital consent in their country (up to 16
        in parts of the EU and EEA). We check this at sign-up from your country and month and year of birth, and we don&apos;t
        knowingly keep information about anyone below that age. If we learn that we have, we delete the account. A parent
        or guardian who thinks this has happened can email {email}.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy, we'll update the date above and, for significant changes, let you know by email or in the app.</p>

      <h2>Contact</h2>
      <p>Email {email} with any questions about privacy.</p>
    </>
  );
}

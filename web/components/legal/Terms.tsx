import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

/** The Terms of Service text, shared by its page and the pop-up on the sign-in pages. */
export function TermsBody() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <>
      <p>
        These terms are an agreement between you and Typewit Organization, based in Bangladesh, operating TypeWit (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for your use of
        typewit.com and the TypeWit service. By creating an account or using TypeWit, you agree to these terms, our{" "}
        <Link href="/privacy/">Privacy Policy</Link> and the <Link href="/responsible-use/">Responsible Use Agreement</Link>.
      </p>

      <h2>1. What TypeWit does</h2>
      <p>
        TypeWit is provided only for authorized testing and demonstration of automated text entry into Google Docs and Microsoft Word. You supply and approve the text. It is not developed or authorized for academic cheating. Natural, Steady and Drafting vary automated entry timing; optional typos and false starts temporarily insert and correct text. These are simulations, not evidence of human authorship.
      </p>
      <p>Day Pass and Pro include optional writing blocks separated by scheduled long rests. Long rests count toward total session duration. Day Pass restarts and completion must fit remaining access; runtime access expiry pauses unfinished work. Scheduled restart times are targets, subject to provider availability, permissions, user pauses and writing hours. Word requires its document and add-in open. Long rests do not guarantee distinct Google revision groups.</p>
      <p>Writing hours limit scheduled entry to your selected time zone and hours; waiting, provider interruptions and pauses may move completion later. Pro session playback is a read-only replay of TypeWit&apos;s recorded actions, not Google&apos;s official revision history or proof of authorship. An optional final revision pass makes small reversible edits only to the session-owned suffix and restores the exact approved text. Stopping or access expiry during a correction can leave temporary text; inspect the document before sharing.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>
          You must be at least 13 years old, and at least the age at which you can agree to online services yourself where
          you live. In most of the world that is 13; in the EU and EEA it is between 13 and 16 depending on the country
          (for example 16 in Germany, Ireland and the Netherlands). When you sign up we ask for your country and the month
          and year you were born to check this.
        </li>
        <li>If you are under 18, a parent or guardian must agree to and pay for a Pro subscription on your behalf.</li>
        <li>Sign up with Google, Discord or a personal email address. Social sign-up also requires an eligible personal email address. Keep your sign-in details secure; you're responsible for activity on your account.</li>
        <li>Give accurate information and keep it up to date.</li>
      </ul>

      <h2>3. Responsible use</h2>
      <p>
        You agree to follow the <Link href="/responsible-use/">Responsible Use Agreement</Link>. In particular, you'll
        only use text you wrote or have the right to use, and you'll follow the rules of your school, employer or any
        other organisation that applies to your work, including any rules about disclosing automation. Academic cheating, assessment misconduct, evading integrity checks, fabricating evidence of authorship or a writing process, and disguising copied or AI-generated work as your own are prohibited. You are responsible for your misuse and any resulting academic, employment, contractual or legal consequences. We do not endorse misuse. You must
        not use TypeWit to break the law, infringe others' rights, or misrepresent automated input as manual typing.
      </p>

      <h2>4. Your content</h2>
      <p>
        You retain ownership of content you own. You give us permission to store and process it only as needed to provide
        TypeWit: to enter it into your documents, preserve supported formatting, execute the approved schedule (including temporary simulated edits), show your progress and keep your activity log. You retain any rights you hold in the content; you do not acquire rights in third-party content by uploading it. You're responsible
        for your content and for having the right to use it.
      </p>

      <h2>5. Connected services and execution</h2>
      <p>
        TypeWit works with your Google account through Google's APIs. Your use of Google Docs is also subject to
        Google's terms. Microsoft Word runs through its add-in and requires the document and panel to remain open. These providers control their services and version-history grouping. We do not guarantee a particular number, appearance or permanence of visible versions. Google sessions run on our servers even after you close the dashboard. You may pause or stop them. Pro users may revise remaining text and settings while safely paused; text changes require renewed approval. Disconnecting an account stops its active sessions but does not undo past edits. Temporary mistakes may remain visible in document history. Review output and use test documents with backups.
      </p>

      <h2>6. Plans, trials and billing</h2>
      <ul>
        <li><strong>Free</strong> is free with the limits shown on our <Link href="/pricing/">pricing page</Link>.</li>
        <li>
          <strong>Pro</strong> is a subscription billed monthly or yearly in advance through Stripe. It renews
          automatically at the end of each period until you cancel.
        </li>
        <li>
          <strong>Day Pass:</strong> US$3.99 as a one-time purchase for 24 hours from payment confirmation and activation. It does not renew and does not include a Pro trial. It provides unlimited words, one active session, sessions up to one day within the remaining access window, writing hours, customizable writing blocks and priority dispatch. It does not include Pro-only advanced controls, final revision pass or playback. At expiry, unfinished pass sessions pause; text already entered remains. A new pass after expiry or Pro access can allow resumption. Refunds that reverse the purchase end the corresponding pass entitlement. Mandatory consumer remedies remain available.
        </li>
        <li>
          <strong>Free trial:</strong> new Pro subscribers may get one 7-day free trial per person. A payment card is
          required. If you don't cancel before the trial ends, your subscription starts and you're charged. We may
          refuse a trial where we reasonably believe it isn't a person's first.
        </li>
        <li>
          <strong>Cancelling:</strong> cancel any time from Plan &amp; usage in your dashboard, then Manage billing. You keep Pro until the end of
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
        Supported paste preserves text, headings, bold, italic, underline, strikethrough, paragraph alignment, bullets, numbered lists and highlight colors; it does not reproduce images, tables, fonts or page layout. Review the preview and destination before starting. Timing is a target, not a deadline. We work to keep TypeWit reliable, but it may sometimes be unavailable, and sessions can be delayed or stop
        because of problems with Google or other services. You can always see what was entered in your activity log.
        We may improve or change features over time.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        TypeWit is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make
        no warranties beyond those stated in these terms, including that the service will be uninterrupted or
        error-free, fit for a particular purpose, or capable of proving authorship or satisfying any institution. We exclude implied warranties of merchantability, fitness and non-infringement to the maximum lawful extent. Always check your document before relying on it or submitting it.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the extent the law allows, TypeWit isn't liable for indirect, incidental or consequential losses, or for lost
        data, grades, profits or opportunities. Our total liability for any claim is limited to the amount you paid us
        in the 12 months before the claim, or US$50 if greater. These limitations apply to the operator and its personnel to the maximum lawful extent. They do not exclude fraud, willful misconduct, death or personal injury caused by negligence where protected by law, or any non-waivable consumer rights, statutory guarantees or other liability that cannot lawfully be limited. We do not assume responsibility for your prohibited use or an institution’s decisions; you remain responsible for your own conduct.
      </p>

      <h2>12. Third-party claims, mandatory rights and disputes</h2>
      <p>To the extent permitted by law, you will reimburse the operator for reasonable losses and defense costs arising from third-party claims caused by your unlawful content, intentional misuse or material breach of these terms. This does not cover losses caused by our own unlawful conduct and does not override mandatory consumer protections. We will notify you of a claim, allow reasonable participation in its defense, and will not impose a settlement admitting your liability without your consent.</p>
      <p>These terms are governed by the laws of Bangladesh, except to the extent mandatory laws where you live require otherwise. Disputes may be brought before competent courts in Bangladesh, without limiting a consumer’s right to bring proceedings in another court where mandatory law permits. Contact us first to try to resolve a dispute. These terms do not require arbitration, waive class-action rights, or deprive you of mandatory protections or access to courts available under applicable law. If a provision is unenforceable, the remaining provisions continue where lawful. Failure to enforce a provision is not a waiver. Rights and obligations that by their nature should survive termination, including payment obligations and lawful liability limits, survive.</p>
      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms. We'll change the date above and, for significant changes, tell you by email or in
        the app before they apply. If you keep using TypeWit after that, the new terms apply.
      </p>

      <h2>14. Contact and operator</h2>
      <p>TypeWit and typewit.com are operated by Typewit Organization, based in Bangladesh. Questions or legal notices? Email {email}.</p>
    </>
  );
}

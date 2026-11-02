import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OnThisPage } from "@/components/legal/OnThisPage";
import { pageMeta } from "@/lib/seo";
import { LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/site";
export const metadata: Metadata = pageMeta("/cookies/", "Cookie and Storage Policy", "How TypeWit uses authentication storage, local drafts, preferences and consent choices.");
export default function CookiesPage() {
  return <article className="prose">
    <Breadcrumbs items={[{name:"Cookie and Storage Policy",path:"/cookies/"}]} />
    <h1>Cookie and Storage Policy</h1><p className="updated">Last updated {LEGAL_UPDATED}</p><OnThisPage />
    <p>This policy covers cookies and similar browser technologies on TypeWit, including local storage and session storage. Read it with the <Link href="/privacy/">Privacy Policy</Link>.</p>
    <h2>Tracking and consent</h2>
    <p>TypeWit’s application does not include advertising pixels, behavioral-analytics tools or recordings of visitors’ browsing sessions. The session activity log and Pro action playback describe automated document entry; they are not visitor tracking tools.</p>
    <p>We do not ask for a blanket “accept cookies” decision just to authenticate you or provide a feature you request. An exemption from consent applies only when the relevant storage/access is genuinely necessary under applicable law; calling something a preference or a security tool does not automatically make it exempt.</p>
    <p>If we introduce optional tracking or other non-exempt storage, it must remain disabled until you consent. The first banner layer must make “Reject all” as prominent and easy to use as “Accept all”, with matching size and visual prominence, a one-step reject option, no preselected optional purposes, and a persistent way to change or withdraw choices. Cookie consent must be separate from terms and marketing consent. Records must identify the choice, purposes, notice/version, time and any withdrawal.</p>
    <h2>Authentication and security storage</h2>
    <ul>
      <li><strong>Supabase authentication:</strong> browser local storage, normally under an <code>sb-…-auth-token</code> key, holds the session needed to remain signed in. Tokens have provider-controlled expiry/refresh rules. Stored authentication is removed or becomes unusable through sign-out, expiry/revocation or clearing storage; it is not a marketing identifier.</li>
      <li><strong>Connection/OAuth state:</strong> session storage such as <code>typewit-google-connect-verifier</code>, <code>typewit:agreed-before-google</code> and <code>typewit:age-before-google</code> supports the sign-in/connection you start and temporary agreement/age answers. Entries are removed when consumed; session storage normally ends when the tab is closed.</li>
      <li><strong>Age restriction:</strong> <code>typewit:age-block</code> stores a 24-hour refusal timestamp to prevent immediate repeated age attempts. The check stops applying after that time; the expired value may remain until storage is cleared or replaced.</li>
    </ul>
    <h2>Drafts and preferences on your device</h2>
    <ul>
      <li><code>typewit.draft</code> stores unsent text/formatting so you can restore or discard it. It is removed when cleared/discarded through the relevant workflow; otherwise local storage can persist until you clear it. Preparing a preview can still send text to our server, as explained in the Privacy Policy.</li>
      <li><code>typewit.pace</code>, <code>typewit.rhythm</code>, <code>typewit.theme</code> and <code>typewit.announceProgress</code> remember selected pacing, rhythm, appearance and screen-reader preferences. They can persist until replaced, reset through available controls or cleared in your browser.</li>
      <li>Settings saved to your account are separate from browser-only storage. Clearing this browser does not delete account records; deleting an account does not automatically clear every browser you used.</li>
    </ul>
    <p>These features support the workflow and choices you request. Their legal exemption and any need for consent must be assessed for the technology and jurisdiction concerned; this policy does not treat all local storage as automatically exempt.</p>
    <h2>Third-party service flows</h2>
    <p>Google/Discord sign-in, Google’s picker, Word and Stripe-hosted payment pages can use their own service and security storage when you use those features. Their policies and settings apply to their own processing. See the <Link href="/subprocessors/">service-provider list</Link>. Third-party analytics introduced through a hosting dashboard or another integration would still need an appropriate consent assessment and, where required, prior consent.</p>
    <h2>How to manage storage</h2>
    <p>Use Settings for available preferences and notification choices, sign out to end the local signed-in session, and use your browser’s site-data controls to inspect, block or remove storage for typewit.com. Clearing data can sign you out and permanently remove an unsent local draft. Save any work you want to keep first, particularly on shared devices.</p>
    <p>Questions or requests about storage or consent: <a href={`mailto:${SUPPORT_EMAIL}?subject=Privacy%20request`}>{SUPPORT_EMAIL}</a>. Withdrawing optional consent does not withdraw a necessary service request or cancel a subscription.</p>
  </article>;
}

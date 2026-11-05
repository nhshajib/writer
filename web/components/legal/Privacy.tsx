import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

/** Shared by the public policy and the signup/sign-in policy dialog. */
export function PrivacyBody() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}?subject=Privacy%20request`}>{SUPPORT_EMAIL}</a>;
  return <>
    <div className="summary"><strong>The short version</strong><ul>
      <li>TypeWit processes your account and the text, formatting and documents needed for the workflow you request.</li>
      <li>We do not sell personal data or use your text for advertising or AI training.</li>
      <li>Optional tracking or marketing requires its own consent where required; accepting terms is not that consent.</li>
      <li>You can manage your settings, delete finished sessions, and contact us to exercise your privacy rights.</li>
    </ul></div>
    <h2>Who is responsible and how to contact us</h2>
    <p>Typewit Organization, based in Bangladesh, operates typewit.com (TypeWit). We are the controller for account administration, billing, service security and our own customer support. Send privacy requests to {email}, with the subject “Privacy request”. This is our privacy contact; we do not describe this mailbox as an appointed Data Protection Officer or an EU/UK representative.</p>
    <p>This notice explains our processing. It does not ask you to waive rights or consent to every use of data. Where the EU GDPR or other mandatory privacy law applies, that law determines your rights and our obligations.</p>

    <h2>What we collect and where it comes from</h2>
    <h3>Account and eligibility</h3>
    <ul>
      <li>Your email, optional name, authentication identifiers and account timestamps. Email/password authentication stores a password hash, not a readable password.</li>
      <li>Google sign-in supplies an account ID and permitted profile information such as name, email and avatar. Discord sign-in supplies an account ID, email and basic profile such as username/avatar. Discord sign-in does not give us your messages, servers or contacts.</li>
      <li>Your country and birth month/year, age-check result and timestamps, and any recorded guardian confirmation. We do not request your day of birth. These checks control eligibility; a guardian checkbox is not identity verification of a parent.</li>
      <li>The version and timestamp of your Responsible Use Agreement acceptance, account preferences and service notification choices. Agreement acceptance is not marketing or cookie consent.</li>
    </ul>
    <h3>Documents, submitted text and session activity</h3>
    <ul>
      <li>Text and supported formatting you provide, the document title/ID/link, chosen provider, rhythm, schedule, writing hours/time zone, writing blocks, pauses and optional simulated corrections. Text and settings may be sent to our server to calculate a preview before you approve starting; approval is required before a writing session begins.</li>
      <li>Session source and execution steps, progress, approvals/content fingerprints and activity records. Paused Pro edits replace remaining content/settings; completed actions can remain in the session record. Playback is a replay of TypeWit actions, not visitor session-replay tracking or proof of human authorship.</li>
      <li>For connected Google Docs, encrypted access credentials and selected document content or revision information needed to locate insertion points, preserve formatting, check conflicts, recover safely or show a requested comparison. The <code>drive.file</code> permission covers files TypeWit creates or you select through Google’s picker, not unrestricted access to Drive.</li>
      <li>Word sessions use the open document through the add-in. We do not store a Microsoft password or Microsoft OAuth token for this integration. Google and Microsoft retain document content and history under their own services.</li>
    </ul>
    <h3>Payments, support and technical records</h3>
    <ul>
      <li>Stripe processes payment information. TypeWit uses customer, checkout, subscription and payment identifiers, plan/status, pass activation/expiry and refund information. Billing screens can retrieve limited card details (such as brand/last four/expiry), billing email and invoices from Stripe. We do not receive or store full card numbers or card security codes.</li>
      <li>A normalized email/trial-use record helps apply the one-trial-per-person rule. It can remain after account deletion for that limited purpose.</li>
      <li>Messages and attachments you choose to send to support, and records needed to respond to your requests.</li>
      <li>Hosting and service logs can contain IP addresses, browser/device information, request times, identifiers and errors for operation, security and troubleshooting. Providers may also produce payment or authentication security signals.</li>
    </ul>
    <p>For troubleshooting, the signed-in app can send a fixed error category, app area, HTTP status, release identifier and request identifier to our existing Supabase logging service. This diagnostic mechanism does not send submitted text, raw error messages, document URLs or credentials, and is not visitor session replay. Delivery can fail when the browser or network is unavailable. Infrastructure logs are separate technical records as described above.</p>
    <p>We obtain data from you and your device, your chosen sign-in/document provider, Stripe, and the operational providers listed below. Do not submit information you are not authorized to process. We do not request health, biometric, political, religious or other special-category data; avoid including it in test text or support messages.</p>

    <h2>Lawful basis for processing — GDPR Article 6</h2>
    <ul>
      <li><strong>Contract, Article 6(1)(b):</strong> creating and managing your requested account, preparing previews, connecting selected documents, entering approved text, displaying session history, providing purchased access and service communications necessary to deliver TypeWit.</li>
      <li><strong>Legitimate interests, Article 6(1)(f):</strong> service/network security, preventing fraud and duplicate trials, investigating faults, providing non-marketing service updates where appropriate, handling support and establishing or defending legal claims. These interests must be balanced against your rights; you can object as explained below.</li>
      <li><strong>Legal obligation, Article 6(1)(c):</strong> records or disclosures required by applicable EU or Member State law where that basis applies. Other legal requirements must be assessed under an appropriate lawful basis; a requirement in another country does not automatically satisfy Article 6(1)(c).</li>
      <li><strong>Consent, Article 6(1)(a):</strong> optional marketing or non-essential tracking where offered and requiring consent. We must ask separately before that processing starts. You can withdraw independently, without affecting earlier lawful processing or losing necessary account functionality.</li>
    </ul>
    <p>Information needed for authentication, eligibility, payment or execution is required for the corresponding feature; without it we may be unable to provide that feature. An optional profile name is not required. Automated age, plan, payment and abuse checks can restrict access. Contact us to challenge a result, correct information or request human review; any applicable Article 22 safeguards remain available.</p>

    <h2>Cookies, local storage and consent choices</h2>
    <p>See the <Link href="/cookies/">Cookie and Storage Policy</Link> for authentication storage, temporary OAuth state, locally saved drafts and preferences, and how to clear them. Our application does not include advertising, behavioral-analytics or visitor session-replay trackers. Operational session activity is different from recording your browsing behavior.</p>
    <p>Where optional storage or tracking requires consent, it must remain off until you opt in. Any such banner must offer an equally prominent, equally easy “Reject all” and “Accept all” on its first layer, with no preselected optional categories. Marketing cannot be bundled with terms or essential service emails. Consent choices must be recorded with their purpose, notice/version, time and withdrawal, and withdrawal must be as easy as giving consent. No optional-tracking consent banner is needed solely to authorize storage genuinely necessary for a service you request.</p>
    <p>Completion and attention emails are service notifications, controlled in <Link href="/app/settings/#notifications">Settings → Notifications</Link>. Turning them off does not prevent necessary authentication, billing, security or legal notices. These switches are not permission for advertising emails.</p>

    <h2>Recipients and service providers</h2>
    <p>We disclose data needed to operate your requested workflow to Supabase, Netlify (production hosting), Vercel (preview/test hosting), Google, Discord, Microsoft, Stripe and Resend. See the <Link href="/subprocessors/">service-provider and subprocessor list</Link> for their purposes, data categories and privacy information. They do not all act solely as processors: payment, identity and document providers can also be independent controllers for their own services.</p>
    <p>Processors acting on our instructions require appropriate Article 28 terms, confidentiality, security and assistance obligations. A provider’s inclusion in our list is not proof of an executed DPA or a particular hosting region. Contact our privacy contact for the applicable arrangements. We may also disclose information when lawfully required, to professional advisers, or to establish or defend rights. We do not sell or rent personal data, or use submitted text for advertising or AI training.</p>
    <h3>Google user data</h3>
    <p>Our use and transfer of Google API data follows the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">Google API Services User Data Policy</a>, including Limited Use. Access is used for the document features you request. Staff access is restricted to authorized purposes such as support you request, security investigation or legal requirements.</p>

    <h2>International processing and transfers</h2>
    <p>TypeWit is operated from Bangladesh. Our primary Supabase project is configured in Ohio, United States (us-east-2). Other service-provider processing, backups or authorized support access may occur outside your country, including outside the EEA/UK. Hosting a database in Europe does not by itself eliminate international transfers. Bangladesh does not have an EU adequacy decision.</p>
    <p>Where GDPR Chapter V applies, a transfer needs a valid mechanism before it takes place: for example, an applicable adequacy decision for the recipient, or appropriate safeguards such as the European Commission’s Standard Contractual Clauses with the required transfer assessment and any supplementary measures. UK transfers need the applicable UK mechanism. An adequacy decision for one recipient does not cover every provider or onward transfer.</p>
    <p>This notice does not establish that particular contracts have been signed. Ask {email} for the relevant recipients, processing locations and applicable safeguards, and a copy of safeguards subject to necessary redactions. Accepting our terms is not blanket consent to international transfers.</p>

    <h2>Retention and deletion</h2>
    <ul>
      <li><strong>Accounts, sessions, submitted text, execution/activity history and unread notifications:</strong> retained to provide your account and requested history until you delete applicable records or your account, subject to lawful preservation needs. Inactivity alone currently does not trigger automatic account/session deletion. This is not a promise of an inactivity purge.</li>
      <li><strong>Read notifications:</strong> automatic cleanup after 90 days from being read. <strong>Duplicate-start records:</strong> after 7 days. <strong>Rate-limit/write-window records:</strong> after 2 days. <strong>Webhook processing receipts:</strong> after 90 days. Cleanup normally runs daily; outages can delay a run. Expired Google connection nonces are also cleaned up.</li>
      <li><strong>Trial eligibility:</strong> normalized email and trial-use evidence remain as needed to enforce the one-trial rule and investigate abuse. Their necessity must be reviewed; deleting your account does not automatically erase this record.</li>
      <li><strong>Billing, claims and support:</strong> kept only as needed for payment reconciliation, applicable statutory recordkeeping, responding to requests or establishing/defending claims. The relevant legal obligation, unresolved issue and limitation period determine retention; ask us for the period applicable to a particular record.</li>
      <li><strong>Provider logs/backups:</strong> subject to separate provider retention cycles and lawful preservation requirements. Deleting live application records is not instantaneous removal from every backup. Retained copies must remain protected and not be reused for unrelated purposes.</li>
    </ul>
    <p>Clear finished sessions in <Link href="/app/settings/#data">Settings → Data &amp; privacy</Link>. Account deletion is under <Link href="/app/settings/#danger">Delete account</Link> and requires confirming your email to prevent accidental deletion. Self-service deletion can require resolving an ongoing Stripe subscription first. You can still request erasure by email at any time, including if self-service is blocked; a billing issue does not remove your statutory rights. We assess necessary exceptions rather than promising deletion of every record regardless of law.</p>
    <p>Deletion stops sessions and removes account-linked live records through the account deletion workflow. You can explicitly choose to end an ongoing Pro subscription immediately so deletion need not wait for the paid period to expire. Pending TypeWit checkout links are closed before deletion. Necessary financial/trial retention exceptions still apply. After successful deletion, the app attempts to clear its saved drafts and preferences on the device you are using; storage restrictions can prevent this, and short security markers can remain. Deletion does not erase Google/Microsoft documents or their version history, drafts on other devices, or records independently controlled by providers. Manage those documents and other devices separately.</p>

    <h2>Your rights and how to use them</h2>
    <p>Where GDPR applies, you can request:</p>
    <ul>
      <li><strong>Access:</strong> confirmation, a copy of your personal data and information about processing.</li>
      <li><strong>Rectification:</strong> correction of inaccurate data or completion of incomplete information.</li>
      <li><strong>Erasure:</strong> deletion where its conditions apply; some records may be retained for a legal obligation or legal claims.</li>
      <li><strong>Restriction:</strong> limits on use in the circumstances set out in Article 18.</li>
      <li><strong>Portability:</strong> data you provided, processed by automated means on consent or contract, in a structured, commonly used, machine-readable format, and transmission to another controller where technically feasible.</li>
      <li><strong>Objection:</strong> object on grounds relating to your situation to processing based on legitimate interests. We must stop unless the applicable legal grounds for continuing apply. Objection to direct marketing is unconditional.</li>
      <li><strong>Consent withdrawal and review:</strong> withdraw consent independently and exercise applicable safeguards for solely automated decisions.</li>
    </ul>
    <p>The Settings JSON download is an account/session summary, not a complete Article 15 access response or a complete portability export. For a full request, including eligible submitted text and records not present in that summary, email {email}. You can correct your display name in Profile and request other corrections through the same address.</p>
    <p>We respond without undue delay and normally within one month of receiving a request. Where legally permitted for complex or numerous requests, this can be extended by up to two further months; we will explain the extension within the first month. Requests are normally free. We may ask for proportionate information to verify identity, protect other people’s rights, and explain any lawful refusal or fee. You do not need a paid plan to exercise your rights.</p>
    <p>You may complain to a competent supervisory authority, particularly where you habitually live, work or believe an infringement occurred, and seek a judicial remedy. You need not contact TypeWit first. The <a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en" rel="noopener noreferrer">EDPB authority directory</a> can help locate an EEA authority. UK users can contact the ICO.</p>

    <h2>Security and personal data breaches</h2>
    <p>We use encrypted transport for service connections, encrypted Google credentials at rest, account-level access controls and restricted privileged access. Exact protocol/cipher support, storage encryption and backup controls depend on the service and provider configuration. We do not promise that every connection uses TLS 1.3 or every stored record uses AES-256 without verifying that configuration. No system is risk-free.</p>
    <p>For a personal data breach, we must assess and document what happened, contain the incident and its risks, and cooperate with affected processors. Where GDPR Article 33 requires notification, we must notify the competent supervisory authority without undue delay and, where feasible, within 72 hours after becoming aware, unless the breach is unlikely to result in a risk to people’s rights and freedoms. If notification is late, we must explain why; information can be supplied in phases where permitted.</p>
    <p>Where a breach is likely to create a high risk, we must inform affected people without undue delay in clear language, unless a lawful Article 34 exception applies. A report to TypeWit is not the same as notification to an authority. Send suspected security incidents to {email}, with “Security incident” in the subject.</p>

    <h2>Children and young people</h2>
    <p>TypeWit is not available below age 13 or below our country-specific minimum eligibility age, which can be higher. Below that minimum, a guardian checkbox does not override the restriction. Accounts are created before the age question; the dashboard is gated pending the check. A below-minimum result blocks use and cancels active sessions; it does not by itself guarantee immediate deletion. Contact us to request removal through the account-deletion process.</p>
    <p>GDPR Article 8’s national threshold (13–16) applies when consent is relied on for an information-society service offered directly to a child; it is not a universal rule that all processing of every EU user under 16 requires consent. Where parental authorization is legally required, reasonable verification is necessary. A recorded guardian declaration is not proof that such verification has occurred. Eligible users under 18 must obtain guardian agreement under our service rules, and paid plans must be purchased by an adult.</p>

    <h2>Changes to this notice</h2>
    <p>We update the date when this notice changes and provide appropriate notice of material changes. If new processing needs consent, an updated notice or continued use cannot substitute for that consent. Contact {email} about this notice or any privacy request.</p>
  </>;
}

# TypeWit clauses for individual legal review

These are extracts of the updated policy/terms wording, grouped in the requested checklist format. Review them with the full policies and gdpr-audit.md; quoted duties do not prove operational completion. General guidance, not legal advice or certification.

[1. CONSENT FIRST]

MISSING: Partial/unverified. No advertising, behavioral analytics or visitor-session-replay integration was found in application source. Hosting-dashboard injection and live provider flows were not scanned. Not all local storage is automatically necessary.

RECOMMENDED TEXT:

Where optional storage or tracking requires consent, it must remain off until you opt in. Any such banner must offer an equally prominent, equally easy “Reject all” and “Accept all” on its first layer, with no preselected optional categories. Marketing cannot be bundled with terms or essential service emails. Consent choices must be recorded with their purpose, notice/version, time and withdrawal, and withdrawal must be as easy as giving consent. No optional-tracking consent banner is needed solely to authorize storage genuinely necessary for a service you request.

[2. EQUAL REJECT OPTION]

MISSING: Not applicable to an optional-tracking banner in the reviewed app: no such banner currently exists. A banner authorizing nothing is not required merely for genuinely necessary storage.

RECOMMENDED TEXT:

If we introduce optional tracking or other non-exempt storage, it must remain disabled until you consent. The first banner layer must make “Reject all” as prominent and easy to use as “Accept all”, with matching size and visual prominence, a one-step reject option, no preselected optional purposes, and a persistent way to change or withdraw choices. Cookie consent must be separate from terms and marketing consent. Records must identify the choice, purposes, notice/version, time and any withdrawal.

[3. NO PRE-TICKED MARKETING BOXES]

MISSING: No marketing signup box found. Default operational completion/attention email choices are not marketing consent.

RECOMMENDED TEXT:

If we introduce optional tracking or other non-exempt storage, it must remain disabled until you consent. The first banner layer must make “Reject all” as prominent and easy to use as “Accept all”, with matching size and visual prominence, a one-step reject option, no preselected optional purposes, and a persistent way to change or withdraw choices. Cookie consent must be separate from terms and marketing consent. Records must identify the choice, purposes, notice/version, time and any withdrawal.

Completion and attention emails are service notifications, controlled in Settings → Notifications . Turning them off does not prevent necessary authentication, billing, security or legal notices. These switches are not permission for advertising emails.

[4. ACCESSIBLE PRIVACY POLICY]

MISSING: No for basic availability: PrivacyBody was already shared by the public page and auth LegalDialog, with footer links. Substance was incomplete.

RECOMMENDED TEXT:

See the Cookie and Storage Policy for authentication storage, temporary OAuth state, locally saved drafts and preferences, and how to clear them. Our application does not include advertising, behavioral-analytics or visitor session-replay trackers. Operational session activity is different from recording your browsing behavior.

[5. DATA MINIMIZATION]

MISSING: Partial. Old notice omitted server preview requests before approval, selected-document reads/revision information, limited Stripe billing/card data and some eligibility/security records. Birth day is not requested.

RECOMMENDED TEXT:

Information needed for authentication, eligibility, payment or execution is required for the corresponding feature; without it we may be unable to provide that feature. An optional profile name is not required. Automated age, plan, payment and abuse checks can restrict access. Contact us to challenge a result, correct information or request human review; any applicable Article 22 safeguards remain available.

[6. SEPARATE CONSENT]

MISSING: Yes/partial. Terms implied general agreement to the Privacy Policy; acceptance, provider authorization and optional consent were insufficiently distinguished.

RECOMMENDED TEXT:

These terms are an agreement between you and Typewit Organization, based in Bangladesh, operating TypeWit (“we”, “us”) for your use of typewit.com and the TypeWit service. By creating an account or using TypeWit, you agree to these terms and the Responsible Use Agreement . Our Privacy Policy explains personal-data processing; acknowledging that notice is not blanket consent to tracking, marketing or other processing that requires separate consent.

Where optional storage or tracking requires consent, it must remain off until you opt in. Any such banner must offer an equally prominent, equally easy “Reject all” and “Accept all” on its first layer, with no preselected optional categories. Marketing cannot be bundled with terms or essential service emails. Consent choices must be recorded with their purpose, notice/version, time and withdrawal, and withdrawal must be as easy as giving consent. No optional-tracking consent banner is needed solely to authorize storage genuinely necessary for a service you request.

[7. CONSENT LOGGING]

MISSING: Partial. profiles.agreed_terms_version/agreed_terms_at records current Responsible Use Agreement acceptance, not a purpose-specific optional-consent ledger or a separate version record for each Privacy/Terms document. Archive relevant contract/notice versions and evidence rather than assuming this field proves every acceptance. No optional marketing/tracking consent flow was found.

RECOMMENDED TEXT:

If we introduce optional tracking or other non-exempt storage, it must remain disabled until you consent. The first banner layer must make “Reject all” as prominent and easy to use as “Accept all”, with matching size and visual prominence, a one-step reject option, no preselected optional purposes, and a persistent way to change or withdraw choices. Cookie consent must be separate from terms and marketing consent. Records must identify the choice, purposes, notice/version, time and any withdrawal.

[8. CHILDREN'S DATA]

MISSING: Partial. Country minimum ages and a guardian declaration exist. Accounts are created before age confirmation. Latest confirm_age blocks below-minimum accounts and cancels sessions instead of immediately deleting them; old Privacy promised deletion. Verified parental identity/authorization was not demonstrated.

RECOMMENDED TEXT:

TypeWit is not available below age 13 or below our country-specific minimum eligibility age, which can be higher. Below that minimum, a guardian checkbox does not override the restriction. Accounts are created before the age question; the dashboard is gated pending the check. A below-minimum result blocks use and cancels active sessions; it does not by itself guarantee immediate deletion. Contact us to request removal through the account-deletion process.

GDPR Article 8’s national threshold (13–16) applies when consent is relied on for an information-society service offered directly to a child; it is not a universal rule that all processing of every EU user under 16 requires consent. Where parental authorization is legally required, reasonable verification is necessary. A recorded guardian declaration is not proof that such verification has occurred. Eligible users under 18 must obtain guardian agreement under our service rules, and paid plans must be purchased by an adult.

[9. DATA DOWNLOAD]

MISSING: Partial. Existing Settings JSON includes account/session summaries but omits source text, full activity and other records relevant to access/portability.

RECOMMENDED TEXT:

The Settings JSON download is an account/session summary, not a complete Article 15 access response or a complete portability export. For a full request, including eligible submitted text and records not present in that summary, email support@typewit.com . You can correct your display name in Profile and request other corrections through the same address.

We respond without undue delay and normally within one month of receiving a request. Where legally permitted for complex or numerous requests, this can be extended by up to two further months; we will explain the extension within the first month. Requests are normally free. We may ask for proportionate information to verify identity, protect other people’s rights, and explain any lawful refusal or fee. You do not need a paid plan to exercise your rights.

[10. DATA DELETION]

MISSING: Partial. Authenticated deletion requires email confirmation and checks billing, cancels sessions, revokes Google where appropriate and deletes the auth user/cascading records. Ongoing subscriptions can block self-service. Trial records, provider billing/backups, documents/history and local drafts are not all erased by it.

RECOMMENDED TEXT:

Clear finished sessions in Settings → Data & privacy . Account deletion is under Delete account and requires confirming your email to prevent accidental deletion. Self-service deletion can require resolving an ongoing Stripe subscription first. You can still request erasure by email at any time, including if self-service is blocked; a billing issue does not remove your statutory rights. We assess necessary exceptions rather than promising deletion of every record regardless of law.

Deletion stops sessions and removes account-linked live records through the account deletion workflow. It does not erase Google/Microsoft documents or their version history, your browser’s saved drafts/preferences, or records independently controlled by providers. Clear local storage and manage provider documents separately.

[11. AUTOMATIC DELETION / INACTIVITY]

MISSING: Yes for inactive accounts/sessions and unread notifications. Actual housekeeping removes expired OAuth nonces, duplicate-start records after 7 days, rate/write-window records after 2 days, webhook receipts after 90 days and read notifications after 90 days. Sessions/history/unread notifications stay until user deletion. Trial claims have no fixed expiry.

RECOMMENDED TEXT:

Accounts, sessions, submitted text, execution/activity history and unread notifications: retained to provide your account and requested history until you delete applicable records or your account, subject to lawful preservation needs. Inactivity alone currently does not trigger automatic account/session deletion. This is not a promise of an inactivity purge.

Read notifications: automatic cleanup after 90 days from being read. Duplicate-start records: after 7 days. Rate-limit/write-window records: after 2 days. Webhook processing receipts: after 90 days. Cleanup normally runs daily; outages can delay a run. Expired Google connection nonces are also cleaned up.

[12. SUBPROCESSOR LIST]

MISSING: Partial. Providers were named but roles and data categories were sparse.

RECOMMENDED TEXT:

We disclose data needed to operate your requested workflow to Supabase, Netlify (production hosting), Vercel (preview/test hosting), Google, Discord, Microsoft, Stripe and Resend. See the service-provider and subprocessor list for their purposes, data categories and privacy information. They do not all act solely as processors: payment, identity and document providers can also be independent controllers for their own services.

This list explains the services used by TypeWit. Not every listed provider is a subprocessor in every context. Some are independent controllers for their own payment, identity or document services. Read our Privacy Policy for lawful bases, rights and transfers.

[13. EXECUTED DPAs]

MISSING: Unverified. Installed software and public vendor DPA pages do not prove TypeWit's execution/acceptance. Agreements were not provided.

RECOMMENDED TEXT:

Processors acting on our instructions require appropriate Article 28 terms, confidentiality, security and assistance obligations. A provider’s inclusion in our list is not proof of an executed DPA or a particular hosting region. Contact our privacy contact for the applicable arrangements. We may also disclose information when lawfully required, to professional advisers, or to establish or defend rights. We do not sell or rent personal data, or use submitted text for advertising or AI training.

[14. INTERNATIONAL TRANSFERS]

MISSING: Yes/insufficiently evidenced. Bangladesh operator; Supabase project metadata verifies primary region us-east-2 (Ohio, United States), now disclosed. Other provider locations/access, executed SCCs, transfer assessment, adequacy coverage and supplementary measures remain unverified.

RECOMMENDED TEXT:

TypeWit is operated from Bangladesh. Our primary Supabase project is configured in Ohio, United States (us-east-2). Other service-provider processing, backups or authorized support access may occur outside your country, including outside the EEA/UK. Hosting a database in Europe does not by itself eliminate international transfers. Bangladesh does not have an EU adequacy decision.

Where GDPR Chapter V applies, a transfer needs a valid mechanism before it takes place: for example, an applicable adequacy decision for the recipient, or appropriate safeguards such as the European Commission’s Standard Contractual Clauses with the required transfer assessment and any supplementary measures. UK transfers need the applicable UK mechanism. An adequacy decision for one recipient does not cover every provider or onward transfer.

This notice does not establish that particular contracts have been signed. Ask support@typewit.com for the relevant recipients, processing locations and applicable safeguards, and a copy of safeguards subject to necessary redactions. Accepting our terms is not blanket consent to international transfers.

[15. ENCRYPTION]

MISSING: Partial/unverified for exact ciphers. Encrypted transport, encrypted Google tokens and account access controls exist. Universal TLS 1.3 and AES-256 for all data/connections were not demonstrated.

RECOMMENDED TEXT:

We use encrypted transport for service connections, encrypted Google credentials at rest, account-level access controls and restricted privileged access. Exact protocol/cipher support, storage encryption and backup controls depend on the service and provider configuration. We do not promise that every connection uses TLS 1.3 or every stored record uses AES-256 without verifying that configuration. No system is risk-free.

[16. BREACH NOTIFICATION]

MISSING: Yes. Original promise omitted authority deadline, risk thresholds and documented response. Trained personnel/operating process were not evidenced.

RECOMMENDED TEXT:

For a personal data breach, we must assess and document what happened, contain the incident and its risks, and cooperate with affected processors. Where GDPR Article 33 requires notification, we must notify the competent supervisory authority without undue delay and, where feasible, within 72 hours after becoming aware, unless the breach is unlikely to result in a risk to people’s rights and freedoms. If notification is late, we must explain why; information can be supplied in phases where permitted.

Where a breach is likely to create a high risk, we must inform affected people without undue delay in clear language, unless a lawful Article 34 exception applies. A report to TypeWit is not the same as notification to an authority. Send suspected security incidents to support@typewit.com , with “Security incident” in the subject.

[ADDITIONAL: ARTICLE 6, RIGHTS, DPO / REPRESENTATIVE]

MISSING: Yes/partial. No purpose-to-basis map, complete rights/time-limit explanation, or confirmed representative/DPO.

RECOMMENDED TEXT:

Typewit Organization, based in Bangladesh, operates typewit.com (TypeWit). We are the controller for account administration, billing, service security and our own customer support. Send privacy requests to support@typewit.com , with the subject “Privacy request”. This is our privacy contact; we do not describe this mailbox as an appointed Data Protection Officer or an EU/UK representative.

Contract, Article 6(1)(b): creating and managing your requested account, preparing previews, connecting selected documents, entering approved text, displaying session history, providing purchased access and service communications necessary to deliver TypeWit.

Legitimate interests, Article 6(1)(f): service/network security, preventing fraud and duplicate trials, investigating faults, providing non-marketing service updates where appropriate, handling support and establishing or defending legal claims. These interests must be balanced against your rights; you can object as explained below.

Legal obligation, Article 6(1)(c): records or disclosures required by applicable EU or Member State law where that basis applies. Other legal requirements must be assessed under an appropriate lawful basis; a requirement in another country does not automatically satisfy Article 6(1)(c).

Consent, Article 6(1)(a): optional marketing or non-essential tracking where offered and requiring consent. We must ask separately before that processing starts. You can withdraw independently, without affecting earlier lawful processing or losing necessary account functionality.

We respond without undue delay and normally within one month of receiving a request. Where legally permitted for complex or numerous requests, this can be extended by up to two further months; we will explain the extension within the first month. Requests are normally free. We may ask for proportionate information to verify identity, protect other people’s rights, and explain any lawful refusal or fee. You do not need a paid plan to exercise your rights.

No liability cap, disclaimer, governing-law clause or use restriction in these terms overrides non-waivable data-protection rights, supervisory-authority powers or compensation rights under applicable law. Optional marketing and tracking must not be made a condition of accepting these terms.

# TypeWit GDPR audit and update

Scope: repository policy components shared by public pages and signup dialogs, storage, Settings export/deletion, age/guardian checks, provider integrations and housekeeping. Live database function inspection confirmed agreement timestamps and ineligible-account blocking; the deployed worker housekeeping source matches the reviewed code. No schema or customer-data writes were made. Live page retrieval was blocked by the environment; this is not a production network/tracker scan. No customer records were inspected or deleted.

General guidance, not legal advice or GDPR certification. Qualified EU/UK and Bangladesh counsel must review applicability, roles, minors, representation, contracts and consumer terms. Changes to wording cannot prove that a contract was executed or an operational control works.

`MISSING` describes the original gap. `RECOMMENDED TEXT` identifies the updated site clauses, which can be reviewed independently. Open operational items remain open.

[1. CONSENT FIRST]
MISSING: Partial/unverified. No advertising, behavioral analytics or visitor-session-replay integration was found in application source. Hosting-dashboard injection and live provider flows were not scanned. Not all local storage is automatically necessary.
RECOMMENDED TEXT: Privacy → Cookies/consent and new Cookie Policy: non-exempt processing stays off until specific opt-in. Operator must scan production signed out/in, on mobile, and during provider flows; assess each storage exemption under applicable national rules.

[2. EQUAL REJECT OPTION]
MISSING: Not applicable to an optional-tracking banner in the reviewed app: no such banner currently exists. A banner authorizing nothing is not required merely for genuinely necessary storage.
RECOMMENDED TEXT: Cookie Policy requires equal first-layer Accept all/Reject all access and prominence, no preselected optional categories and an easy persistent withdrawal control if introduced. Implement matching size/visual weight and keyboard access, not a hidden reject path.

[3. NO PRE-TICKED MARKETING BOXES]
MISSING: No marketing signup box found. Default operational completion/attention email choices are not marketing consent.
RECOMMENDED TEXT: Privacy distinguishes service emails from independently optional marketing. Do not reuse these switches to send advertising; obtain separate consent where required.

[4. ACCESSIBLE PRIVACY POLICY]
MISSING: No for basic availability: PrivacyBody was already shared by the public page and auth LegalDialog, with footer links. Substance was incomplete.
RECOMMENDED TEXT: Updated shared PrivacyBody; new Cookie/Storage and Service-provider pages linked in both footer variants, Privacy and Terms. Add canonicals and sitemap entries and verify signup/footer mobile and keyboard access.

[5. DATA MINIMIZATION]
MISSING: Partial. Old notice omitted server preview requests before approval, selected-document reads/revision information, limited Stripe billing/card data and some eligibility/security records. Birth day is not requested.
RECOMMENDED TEXT: Privacy → Collection/sources and Article 6 sections explain necessary/optional data, purpose and source. Avoid unauthorized/special-category content. Operator must document minimization decisions and assess trial-record retention; prose alone does not establish Article 5 compliance.

[6. SEPARATE CONSENT]
MISSING: Yes/partial. Terms implied general agreement to the Privacy Policy; acceptance, provider authorization and optional consent were insufficiently distinguished.
RECOMMENDED TEXT: Terms introduction/privacy section and Privacy consent section: notice acknowledgment is not blanket consent. Marketing/tracking require an independent choice and withdrawal where applicable. Continued use is not new consent.

[7. CONSENT LOGGING]
MISSING: Partial. profiles.agreed_terms_version/agreed_terms_at records current Responsible Use Agreement acceptance, not a purpose-specific optional-consent ledger or a separate version record for each Privacy/Terms document. Archive relevant contract/notice versions and evidence rather than assuming this field proves every acceptance. No optional marketing/tracking consent flow was found.
RECOMMENDED TEXT: Privacy/Cookie policy specifies choice, purpose, notice version, timestamp and withdrawal. Before introducing optional consent, implement versioned evidence and withdrawal enforcement with proportionate retention; do not relabel terms acceptance as cookie/marketing consent.

[8. CHILDREN'S DATA]
MISSING: Partial. Country minimum ages and a guardian declaration exist. Accounts are created before age confirmation. Latest confirm_age blocks below-minimum accounts and cancels sessions instead of immediately deleting them; old Privacy promised deletion. Verified parental identity/authorization was not demonstrated.
RECOMMENDED TEXT: Children/eligibility clauses now explain actual gating and declarations. Article 8 thresholds vary 13–16 for consent-based information-society services; not all processing of all EU under-16 users universally requires consent. Review minimum-age map, contract capacity, pre-check account collection, verified authorization where relied on, and cleanup of ineligible records. No lower-age onboarding route was enabled.

[9. DATA DOWNLOAD]
MISSING: Partial. Existing Settings JSON includes account/session summaries but omits source text, full activity and other records relevant to access/portability.
RECOMMENDED TEXT: Button now says Download account summary; added full-request email route and accurate Privacy explanation of Articles 15/20 and scope. Complete automated export remains unimplemented and is not claimed. Operator must supply full eligible records on request, in appropriate formats with necessary third-party/security redactions.

[10. DATA DELETION]
MISSING: Partial. Authenticated deletion requires email confirmation and checks billing, cancels sessions, revokes Google where appropriate and deletes the auth user/cascading records. Ongoing subscriptions can block self-service. Trial records, provider billing/backups, documents/history and local drafts are not all erased by it.
RECOMMENDED TEXT: Privacy/Terms disclose limits and allow email erasure requests even when self-service is blocked. GDPR does not demand unsafe literal one-click destruction; reasonable confirmation is appropriate. Billing issues cannot remove statutory rights; assess lawful retention exceptions rather than imposing a paywall.

[11. AUTOMATIC DELETION / INACTIVITY]
MISSING: Yes for inactive accounts/sessions and unread notifications. Actual housekeeping removes expired OAuth nonces, duplicate-start records after 7 days, rate/write-window records after 2 days, webhook receipts after 90 days and read notifications after 90 days. Sessions/history/unread notifications stay until user deletion. Trial claims have no fixed expiry.
RECOMMENDED TEXT: Publish actual implemented periods and state no inactivity purge. OPEN: approve justified inactive-account/history/unread/trial/support/billing schedules, provider log/backup periods and legal holds. Then implement prospective cleanup, user notice, migrations and tests separately. No silent purge of history or customers was performed here.

[12. SUBPROCESSOR LIST]
MISSING: Partial. Providers were named but roles and data categories were sparse.
RECOMMENDED TEXT: New /subprocessors/ covers Supabase, Netlify, Vercel, Resend, Stripe, Google, Discord and Microsoft with purposes, data and legal/privacy links. Not all identity/document/payment providers act solely as TypeWit processors. Confirm legal entities, actual enabled services, roles, regions and onward providers against contracts.

[13. EXECUTED DPAs]
MISSING: Unverified. Installed software and public vendor DPA pages do not prove TypeWit's execution/acceptance. Agreements were not provided.
RECOMMENDED TEXT: Policies explain Article 28 requirements without claiming signed contracts. OPEN: record applicable contracted entity, accepted version/date, execution evidence, assistance/security/deletion obligations and subprocessor notice process. Also arrange a customer DPA before organizational use requiring TypeWit to act as processor; consumer terms alone are insufficient.

[14. INTERNATIONAL TRANSFERS]
MISSING: Yes/insufficiently evidenced. Bangladesh operator; Supabase project metadata verifies primary region us-east-2 (Ohio, United States), now disclosed. Other provider locations/access, executed SCCs, transfer assessment, adequacy coverage and supplementary measures remain unverified.
RECOMMENDED TEXT: Privacy/provider page explain Bangladesh, Chapter V, relevant adequacy/SCC/UK mechanisms and obtaining safeguards without claiming execution. OPEN: map transfers/remote access and roles, establish applicable mechanisms and assessments BEFORE relevant transfers. Counsel must assess correct SCC modules/current applicability, including Article 3(2)-subject importers. EU hosting, terms acceptance or one recipient's adequacy coverage do not solve all transfers.

[15. ENCRYPTION]
MISSING: Partial/unverified for exact ciphers. Encrypted transport, encrypted Google tokens and account access controls exist. Universal TLS 1.3 and AES-256 for all data/connections were not demonstrated.
RECOMMENDED TEXT: Security clause states supported controls without inventing universal specifications. OPEN: verify TLS support/minimums, database/log/backup encryption, keys and access in provider configuration. Article 32 is risk-based and does not universally prescribe this particular cipher pair.

[16. BREACH NOTIFICATION]
MISSING: Yes. Original promise omitted authority deadline, risk thresholds and documented response. Trained personnel/operating process were not evidenced.
RECOMMENDED TEXT: Privacy specifies Article 33 notification without undue delay and where feasible within 72 hours of awareness unless risk is unlikely; Article 34 high-risk user communication without undue delay with lawful exceptions. Internal runbook added. OPEN: assign lead/backup, provider escalation, decision evidence, authority/user channels, training and exercises. Text alone is not an operating response capability.

[ADDITIONAL: ARTICLE 6, RIGHTS, DPO / REPRESENTATIVE]
MISSING: Yes/partial. No purpose-to-basis map, complete rights/time-limit explanation, or confirmed representative/DPO.
RECOMMENDED TEXT: Expanded bases, data sources/required fields, automated checks/human-review contact, rights, one-month response and lawful extension, portability scope and authority complaints. Terms preserve mandatory privacy rights against caps/disputes clauses. OPEN: confirm legal identity and appropriate public contact/address; assess Article 27 EU/UK representatives and Article 37 DPO, appoint/publish if required. Do not label support as an appointed official or invent a representative. Owner confirmation was requested; silence is not confirmation.

## Priority operator actions before claiming full compliance

1. Qualified legal review of controller identity/contact, applicability, representatives/DPO, minors and customer data-processing roles.
2. Execute/record required DPAs, map locations/access and implement lawful transfer safeguards/assessments. Use vendor-contract-register.csv.
3. Scan production trackers/storage, including hosting settings and provider flows. Consent must precede non-exempt use.
4. Approve proportionate retention and implement prospective cleanup with notice and legal-hold safeguards; do not silently remove promised history.
5. Operate complete access/portability/erasure request handling and the breach runbook; verify security and parental authorization when relied on.

## Primary references for legal review

- [GDPR, Articles 5–8, 12–22, 27–28, 32–39 and 44–49](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Irish DPC: Articles 13/14 transparency](https://www.dataprotection.ie/en/individuals/know-your-rights/right-be-informed-transparency-article-13-14-gdpr)
- [European Commission: individual rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en)
- [European Commission: obligations, DPO and breaches](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en)
- [European Commission: children's safeguards](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en)
- [European Commission: adequacy](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en)
- [European Commission: SCCs](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en)
- [ICO cookie/storage guidance; UK reference, assess EU national rules separately](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/)

## Verification

The 140-case browser suite passed, including new policy readability/accessibility and account-summary download checks. A final rebuilt, separately targeted two-test policy check also passed with the verified US-region wording. Final TypeScript and SEO validation passed (22 canonical public pages). No existing test was weakened. No database migration, backend deployment, customer deletion or optional tracking was introduced by this policy update. Owner evidence and legal review items above remain open; passing UI tests is not GDPR certification.

# TypeWit launch: owner-operated checks

Tax registration and checkout tax settings are intentionally excluded at your request. This checklist does not assert they are complete. Do not paste secrets into chat, commit them, or replace production keys to run test payments.

## 1. Backups — before database history repair or release rollback

1. Open Supabase project `jopggisumjlfitapkgjh` → Database → Backups. Record the plan, whether daily backups/PITR are enabled, latest successful point and actual retention. If your plan lacks the required protection, decide on a paid upgrade yourself.
2. Arrange an isolated nonproduction restore using the provider's supported procedure. Never restore over production as a test. Check schema, functions/grants, owner isolation and synthetic/redacted row counts.
3. Record acceptable recovery point/time (RPO/RTO), restore authority and the tested steps. Database backups do not automatically cover external Google/Word documents or every Storage object.
4. Preserve the resulting evidence before approving migration-history changes.

## 2. Migration-history reconciliation

1. Save `supabase migration list` / MCP `list_migrations`, current schema definitions and the backup evidence above.
2. Git contains `20261024000001_session_defaults`; live history records `20261022085807_session_defaults`. Do not rename an already-applied file or replay its old function over the current one.
3. Compare the original statements and final schema. The later writing-block migration replaces the setter again; the current live setter contains writing-block validation. The mismatch alone does not prove broken defaults.
4. Have a database maintainer review a history-only reconciliation plan and its effect on future deploys, then test it in isolation. Obtain separate approval before executing any repair.

## 3. Supabase Auth controls

1. Open Authentication → security/password settings and enable leaked-password protection if available on your plan. The audit found it disabled; it was not changed automatically. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. Inspect Authentication rate limits for sign-in, signup, token refresh, verification and password recovery. Record current values and choose limits that accommodate Google/Discord and Word sign-in.
3. If enabling CAPTCHA, wire and test the actual widget/token flow in a test deployment before switching the production Auth requirement on. Enabling it in the dashboard alone can break sign-in.
4. Verify Google and Discord redirect allowlists and production `APP_URL`. Use only your controlled test identity for manual flow checks; never another customer's account.

## 4. Stripe retry and failure policy (no tax changes)

1. Stripe Dashboard → Billing → Revenue recovery / failed-payment settings: record retry schedule and the final action after retries. Avoid an indefinite `past_due` final state if Pro access remains available during that state.
2. Choose a documented recovery window and final `unpaid` or canceled state appropriate to your business. Verify how automations override global settings. Do not silently change existing customers' paid access or refund rights.
3. Enable and review customer failed-payment/card-update emails, sender settings and portal payment-method updates.
4. Review disputed-payment and fraud handling with your payments adviser; confirm whether and when subscriptions should end. A refund and subscription cancellation are separate actions.
5. Confirm the live webhook endpoint targets `/functions/v1/stripe-webhook`, has the correct signing secret in Edge secrets and receives the event types implemented by the released code. Do not expose the signing secret.

## 5. Real payment test evidence — isolated Stripe sandbox only

1. Use a separate Stripe sandbox plus a nonproduction app/database with sandbox keys, prices and webhook signing secret. Never swap production secrets just to test.
2. Complete a Day Pass and a Pro checkout using Stripe's successful test card. Confirm amount, owner, single entitlement, correct trial/expiry and idempotent webhook delivery.
3. Test declined card `4000 0000 0000 0002`: readable error, no premature entitlement, retry works.
4. Use Stripe's documented authentication-required test card; complete and abandon the 3D Secure challenge. Confirm access is granted only after the required successful payment state.
5. Refund a sandbox payment and check the intended access policy, duplicate/reordered event deliveries and Day Pass revocation. Record results without cardholder/customer data.
6. Test subscription renewal failure, retry success and terminal failure using sandbox/test-clock facilities where supported. Check that the billing screen matches current Stripe status.

## 6. Spending controls

1. Supabase organization/project billing: record plan limits, spend cap behavior and usage alerts for database, functions, egress and storage. Confirm which charges a cap actually covers.
2. Netlify production and Vercel preview: configure budget/usage alerts and review overage behavior. Keep previews out of production indexing and do not assume Vercel is a production fallback.
3. Resend: set volume alerts/limits and monitor bounces. Google Cloud: inspect Docs/Drive API quotas and any billable-service budgets; budget alerts are not automatically hard caps.
4. Assign an alert owner and escalation recipient. Test notifications without exhausting quotas or interrupting writing sessions.

## 7. Uptime and incident alerts

1. In your chosen external monitor, check `https://jopggisumjlfitapkgjh.supabase.co/functions/v1/drip-tick/health` every 60 seconds. Require HTTP 200 **and** JSON `ok: true`.
2. Monitor `https://typewit.com/` and certificate expiry separately. A healthy static page does not prove the worker is running.
3. Configure confirmed alert recipients and test delivery using a controlled test monitor. Do not stop the production worker or customer sessions to generate an alert.
4. Record the current release SHA/deploy ID and incident owner. Supabase logs alone are not proof that someone receives alerts.

### Diagnostic log review

Search Supabase Edge Function logs for `typewit.request_error`, `typewit.stripe_error`, `typewit.billing_reconcile` and `typewit.billing_review`. Correlate request IDs with `typewit.client_error`; client reports are untrusted and best-effort, signed-in only. No external alert destination or retention setting was configured. If using supported log drains, privacy-review the destination, select retention and test alert delivery in staging. Do not log document text, credentials or full URLs.

## 8. Email authentication and delivery

1. Resend → Domains → `typewit.com`: verify the domain and use the exact SPF/DKIM/MAIL-FROM records shown there. Do not invent selector values or overwrite unrelated business-mail MX records.
2. Set `EMAIL_FROM` to a verified `typewit.com` sender and confirm `RESEND_API_KEY` in Supabase Edge secrets. The code fallback `onboarding@resend.dev` is not evidence of production-domain verification.
3. Verify Supabase Auth custom SMTP independently; signup/reset mail and service notifications are separate paths.
4. Run `dig TXT typewit.com` and `dig TXT _dmarc.typewit.com`. Replace the following placeholders with the provider's actual values before running `dig TXT DKIM_SELECTOR._domainkey.typewit.com` and `dig TXT MAIL_FROM_DOMAIN`.
5. Keep a single SPF record per DNS name. Validate SPF/DKIM alignment and review DMARC reporting before moving to enforcement.
6. Send controlled signup, confirmation, reset and notification emails to your test Gmail/Outlook inboxes. Inspect `Authentication-Results` for SPF/DKIM/DMARC passes and review bounce/delivery logs. Do not send customer emails as tests.

## 9. Production cookies, headers and provider compatibility

1. Use a fresh browser profile. In DevTools Network/Application inspect requests, cookies and storage before interaction and through requested sign-in/payment/Office flows.
2. Check hosting integrations for injected analytics, replay or marketing scripts. Source-code absence does not prove no hosting injection.
3. If optional tracking exists, verify no optional requests occur before consent or after rejection, with equal first-layer Accept/Reject and an accessible withdrawal control. Do not enable trackers while this remains unverified.
4. Check effective response headers with `curl -I https://typewit.com/` and `curl -I https://typewit.com/word/`, plus your actual Vercel preview. Hosting config is not proof of deployed headers.
5. Preserve Microsoft Office framing; do not add `X-Frame-Options: DENY/SAMEORIGIN` globally to the Word add-in. The new script CSP is Report-Only. Inspect report-only console/securitypolicyviolation events with Google Picker and Office.js; review required hosts and Next inline-script hashes/nonces before any separately reviewed enforcement change. Do not simply flip the header to enforced.
6. Manually verify keyboard/screen-reader operation in actual Stripe-hosted Checkout and its SCA challenge; mocks cannot prove that third-party UI.

## 10. Privacy, retention and legal operations

1. Assign the privacy-request/incident owner and backup. Follow `docs/privacy/operations.md`; monitor the published support address and normally one-month rights-request deadlines.
2. Complete `docs/privacy/vendor-contract-register.csv` with accepted DPAs, service roles, locations, transfer safeguards and actual log/backup retention. Obtain qualified legal review where needed.
3. Decide and approve any prospective inactive-data retention rule before implementing it. Do not erase sessions/history sooner than the published policy permits, and do not claim an inactivity purge exists when it does not.
4. Maintain a manual erasure route even when billing or eligibility blocks self-service. Separately justify restricted retained financial/trial records and explain provider documents and device-local storage.
5. Exercise the breach procedure with synthetic evidence; do not send real incident notifications as a test.

## 11. Release and rollback drill

1. Record Git SHA, Netlify production deployment ID, Edge versions, full imported source/import map and `verify_jwt` values, migrations and confirmed restore point before release.
2. Verify Netlify's last-known-good deployment and publish/rollback procedure. Vercel is currently a test host.
3. Revert an individual launch-fix commit with `git revert FIX_SHA`, then build/lint/test before publishing. Do not reset shared branch history.
4. Edge rollback requires redeploying the compatible function source closure, import map and JWT settings; Git/Netlify rollback does not roll back Supabase functions or secrets.
5. Do not run down SQL, production restores or migration-history repair without backup evidence, compatibility checks and explicit approval.

This document is operational guidance, not proof the settings are active or legal/tax advice. Keep a dated evidence record for each completed manual check.

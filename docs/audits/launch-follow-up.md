# Launch follow-up — 5 November 2026

Scope: approved follow-up to the 24-check launch audit. Tax registration/settings are excluded by the owner. This is evidence of code review and simulated verification, not a production-readiness or legal certification. No schema changes, migration-history repairs or customer payment/deletion tests were made.

## Findings and disposition

| # | Status | Evidence / disposition |
|---|---|---|
| 1 | PASS | Secret scan: server configuration in `supabase/functions/_shared/env.ts`; browser configuration uses publishable credentials only. No secret found. |
| 2 | PASS | Live audit: all 17 public tables had RLS; service-only grants and owner checks reviewed against `supabase/migrations/`. No policy changes. |
| 3 | FIXED / MANUAL | `web/lib/profileRefresh.ts`, `web/lib/dashboard.tsx`, `web/app/app/settings/page.tsx`: protect confirmed saves and OAuth onboarding from stale concurrent reads. Provider-managed Auth retained. Password/dashboard controls remain manual. |
| 4 | FIXED / MANUAL | `supabase/functions/billing/index.ts`, `_shared/rateLimit.ts`: fail-closed billing buckets before Stripe calls. Auth provider limits/CAPTCHA remain manual. |
| 5 | PASS | Runtime request validation in `supabase/functions/drips/index.ts`, `billing/index.ts` and shared planners. Prices and entitlement rules remain server-controlled. |
| 6 | N/A | No separate administrative UI/API requiring a new role mechanism found. Service credentials stay server-side. |
| 7 | PASS | `supabase/functions/stripe-webhook/index.ts`, `_shared/http.ts`: signature verification against bounded, unmodified raw text; no JSON reserialization before verification. |
| 8 | N/A | File import is local parsing; no public executable upload/storage endpoint found. Existing limits retained. |
| 9 | FIXED | `web/eslint.config.mjs`, `web/package.json`, lockfile, root `deno.json`, `.github/workflows/ci.yml`: noninteractive lint and narrowly permitted test source reads. No production framework upgrade. Dependency audit clean at verification. |
| 10 | FIXED / MANUAL | `web/netlify.toml`, `web/vercel.json`, `_shared/http.ts`: hosting header parity, API no-store/nosniff. Script CSP is Report-Only pending actual Picker/Office and inline-script compatibility validation. Office framing preserved. |
| 11 | PASS / MANUAL | `web/components/legal/Privacy.tsx`: notice, data/processors/contact and deletion/diagnostic disclosures. DPAs, transfer evidence and legal review remain operational tasks. |
| 12 | MANUAL | No optional tracker found in application source. Inspect effective hosting injections and consent behavior before enabling any tracking; no blanket GDPR claim. |
| 13 | PASS | `web/components/legal/Terms.tsx`, signup/terms flow and version checks retained. Tax behavior unchanged. |
| 14 | FIXED / MANUAL | `_shared/accountDeletion.ts`, `drips/index.ts`, settings, `web/lib/deletedAccountStorage.ts`: explicit cancellation consent, live subscription checks, owned checkout closure and guarded mutex renewal before deletion. Privacy updated. Isolated provider tests remain manual. |
| 15 | PASS / MANUAL | Existing browser accessibility and form-navigation checks pass; actual Stripe/SCA screen-reader and device checks still required. |
| 16 | SKIPPED | Tax registration and checkout tax settings excluded by explicit owner instruction. |
| 17 | MANUAL | Mock billing tests do not establish successful live/sandbox card, decline, SCA, asynchronous payment or refund evidence. Use an isolated sandbox. |
| 18 | FIXED / MANUAL | `_shared/billingSync.ts`, `_shared/billingReconcile.ts`, `stripe-webhook/index.ts`, `drip-tick/index.ts`: invoice recovery and bounded stale-projection reconciliation against current Stripe state. Existing grace/grandfathered sessions retained. Retry/dunning/risk policy remains owner-controlled. |
| 19 | FIXED / MANUAL | `_shared/http.ts`: streaming byte/chunk limits before parsing, preserving optional-body behavior and raw signatures. Billing buckets bound expensive requests. Provider spending alerts/caps remain manual. |
| 20 | MANUAL | Backup entitlement, retention and isolated restore evidence cannot be established from source. No production restore attempted. |
| 21 | FIXED / MANUAL | `_shared/diagnostics.ts`, `_shared/http.ts`, `web/lib/diagnostics.ts`, `web/components/ErrorReporting.tsx`, `web/app/error.tsx`: correlated redacted diagnostics to existing Supabase logs. Signed-in client delivery is best-effort; no anonymous/offline delivery guarantee or external alert configuration. |
| 22 | PASS / MANUAL | `drip-tick/index.ts` public health route retained. External monitor/alert delivery must be configured and exercised separately. |
| 23 | MANUAL | `_shared/notify.ts` and environment configuration are not proof of DNS authentication/custom SMTP delivery. Follow the manual checklist. |
| 24 | FIXED / MANUAL | This report and `launch-manual-checks.md` document rollback and operations. Migration-history mismatch is documented, not repaired. Provider rollback/restore drill still required. |

## Automated evidence

Each retained code fix passed production build, web lint/typecheck, Deno check/lint/format, backend tests and full mock-backed browser tests. Latest code verification: **258 backend tests and 145 browser tests passed**. Four pre-existing React hook dependency warnings remain; no existing assertion was weakened or skipped. New regression coverage includes `supabase/tests/profile_refresh_test.ts`, request bounds, billing limits/synchronization/reconciliation, account-deletion and diagnostics tests; browser coverage includes `web/e2e/profile-refresh.spec.ts`, onboarding, settings, deletion and diagnostics.

The original mock that allowed active Pro deletion without cancellation consent was corrected to encode the bug fix; existing browser assertions remain. The initial verification-tooling/dashboard bootstrap exception was explicitly approved. Separate `launch-fix #N` commits retain review/revert boundaries; later profile fixes depend on the initial guard.

## Release and rollback

Baseline Git revision: `89b0f52d3d089cfcda70b0bae709f06c9a331ea6`. Before release record the final SHA, Netlify deploy ID, exact Edge imported source/import map, JWT flags, migration list and verified backup reference. Pre-release live Edge versions were billing 30, drips 51, drip-tick 42, stripe-webhook 27, google-oauth-start 25, google-oauth-callback 26. JWT verification stays enabled for billing/drips/oauth-start and disabled for the authenticated-by-other-means tick/webhook/oauth-callback.

For one code fix, review dependencies then `git revert FIX_SHA`; build, lint, typecheck and run all suites before publishing. Revert dependent profile commits in reverse order if rolling that group back. Do not reset shared history. Netlify's previous deployment can restore static assets; Vercel is the test host. Edge rollback needs the matching complete source closure and import map redeployed with unchanged JWT flags. Git/hosting rollback does not revert Edge code, secrets, billing actions or stored data. Preserve exact pre-release Edge sources: the live OAuth imported helper revisions differed from the Git baseline.

This release adds no migrations. Never run down SQL, restore production or repair applied migration history as a routine source rollback. Intentional account deletion and payment-provider actions cannot be undone by reverting code. See the [owner-operated checklist](launch-manual-checks.md) for backup/history and provider drills.

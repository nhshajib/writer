# Day Pass and document-editing release

Implemented 22 October 2026 on `claude/blissful-goodall-sdsf09`. The ordered plan is in [feature-parity-plan.md](feature-parity-plan.md).

## Delivered plan matrix

| Feature | Free | Day Pass | Pro monthly / yearly |
|---|---|---|---|
| Price | Free | $4.99 once, no renewal | Existing subscription prices retained |
| Words per day | 250 | Unlimited | Unlimited |
| Maximum session | 60 minutes | 24 hours within remaining access | 1 week |
| Active sessions | 1 | 1 | 3 |
| Existing Google Docs | Ongoing access | Ongoing access | Ongoing access |
| Formatted paste, Natural / Steady, activity log | Included | Included | Included |
| Background Google Docs entry | Included | Included | Included |
| Writing hours / time zone | — | Included | Included |
| Queue dispatch | Standard | Bounded priority | Bounded priority |
| Advanced drafting, imports, headings, presets, paused edits | — | — | Included |
| Optional final revision pass / read-only playback | — | — | Included |

Word sessions still require the document and add-in to remain open. Google controls its own version-history grouping. Playback previews TypeWit's confirmed actions using the saved planned timeline; it neither changes the document nor recreates Google snapshots. The final pass edits only a bounded session-owned suffix and restores exact approved text and formatting. Temporary edits require approval.

## Implementation and evidence

| Area | Implementation | Regression evidence |
|---|---|---|
| Entitlements | `_shared/limits.ts`, `drips/index.ts`, profile normalization in `web/lib/dashboard.tsx` | `day_pass_test.ts`: exact expiry, Pro precedence, Free 250/60 and Day Pass 24h/one-active boundaries |
| One-time payment | `billing/index.ts`, `_shared/dayPass.ts`, `stripe-webhook/index.ts` | `day_pass_routes_test.ts`: payment mode, USD 499 cents, no subscription-only parameters or trial; payment/customer ownership; unpaid/refunded refusal |
| Reliable fulfillment | Checkout verifies the existing TypeWit webhook endpoint and preserves existing events while enabling completion/refund delivery; verified return path also fulfills idempotently | Route fixtures verify endpoint scope and event preservation; isolated SQL verifies duplicate delivery, refund-before-payment, refund replay, later purchases and account cleanup |
| Expiry / renewal | Saved `access_expires_at`, worker and Word engine guards, profile upgrade trigger | Expiry before provider access, expiry during I/O, pending recovery preservation and renewal; isolated SQL tests service-only grants and Pro upgrade |
| Writing hours | `_shared/workWindow.ts`, planner projection and engine gating | Validation, overnight ownership, selected days, skipped/repeated DST minutes, plan duration limits, bounded minute evaluation for narrow windows, and no reads outside hours |
| Fair dispatch | `claim_due_worker_drips` bounded 20-second paid preference | Isolated SQL proves older Free work is claimed first and paid work then proceeds |
| Final revisions | `_shared/drafting.ts`, opt-in approval in Google and Word flows | Unicode, independently recoverable units, rich correction spans, exact text restoration and real worker recovery after an applied response is lost |
| Playback | Owner-scoped `GET /drips/:id/playback`, Pro gate, lazy playback tab | Route tests reject other owners and Free access, return only confirmed actions; browser replay reaches exact approved text without engine writes or eager downloads |
| Billing receipts | Shared invoice panel for subscription and one-time payments | Browser test displays an active Day Pass and its $4.99 receipt with no subscription |
| Frontend / disclosure | Dashboard, Word, account, billing, four pricing choices, comparison, help, structured offers, Terms, Privacy and Responsible Use descriptions | Existing browser suite retained; new Day Pass, approval, playback, receipt and mobile accessibility scenarios |

Only existing assertions encoding the explicitly changed Free word/duration limits or the newly added fourth pricing choice were updated. Existing guide fragment identifiers are preserved. No tests were skipped, removed or weakened.

## Verification

- Backend: **214 passing** (`deno test -A supabase/tests/`), plus `deno task check` (all entrypoints, lint and format).
- Database: all four SQL fixture suites pass in isolated PostgreSQL; migration 06 re-applies successfully.
- Web: TypeScript passes; **87 browser tests pass locally**, including all existing browser scenarios and four new plan/payment/playback cases. Nine focused browser checks pass after the final planner and native-picker focus fixes.
- GitHub CI is green for runtime commit `5c1971785cf28bdedb26e15fc361d609769058d0`: **214 backend / 87 browser tests**, typecheck, lint, formatting, production build and dependency audit. [CI run](https://github.com/nhshajib/writer/actions/runs/39701307879). The following release-report commit changes documentation only.
- SEO: 16 indexing-policy cases, 12 canonical public pages, 409 internal links, private exclusions, sitemap and JSON-LD checks pass.
- No real writing session, account change, subscription, payment, provider disconnect or customer fixture was used for testing.

## Live backend

Migration `20261023000006_day_pass_and_work_windows.sql` applied through Supabase MCP. All 23 migration versions match the repo. The MCP-generated timestamp for this new migration alone was normalized to the repo's required version after application; the 22 previous migrations were untouched.

| Function | Version | verify_jwt |
|---|---:|---|
| drips | 39 | true |
| drip-tick | 32 | false |
| billing | 19 | true |
| stripe-webhook | 18 | false |
| google-oauth-start (code unchanged) | 19 | true |
| google-oauth-callback (code unchanged) | 20 | false |

Retrieved all six live bundles and compared all 87 bundled file occurrences, including import maps, byte-for-byte with the repo. No differences. JWT settings remain unchanged.

Security advisors have no new findings. Performance advisors have no new warnings; the new foreign-key/ownership index has the expected informational unused-index notice until real traffic uses it. Keep the index for ownership lookup and account cleanup. Existing intentional authenticated RPC notices and the previously reported manual leaked-password setting remain unchanged.

Post-deployment v32 worker requests returned HTTP 200, the heartbeat advanced, and no error-level records for the changed functions appeared in the inspected window (00:40:51–00:43:50 UTC). No server sessions were due, so no positive live claim was manufactured; fake worker and isolated SQL claim tests supply that evidence. The public worker health check is healthy.

The main domain is hosted on Netlify; Vercel and preview indexing safeguards are unchanged. This environment's outbound gateway refuses direct requests to typewit.com (HTTP 403), so production page delivery must be distinguished from local/CI behavior and backend deployment evidence.

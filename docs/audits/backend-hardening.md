# Backend hardening audit

Baseline: `15cccec` (main). The requested development branch was one commit
behind main and is fast-forwarded to include that SEO commit.

Before implementation, the unmodified suites passed:

- `cd supabase && deno test -A tests/`: 173 passed, 0 failed.
- `cd web && CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: 79 passed (5.6 minutes).

Live baseline: 18 applied migrations, ending in `20261023000001_premium_drafting`.
Functions: drips 35 (JWT on), drip-tick 28 (off), billing 16 (on),
stripe-webhook 15 (off), google-oauth-start 17 (on), google-oauth-callback 18 (off).
Performance advisors: none. Security: existing service-table RLS informational
notices, three intentionally authenticated SECURITY DEFINER RPC warnings, and
leaked-password protection disabled. Auth configuration will not be changed.

Work order: worker/planner regression fixes; database guards and privileges;
OAuth and billing; API and Word integration; full release verification and deployment.

No real writing sessions, customer account mutations, subscription changes or
provider disconnections are used as tests.

## Finding-by-finding

Tests use synthetic text/identities, fake provider transports and an isolated
PostgreSQL 17 database. Existing test assertions are not removed or relaxed.
The Google URL assertion changes only from the old broad field mask to the new
mask; its exact extracted-text expectation is unchanged. Word mocks now model
the active-state confirm restriction and the additional conflict counter.

| # | Change / location | Evidence |
|---|---|---|
| 1 | [supabase/functions/_shared/session.ts:480](../../supabase/functions/_shared/session.ts#L480) — Release before the next claimable tick; retain lateness shifts and write-ahead recovery. | audit_engine_test.ts: 30-minute 4/4.5/5-second character gaps; existing session fuzz and slow-Google tests |
| 2 | [supabase/functions/google-oauth-callback/index.ts:61](../../supabase/functions/google-oauth-callback/index.ts#L61) — Initiating-tab PKCE, signed state, one-time server nonce, authenticated finalization, redirect allowlist. No exchange on public GET. | audit_routes_test.ts OAuth route test; audit_database_test.sql nonce mismatch/reuse/expiry; oauth-connect.spec.ts |
| 3 | [supabase/functions/_shared/engineProtocol.ts:15](../../supabase/functions/_shared/engineProtocol.ts#L15) — Confirm only the next cursor and real confirmation fields; active-state SQL filter; no status/lease/anchor mutation; bounded event kinds/count/detail. Database trigger refuses revival. | audit_protocol_test.ts; audit_routes_test.ts actual Word API; audit_database_test.sql; all Word browser tests |
| 4 | [supabase/migrations/20261023000003_identity_billing_guards.sql:34](../../supabase/migrations/20261023000003_identity_billing_guards.sql#L34) — Lock the profile and accept only an initial age answer. Underage returns too_young, marks ineligible and stops active sessions; never directly deletes auth.users or billing. requireUser blocks ineligible use while retaining account cleanup. | audit_database_test.sql: paying confirmed account cannot be changed/deleted; initial underage result; auth.spec.ts first-login and concurrent age-confirmation cases |
| 5 | [supabase/migrations/20261023000002_session_guards.sql:76](../../supabase/migrations/20261023000002_session_guards.sql#L76) — Replace the per-update CHECK with a column-specific trigger and set-based validator; preserve null legacy metadata. | audit_database_test.sql: 10,000 comparisons to original validator, invalid execution rejected, progress does not rescan; existing drafting_database_test.sql |
| 6 | [supabase/functions/_shared/providers/google.ts:27](../../supabase/functions/_shared/providers/google.ts#L27) — Narrow text/structure field mask without changing extractText. Retain existing same-revision insertion-point cache. Project worker claim columns and reduce batch to 10. | google_provider_test.ts byte-exact extraction; formatting_test.ts cached read/write; audit_protocol_test.ts; SQL claim projection |
| 7 | [supabase/functions/drips/index.ts:868](../../supabase/functions/drips/index.ts#L868) — Test connection selects deletion metadata needed by expectedTail. | audit_routes_test.ts projects the actual checkSession query and verifies corrected drafting text; audit_protocol_test.ts |
| 8 | [supabase/functions/_shared/plan.ts:279](../../supabase/functions/_shared/plan.ts#L279) — Reject over-plan duration before pacing allocations; direct pacing has a seven-day absolute ceiling. Existing duration_over_plan message/code retained. | audit_engine_test.ts huge-duration cases for Free/Pro and direct buildPacing; existing planner tests |
| 9 | [supabase/functions/stripe-webhook/index.ts:83](../../supabase/functions/stripe-webhook/index.ts#L83) — Read current customer subscriptions instead of trusting event order; generation check prevents older reads overwriting newer reconciliation, including equal timestamps. | audit_routes_test.ts same-second deleted/updated events; stripe_test.ts subscription precedence |
| 10 | [supabase/functions/billing/index.ts:104](../../supabase/functions/billing/index.ts#L104) — Read all subscription pages; block checkout for any non-ended subscription. Summary/portal/reprice select a live entitlement ahead of canceled history. | stripe_test.ts paginated multi-subscription cases; existing billing browser flows |
| 11 | [supabase/functions/drips/index.ts:1316](../../supabase/functions/drips/index.ts#L1316) — Skip grant revocation if any other TypeWit connection still holds the Google identity; unknown identity or lookup failure conservatively skips revocation. Account deletion excludes its own soon-to-be-deleted rows. | audit_routes_test.ts actual disconnect with shared grant and encrypted fake token; no live revocation |
| 12 | [supabase/functions/_shared/rateLimit.ts:10](../../supabase/functions/_shared/rateLimit.ts#L10) — Generous buckets for all requested state-changing routes; coalesced worker kicks with trailing wake; atomic one-minute email cooldown preserves fresh in-app notices and completion email. | audit_notifications_test.ts verifies two fresh notices/one attention email, plus unchanged completion mail; rate-limit SQL guards; pause/resume browser tests |
| 13 | [supabase/functions/drip-tick/index.ts:89](../../supabase/functions/drip-tick/index.ts#L89) — Database/setup outages retain pending state for lease recovery; missing connection still asks to reconnect. | audit_routes_test.ts actual worker database outage creates no pause/update; audit_engine_test.ts store outage; existing recovery/fuzz tests |
| 14 | [supabase/functions/_shared/session.ts:42](../../supabase/functions/_shared/session.ts#L42) — Persist consecutive conflicted runs; pause with existing document_changed attention after five exhausted runs; reset on success/resume. | audit_engine_test.ts persistent conflict pause and short conflict recovery |
| 15 | [supabase/functions/_shared/session.ts:782](../../supabase/functions/_shared/session.ts#L782) — Apply uncertain-deletion proof only to the pending deleting action; permit absent plus safe new-end resync for ordinary insertions. Keep ownership guard for unfinished corrections. | audit_engine_test.ts interrupted drafting insertion absent/new end; existing drafting_session_test.ts deletion ownership/uncertainty tests |
| 16 | [supabase/functions/_shared/connections.ts:47](../../supabase/functions/_shared/connections.ts#L47) — Global atomic admission at 480 writes/minute includes edit probes and format batches; quota 429s back off without consuming outage attempts. | audit_engine_test.ts eight consecutive 429s recover; migration admission function; existing drafting quota/recovery tests |
| 17 | [web/lib/wordHost.ts:109](../../web/lib/wordHost.ts#L109) — Compare the document after the Office.js write against the exact pre-write text plus requested change. Uncertain conflict retains pending evidence; never retries a changed first write blindly. Correct atomicity comment. | word.spec.ts concurrent post-write edit test; audit_protocol_test.ts uncertain first-write recovery; existing word_test.ts |
| 18 | [supabase/functions/_shared/session.ts:306](../../supabase/functions/_shared/session.ts#L306) — Check deadline before waits, recovery and conflict retries; bound loop operations. Provider has request/deadline budget; worker store requests abort at deadline; optional revision summary has a 15-second cap. | audit_engine_test.ts expired-window zero I/O; existing slow provider/window tests; all entrypoint checks |
| 19 | [supabase/functions/_shared/housekeeping.ts:40](../../supabase/functions/_shared/housekeeping.ts#L40) — Cap new event detail in DB and Word API; clean expired OAuth challenges/quota windows alongside existing bookkeeping/read-notification retention. Keep session/log/unread-notification history under the current privacy promise (see below). | audit_protocol_test.ts event bounds; audit_database_test.sql DB detail cap; housekeeping source review |
| 20 | [supabase/migrations/20261023000002_session_guards.sql:84](../../supabase/migrations/20261023000002_session_guards.sql#L84) — Add partial next_run_at index excluding Microsoft sessions. | Isolated migration replay and rerun; SQL catalog/advisor verification |
| 21 | [README.md:663](../../README.md#L663) — Leave all 18 applied migration files unchanged; new files are 20261023000002, 000003, 000004. Document the already-applied future date. | git diff against baseline; migration list comparison |
| 22 | [supabase/migrations/20261023000004_database_hygiene.sql:97](../../supabase/migrations/20261023000004_database_hygiene.sql#L97) — Idempotent daily cron job purges completed cron run records older than seven days. | Isolated migration replay/rerun; cron job catalog check (no manual live purge) |
| 23 | [supabase/functions/stripe-webhook/index.ts:44](../../supabase/functions/stripe-webhook/index.ts#L44) — Record receipt separately from successful processing. Crashes/failures leave a retryable row; completed events deduplicate. | audit_routes_test.ts failed profile write then successful retry, followed by duplicate delivery |
| 24 | [supabase/functions/drips/index.ts:340](../../supabase/functions/drips/index.ts#L340) — Validate document titles as strings with 400 errors; return friendly provider/database messages without constraint/provider detail leakage. | All entrypoint checks; audit_routes_test.ts exchange error redaction; existing friendly-error browser tests |
| 25 | [supabase/functions/drips/index.ts:474](../../supabase/functions/drips/index.ts#L474) — Retain existing-document checks first; defer creating a new document until plan/active checks and daily quota reservation pass; release reservation on creation failure. | Existing Free/Pro creation browser tests; create/start ordering review; reserve/release SQL tests |
| 26 | [supabase/functions/_shared/replan.ts:79](../../supabase/functions/_shared/replan.ts#L79) — Check the combined confirmed-prefix and replacement schedule against the seven-day plan duration. | replan_test.ts combined-duration rejection and existing prefix/remaining-text/formatting tests |
| 27 | [supabase/functions/drip-tick/index.ts:167](../../supabase/functions/drip-tick/index.ts#L167) — Keep public uptime/tick timestamps and health status; remove configured.* details. | audit_routes_test.ts public health response has no configured field |
| 28 | [supabase/functions/google-oauth-callback/index.ts:71](../../supabase/functions/google-oauth-callback/index.ts#L71) — Require granted drive.file scope and an identified email; never upsert null identities; friendly exchange failure rather than raw 500. | audit_routes_test.ts missing scope, missing email and failed exchange all reject without storing a connection |
| 29 | [supabase/functions/drips/index.ts:980](../../supabase/functions/drips/index.ts#L980) — Account deletion rechecks all current subscriptions; unpaid, incomplete, past_due and other non-ended subscriptions block cleanup; lookup failures fail closed. | stripe_test.ts non-ended status matrix; existing account-deletion browser flow; route source review |
| 30 | [supabase/functions/_shared/providers/google.ts:284](../../supabase/functions/_shared/providers/google.ts#L284) — Reload execution cursor on conflict; map completion heading errors; require a read revision; permanent invalid execution; reject Word vertical tabs; reject split-surrogate rich spans; split style batches with revision chaining and idempotent recovery. | audit_engine_test.ts invalid execution; audit_protocol_test.ts surrogate/missing revision/batch/uncertain-write cases; formatting_test.ts; word_test.ts and Word browser suite |
| 31 | [supabase/migrations/20261023000004_database_hygiene.sql:54](../../supabase/migrations/20261023000004_database_hygiene.sql#L54) — Allowlist Vault names, owner-check test append, remove unused legacy helpers, empty search paths, positive quota/window guards, service-only privileges, cleanup indexes, current terms only, user/provider/document active uniqueness. | audit_database_test.sql privilege/input/current-terms guards; existing drafting_database_test.sql; isolated migration replay/rerun; advisors/catalog verification |
| 32 | [docs/audits/backend-hardening.md:88](../../docs/audits/backend-hardening.md#L88) — Manual dashboard action only; Auth settings are not changed. | Existing Supabase security advisor warning; owner action described below |

## Deliberate compatibility decisions

- **Retention (19):** `web/components/legal/Privacy.tsx` promises: “We keep
  your account, sessions and activity log while your account is open, so you
  can see your history.” Automatically deleting finished sessions or their
  events would break that promise and remove visible user history. Those
  records, and unread notifications, are therefore retained until user/account
  deletion. No retrospective retention change or live customer-data purge is
  made. New event payloads are bounded; expired service bookkeeping is purged.
- **Existing optimized read (6):** `insertAt` already reused a matching
  last-read revision. That safe cache is retained; formatting tests ensure a
  matching read does not cause another GET. Nested table/TOC text remains in
  the field mask to keep extraction byte-identical.
- **Recovery (15/17):** continuing from a new end remains refused while a
  transient deleting correction is unfinished. Moving that deletion could
  erase user-owned text. Ordinary interrupted insertions can use absent plus
  a safe new end. Ambiguous post-write conflicts preserve write-ahead evidence.
- **OAuth rollout (2):** current Google connections and stored sessions are
  untouched. Old in-flight consent links must be restarted from the updated
  dashboard, because they have no browser-bound challenge. Google sign-in and
  account creation use their existing Supabase Auth flow.
- **Leaked-password protection (32):** enable it manually in Supabase Dashboard
  → Auth → Passwords. [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  No Auth configuration is changed by this release.

## Second audit and fixes

A second pass reviewed the changed request boundaries, quota ownership, webhook failure paths, billing cleanup, checkout concurrency and CI execution.

| Finding | Fix | Regression evidence |
| --- | --- | --- |
| High: concurrent checkouts | [supabase/functions/billing/index.ts:91](../../supabase/functions/billing/index.ts#L91): Serialize preparation with a service-only, expiring per-account lease. Reuse an open checkout for the same price, expire old links before switching intervals, use Stripe idempotency keys, and bound Stripe work below lease expiry. No customer/subscription is changed to test this. | audit_second_pass_test.ts checkout test; checkout_database_test.sql lease contention/expiry/stale release/client privileges/account cleanup |
| Medium: webhook lookup outages | [supabase/functions/stripe-webhook/index.ts:102](../../supabase/functions/stripe-webhook/index.ts#L102): Customer/profile and trial-user lookup failures now return a retryable failure and leave the webhook receipt unprocessed. | audit_routes_test.ts: both failures retry successfully without losing Pro or trial bookkeeping |
| Medium: cancellation for an ineligible account | [supabase/functions/billing/index.ts:37](../../supabase/functions/billing/index.ts#L37): Keep billing summary and cancellation-only portal access for an account blocked by age checks. Checkout/reprice remain refused; a failed cancellation flow never falls back to an unrestricted upgrade portal. | audit_second_pass_test.ts: blocked purchase/upgrade, allowed cancellation, safe portal failure |
| Medium: delayed scheduled start | [supabase/functions/drips/index.ts:455](../../supabase/functions/drips/index.ts#L455): Validate start time before reserving words. If provider work crosses the requested start, save the session starting at approval time rather than failing after quota reservation. | audit_second_pass_test.ts: fake document creation crosses the grace period and still saves exactly one reserved session |
| Low: malformed JSON objects | [supabase/functions/_shared/http.ts:71](../../supabase/functions/_shared/http.ts#L71): Reject null, arrays and primitive JSON bodies with HTTP 400 before handlers dereference fields. Valid object shapes and responses remain unchanged. | http_test.ts object/primitive cases |
| Low: unbounded Google consent starts | [supabase/functions/google-oauth-start/index.ts:28](../../supabase/functions/google-oauth-start/index.ts#L28): Accept only GET and rate-limit nonce creation to 60 starts per account per hour. Existing CSRF/PKCE and redirect checks remain intact. | audit_routes_test.ts actual OAuth success/failure paths; shared rate-limit guards |
| CI: dynamic route-test imports | [supabase/tests/audit_routes_test.ts:7](../../supabase/tests/audit_routes_test.ts#L7): Load entrypoints through explicit import closures so the route fakes run under CI’s existing --allow-env permissions. No test assertion, permission restriction or existing test is weakened. | deno task test: full 200-test suite |
| Medium: contrast during animated text entry | [web/app/globals.css:1659](../../web/app/globals.css#L1659): GitHub’s bundled Chromium caught low-contrast text during session and mobile-header opacity fades. Keep text opaque throughout the slide, hide the inactive header title with visibility, and remove session motion when reduced motion is requested. | Existing session and mobile SEO accessibility checks; no assertions or timeouts changed |

## Release verification

- Unchanged baseline: 173 backend tests and 79 browser tests passed.
- Final backend: **200 passed** with both `cd supabase && deno test -A tests/` and CI’s restricted `deno task test`. All six entrypoints type-check; backend lint and formatting pass. `npx tsc --noEmit` passes; `npm run audit` reports zero vulnerabilities.
- Isolated SQL: the original migration chain and all four new migrations were applied; each new migration was re-applied. All three SQL regression files pass and roll back their fixtures, including the 10,000-case drafting-validator parity check.
- Browser verification: the first second-audit run passed 82/83; one scenario timed out waiting five seconds for the schedule preview, before pressing Start. The identical scenario then passed five consecutive repetitions. The unchanged-suite rerun passed 83/83. GitHub’s bundled Chromium then exposed two animation-contrast failures that system Chromium did not reproduce; the text-opacity correction above fixes those failures. The final full run after that correction passed **83/83 in 6.0 minutes**. No test was skipped, relaxed or given a longer timeout.
- GitHub CI: both backend and web jobs passed for the final runtime/frontend code in [run 39625702584](https://github.com/nhshajib/writer/actions/runs/39625702584), commit `10d9780a66d1c70728198a4819ec8a4652c427d7`. The release-report update changes documentation only.
- Supabase migrations: **22 live entries match the repository exactly**. New versions are `20261023000002` through `20261023000005`. MCP initially stamped its current clock; only those four new history rows were assigned the required file versions after application. All original 18 migration records and files were preserved.
- All six Edge Functions were deployed on **2026-10-21, 15:10–15:11 UTC**, with `supabase/functions/deno.json` and all relative dependencies. Retrieved deployed source and import-map contents match the repository exactly (83 runtime file occurrences; Supabase removes the outer `supabase/` path prefix and omits the unused root build-task config).

| Function | Before → after | verify_jwt |
| --- | --- | --- |
| drips | 35 → 36 | true |
| drip-tick | 28 → 29 | false |
| billing | 16 → 17 | true |
| stripe-webhook | 15 → 16 | false |
| google-oauth-start | 17 → 18 | true |
| google-oauth-callback | 18 → 19 | false |

- Security advisors: unchanged baseline findings only—five service-only RLS tables without client policies, three intentionally authenticated security-definer RPCs, and disabled leaked-password protection. No new security warning appeared.
- Performance advisors: seven new **INFO unused_index** findings for newly created claim, OAuth and retention indexes. There are no new performance warnings/errors. These indexes were retained for their intended workload; a tiny inactive project has not yet exercised them, so removing them to silence the advisor would discard the requested optimizations.
- Worker observation: the first three logged `drip-tick` v29 calls after deployment returned **HTTP 200**, with no error/warning runtime entries in that observation window. Heartbeat advanced through 15:11 and 15:12; the public health check at 15:14 returned `ok: true` with no configuration details.
- Live state had four completed sessions and **zero active sessions**, so live claims were correctly zero. Positive claims, insertion/recovery and store-outage behavior are demonstrated by the fake-provider route and engine tests. No real writing session, provider revocation, account change/deletion or subscription was initiated for testing.

The compatibility target is unchanged legitimate Free/Pro planning, all units
and rhythms, formatting/import/headings, scheduling, paused edits, Word,
billing, Google connections/picker, account cleanup, age/guardian/terms,
notifications and accessibility. The unchanged browser and backend suites
exercise these features; the new tests refuse races, unsafe confirmations,
CSRF/reuse, invalid input and quota/limit bypasses. Live destructive testing is
explicitly excluded; simulated tests cannot establish real Google/Office/Stripe
provider availability.

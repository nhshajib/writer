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
| 4 | [supabase/migrations/20261023000003_identity_billing_guards.sql:34](../../supabase/migrations/20261023000003_identity_billing_guards.sql#L34) — Lock the profile and accept only an initial age answer. Underage returns too_young, marks ineligible and stops active sessions; never directly deletes auth.users or billing. requireUser blocks ineligible use while retaining account cleanup. | audit_database_test.sql: paying confirmed account cannot be changed/deleted; initial underage result; existing auth.spec.ts |
| 5 | [supabase/migrations/20261023000002_session_guards.sql:75](../../supabase/migrations/20261023000002_session_guards.sql#L75) — Replace the per-update CHECK with a column-specific trigger and set-based validator; preserve null legacy metadata. | audit_database_test.sql: 10,000 comparisons to original validator, invalid execution rejected, progress does not rescan; existing drafting_database_test.sql |
| 6 | [supabase/functions/_shared/providers/google.ts:27](../../supabase/functions/_shared/providers/google.ts#L27) — Narrow text/structure field mask without changing extractText. Retain existing same-revision insertion-point cache. Project worker claim columns and reduce batch to 10. | google_provider_test.ts byte-exact extraction; formatting_test.ts cached read/write; audit_protocol_test.ts; SQL claim projection |
| 7 | [supabase/functions/drips/index.ts:865](../../supabase/functions/drips/index.ts#L865) — Test connection selects deletion metadata needed by expectedTail. | audit_routes_test.ts projects the actual checkSession query and verifies corrected drafting text; audit_protocol_test.ts |
| 8 | [supabase/functions/_shared/plan.ts:279](../../supabase/functions/_shared/plan.ts#L279) — Reject over-plan duration before pacing allocations; direct pacing has a seven-day absolute ceiling. Existing duration_over_plan message/code retained. | audit_engine_test.ts huge-duration cases for Free/Pro and direct buildPacing; existing planner tests |
| 9 | [supabase/functions/stripe-webhook/index.ts:83](../../supabase/functions/stripe-webhook/index.ts#L83) — Read current customer subscriptions instead of trusting event order; generation check prevents older reads overwriting newer reconciliation, including equal timestamps. | audit_routes_test.ts same-second deleted/updated events; stripe_test.ts subscription precedence |
| 10 | [supabase/functions/billing/index.ts:87](../../supabase/functions/billing/index.ts#L87) — Read all subscription pages; block checkout for any non-ended subscription. Summary/portal/reprice select a live entitlement ahead of canceled history. | stripe_test.ts paginated multi-subscription cases; existing billing browser flows |
| 11 | [supabase/functions/drips/index.ts:1313](../../supabase/functions/drips/index.ts#L1313) — Skip grant revocation if any other TypeWit connection still holds the Google identity; unknown identity or lookup failure conservatively skips revocation. Account deletion excludes its own soon-to-be-deleted rows. | audit_routes_test.ts actual disconnect with shared grant and encrypted fake token; no live revocation |
| 12 | [supabase/functions/_shared/rateLimit.ts:10](../../supabase/functions/_shared/rateLimit.ts#L10) — Generous buckets for all requested state-changing routes; coalesced worker kicks with trailing wake; attention notification cooldown prevents rapid re-email. | engine and existing pause/resume browser tests; rate-limit SQL guards; source review of centralized dispatch and cooldown |
| 13 | [supabase/functions/drip-tick/index.ts:89](../../supabase/functions/drip-tick/index.ts#L89) — Database/setup outages retain pending state for lease recovery; missing connection still asks to reconnect. | audit_routes_test.ts actual worker database outage creates no pause/update; audit_engine_test.ts store outage; existing recovery/fuzz tests |
| 14 | [supabase/functions/_shared/session.ts:42](../../supabase/functions/_shared/session.ts#L42) — Persist consecutive conflicted runs; pause with existing document_changed attention after five exhausted runs; reset on success/resume. | audit_engine_test.ts persistent conflict pause and short conflict recovery |
| 15 | [supabase/functions/_shared/session.ts:782](../../supabase/functions/_shared/session.ts#L782) — Apply uncertain-deletion proof only to the pending deleting action; permit absent plus safe new-end resync for ordinary insertions. Keep ownership guard for unfinished corrections. | audit_engine_test.ts interrupted drafting insertion absent/new end; existing drafting_session_test.ts deletion ownership/uncertainty tests |
| 16 | [supabase/functions/_shared/connections.ts:47](../../supabase/functions/_shared/connections.ts#L47) — Global atomic admission at 480 writes/minute includes edit probes and format batches; quota 429s back off without consuming outage attempts. | audit_engine_test.ts eight consecutive 429s recover; migration admission function; existing drafting quota/recovery tests |
| 17 | [web/lib/wordHost.ts:109](../../web/lib/wordHost.ts#L109) — Compare the document after the Office.js write against the exact pre-write text plus requested change. Uncertain conflict retains pending evidence; never retries a changed first write blindly. Correct atomicity comment. | word.spec.ts concurrent post-write edit test; audit_protocol_test.ts uncertain first-write recovery; existing word_test.ts |
| 18 | [supabase/functions/_shared/session.ts:306](../../supabase/functions/_shared/session.ts#L306) — Check deadline before waits, recovery and conflict retries; bound loop operations. Provider has request/deadline budget; worker store requests abort at deadline; optional revision summary has a 15-second cap. | audit_engine_test.ts expired-window zero I/O; existing slow provider/window tests; all entrypoint checks |
| 19 | [supabase/functions/_shared/housekeeping.ts:40](../../supabase/functions/_shared/housekeeping.ts#L40) — Cap new event detail in DB and Word API; clean expired OAuth challenges/quota windows alongside existing bookkeeping/read-notification retention. Keep session/log/unread-notification history under the current privacy promise (see below). | audit_protocol_test.ts event bounds; audit_database_test.sql DB detail cap; housekeeping source review |
| 20 | [supabase/migrations/20261023000002_session_guards.sql:83](../../supabase/migrations/20261023000002_session_guards.sql#L83) — Add partial next_run_at index excluding Microsoft sessions. | Isolated migration replay and rerun; SQL catalog/advisor verification |
| 21 | [README.md:663](../../README.md#L663) — Leave all 18 applied migration files unchanged; new files are 20261023000002, 000003, 000004. Document the already-applied future date. | git diff against baseline; migration list comparison |
| 22 | [supabase/migrations/20261023000004_database_hygiene.sql:97](../../supabase/migrations/20261023000004_database_hygiene.sql#L97) — Idempotent daily cron job purges completed cron run records older than seven days. | Isolated migration replay/rerun; cron job catalog check (no manual live purge) |
| 23 | [supabase/functions/stripe-webhook/index.ts:44](../../supabase/functions/stripe-webhook/index.ts#L44) — Record receipt separately from successful processing. Crashes/failures leave a retryable row; completed events deduplicate. | audit_routes_test.ts failed profile write then successful retry, followed by duplicate delivery |
| 24 | [supabase/functions/drips/index.ts:340](../../supabase/functions/drips/index.ts#L340) — Validate document titles as strings with 400 errors; return friendly provider/database messages without constraint/provider detail leakage. | All entrypoint checks; audit_routes_test.ts exchange error redaction; existing friendly-error browser tests |
| 25 | [supabase/functions/drips/index.ts:470](../../supabase/functions/drips/index.ts#L470) — Retain existing-document checks first; defer creating a new document until plan/active checks and daily quota reservation pass; release reservation on creation failure. | Existing Free/Pro creation browser tests; create/start ordering review; reserve/release SQL tests |
| 26 | [supabase/functions/_shared/replan.ts:79](../../supabase/functions/_shared/replan.ts#L79) — Check the combined confirmed-prefix and replacement schedule against the seven-day plan duration. | replan_test.ts combined-duration rejection and existing prefix/remaining-text/formatting tests |
| 27 | [supabase/functions/drip-tick/index.ts:167](../../supabase/functions/drip-tick/index.ts#L167) — Keep public uptime/tick timestamps and health status; remove configured.* details. | audit_routes_test.ts public health response has no configured field |
| 28 | [supabase/functions/google-oauth-callback/index.ts:71](../../supabase/functions/google-oauth-callback/index.ts#L71) — Require granted drive.file scope and an identified email; never upsert null identities; friendly exchange failure rather than raw 500. | audit_routes_test.ts missing scope, missing email and failed exchange all reject without storing a connection |
| 29 | [supabase/functions/drips/index.ts:1](../../supabase/functions/drips/index.ts#L1) — Account deletion rechecks all current subscriptions; unpaid, incomplete, past_due and other non-ended subscriptions block cleanup; lookup failures fail closed. | stripe_test.ts non-ended status matrix; existing account-deletion browser flow; route source review |
| 30 | [supabase/functions/_shared/providers/google.ts:284](../../supabase/functions/_shared/providers/google.ts#L284) — Reload execution cursor on conflict; map completion heading errors; require a read revision; permanent invalid execution; reject Word vertical tabs; reject split-surrogate rich spans; split style batches with revision chaining and idempotent recovery. | audit_engine_test.ts invalid execution; audit_protocol_test.ts surrogate/missing revision/batch/uncertain-write cases; formatting_test.ts; word_test.ts and Word browser suite |
| 31 | [supabase/migrations/20261023000004_database_hygiene.sql:54](../../supabase/migrations/20261023000004_database_hygiene.sql#L54) — Allowlist Vault names, owner-check test append, remove unused legacy helpers, empty search paths, positive quota/window guards, service-only privileges, cleanup indexes, current terms only, user/provider/document active uniqueness. | audit_database_test.sql privilege/input/current-terms guards; existing drafting_database_test.sql; isolated migration replay/rerun; advisors/catalog verification |
| 32 | [docs/audits/backend-hardening.md:1](../../docs/audits/backend-hardening.md#L1) — Manual dashboard action only; Auth settings are not changed. | Existing Supabase security advisor warning; owner action described below |

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

## Release verification

- Unchanged baseline: 173 backend tests and 79 browser tests passed.
- Final backend: 195 passed; all six entrypoints type-check; backend formatting passes.
- Isolated SQL: all migrations replayed; each new migration re-applied; both
  database regression files pass and roll back their fixtures.
- Final browser, deployment, advisor, source-comparison and tick evidence will
  be recorded after release verification finishes.

The compatibility target is unchanged legitimate Free/Pro planning, all units
and rhythms, formatting/import/headings, scheduling, paused edits, Word,
billing, Google connections/picker, account cleanup, age/guardian/terms,
notifications and accessibility. The unchanged browser and backend suites
exercise these features; the new tests refuse races, unsafe confirmations,
CSRF/reuse, invalid input and quota/limit bypasses. Live destructive testing is
explicitly excluded; simulated tests cannot establish real Google/Office/Stripe
provider availability.

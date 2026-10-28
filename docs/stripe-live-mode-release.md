# Stripe live-mode checkout recovery

Date: 28 October 2026 (America/New_York).

## Diagnosis

Supabase billing error logs reported `No such customer` for `/billing/checkout`, including the recent failed attempts. A read-only profile check established that the affected account has no ongoing subscription, so a conservative checkout-time replacement is appropriate. No customer IDs, emails or secret values are recorded in this report or fixtures.

Before edits, deployed sources for billing v24, drips v47 and stripe-webhook v22 matched the repository, including relative imports. Baseline security/performance advisors were recorded; no database changes are involved.

## Changes

- The shared Stripe client preserves structured API `code` and `param` values and identifies only a missing `customer` reference as recoverable. An outage, invalid key, missing price or unrelated 400 response cannot replace a customer.
- Checkout recovers only accounts without an ongoing subscription, within its existing lease. It verifies the price in the current Stripe environment before creating/storing a replacement customer; ongoing subscription records require operator review.
- Replacement customer creation uses a deterministic replacement-specific idempotency key so a deleted customer's cached creation response cannot be reused. Normal new-customer idempotency remains unchanged.
- Prices, currency, intervals, product activity and current published amounts are checked before migration. Day Pass retains its existing one-time price/fulfillment checks.
- Configured Checkout Studio fields are added to the existing REST call. Existing modes, URLs, metadata, trial eligibility, invoices and subscription protections are retained.
- Missing customer/price and invalid-key failures receive actionable messages without returning raw Stripe errors.

No profile, trial claim, subscription or payment was reset manually. No payment/subscription was created to test this change. Existing fulfillment, account deletion, session execution and plan access code remain intact. No database migrations or new dependencies are required.

## Verification

Before edits: backend 238 passed. The first unmodified browser baseline had one failure in the existing email-notification toggle case; the complete unchanged rerun passed all 133 tests. No existing test was changed, skipped or weakened.

New cases in `supabase/tests/stripe_live_checkout_test.ts` prove strict error classification, monthly/yearly/Day Pass recovery, trial preservation, reusable pending sessions, active/unpaid subscription protection, rejection of invalid replacement prices and retention of ownership/UI parameters.

Final backend results: **242 passed**; `deno task check` passed formatting, lint and all function entrypoint type checks. Web TypeScript and SEO checks passed. Full final browser suite: **133 passed (6.6 minutes)**. The first final attempt was interrupted by the workspace restart, leaving an orphan mock server; the clean full rerun passed without changing tests.

Deployed billing **v25** (JWT true), drips **v48** (JWT true), stripe-webhook **v23** (JWT false). Every retrieved deployed source/import file exactly matches the repository; import maps are included. Other function versions/settings are unchanged. The bounded post-deployment function-error log check returned no errors. Unauthenticated checkout was rejected (401), webhook GET rejected (405), and unsigned webhook POST rejected (400). Security/performance advisors match the baseline: no new findings. Existing leaked-password protection remains an operator Auth setting ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). No live payment was made.

Stripe live account inspection verified all three active USD prices and found no webhook endpoints or portal configuration. Created the required live webhook and default billing portal without modifying customers/subscriptions. The owner confirmed saving the new webhook signing secret securely in Supabase; connected tools do not support runtime secret reads/writes. Signed event delivery remains to be observed during ordinary use, without creating a live payment for testing.

## Operator setup

[STRIPE_INTEGRATION_TODO.md](../STRIPE_INTEGRATION_TODO.md) is the single source of truth for live key/price/webhook/portal setup and remaining verification. Stripe account access is connected and live prices/webhook/portal were inspected. Supabase runtime secret values have not been read; signing-secret setup is owner-confirmed and end-to-end signed delivery remains untested. No guessed credentials or replacement prices were written.

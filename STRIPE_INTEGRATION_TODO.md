# Stripe live-mode integration: setup and remaining checks

Updated: 31 October 2026 (America/New_York). This is the single source of truth for remaining Stripe setup steps.

## Confirmed issue and correction

Recent production requests to `/billing/checkout` failed with Stripe `No such customer`. The affected profile has no ongoing subscription. A saved customer reference from a sandbox, another Stripe environment or a deleted customer cannot be used by the current Stripe key.

The existing server integration is retained. Checkout now recovers **only** Stripe's structured `resource_missing` error for the `customer` parameter, inside the existing per-user checkout lock. Before replacing the saved customer, it verifies the selected price. It preserves trial eligibility, ownership metadata, existing plans, payment history and duplicate-subscription protections. Accounts with an ongoing subscription require operator review rather than an automatic reset. No existing customer/profile was changed manually as part of this release.

## Values to replace or verify

There are **no new production placeholder IDs, modes or return URLs** in the source. Existing server-side secrets supply the Stripe IDs. Their current contents were not read or exposed. The connected TypeWit live Stripe account was checked: all three published prices exist and are active. The owner confirmed saving the webhook signing secret; matching the remaining Supabase values still requires the secure dashboard checks below.

**Files using these settings:**
- [Existing billing endpoint](supabase/functions/billing/index.ts)
- [Existing webhook endpoint](supabase/functions/stripe-webhook/index.ts)
- [Stripe REST client](supabase/functions/_shared/stripe.ts)

Set/check these in **Supabase → Edge Functions → Secrets**, rather than putting payment secrets in the browser or Git:

| Setting | Required live value / check |
|---|---|
| `STRIPE_SECRET_KEY` | A valid live server key for the intended Stripe merchant account. Never use a publishable `pk_` key here. |
| `STRIPE_PRICE_MONTHLY` | `price_1UVYdhPb7jJgTZg4dBVX44ub`: verified active live USD $6.99/month. Confirm the Supabase value matches. |
| `STRIPE_PRICE_YEARLY` | `price_1UVYdgPb7jJgTZg4E01UIshD`: verified active live USD $60/year. Confirm the Supabase value matches. |
| `STRIPE_PRICE_DAY` | `price_1UWfvaPb7jJgTZg49QwQpl4p`: verified active live USD $3.99 one-time. The lowercase `stripe_price_day` fallback still works; prefer uppercase. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the **live** webhook endpoint listed below. Sandbox/CLI webhook secrets are different. |
| `APP_URL` | `https://typewit.com` for production. |

Test and live objects are separate. Do not edit an ID's text to make it “live”; select/create the actual live object in the correct Stripe account. Retain existing secrets securely. No extra Stripe publishable key is required by this site's hosted-checkout redirect flow.

## Configured Checkout Studio parameters

**File:** [billing/index.ts](supabase/functions/billing/index.ts).

| Parameter | Value |
|---|---|
| `ui_mode` | `hosted_page` |
| `billing_address_collection` | `required` |
| `phone_number_collection.enabled` | `false` |
| `automatic_tax.enabled` | `false` |
| `allow_promotion_codes` | `true` |
| `payment_method_collection` | `always`, subscription mode only |
| `submit_type` | `auto` |
| `name_collection.individual.enabled` | `true` |
| `saved_payment_method_options.payment_method_save` | `enabled` |
| `integration_identifier` | `hosted_mobile_app_0001` |
| `origin_context` | `web`, matching the browser-based purchase flow |
| `custom_text.submit.message` | A Markdown link: Back to TypeWit without purchasing, targeting the existing cancel URL |

This is a REST integration, with no Stripe SDK initialization to change. Production logs confirmed that the account default API version rejects `hosted_page`, which replaced `hosted` in `2026-03-25.dahlia`. Checkout creation now explicitly sends `Stripe-Version: 2026-09-30.endive`, supporting the supplied Checkout Studio fields independently of the account default. All other Stripe calls retain their existing API version, and no account-wide version upgrade was performed. Checkout uses the web origin context so Stripe shows browser-appropriate return navigation. The native back action and the explicit return link both use the existing cancel URL.

## Existing values intentionally preserved

- Monthly/yearly use `mode=subscription`; Day Pass uses `mode=payment`.
- Subscription success: `${APP_URL}/account?checkout=success` (existing account redirect).
- Day Pass success: `${APP_URL}/app/billing/?checkout=success&session_id={CHECKOUT_SESSION_ID}`.
- Cancel: `${APP_URL}/pricing?checkout=canceled`.
- Existing Price IDs are read from the secrets above; quantity stays one.
- The seven-day subscription trial remains conditional on the existing email-based eligibility check; Day Pass has no trial or renewal.
- Customer/user metadata, `client_reference_id`, subscription metadata, Day Pass payment-intent metadata and invoice creation remain in place for ownership checks and fulfillment.
- Existing idempotency, checkout serialization, reusable pending links and interval-switch handling remain intact. A pending link is reused only if it has the current web-return flow marker and cancel URL. Older links are retired on the next checkout request so users receive the corrected return controls.

The generated prompt's instruction to remove all unlisted parameters was not applied: deleting these fields would break existing fulfillment and account ownership checks. No new Checkout endpoint, payment SDK, webhook route or database schema was added.

## Live webhook and portal setup

Live webhook destination:
`https://jopggisumjlfitapkgjh.supabase.co/functions/v1/stripe-webhook`

Created the previously missing live endpoint on 28 October 2026: `we_1UVcjAPb7jJgTZg4F60Y68lF`, enabled, API version `2026-09-30.endive`. It subscribes to:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

**Owner confirmed complete:** the new endpoint signing secret was saved as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function Secrets. The value was not pasted into chat, Git or logs. The available Supabase tools cannot read/write these runtime secrets, so byte-for-byte matching was not independently checked. A naturally occurring signed event will provide end-to-end delivery confirmation; no live subscription or charge was created for testing. The endpoint can be managed [in Stripe](https://dashboard.stripe.com/webhooks/we_1UVcjAPb7jJgTZg4F60Y68lF). Do not remove other required events. The existing Day Pass check confirms its fulfillment/refund events on the existing endpoint before accepting a pass checkout. A successful redirect alone is not proof of payment or Pro activation; fulfillment still verifies Stripe's state.

Created the missing **live Customer Portal** default configuration (`bpc_1UVcixPb7jJgTZg4uM7c2FfU`): invoice history, payment-method updates, name/address updates, cancellation at period end and monthly/yearly switching with prorations and trial continuation. Day Pass is excluded from subscription switching. No existing subscription was modified. Sandbox portal configuration remains separate.

Promotion codes are enabled as requested. Existing paid Day Pass fulfillment supports verified paid sessions for the $3.99 source price. It requires a payment intent; a 100%-off/no-payment-required Day Pass is **not** supported by the existing grant model. Restrict such coupons to subscriptions rather than offering a free Day Pass that cannot activate. No new free-pass entitlement path was added.

## Tax and product presentation

Automatic tax remains disabled, as specified by the supplied Checkout configuration. Review applicable sales-tax/VAT obligations; enable Stripe Tax only after confirming the required registrations.

The existing live Day Pass price shares the Pro product, whose description mentions week-long sessions and three documents. Day Pass limits remain one day/one active document. This is a presentation mismatch in the current Stripe catalog; use a separate Day Pass product/price when updating the catalog, then update the Supabase price setting. Existing prices were not replaced or repriced in this repair.

## Accounts needing operator review

If a profile has `active`, `trialing`, `past_due`, `unpaid` or another non-ended subscription status but Stripe cannot find its customer, checkout will ask for review. Verify its old mode/account and any real subscription before changing references. Do not bulk-null customer IDs, erase trial claims, reset Pro plans or cancel subscriptions to test this fix.

Old sandbox invoices cannot be retrieved with a live key. The summary/portal now explain a missing billing account rather than showing the generic payment-provider message. A new checkout is the recovery path for eligible accounts without an ongoing subscription.

## Flow and verification

1. The existing authenticated `/billing/checkout` validates age, access and the selected plan.
2. It acquires the checkout lock, reads all current subscriptions, and recovers an eligible missing customer only after validating the selected price in the current Stripe environment.
3. It reuses a matching open checkout or creates a Stripe-hosted session with the configured UI options and existing ownership metadata.
4. The browser follows the returned URL. Verified webhook/payment-return handlers grant the appropriate access.

Use the existing Deno Stripe fakes and browser mock API for regression checks. `4242 4242 4242 4242` is a Stripe **test-mode-only** card and must not be used in live Checkout. No live customer, subscription, charge, refund or provider connection was created or modified for verification.

Validation/deployment details: [Stripe live-mode release report](docs/stripe-live-mode-release.md).

## Files added

- [Regression cases](supabase/tests/stripe_live_checkout_test.ts)
- [Release report](docs/stripe-live-mode-release.md)
- This setup checklist; no new application routes or dependencies.

## References

- [Stripe API keys and live-mode separation](https://docs.stripe.com/keys)
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create)
- [Official Stripe OpenAPI schema](https://github.com/stripe/openapi/blob/master/openapi/spec3.json)
- [Stripe support](https://support.stripe.com)
- [Stripe MCP documentation](https://docs.stripe.com/mcp)

Price update, 31 October 2026: new Day Pass checkouts require $3.99 USD. Historical $4.99 payments retain verification against their original offer marker and amount; they are not repriced. Supabase STRIPE_PRICE_DAY was updated by the owner.

Verification for this price update: 244 backend tests and 137 browser tests passed, with function formatting/lint/type checks, web TypeScript and SEO validation. Deployed billing v29 (JWT true) and stripe-webhook v27 (JWT false), with retrieved sources matching the repository. The post-deployment error query returned no new billing errors. No live customer, checkout, charge or subscription was created for testing. No schema migration was needed.

Checkout navigation update: billing v30 (JWT true) adds web-origin checkout and an explicit Back to TypeWit without purchasing link. Returning opens `/pricing?checkout=canceled`; it does not start or complete a payment. Reopen checkout from TypeWit to replace an already-open older Stripe page. Backend regression coverage includes Day Pass, monthly/yearly subscriptions, stale-link replacement and corrected-link reuse.

Navigation verification: all 245 backend tests passed, including every paid offer's return parameters, legacy-link replacement and corrected-link reuse. Function formatting/lint/type checks passed. The existing 137 browser tests passed, followed by the added phone/desktop cancellation-return test (no new checkout request on return). Billing v30's retrieved source/import files match the repository and its JWT setting remains true. No new production billing errors appeared in the bounded post-deployment log check. No live checkout or payment was created for testing.

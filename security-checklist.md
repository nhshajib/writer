# TypeWit security checklist

Before releasing:
- [ ] Run `deno task check` and `deno test -A supabase/tests/`.
- [ ] In web, run `npm ci`, `npm run audit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run seo:check`, `npm run test:e2e`.
- [ ] Run the Security audit probes workflow: harmless production boundary requests, current source/bundle secret scan and isolated trial concurrency/grant tests.
- [ ] Check Supabase security/performance advisors and compare against the recorded baseline. Never make a policy permissive merely to remove a warning.
- [ ] Enable leaked-password protection in Supabase Auth; verify signup/login/recovery/OTP throttling in the dashboard. Browser timers are not rate limits.
- [ ] Preserve verify_jwt values when deploying functions; verify raw Stripe signatures and x-tick-secret before work.
- [ ] Snapshot live source, include every relative dependency/import map, deploy only tested code and compare the retrieved deployed files.
- [ ] Verify the actual Netlify production publish; a Git push alone is not a confirmed production deploy.

For every new route:
- [ ] Resolve identity server-side with requireUser; ignore client role, isAdmin, plan, price and user_id for authorization.
- [ ] Apply owner predicates to every user-owned read/write and add an outsider-ID regression against the actual handler.
- [ ] Use bounded JSON and runtime field validation; validate before parsing/compiling expensive data. Preserve backward-compatible legitimate payloads.
- [ ] Add per-user budgets before costly/state-changing work. Fail closed for spending/planning; explicitly review safe session-recovery exceptions.
- [ ] Select Stripe Price IDs, quantity and entitlements server-side. Return URLs never prove payment.
- [ ] Serialize canonical-email trial checkout eligibility; do not silently replace a trial promise with a paid checkout.
- [ ] Keep webhook fulfillment idempotent, owner-scoped, refund-aware and retryable after a crash.
- [ ] Use parameterized query-builder/RPC input, not concatenated SQL or user-controlled filter syntax.
- [ ] Default new tables/RPCs to service-only; use RLS, explicit grants and safe search_path. Reapply grants on replaced functions.
- [ ] Add a new rerunnable migration; never edit or rename applied migrations. Record any pre-existing history discrepancy.
- [ ] Render user text through React/textContent. Clipboard/import HTML must be inert and reconstructed from allowed formatting.
- [ ] Keep file imports local; a future server-upload feature needs its own size/content/signature/storage/access validation.
- [ ] Test Word, Google Picker/OAuth and mobile flows before enforcing a stricter script/frame CSP.
- [ ] Commit only example env files. Public Supabase publishable keys are expected; service-role keys, signing secrets and OAuth credentials stay server-side.
- [ ] Scan history and built bundles for secrets; rotate any real leak rather than merely deleting it from current source.
- [ ] Do not add AI/model execution, arbitrary URL fetching or external tool calls without a fresh prompt-injection/SSRF/data-boundary review.
- [ ] Use synthetic fixtures; never test destructive requests, real purchases or writing sessions against customer data.

Manual security follow-up:
1. Supabase Auth: enable leaked-password protection and review real rate-limit settings.
2. Stripe: if running promotions, review expiry, redemption limits and customer restrictions. No referral engine exists.
3. Stage and validate a stricter CSP with the real Google Picker and Microsoft Office hosts before enabling script enforcement.
4. Arrange a controlled two-test-account authenticated live assessment if broader penetration-test assurance is required.

Audit details and local-only proofs: [23 November audit](docs/audits/security-2026-11-23.md).

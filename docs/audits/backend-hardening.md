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

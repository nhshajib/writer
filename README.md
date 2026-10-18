# Writer

Users paste text, pick a document and a duration, and Writer adds the text to
that document in even chunks over the chosen time. Writing happens on the
server, so it keeps going after the browser is closed. Drips can be paused,
resumed and canceled.

This repo currently holds the **backend** (Supabase). The frontend comes next.

- Google Docs: supported (needs Google OAuth credentials, see below)
- Microsoft Word Online: planned, behind the same provider interface
- `test` provider: writes into a database table so the whole pipeline can be
  exercised without Google

## Frontend (`web/`)

A Next.js 15 app (React 19, TypeScript) in `web/`, designed for keyboard and screen-reader use: skip link,
visible focus, 44px+ targets, dark mode, reduced motion. The built pages pass axe (WCAG 2.1 AA) in light and dark mode.

| Route | What it does |
|---|---|
| `/`, `/pricing`, `/responsible-use` | Public pages (pricing starts Stripe checkout) |
| `/signup`, `/login` | Account creation (personal email only, agreement required) and sign-in |
| `/app` | Dashboard: agreement check, connect Google, list of sessions with progress |
| `/app/sessions/[id]` | Live progress, countdown, text entered so far, pause / resume / stop, activity log (CSV export) |
| `/account` | Plan, billing portal, email notifications, change password |

```bash
cd web
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm install
npm run dev
```

**Not built yet:** the screen for starting a new session (choose the document, enter text, approve it with
the checkbox, pick step size and timing). It has to call `POST /drips` as described in "Approval, insertion units
and timing" below; the backend, dashboard and session view are ready for it.

## Launch checklist

1. **Stripe:** create a Pro product with a $15 monthly and a $108 yearly price. Add Edge Function secrets
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`. Create a webhook to
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` for `customer.subscription.created`,
   `.updated` and `.deleted`, and add its signing secret as `STRIPE_WEBHOOK_SECRET`. Enable the Customer Portal.
2. **Deploy `web/` to Vercel** (root directory `web`, env vars from `web/.env.example`).
3. **Supabase secrets:** `APP_URL` = the deployed site, `TOKEN_ENCRYPTION_KEY`, `ENABLE_TEST_PROVIDER=false`;
   optionally `RESEND_API_KEY` and `EMAIL_FROM` for email.
4. **Supabase Auth:** add the site to Authentication → URL Configuration; turn on leaked-password protection;
   keep the "Before User Created" hook on `public.hook_before_user_created`.
5. **Google:** add the site origin to the OAuth client and publish the consent screen for real users.
6. Test Stripe in test mode end to end (trial starts, plan becomes Pro, second trial refused, cancel returns to Free).

## How it works

```
client ──JWT──▶ drips (Edge Function) ──▶ drips table (chunks, schedule)
                                                  ▲
pg_cron (every minute) ──x-tick-secret──▶ drip-tick ──▶ Google Docs API
                                         claims due drips,   (insertText at end)
                                         writes next chunk
```

- **Pacing:** the text is split into `min(words, minutes)` chunks of near-equal
  word counts, spaced evenly across the duration (minimum 60 s apart, since the
  worker runs once a minute). Chunks keep all whitespace, so the document ends
  up byte-for-byte identical to the input.
- **Worker:** `claim_due_drips` locks due rows with `FOR UPDATE SKIP LOCKED` and
  leases them for 5 minutes, so overlapping ticks never write the same chunk
  and a crashed tick is retried.
- **Errors:** rate limits / 5xx retry with backoff (1, 2, 4, 8 min), then fail.
  A revoked Google grant fails the drip with a "reconnect" message.
- **Security:** RLS on every table; clients can only read their own rows.
  OAuth tokens are AES-GCM encrypted and their columns are not readable by
  clients. All writes go through the Edge Functions.

## Layout

```
supabase/
  migrations/            schema, RLS, RPCs, cron job
  functions/
    drips/               user API
    drip-tick/           worker (cron)
    google-oauth-start/  returns the Google consent URL
    google-oauth-callback/ stores the Google tokens
    _shared/             chunking, scheduling, limits, crypto, providers
  tests/                 unit tests (deno test)
```

## Development

Requires [Deno](https://deno.com) 2.x.

```bash
deno task test    # unit tests
deno task check   # typecheck + lint + format check
```

## Setup (already done on the `Writer` project)

1. Apply `supabase/migrations/*` in order.
2. Create the Vault secrets used by the cron job and functions (SQL editor):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'tick_secret');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'token_encryption_key');
   ```
3. Deploy the four functions (`supabase functions deploy`); `config.toml`
   sets `verify_jwt` for each.

Edge Function secrets (Dashboard → Edge Functions → Secrets):

| Secret | Required | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google | OAuth client |
| `APP_URL` | for the frontend | origin allowed as OAuth `redirect_to` |
| `TOKEN_ENCRYPTION_KEY` | recommended | token encryption key; falls back to Vault `token_encryption_key`. Keeping it out of the database means a database leak alone doesn't expose tokens. Set it **before** any Google account is connected, or existing tokens can't be decrypted. |
| `TICK_SECRET` | optional | overrides Vault `tick_secret` (must match what cron sends) |
| `GOOGLE_REDIRECT_URI` | optional | defaults to `<SUPABASE_URL>/functions/v1/google-oauth-callback` |
| `ENABLE_TEST_PROVIDER` | optional | set to `false` in production to disable the `test` provider |
| `RESEND_API_KEY` | for email | from [resend.com](https://resend.com); without it, notifications are in-app only |
| `EMAIL_FROM` | for email | sender, e.g. `Writer <noreply@yourdomain.com>` (needs a verified domain in Resend). Defaults to Resend's test sender, which only delivers to your own Resend account email. |

## Connecting Google (to do)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project
   and enable the **Google Docs API**.
2. Configure the OAuth consent screen. Add the scopes `openid`, `email` and
   `https://www.googleapis.com/auth/drive.file`. `drive.file` only covers files
   Writer creates or the user picks, so it needs no restricted-scope review.
3. Create an **OAuth client ID** (Web application). Authorized redirect URI:
   `https://jopggisumjlfitapkgjh.supabase.co/functions/v1/google-oauth-callback`
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Edge Function secrets.
5. While the app is in "Testing" mode, add your Google account as a test user.

Writing into an **existing** doc with `drive.file` requires the user to pick it
with Google Picker in the frontend; until then, use `new_document_title`.

## API

Base URL: `https://jopggisumjlfitapkgjh.supabase.co/functions/v1`. Every call
needs `Authorization: Bearer <user access token>` and `apikey: <publishable key>`.

| Method & path | Body | Result |
|---|---|---|
| `GET /google-oauth-start?redirect_to=<url>` | | `{ url }`: send the user there |
| `GET /drips/connections` | | `{ connections: [...] }` |
| `POST /drips/connections/test` | | `{ connection }` (test provider) |
| `POST /drips/documents` | `{ connection_id, title }` | `{ document: { id, title, url } }` |
| `POST /drips` | `{ connection_id, text, duration_minutes, document_id \| new_document_title }` | `201 { drip }` |
| `GET /drips` | | `{ drips: [...] }`, each with `progress` |
| `GET /drips/:id` | | `{ drip, events }`; `drip.progress` includes `written_text` |
| `POST /drips/:id/pause` · `/resume` · `/cancel` | | `{ drip }` |

Errors are `{ "error": "message" }` with 400/401/404/409/422/503.

Example:

```bash
curl -X POST "$BASE/drips" \
  -H "Authorization: Bearer $JWT" -H "apikey: $PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"connection_id":"…","new_document_title":"My essay","text":"…","duration_minutes":30}'
```

Clients can also read their own `drips`, `drip_events`, `profiles` and
`provider_connections` (token columns excluded) directly with supabase-js, e.g.
to show live progress via Realtime.

## Live progress, preview and notifications

Everything a status page needs is already served; the UI itself belongs to the frontend.

**Progress and preview.** `GET /drips/:id` returns `drip.progress`:

```json
{
  "percent": 33, "words_written": 6, "words_total": 18,
  "chunks_written": 1, "chunks_total": 3,
  "next_chunk_at": "2026-10-17T03:11:00Z", "seconds_until_next_chunk": 34,
  "finish_at": "2026-10-17T03:12:00Z",
  "written_text": "One two three four five six. "
}
```

`next_chunk_at` and `finish_at` are `null` when the drip is paused or finished.
Drive the countdown from `next_chunk_at` on the client clock instead of polling.
`GET /drips` returns the same `progress` without `written_text`.

**Live updates.** `drip_events` and `notifications` are in the Realtime
publication, and Row Level Security means each user only receives their own rows.
Every `chunk_written` event carries `{ written, total, next_run_at }`; refetch the
drip on each event to get the new `written_text`:

```ts
supabase.channel(`drip-${id}`)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'drip_events', filter: `drip_id=eq.${id}` },
      () => refetchDrip())
  .subscribe()
```

**Notifications.** When a drip completes or fails, the worker adds a row to
`notifications` (one per drip and outcome) and, if `RESEND_API_KEY` is set and the
user hasn't opted out, emails them. Clients can read their own notifications, mark
them read (`update notifications set read_at = now()`), and switch email off with
`update profiles set email_notifications = false`. Nothing else in those tables is
writable from the client.

## Approval, insertion units and timing

`POST /drips` only accepts text the user has approved. The client shows the exact
text, the user ticks a checkbox, and the client sends:

```json
"approval": { "confirmed": true, "text_sha256": "<hex SHA-256 of the exact text>" }
```

If the hash doesn't match the text (for example, the text was edited after
approval), the server returns 409 and asks for a new approval. The approval, the
hash and the time are stored on the drip and written to the activity log as an
`approved` event.

Other options on `POST /drips`:

| Field | Values | Meaning |
|---|---|---|
| `insertion_unit` | `chunk` (default), `sentence`, `paragraph` | What the text is split on. Each step adds whole units; units are only grouped when there are more units than minutes. |
| `mode` | `scheduled` (default), `as_soon_as_possible` | `scheduled` spreads the steps over `duration_minutes`. `as_soon_as_possible` writes the whole text on the next worker run (within about a minute). |

Writer writes only into the Google Doc, in these steps. It doesn't type
character by character or word by word into the document, and every insertion is
logged and labelled as automated.

### Plan limits (`_shared/limits.ts`)

| | Free | Pro |
|---|---|---|
| Words per day | 250 | unlimited |
| Longest drip | 1 hour | 1 week |
| Active drips | 1 | 3 |

Plans are set in `profiles.plan`. Billing is not wired up yet.

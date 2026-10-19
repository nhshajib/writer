# TypeWit

Users paste and approve text, pick a document and a duration, and TypeWit
enters the text into that Google Doc step by step (one sentence at a time by
default) at varied, pre-planned times, finishing at the end of the duration.
Each step is a real Docs API edit made at its scheduled time. Writing happens on
the server, so the browser can be closed and the computer can sleep. Sessions can
be paused, resumed and stopped, and every insertion is logged.

This repo holds the backend (Supabase, `supabase/`) and the frontend (Next.js, `web/`).

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
| `/app` | Overview: greeting, setup checklist, usage today, active sessions, updates (notifications) |
| `/app/sessions` | All sessions with filters, search and CSV export |
| `/app/session?id=…` | Live progress, countdown, text entered so far, pause / resume / stop, activity log (CSV export) |
| `/app/new` | Start a session (document, text, step size, timing, approval) |
| `/app/documents` | Google accounts (connect, disconnect, reconnect) and documents TypeWit wrote into |
| `/app/billing` | Plan, usage meter, start trial, Stripe billing portal |
| `/app/settings` | Profile name, notifications, password, agreement, data download, account deletion request |
| `/account` | Old address; forwards to `/app/billing` (Stripe still returns here) |
| `/privacy`, `/terms`, `/support` | Legal pages and help |

```bash
cd web
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm install
npm run dev
```

`/app/new` starts a session: choose a new Google Doc (or one from a past session), paste the text, pick sentence,
paragraph or even steps and the timing, then approve the exact text (editing it clears the approval). Legal and help
pages: `/privacy`, `/terms`, `/support` (support address in `web/lib/site.ts`).

## Launch checklist

1. **Stripe:** create a Pro product with a $15 monthly and a $108 yearly price. Add Edge Function secrets
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`. Create a webhook to
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` for `customer.subscription.created`,
   `.updated` and `.deleted`, and add its signing secret as `STRIPE_WEBHOOK_SECRET`. Enable the Customer Portal.
2. **Deploy `web/` to Netlify.** The app is a static export (`npm run build` writes `web/out`). Base directory `web`; `web/netlify.toml` sets the build command and publish directory `out`. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as environment variables.
3. **Supabase secrets:** `APP_URL` = `https://typewit.com`, `TOKEN_ENCRYPTION_KEY`, `ENABLE_TEST_PROVIDER=false`;
   optionally `RESEND_API_KEY` and `EMAIL_FROM` for email.
4. **Supabase Auth:** set Site URL to `https://typewit.com` and add it to Authentication → URL Configuration; turn on leaked-password protection;
   keep the "Before User Created" hook on `public.hook_before_user_created`.
5. **Google:** add the site origin to the OAuth client and publish the consent screen for real users.
6. **Sign in with Google:** in Supabase → Authentication → Sign In / Providers, enable Google with the same OAuth
   client ID and secret, and add `https://jopggisumjlfitapkgjh.supabase.co/auth/v1/callback` to the client's authorized
   redirect URIs in Google Cloud. The Before User Created hook still applies, so Google Workspace (business/school)
   accounts are refused. People who tick the agreement before choosing Google have it recorded on first visit to the
   dashboard; everyone else is asked there.
7. Test Stripe in test mode end to end (trial starts, plan becomes Pro, second trial refused, cancel returns to Free).

## How it works

```
client ──JWT──▶ drips (Edge Function) ──▶ drips table (chunks, schedule)
                                                  ▲
pg_cron (every minute) ──x-tick-secret──▶ drip-tick ──▶ Google Docs API
                                         claims due drips,   (insertText at end)
                                         writes next chunk
```

- **Units:** sentences (default, Unicode sentence boundaries), paragraphs,
  words, or characters (grapheme clusters, so emoji and accents stay whole).
  Units always join back to the exact text. Text containing characters Google
  Docs would drop (control characters incl. `\r`, private-use characters, lone
  surrogates) is refused with an explanation instead of being altered.
- **Schedule** (`_shared/schedule.ts`): built once, before the session starts,
  and stored on the drip as millisecond offsets. The wait before each unit is
  proportional to its length (clamped to 3× the median) times a random factor
  in ±35 %, with at least 4 s between insertions; the last insertion lands
  exactly at the end of the duration. The seed the user previewed is the seed
  that runs. `POST /drips/plan` explains impossible combinations (e.g. 2,000
  characters can't fit in 5 minutes) before anything starts.
- **Worker** (`_shared/session.ts`): pg_cron ticks each minute; a tick claims
  sessions due within the next minute and waits for each insertion's exact time.
  Before each insertion it checks the document still ends with TypeWit's text,
  records a write-ahead marker, and inserts with `requiredRevisionId`, so a
  concurrent edit makes Google refuse the write instead of interleaving. If the
  worker dies mid-write, the next run decides from the document whether the
  unit landed, so nothing is duplicated or skipped.
- **Falling behind:** after an outage or retries the rest of the schedule
  shifts later (logged as `schedule_shifted`); text is never dumped to catch up.
  Pause/resume shifts the rest by exactly the pause length.
- **Attention pauses:** text added after TypeWit's text, an ambiguous
  interrupted write, a revoked Google grant, a deleted document, or a long
  outage pause the session with a reason (`attention`) and a notification. The
  user resumes once fixed, confirms whether a part landed, or chooses to
  continue after the document's current end. Edits elsewhere in the document
  don't stop the session.
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
    _shared/             units, plan, schedule, session engine, providers
  tests/                 unit tests incl. simulated sessions (deno test)
web/
  e2e/                   Playwright + axe browser tests against a mock API
```

## Development

Requires [Deno](https://deno.com) 2.x.

```bash
deno task test    # unit tests
deno task check   # typecheck + lint + format check

cd web && npm run typecheck
cd web && CHROMIUM_PATH=/path/to/chrome npm run test:e2e   # keyboard + screen reader + axe
```

## Setup (already done on Supabase project `jopggisumjlfitapkgjh`)

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
| `EMAIL_FROM` | for email | sender, e.g. `TypeWit <noreply@typewit.com>` (needs a verified domain in Resend). Defaults to Resend's test sender, which only delivers to your own Resend account email. |

## Connecting Google (to do)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project
   and enable the **Google Docs API**.
2. Configure the OAuth consent screen. Add the scopes `openid`, `email` and
   `https://www.googleapis.com/auth/drive.file`. `drive.file` only covers files
   TypeWit creates or the user picks, so it needs no restricted-scope review.
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
| `GET /drips/connections` | | `{ connections: [...] }`, each with `connected` |
| `POST /drips/connections/:id/disconnect` | | stops that account's active drips, revokes the Google grant, clears tokens; history is kept |
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
| `insertion_unit` | `sentence` (default), `paragraph`, `word`, `character`, `chunk` | One unit per insertion. `chunk` (even groups of words, about one a minute) is kept for older clients. |
| `mode` | `scheduled` (default), `as_soon_as_possible` | `scheduled` spreads the units over `duration_minutes`. `as_soon_as_possible` writes the whole text in one insertion. |
| `schedule_seed` | 32-bit integer | The seed from `POST /drips/plan`, so the session follows the previewed schedule. |

`POST /drips/:id/resume` takes optional `{ "last_part": "present" | "absent" }`
(after an interrupted insertion the document can't settle) or
`{ "continue_from_current_end": true }` (after text was added at the end).

TypeWit inserts only the approved text, in order, at planned times. It never
adds typos, corrections or backdated edits, and sessions are labelled as
automated text entry. The session log (`drip_events`) records planned and
actual times, pauses, retries and problems; it is separate from Google Docs
version history, which Google groups on its own.

### Plan limits (`_shared/limits.ts`)

| | Free | Pro |
|---|---|---|
| Words per day | 250 | unlimited |
| Longest drip | 1 hour | 1 week |
| Active drips | 1 | 3 |

Plans are set in `profiles.plan`. Billing is not wired up yet.

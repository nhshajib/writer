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
| `GET /drips` | | `{ drips: [...] }` |
| `GET /drips/:id` | | `{ drip, events }` |
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

### Plan limits (`_shared/limits.ts`)

| | Free | Pro |
|---|---|---|
| Words per day | 250 | unlimited |
| Longest drip | 1 hour | 1 week |
| Active drips | 1 | 3 |

Plans are set in `profiles.plan`. Billing is not wired up yet.

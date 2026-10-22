# TypeWit

Users paste and approve text, pick a document and a pace (a target duration or a
typing speed, with optional breaks), and TypeWit enters the text into that
Google Doc step by step (one sentence at a time by default) at varied,
pre-planned times. Each step is a real Docs API edit made at its scheduled time.
Writing happens on the server, so the browser can be closed and the computer can
sleep. Sessions can be paused, resumed and stopped, and every insertion is
logged. Optional Pro drafting simulation can temporarily add a keyboard slip or
false start, visibly remove it, and restore the approved text. Sessions stay
labelled as automated text entry; TypeWit never backdates edits.

This repo holds the backend (Supabase, `supabase/`) and the frontend (Next.js, `web/`).

- Google Docs: supported (needs Google OAuth credentials, see below)
- Microsoft Word (on the web and desktop): supported through the TypeWit add-in
  (a task pane in Word, see below)
- `test` provider: writes into a database table so the whole pipeline can be
  exercised without Google

## Frontend (`web/`)

A Next.js 15 app (React 19, TypeScript) in `web/`, designed for keyboard and screen-reader use: skip link,
visible focus, 44px+ targets, dark mode, reduced motion. The built pages pass axe (WCAG 2.1 AA) in light and dark mode.

| Route | What it does |
|---|---|
| `/`, `/pricing`, `/responsible-use` | Public pages (pricing starts Stripe checkout) |
| `/signup`, `/login` | Account creation (personal email only, agreement required, resend confirmation) and sign-in (returns to the page that asked) |
| `/reset-password` | Where the password-reset email lands: choose a new password |
| `/word` | The Microsoft Word add-in pane (see below) |
| `/app` | Overview: greeting, setup checklist, usage today, active sessions, updates (notifications) |
| `/app/sessions` | All sessions with filters, search, sort, older pages and CSV export of what's shown |
| `/app/session?id=…` | Live progress, countdown, text entered so far, pause / resume / stop, activity log (CSV export) |
| `/app/new` | Start a session (document, text, step size, timing, optional later start, approval); `?from=<id>` runs a past session again; unsent text is kept in the browser |
| `/app/documents` | Google accounts (connect, disconnect, reconnect) and documents TypeWit wrote into |
| `/app/billing` | Plan, usage meter, start trial, Stripe billing portal |
| `/app/settings` | Profile name, email choices (finished / needs attention), password (current one required) or set one for Word, email change, agreement, data download, delete account |
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

1. **Stripe:** create a Pro product with a $6.99 monthly and a $60 yearly price (keep `PRO_PRICE` in `web/lib/site.ts` in step). Add Edge Function secrets
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_DAY`. Create a webhook to
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` for `customer.subscription.created`,
   `.updated` and `.deleted`, and add its signing secret as `STRIPE_WEBHOOK_SECRET`. Enable the Customer Portal.
2. **Deploy `web/` to Netlify.** The app is a static export (`npm run build` writes `web/out`). Base directory `web`; `web/netlify.toml` sets the build command and publish directory `out`. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as environment variables.
3. **Supabase secrets:** `APP_URL` = `https://typewit.com`, `TOKEN_ENCRYPTION_KEY`;
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
8. **Google verification** (logo and the exact values to enter are in `docs/brand.md`): while the OAuth consent screen is in "Testing", only listed test users can connect and
   their refresh tokens expire after 7 days (long sessions would pause with "reconnect"). Publish it: add the app
   name, logo, `https://typewit.com/privacy/` and `/terms/`, and verify the `typewit.com` domain in Search Console.
   `drive.file` is not a sensitive scope, so no security assessment is needed.
9. **Google Picker:** enable the Picker API and set `GOOGLE_API_KEY` (see "Choosing any existing Google Doc").
10. **Email:** verify `typewit.com` in Resend and set `EMAIL_FROM`; without it Resend only delivers to its own account.
11. **Supabase Auth URLs:** add `https://typewit.com/**` to the redirect allow list, so password-reset links reach
    `/reset-password/` and confirmation links return to the page people started from.
12. **Uptime:** point a monitor (e.g. UptimeRobot) at `https://jopggisumjlfitapkgjh.supabase.co/functions/v1/drip-tick/health`;
    it returns 503 if the once-a-minute worker stops.
13. Leave `ENABLE_TEST_PROVIDER` unset in production (the test provider is off unless it is `true`).
    `CORS_EXTRA_ORIGINS` (comma-separated) allows extra sites, such as a preview deploy, to call the API.

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
- **Sentences** are split with Unicode sentence boundaries, then pieces are
  joined back where a full stop doesn't end the sentence: abbreviations
  ("Dr.", "e.g.", "Jan.", "4 p.m."), initialisms ("U.S."), decimals ("3.5"),
  list markers ("1. ") and a quote followed by lowercase (`"Go!" she said.`).
  A line break always ends a unit, so headings and list items stand alone.
- **Schedule** (`_shared/pacing.ts`): built once, before the session starts,
  and stored on the drip as millisecond offsets plus a list of breaks. The
  seed the user previewed is the seed that runs.
  - *Target duration:* each unit's share of the active time is proportional
    to its length (clamped to 3× the median) times a random factor within
    ±variation; breaks are added inside the duration, and the last insertion
    lands exactly at the end.
  - *Typing speed:* a unit of `c` characters takes `c × 12 / WPM` seconds
    (1 word = 5 characters, so 60 s ÷ (WPM × 5) per character), varied by
    ±variation; the total shown is an estimate that includes breaks.
  - *Breaks:* after a varied amount of active time (“active time between
    breaks” ± its variation), a pause between the shortest and longest break,
    optionally only after a sentence or paragraph ends.
  - At least 4 s between insertions (Google Docs allows 60 edits a minute).
    `POST /drips/plan` explains impossible combinations (e.g. 2,000
    characters can't fit in 5 minutes) and warns when a speed can't be kept.
- **Test connection** (`_shared/access.ts`): checks the Google account, that
  the document opens, that it is editable, and (for a running session) that it
  still ends with TypeWit's text. The edit check sends a `replaceAllText` for a
  random marker that can't be in the document, with `requiredRevisionId`; it
  changes nothing, and the revision before and after is compared. The worker
  runs the same check before the first insertion. Failures name the cause:
  permission missing, document not found, not editable, editor unavailable,
  connection interrupted, insertion point uncertain.
- **States:** Idle (client only), Preparing, Running, Paused, Recovering,
  Completed, Cancelled, Failed (`_shared/progress.ts`), plus the current
  activity (entering, waiting, on a break, recovering). Each insertion is
  logged as scheduled (the plan), attempted (the write-ahead marker),
  confirmed (`chunk_written`) or uncertain (`insertion_uncertain`).
- **Duplicate starts:** each press of Start carries a `request_id`; a repeated
  request returns the same session, and a unique index allows only one
  unfinished session per document.
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

`.github/workflows/ci.yml` runs all of these on every push and pull request.

### Dependency security and deployment integrity

Run `cd web && npm run audit` to check the installed dependency graph. CI runs
this after its frozen `npm ci` install. Supabase JS is pinned to 2.50.0 in the
frontend and Deno imports so both use the patched Auth 2.70.0 dependency.
The npm overrides keep PostCSS 8.5.31 and Sharp 0.35.5 on patched releases.
Mammoth's CLI-only dependency is overridden to Argparse 2.0.1,
removing the vulnerable `sprintf-js` chain. Mammoth's CLI help and real DOCX
conversion were also checked for compatibility; no advisory is suppressed.

The non-text document marker is calculated from numeric code point `0xfffc`,
so the source literal itself is ASCII and does not depend on an upload editor's
Unicode handling. Regression tests verify the exact runtime marker and resume
behavior with an existing image versus an image added after confirmed text.
Deploy the checked-out shared modules with the standard Supabase CLI, rather
than manually pasting an Edge Function and its shared files into an editor.
A Git push alone does not update a deployed Supabase function. Redeploy all
affected functions to pick up the shared Supabase SDK security update.

To repair an uploaded copy of `drips`, deploy it from the tested repository:
`supabase functions deploy drips --project-ref jopggisumjlfitapkgjh`.
This requires Supabase management access in the deploying environment; the two
`NEXT_PUBLIC_SUPABASE_*` frontend values do not grant deployment permissions.
After deployment, test resuming a session whose confirmed insertion anchor
contains an existing image. An image newly added after the confirmed text must
still pause for review. The live function copy cannot be verified from source
checks alone.

### Operations

- **Security headers** (`web/netlify.toml`): HSTS, and a Content-Security-Policy whose `frame-ancestors` allows
  only Microsoft Office to frame the site (the Word add-in pane runs in a frame in Word on the web), plus
  `base-uri`, `object-src` and `form-action` limits. Scripts are not restricted, because Office.js and Google
  Picker load further code from hosts they choose.
- **CORS:** the API answers browsers on typewit.com, `APP_URL`, localhost and `CORS_EXTRA_ORIGINS` only.
- **Clean-up:** once a day the worker deletes start-request records after 7 days, rate-limit counters after
  2 days, Stripe event ids after 90 days and read notifications after 90 days. Sessions and their logs stay until
  people delete them (or their account).
- **Stripe webhook:** an event whose processing fails is forgotten so Stripe's retry is processed; an event older
  than the last one applied doesn't change the plan.

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

### Choosing any existing Google Doc (Google Picker)

`drive.file` only reaches files TypeWit created or the user picked. "Choose from
Google Drive…" on `/app/new` opens Google Picker with a short-lived access token
from `POST /drips/connections/:id/picker` and `setAppId(<project number>)`;
picking a document grants TypeWit access to that one file. Setup:

1. In project 654277390095, enable the **Google Picker API**.
2. Create a **browser API key** restricted to the Picker API and to
   `https://typewit.com/*`.
3. Add it as the Edge Function secret `GOOGLE_API_KEY`. The project number is
   taken from the OAuth client ID; set `GOOGLE_PROJECT_NUMBER` only if that
   differs.

## Microsoft Word add-in

Word's file APIs can't safely append to a document someone has open, so Word
sessions run inside Word itself: a task-pane add-in (`/word/`, manifest at
`web/public/word/manifest.xml`) edits the open document through Word's
JavaScript API and runs the same session engine as the Google worker
(`_shared/session.ts` with `_shared/providers/word.ts`). The server keeps the
session, its schedule and the log; the pane claims each step with
`claim_client_drip` (a lease bound to that document) through
`POST /drips/:id/engine`.

Install:

- **Word on the web:** Home → Add-ins → More add-ins → My add-ins → Upload my
  add-in → choose `manifest.xml` (downloadable from Documents → Microsoft Word).
- **Word desktop:** sideload from a shared folder, or have an admin deploy it in
  the Microsoft 365 admin center.

Permissions: `ReadWriteDocument` (only the open document). TypeWit stores no
Microsoft credentials. The user signs in to TypeWit with email and password in
the pane.

How it behaves:

- The first line continues the last paragraph; every line break starts a real
  new paragraph. Each step is checked against the document before it is
  written (a text hash acts as the revision), so text typed after TypeWit's
  pauses the session, like Google.
- The document must be saved (its URL identifies it). The same file opened in
  Word desktop and Word on the web can have different URLs.

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
| `POST /drips/plan` | `{ text, insertion_unit, pacing, schedule_seed }` | `{ plan }`: units, schedule, breaks, problems, warnings |
| `POST /drips/check` | `{ connection_id, document_id? }` | `{ report }`: Test connection, changes nothing |
| `POST /drips` | `{ connection_id, text, pacing \| duration_minutes, document_id \| new_document_title, approval, request_id, start_at? }` | `201 { drip }`; a repeated `request_id` returns the same drip; `start_at` (ISO, up to 7 days ahead) starts it later |
| `GET /drips?before=<iso>` | | `{ drips: [...], has_more }`, newest first, 100 per page, each with `progress` |
| `GET /drips/:id` | | `{ drip, events }`; `drip.progress` includes `written_text` and `remaining_text` |
| `POST /drips/:id/pause` · `/resume` · `/cancel` | | `{ drip }` |
| `POST /drips/:id/check` | | `{ report }`, including whether the insertion point is still where TypeWit left it |
| `POST /drips/:id/delete` · `POST /drips/clear` | | delete one / all finished sessions with their saved text and log |
| `POST /drips/account/delete` | `{ confirm_email }` | stops sessions, revokes Google, deletes the user and (by cascade) everything stored for them; refused while Pro is active |
| `GET /drip-tick/health` | | no auth; `{ ok, worker: { last_tick_at, seconds_since_tick }, configured: {...} }`, 503 when the worker has stopped |

Limits: per user, 30 Starts, 20 new documents, 60 connection checks and 60 Picker tokens per hour, and 600
schedule previews per hour (429 after that). The active-session limit is also enforced by a database trigger,
so Starts sent at the same moment can't exceed it.

`pacing` is `{ timing: "duration", duration_seconds }` or `{ timing: "speed", wpm }`, plus
`variation_pct` (0–50) and `breaks: { enabled, every_seconds, every_variation_pct, min_seconds, max_seconds, align: "any" | "sentence" | "paragraph" }`.

Errors are `{ "error": "message" }` with 400/401/404/409/422/429/503.

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

By default TypeWit inserts only the approved text, in order, at planned times.
Pro users can opt into simulated temporary typos and false starts, followed by
visible deletion and correction. Completed content matches the approved text;
sessions remain labelled as automated text entry and edits are never backdated.
The session log (`drip_events`) records planned and actual times, pauses, retries and problems; it is separate from Google Docs
version history, which Google groups on its own.

### Plan limits (`_shared/limits.ts`)

| | Free | Day Pass | Pro |
|---|---|---|---|
| Price | $0 | $4.99 once, no renewal | Monthly or yearly subscription |
| Words per day | 250 | unlimited | unlimited |
| Longest drip | 60 minutes | 24 hours within remaining access | 1 week |
| Active drips | 1 | 1 | 3 |
| Existing Google Docs | ongoing | ongoing | ongoing |
| Writing hours / IANA time zone | no | yes | yes |
| Typing speed and custom drafting | included rhythms | included rhythms | yes |
| Start later / saved presets | no | no | yes |
| Final revision pass / action playback | no | no | yes |
| Queue dispatch | standard | bounded priority | bounded priority |

`profiles.plan` remains the backward-compatible subscription enum. Resolve the
actual tier using `effectivePlan(profile)`, which also checks the service-only
`day_pass_expires_at` grant. Pass sessions save `access_expires_at`; expiry pauses
unfinished sessions without deleting document text. Renewals extend access and a
Pro upgrade clears the session expiry. Old sessions have no new expiry imposed.

Day Pass checkout uses Stripe payment mode with `STRIPE_PRICE_DAY` (legacy lowercase
`stripe_price_day` is also accepted). Set it to an active Stripe **Price ID** (`price_…`)
for a fixed, one-time USD $4.99 payment, not a Product ID. The server verifies the
price amount, currency, nonrecurring type and product before preparing checkout.
Keep the monthly and yearly Pro Price IDs in their existing secrets; the Day Pass
Price ID does not replace either recurring subscription price.

Before creating a payment link, billing verifies the existing TypeWit
webhook endpoint and adds payment-completion/refund events while preserving its
subscription events. A missing endpoint prevents checkout. Webhook fulfillment
and the authenticated checkout-return verification share an idempotent grant;
never treat the browser success URL as payment confirmation. No real payment is
needed for the fixture tests.

Writing hours project the plan and gate both worker and Word writes, including
overnight windows and DST. Paid dispatch uses a bounded 20-second preference,
so older Free work continues. Playback is a read-only preview of confirmed
TypeWit actions with planned timestamps, not Google's official snapshots.
The optional final pass changes only a bounded, session-owned suffix and
restores exact approved text and formatting; temporary edits require approval.

Free keeps Natural and Steady, all insertion modes, formatted paste and existing
Google Docs. Keep `web/lib/plans.ts` and `PLAN_LIMITS` in
`web/lib/dashboard.tsx` aligned with `_shared/limits.ts`.

## Pro drafting rhythm

The New Session and Word add-in pacing panels expose six remembered controls:

| Control | Range | Meaning |
|---|---|---|
| Typing speed | 20–150 WPM | Speed-mode target; one word is five characters |
| Timing variation | 0–50% | Seeded variance around each planned interval |
| Neighbor-key typo rate | 0–20% | Chance per eligible ASCII word of one QWERTY-neighbor slip |
| False-start rate | 0–20% | Chance per eligible ASCII word of a different nearby word before the approved word |
| Sentence pause | 0–30 seconds | Extra wait at each sentence/line boundary except the final one |
| Sentence-pause variation | 0–50% | Variance around that extra wait |

Typos, false starts, and sentence pauses default to zero. Preferences are
sanitized and remembered in `typewit.pace` local storage, and saved Pro presets
include them. All custom controls require Pro, with independent server checks on
both preview and Start; Free keeps its existing standard duration pace. Word
also hides these controls until the account's plan is known.

`pacing.drafting` contains `typo_rate_pct`, `false_start_rate_pct`,
`sentence_pause_seconds`, and `sentence_pause_variation_pct`. The seed and all
execution steps are persisted before starting. The source units are separate
from append/backspace/correction actions (`source_chunks`, `source_unit_ends`,
`chunk_deletions`, `action_kinds`). Temporary text does not consume daily word
quota or count as confirmed source progress. Zero rates preserve the ordinary
insertion behavior. These are API edits, not literal keyboard events, and do not
claim to represent manual authorship or guarantee version-history grouping.

Each edit remains at least four seconds apart, including visible deletion and
correction steps. This keeps the three-session Pro maximum within the per-user
write budget under normal operation. Tiny units or high simulated-error rates
can make the requested WPM impractical; the preview includes extra edits and
warns when the minimum gap limits the speed. Duration-mode pauses and corrections
fit inside the chosen duration or return a clear conflict. Outages can still
move completion later. An incorrect temporary word can therefore remain visible
for several seconds; this deliberately does not imitate subsecond keystrokes.

Before any deletion, Writer checks the revision/text fingerprint and insertion
point and proves that the suffix belongs to its current generated unit. It never deletes across
paragraph boundaries. Google and the test provider use atomic revision guards;
Office.js offers no server-side compare-and-swap, so Word rechecks its text
fingerprint immediately before a supported range deletion, as with normal Word
insertions. Concurrent real Word edits still need staging validation. A lost
response is reconciled using the durable pending edit, expected text, revision and length before retrying. If the outcome is
ambiguous, the session pauses; arbitrary "present/absent" overrides and moving
an unfinished correction to a new insertion point are refused. Completion
requires a successful final content check.

Pausing or stopping between simulated steps can leave temporary text in the
document. Pause preserves the correction for a verified resume. Stop sends no
new cleanup edits; review that temporary text manually. An already dispatched
API request can still settle. Do not enable simulation when temporary incorrect
text would be inappropriate.

Apply `supabase/migrations/20261023000001_premium_drafting.sql` before deploying
the updated `drips` and `drip-tick` functions and the static frontend. The migration
adds execution metadata and a revision-checked test-provider tail-edit RPC;
existing sessions retain their original behavior. No live database migration or
Edge Function deployment is implied by a Git push.

Drafting regression coverage lives in `supabase/tests/drafting_*_test.ts`,
`supabase/tests/drafting_database_test.sql`, and `web/e2e/drafting.spec.ts`. Run
`deno task test`, `deno task check`, and
`cd web && CHROMIUM_PATH=/path/to/chromium npm run test:e2e`. For an isolated
PostgreSQL database with migrations applied, run
`psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/drafting_database_test.sql`;
its fixtures roll back. Browser tests use a mock API and Office environment;
real Google/Word concurrency and real account permissions still need staging
smoke tests after the migration and function deployment.

## Why there is no browser extension

TypeWit writes through the Google Docs API (`documents.batchUpdate` →
`insertText` at `endOfSegmentLocation`), not through keystrokes. A website
can't control another browser tab, and synthetic key events into the Docs
editor are unreliable and can't be confirmed (the dripwriter-origin code
notes the same). The API approach needs no extension, runs on the server
(close the page, let the computer sleep), is bound to one document ID rather
than to whatever has focus, and can confirm each insertion from the document
itself. The cost: TypeWit appends at the end of the document; it doesn't
follow the user's cursor.

Reference projects: WriterDrip (MIT) and dripwriter-origin (noncommercial-only
license). Both were read for interaction ideas; no code was copied from either.
The opt-in simulated drafting implementation is independent and uses Writer's
revision-guarded document APIs, rather than browser keystrokes.

## Privacy and permissions

- **Google scopes:** `openid`, `email`, `drive.file`. `drive.file` reaches
  only documents TypeWit created or the user picked with Google Picker,
  nothing else in Drive. For Picker, the browser receives a short-lived
  (about one hour) access token; the refresh token never leaves the server.
- **Word:** the add-in reads and edits only the open document, and only while
  the pane is open. No Microsoft tokens are stored.
- **Stored in TypeWit's database (Supabase), readable only by the owner via RLS:**
  the approved text, its units and schedule, session state, and the activity
  log. The log records times, counts, revision IDs and outcomes, not the text.
- **Google tokens** are AES-GCM encrypted and never sent to the browser.
- **In the browser:** only the pace settings and the screen-reader
  announcement preference (`localStorage`).
- **Clearing:** Settings → "Delete finished sessions", or Delete on a finished
  session, removes its text, schedule, log and notifications. Unfinished
  sessions must be stopped first. Documents are never touched.

## Version history (observed, not assumed)

Each insertion is one separate `batchUpdate`, made at its scheduled time from
the user's connected account, so one sentence is one API edit. In the live
tests, every insertion produced a new document revision ID. Google decides how
those edits are grouped under File → Version history; TypeWit does not
promise one history entry per edit. TypeWit can read that history through the
Drive API, but the Drive API is **not enabled** in the current Google Cloud
project (654277390095), so the completion log records
`provider_revisions: { unavailable: … }`. The grouping has not been observed
yet. Enable the Drive API in that project to have each completion log the
revision count. Note: Google also issues a new revision ID for a
`batchUpdate` that changes nothing (Test connection's check). That is why
Test connection confirms "nothing changed" by re-reading the text, not by
comparing revision IDs.

## Validation (2026-10-19)

Automated, all passing:

| Suite | Command | Result |
|---|---|---|
| Unit + simulated-time tests (scheduler, pacing, segmentation, engine, recovery, Test connection) | `deno task test` | 101 passed |
| Typecheck, lint, format | `deno task check` | clean |
| Web typecheck and static build | `cd web && npm run typecheck && npm run build` | clean |
| Browser tests (keyboard-only flow, axe in light/dark, reduced motion, announcements, sliders with number boxes, summary, Test connection, double-click Start, delete/clear, Word add-in pane with a fake Word, Google Picker with a fake Picker, password reset, sign-in return path, Start later, Run again, drafts, settings and account deletion, sessions sort/CSV, 404 and page titles) | `cd web && CHROMIUM_PATH=… npm run test:e2e` | 30 passed |

The simulated-time tests cover:

- exact final text, Unicode and paragraphs;
- the last insertion landing exactly at the duration;
- variation bounds, no back-loading, and the WPM arithmetic;
- very short and very long texts, and impossible durations;
- pause and resume shifting by the pause length;
- cancellation;
- sleep (no worker ticks for hours, then a shifted schedule rather than a burst);
- crashes between write and confirm, and uncertain or ambiguous insertions;
- concurrent edits and refused writes;
- outages with backoff;
- preflight failures;
- a fuzz run over random interruptions;
- Word: exact paragraphs in sentence, word and character modes, read-only
  documents, typing after TypeWit's text, concurrent typing, a lost
  confirmation and document binding.

Live, against the real Google Doc "Testing" through the deployed functions:

- *Target duration 4 min, sentence mode, 2 breaks (29.5 s, 29.4 s):*
  - Test connection passed before the first insertion.
  - All 6 sentences were entered 0.3–1.3 s after their planned times, including after both breaks.
  - The last one landed 1.1 s after the planned end (start + 240 s).
  - The completion check found the document exactly equal to its prior content plus the approved text.
  - Abbreviations ("Oct.", "Dr.", "U.S.", "4 p.m."), the decimal "3.5" and `"Done!" she said.` split correctly.
- *Target duration 1 min, 2 sentences with "é" and "☕", after the Test connection fix:*
  - The preflight logged `content_unchanged: true` (the document text was re-read after the edit check).
  - Both parts were entered 0.4–0.5 s after their planned times.
  - The completion check matched exactly.
- *Earlier runs (same engine):*
  - A conditional write (`requiredRevisionId`) was accepted by Google.
  - A test-provider session paused correctly on a concurrent edit.
- *After the Word release (drips v22, drip-tick v17):* a 1-minute, 6-sentence
  session passed Test connection and completed with the document equal to its
  prior content plus the text. Steps 2–6 were 0.4–0.5 s late; step 1 waited for
  the next cron tick (the row was inserted with SQL, which skips the API's
  worker kick) and the rest of the schedule moved 30 s later instead of
  bursting.
- *After launch hardening (drips v23, drip-tick v18, stripe-webhook v9):* a 1-minute, 6-sentence session
  passed Test connection, every step landed 0.4–0.6 s after its planned time, and the completion check found the
  document equal to its prior content plus the text. `GET /drip-tick/health` answered `ok: true`; the worker
  heartbeat updates every minute and the first daily clean-up ran. The active-session trigger refused a fourth
  active session for a Pro user, and the rate limiter refused the third request on a budget of two (both in
  rolled-back transactions).
- *Word claims (SQL, rolled back):* the server worker skips Word sessions; a
  claim for another document, a second claim during a lease, and another
  user's claim are all refused.
- *Duplicate starts:* the database guards were exercised with SQL.
  - Same document → refused.
  - Same request ID → refused.
  - New session after a finished one → allowed.

Not tested live:

- The `drips` HTTP endpoints with a real user JWT. Plan, check, create, pause, resume, clear and delete were exercised against the mock API in the browser tests, and their logic is unit-tested.
- Google's version-history grouping (see above).
- A Google outage or revoked grant (simulated only).

## Known limitations

- Insertions are at least 4 s apart (Google allows 60 writes a minute per user),
  so character mode suits short texts; the planner says when a text won't fit.
- Text is appended at the end of the document, not at the cursor. Edits
  elsewhere are fine; text added after TypeWit's pauses the session.
- Timing depends on pg_cron (once a minute) plus in-worker waits; typical
  lateness observed was about 1 s. Outages or long editor delays move the rest
  of the schedule later rather than rushing.
- Google Picker needs the `GOOGLE_API_KEY` secret (see above); without it the
  picker may refuse to open.
- Word sessions run only while the document and the TypeWit pane are open.
  Browsers slow down background tabs, so in Word on the web keep the tab
  visible for on-time steps; if it falls behind, the rest of the schedule
  moves later instead of rushing. Images and other objects are not seen by
  the change check.
- The Picker and the Word add-in were tested with browser fakes of Google's and
  Microsoft's scripts, not against real Google Picker or real Word.


## Public-site SEO

Production is **Netlify at https://typewit.com**. Vercel is a test deployment and is always `noindex`, including its production alias. Netlify deploy previews and branch deployments are also excluded. Public canonicals always point to typewit.com; authentication, dashboard, legacy account and Word add-in routes stay out of the sitemap and carry noindex rules.

`web/netlify.toml` sets the production canonical URL, preview safeguards, private-route robot headers and the www-to-apex redirect. Keep `NEXT_PUBLIC_NOINDEX=true` and `NEXT_PUBLIC_ALLOW_INDEXING=false` out of the main production context unless intentionally pausing indexing. `NEXT_PUBLIC_ALLOW_INDEXING=true` never overrides test-host safeguards.

After a production-context build, run `npm run seo:check` in `web/`. The checker also supports a non-indexable build when run under the same environment as that build. See [the SEO audit and keyword plan](docs/seo-audit.md) for keyword ownership, sources, Search Console setup and release checks. No Search Console ownership or indexing submission happens automatically.

### Backend audit release

The live history includes `20261023000001_premium_drafting.sql`, although its
name is later than the environment date. It is already applied: never rename
or edit it. New migrations start at `20261023000002` and follow that ordering.
The worker switches to the projected `claim_due_worker_drips` RPC; the original
`claim_due_drips` stays available for compatibility.

Google account connection uses an initiating-tab PKCE verifier and a one-time
server challenge. The callback forwards the code in a fragment, which the app
immediately removes before authenticated finalization. Existing saved sessions
and Google connections are unchanged. Restart any old in-flight consent link
from the updated dashboard; a forwarded or reused link cannot attach a grant.

Run `cd supabase && deno test -A tests/` and `deno fmt --check` plus
`deno check functions/*/index.ts`. The SQL regression fixtures in
`supabase/tests/*_database_test.sql` run in an isolated PostgreSQL database after
migrations and roll back their fixtures. They must not run on customer data.
See [the backend audit report](docs/audits/backend-hardening.md) for release evidence.

The second audit adds `20261023000005_checkout_concurrency.sql`. Apply it before
deploying `billing`: checkout preparation now uses a service-only expiring lease,
reuses an open checkout for the same price, and retires older links when changing
billing intervals. The account's existing subscriptions still determine access.
`supabase/tests/checkout_database_test.sql` verifies lease contention, expiry,
stale releases, grants and account cleanup in an isolated database.

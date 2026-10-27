# Discord account sign-in

Date: 27 October 2026 (America/New_York).

## Change

- Shared Google/Discord sign-in buttons on Login and Join, with matching sizing, accessible names, disabled states and a Discord mark.
- `continueWithProvider` selects the Supabase OAuth provider; the existing Google wrapper and pending agreement/age storage keys remain backward compatible.
- Both methods retain same-site `safeNext` redirects, signup-before-birthday onboarding and current agreement handling. Email eligibility is still enforced by the existing server signup hook.
- Account settings label Discord correctly and retain the password-setup path used by the Word add-in. The add-in's guidance now covers both social methods; no embedded OAuth flow was introduced in Office.
- Updated signup metadata, pricing help, public FAQ, Terms and Privacy explanations, including optional Discord sign-in and the Netlify production/Vercel preview hosting distinction. Discord is for TypeWit identity, not a document provider or a Discord messaging/bot integration.
- Updated legal-page modification dates. The Responsible Use Agreement version and obligations are unchanged; adding a login method does not force existing accounts to accept the same obligations again.

No database/schema, RLS, API route, edge-function, billing, plan-limit, worker or existing session behavior changes. Supabase Auth was enabled for Discord by the owner; no Auth settings or provider secrets were changed in this release.

## Provider setup

The Discord application callback is the existing Supabase Auth endpoint:
`https://jopggisumjlfitapkgjh.supabase.co/auth/v1/callback`.
Supabase's existing redirect allowlist must allow the TypeWit destinations already used by Google. Client code requests no Discord guild, messages, contacts or bot access. Do not use Discord identity as a Google Docs authorization; connect the Google account separately.

## Verification

Six added browser cases in `web/e2e/discord-auth.spec.ts` cover:

1. Login initiates Discord OAuth with the original same-site destination.
2. Signup initiates Discord OAuth on the first click and preserves a checked agreement.
3. An external redirect target falls back to the dashboard.
4. Google and Discord remain accessible at 320px in light/dark themes; no horizontal overflow or axe violations.
5. A Discord-only account has the correct sign-in label and the password form for Word.
6. New Discord accounts still confirm age and record their pending agreement before dashboard access.

Focused suite: 6 passed. TypeScript and production build passed. SEO export checks passed for 16 indexing-policy cases, 20 public canonical pages, 597 internal links, sitemap, JSON-LD and private exclusions. Mobile Login and Join were visually inspected at 390px.

Full browser regression: **133 passed (5.9 minutes)**, including every existing test and six new Discord cases. The initial full run exposed a mock-server gap: `agree_to_terms` returned success without persisting the accepted version, so subsequent profile refreshes could display the agreement again. The mock now validates the current version and persists it like the existing database RPC. The onboarding assertion is unchanged. No pre-existing test was modified, skipped or removed.

OAuth tests intercept the external consent boundary and use synthetic account data. A real Discord consent/token exchange was not performed, and no real account or provider connection was changed. Netlify live publication is not independently verified here; pushing main makes the frontend available to the existing deployment pipeline.

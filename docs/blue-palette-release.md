# Blue palette and account-first signup

## Design

The six reference colours are shared tokens: Ice `#c0e6fd`, Sky `#80aad3`, Slate `#5b86b6`, Blue `#3f6593`, Navy `#1b3554`, Midnight `#000f22`. Pale derivatives form the light surfaces; midnight/navy form dark surfaces. Text and controls use darker or lighter members for contrast. This applies to marketing, headers, dashboard, Word pane, legal pages and account screens through the existing shared stylesheet. Provider logos and semantic error/success colours retain their meaning.

The footer now has a midnight background, an invitation to start free, a brand introduction, three navigation groups and clear legal links. Legacy mobile footer cards were removed. Mobile layouts retain safe areas and existing app navigation.

Vector marks, PNG logos, Word icons, favicon, installable app chrome and social-sharing images were regenerated. `render-brand.mjs` now also writes the ICO favicon, keeping it consistent with the source mark.

## Signup

1. Create an account with Google or email and password; retain the explicit terms agreement.
2. Email users follow the existing confirmation link when email confirmation is required.
3. After authentication, users without confirmed age see one birthday card before dashboard access. It asks only country, birth month/year, and guardian agreement where required.
4. The existing server `confirm_age` remains authoritative. Underage users are refused and signed out. Confirmed users do not repeat the questions; concurrent confirmations retain the first server answer.

No database migration, edge-function deployment, Auth configuration change or new personal-data field is needed. The database already supports accounts awaiting age confirmation and prevents their use of protected operations. Existing Google pending-answer support remains for older tabs returning from OAuth. The refusal no longer incorrectly claims all account data has already been deleted.

## Verification

Baseline: 232 backend tests and 104 browser tests passed before this redesign. Updated the four signup cases whose old assertions required age before account creation; their replacements still assert credentials, terms, guardian agreement, server age confirmation and persistent refusal. Added immediate-session signup coverage and light/dark public/dashboard/mobile accessibility checks. No unrelated existing test was weakened or removed.

Final local verification: **232 backend tests and all 107 browser tests pass**. TypeScript, static production build and SEO checks pass. Browser verification covers the new onboarding, both themes, mobile footer, existing Free/Day Pass/Pro flows, formatted text, paused editing, Google picker and Word sessions.

Visual review includes desktop signup, dark dashboard, mobile birthday card and the redesigned footer. Public Netlify deployment must be distinguished from local/static-build checks because this workspace cannot directly reach typewit.com through its outbound gateway.

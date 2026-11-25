# TypeWit sign-in refresh

The sign-in screen now presents Google, Discord and one Continue with Email button. It uses TypeWit's existing logo, Inter font and light/dark palette, with a small custom SVG document illustration. Login tabs, the split-card frame and carousel are absent from sign-in; signup and password recovery retain their established layouts.

Email is progressive disclosure into the existing email/password sign-in flow. This preserves current accounts, password visibility, confirmation resend, password reset, safe next destinations and age/terms onboarding. No Apple button is advertised because TypeWit's configured frontend supports Google and Discord. No new provider, password field, phone method, database change or auth policy is introduced.

Last-used preferences store only an enum in versioned localStorage. Successful email login writes email; social login carries a short-lived sessionStorage marker which is committed after Supabase returns a session. A failed OAuth start clears the marker. Storage failures cannot block authentication. The preference never determines authorization or plan access.

## UX details

- A single decision at the start; a small Create an account link replaces competing login/signup tabs.
- Stable provider order, with a Last used hint rather than moving buttons around.
- Flat surfaces, no gradients or heavy shadows, 48px minimum controls and iOS safe-area padding.
- The flexible stage puts choices in the middle/lower area on typical phones while allowing short screens and open keyboards to scroll.
- Email disclosure focuses its field; returning restores focus to Continue with Email and keeps typed values.
- Privacy Policy, Terms of Service, Responsible use and Help stay accessible at the bottom. Legal dialogs preserve typed input.

## Source

- web/app/(auth)/login/page.tsx — complete sign-in component and existing handlers.
- web/components/auth/SignInArtwork.tsx — custom branded SVG.
- web/components/auth/SocialSignInButtons.tsx — optional prominent variant.
- web/lib/signInPreference.ts — small, isolated preference helpers.
- web/components/auth/SignInPreferenceTracker.tsx — successful social return observer.
- web/app/globals.css — scoped sign-in styling.

## Verification

Existing auth tests retain all redirect, recovery, onboarding and policy checks. They now explicitly choose Continue with Email before filling the existing fields; the old tab assertion is replaced with assertions for the requested single-flow screen and preserved signup destination.

New browser tests cover phone/desktop light/dark layouts, accessibility, touch targets, keyboard focus, retained email input, each last-used method, failed versus successful authentication, OAuth return and blocked storage. Viewport screenshots are attached to test output for review.

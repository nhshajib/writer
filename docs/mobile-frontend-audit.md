# Mobile frontend audit and fixes

Target: an iOS-like browser/installed experience, retaining all features and plan entitlements. Tested through the local mock API, with no live customer writes or account changes. Browser emulation is not a physical-iPhone test.

## Findings and action

1. **Public navigation disappears outside Home.** A legacy mobile rule hid every public menu. Restore a 44px menu trigger on all public routes, opening the existing accessible bottom sheet with focus containment, dismissal and link navigation.
2. **Dashboard context and return paths are weak.** The compact header showed only an icon; settings/connection/billing screens lacked an explicit parent action. Add a compact section title and 44px parent link without changing the four main tabs.
3. **Account tab loses selection on Manage billing.** Match the billing subtree, preserving the Account selection while managing the subscription.
4. **Settings is a long page without its desktop section navigation.** Add a native section picker that uses the existing deep links; all settings remain accessible and saved as before.
5. **Toolbar competes with the text box on narrow phones.** Use two compact, horizontally scrollable command rows. Keep every existing formatting/import command and the existing Pro import restriction. Selection is preserved by the existing editor command handling.
6. **Touch targets and visual styles vary.** Use system typography on phones, consistent 44–48px actions/fields, grouped flat surfaces, larger account rows and consistent spacing. Small inline legal links remain inline; standalone navigation links receive larger targets.
7. **Software keyboard can crowd fixed bottom actions.** Observe VisualViewport only while editing to hide fixed app tabs/action bars when the keyboard shrinks the visible area; restore them when editing ends. No viewport zoom restriction is introduced.
8. **Sheets and legal dialogs need consistent phone treatment.** Safe-area-aware bottom sheets with scrollable content and background scroll containment, with native dialog focus restoration retained.
9. **Word instruction screen lacks a main heading.** Promote its existing instruction title to the page heading without changing the add-in workflow.
10. **Auth card and footer proportions are inconsistent.** Remove the auth card's negative horizontal margins; retain all form fields/flow. Compact the resource footer and lay its legal links across a row.

11. **Authenticated header briefly offers Sign in while loading.** Use a neutral Account label until the existing session resolves, then show Open app or Sign in. The mobile homepage test was asserting the pre-hydration guest flash despite an authenticated fixture; its single assertion now waits for the correct Open app action. No test is skipped or weakened.

## Coverage

Initial layout sweep: 22 routes at 320, 390 and 430px; no document-wide horizontal overflow. Screenshots and interaction inspection exposed the issues above, which a width check alone did not identify.

New regression coverage checks menus on multiple public pages; 25 route layouts at three widths; enlarged text; Settings picker/back navigation; Account selection on nested billing; keyboard dismissal/restoration; Free session review and accessibility. Screenshot review additionally caught intrinsic toolbar width being clipped by the card; the field now uses a zero-minimum grid track, with explicit editor-bounds assertions. Session pages reuse their existing Back breadcrumb rather than adding a duplicate. All other existing test assertions remain intact. Additional public guide articles inherit the same public shell/prose styles. Active/paused session flows, paid editing and Word are covered by the existing suite.

No backend, database schema, billing prices, entitlement logic or customer data changes are required.

## Additional verification

The isolated 320×568 check passed on Home (including its menu), sign-up, New session (including the visible bottom action), Account, Settings, Manage billing, the legacy account redirect and Responsible use. The active/paused dark-mode audit also passed three consecutive runs. New accessibility checks wait for finite theme animations to settle, matching the existing suite, and retain all contrast rules.

Final release gate: static export built successfully; all 118 browser tests passed, followed by TypeScript (`tsc --noEmit`) and SEO checks (19 canonical public pages, sitemap, private-route exclusions and JSON-LD). The Word formatting adapter check also passed. The only existing assertion changed is the authenticated homepage account action explained above; all 113 existing browser cases still run, alongside five new mobile cases. No physical-iPhone/Safari or production Netlify publication verification was performed in this environment.

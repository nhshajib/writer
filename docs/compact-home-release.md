# Compact homepage and account-card styling

## Scope

The homepage follows the reference composition at 1280×960: a 1136px-wide rounded panel, approximately 800px tall, containing the header, one hero and a compact footer. Existing TypeWit palette, logo and document/session illustration are retained. The example remains explicitly labelled and its Pause button changes only the example.

Phones use a stacked welcome layout, safe-area spacing and a disclosure menu. Short screens and larger text can scroll; content is not clipped to force a fixed height. The longer marketing footer stays on other public pages.

Sign-in and signup changes are CSS changes to form/card presentation only. Existing copy, left illustration, Google integration, credential fields, agreements, email confirmation, reset links and post-authentication age checks are retained. No fields from the reference such as phone, gender, first/last name or repeated password were introduced. No backend migration or function deployment is needed.

## Content destinations

| Former homepage content | Destination |
| --- | --- |
| Setup walkthrough and document choices | `/how-it-works/`, existing Google Docs/Word pages |
| Feature descriptions and controls | `/features/` |
| Authorized workflow examples | `/use-cases/` |
| Plan summaries | Existing `/pricing/` and its full comparison |
| Questions | `/faq/` |
| Guides | Existing `/guides/` |

Header/footer links point to these pages. Old `/#how`, `/#features`, `/#pricing` and `/#faq` URLs continue to their dedicated pages in the browser. New pages have static content, unique metadata, visible breadcrumbs, canonical URLs and sitemap entries; the homepage retains its organization/website/software structured data.

## Verification

The previous release passed 232 backend and 107 browser tests. Existing browser coverage remains, with one homepage test rewritten because the requested compact homepage intentionally replaces inline pricing/features and the old scrolling action bar. That replacement still checks Free pricing, feature availability, the example controls, mobile navigation and accessibility at their new locations.

Added checks cover the desktop frame dimensions, standalone-page navigation, old fragment links, Escape/focus behavior, mobile information pages at 320/390px, and account form accessibility/unchanged fields. Visual review covers desktop/mobile homepage and account cards. SEO checks cover all 19 public pages.

Final verification: 232 backend tests pass. Independent [CI run 39902639773](https://github.com/nhshajib/writer/actions/runs/39902639773) passes backend and web checks on runtime commit `93eb3b8`, including all 111 browser cases, dependency audit and production build. TypeScript and SEO checks pass (19 canonical public pages, 709 internal links). The new small-screen test caught a decorative orbit overflow; its geometry was corrected without hiding page overflow. Compact-footer hover contrast was also corrected and covered by an assertion. No current account or document-session feature was removed.

Follow-up verification: a later local run exposed a first-click pricing-session race. The click handler now awaits the persisted session instead of treating the initial `signedIn=false` render as a guest. The unchanged yearly/monthly checkout test and the full 111-browser suite pass locally after this correction; all 232 backend tests remain green. The follow-up CI web job was still installing Chromium when publishing, while its backend job had passed.

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

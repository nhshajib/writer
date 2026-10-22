# TypeWit SEO audit and keyword plan

Audit date: 21 October 2026. Scope: all public pages, authentication routes, signed-in routes, Word add-in, generated metadata, static export, discovery links and hosting rules. Production is Netlify at https://typewit.com; Vercel is a test version, including Vercel’s production deployment alias.

## Evidence and limits

This is a source/build audit plus public search-result research. It is not a Search Console account audit. No paid keyword planner, backlink database or real-user Core Web Vitals data was available. Search-result presence indicates an established topic, not a measured monthly search volume, ranking difficulty score or ranking guarantee. Workspace networking blocked direct requests to typewit.com; deployment status alone cannot establish that the custom domain is serving the expected headers. Validate that separately in Search Console.

## Findings, in priority order

| Priority | Finding | Resolution |
|---|---|---|
| High | Production/test separation needed verification. Netlify hosts production at typewit.com; an allow-indexing override could expose Vercel test copies. | Netlify production is indexable; every Vercel deployment and Netlify preview/branch deployment remains noindex, even with an inherited allow override. Retain the explicit global noindex switch. Test the full hosting matrix. |
| High | Homepage FAQ said the product never simulates typing; product description/schema and audience copy did not match current testing-only positioning. | Correct visible text and schema; describe automation accurately. No authorship, academic-evasion or guaranteed-history promises. |
| High | No dedicated commercial landing pages for the actual providers. | Add Google Docs and Word pages with distinct setup instructions, limitations and links to the product. |
| High | No helpful indexable guide cluster. | Add a guide hub and three original guides covering scheduling, formatted paste and version history. Each answers a distinct user task. |
| Medium | No public breadcrumb trail or BreadcrumbList markup. | Shared visible breadcrumbs and matching JSON-LD on existing public pages and all new pages. |
| Medium | Broad homepage wording and generic pricing/support titles did not clearly target page intent. | Unique titles, descriptions, canonical URLs, Open Graph and Twitter metadata; article-specific social metadata on guides. |
| Medium | Sitemap contained only six pages and used priority/changefreq, which Google ignores. | Central registry contains the 12 intended canonical public URLs, with truthful modification dates. Private/auth/add-in/legacy account routes stay out. |
| Medium | Homepage FAQ schema implied an optimization opportunity unavailable to most software sites. | Remove FAQPage schema. Keep useful visible questions; do not promise FAQ rich results. |
| Medium | Internal discovery links did not connect provider and guide topics. | Add crawlable header/footer/homepage links, guide hub and related-guide links. |
| Medium | Private HTML had noindex metadata but no hosting-header defense. | Add X-Robots-Tag headers on Netlify and Vercel for dashboard, auth, legacy account and add-in routes. Authentication and RLS remain the actual security boundary. |

## Keyword-to-page map

Priorities below are qualitative judgments based on product fit and sampled search intent. They are not keyword-difficulty measurements.

| Target | Intent / priority | Owning page | Positioning |
|---|---|---|---|
| auto typer for Google Docs and Word | Commercial, broad brand/category | `/` | Brief product overview; routes visitors to provider-specific detail. |
| Google Docs auto typer; auto typer for Google Docs | Commercial, primary | `/google-docs-auto-typer/` | Cloud execution, no Chrome extension required, existing/new documents, supported formatting. Competitive category: expect sustained content and authority work. |
| Google Docs auto typer without extension | Commercial, specific differentiator | `/google-docs-auto-typer/` | Explain server execution honestly; do not imply no Google authorization needed. |
| Microsoft Word auto typer; Word auto typer add-in | Commercial, secondary | `/word-auto-typer/` | Actual sideloaded Word add-in setup and open-panel requirement. Do not claim marketplace listing or support for arbitrary desktop apps. |
| schedule text in Google Docs; scheduled text entry Google Docs | How-to, priority long tail | `/guides/schedule-text-google-docs/` | Explain duration versus later start, Free/Pro limits, cloud behavior and pause/resume. |
| paste text into Google Docs without losing formatting | How-to, secondary long tail | `/guides/paste-text-keep-formatting-google-docs/` | Answer native Google Docs paste first; explain TypeWit when scheduled entry is needed. Do not sell ordinary paste as requiring this app. |
| Google Docs version history automated edits; why Google Docs groups edits | Informational/support | `/guides/google-docs-version-history/` | Explain Google’s grouping and separate application logs. No fabricated history or detection-evasion instruction. |
| auto typer pricing; TypeWit pricing | Transactional/branded | `/pricing/` | Free / $6.99 monthly / $60 yearly; annual charge and savings clearly disclosed. |
| TypeWit support | Navigational | `/support/` | Account connections, provider issues, billing and help contact. |

| auto typer extension; auto typer Chrome extension vs cloud; auto typer that works when laptop is closed | Commercial investigation | `/guides/auto-typer-extension-vs-cloud/` | Neutral comparison of the two approaches (keeps running, install, permissions, devices). No competitor claims. |
| auto type text in Word; auto typer for Microsoft Word; Word AutoText/Quick Parts | How-to, secondary | `/guides/auto-type-text-microsoft-word/` | Answer Word’s own snippet and Dictate features first; the add-in for paced entry. |
| voice typing Google Docs; hands-free typing Google Docs | How-to, accessibility | `/guides/voice-typing-google-docs/` | Google’s own voice typing first; TypeWit for reviewed, paced, hands-free entry. |
| free auto typer for Google Docs; Google Docs auto typer without Chrome extension; auto typer Google Slides | People-also-ask questions | `/google-docs-auto-typer/` “Questions” | Visible answers only (no FAQPage markup). Slides/Sheets answered honestly as unsupported. |

Do not make separate near-identical pages for “autotyper,” “auto typer,” “human typer” and each variant. Use natural synonyms on the owning page to avoid thin doorway pages and keyword cannibalization. Do not pursue academic cheating, detector bypass, fake authorship or “undetectable” traffic. No meta-keyword stuffing, fabricated reviews, ratings, comparison claims, search-volume numbers or author credentials.

## Research sources

Sampled live search results on the audit date showed multiple active product/category pages for auto typers, cloud sessions and formatted typing:

- [AutoTyper Google Docs product page](https://autotyper.net/auto-typer-for-google-docs): category/search-intent evidence only.
- [Duey cloud sessions](https://www.duey.ai/sessions): commercial intent around background cloud execution.
- [Duey Chrome Web Store listing](https://chromewebstore.google.com/detail/auto-typer-typing-simulat/ilamopeagajnekeaogejpdmffneankjf): category vocabulary and feature intent; not a source for TypeWit claims.
- [Google Docs version-history help](https://support.google.com/docs/answer/190843): guide reference for viewing and grouped versions.
- [Google Docs keyboard shortcuts](https://support.google.com/docs/answer/179738): native paste reference.
- [Google: noindex must be crawlable](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google: breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).
- [Google: title links](https://developers.google.com/search/docs/appearance/title-link).
- [Google: meta keywords are not used](https://developers.google.com/search/docs/crawling-indexing/special-tags).
- [Google: sitemap lastmod; priority/changefreq ignored](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping).
- [Google: FAQ rich-result eligibility changes](https://developers.google.com/search/blog/2023/08/howto-faq-changes).

## Update, 22 October 2026

Public search results for “auto typer for Google Docs” are led by vendor comparison posts, Chrome Web Store listings and vendor how-to blogs. The common angles are free tiers, “no extension”, keeps running after the browser closes, and Word support. Changes made in response:

- Three new guides (extension vs. cloud, auto typing in Word, voice typing) bring the guide cluster to six, each answering a distinct task.
- Visible “Questions” sections on the Google Docs and Word pages answer the questions above, with internal links to the owning guides. No FAQPage schema, per Google’s 2023 eligibility change.
- Titles lead with the primary phrase and stay within about 60 characters (“Google Docs Auto Typer, No Extension Needed”).
- Day Pass pricing is now stated on both provider pages and in the homepage free-plan answer, matching the pricing page and offer schema.
- Sitemap `lastmod` is per page (`PAGE_UPDATED` in `web/lib/search-content.ts`), and each guide carries its own published/updated dates in the page, Open Graph and Article markup.

Next, once Search Console data exists: compare impressions per query against this map, expand the pages already gaining impressions, and add guides only for questions people actually search. Earning genuine links (accessibility communities, productivity directories, a Product Hunt launch) will matter more for the competitive “auto typer for Google Docs” term than further on-page changes.

## Launch and measurement

1. Confirm the Netlify main site uses `NEXT_PUBLIC_SITE_URL=https://typewit.com`, `CONTEXT=production` (provided by Netlify), no `NEXT_PUBLIC_NOINDEX=true`, and no `NEXT_PUBLIC_ALLOW_INDEXING=false` in the production environment. An explicit noindex setting is intentionally respected. Vercel always stays noindex, regardless of `VERCEL_ENV` or any allow override; Netlify deploy previews and branch deploys stay noindex too.
2. Verify the custom domain, HTTPS, preferred apex/www redirect, HTTP statuses and absence of unintended public `X-Robots-Tag: noindex` headers. Keep preview domains protected from indexing.
3. The owner confirmed that the typewit.com Search Console property is already verified. After the Netlify production deploy, submit `https://typewit.com/sitemap.xml` in that property. Submission needs Search Console account access and is not completed by generating XML. Keep the existing ownership verification in place.
4. Use Search Console live URL inspection on the homepage, provider pages and guide pages. Check canonical selection and crawlability. Request indexing for important URLs, without promising Google will index them.
5. Test breadcrumbs and Article markup with Google’s Rich Results Test. Organization/SoftwareApplication markup describes the real product; no review stars are fabricated. Structured data does not guarantee a rich result.
6. Check real mobile Core Web Vitals and PageSpeed Insights once public-page access is available. No performance score is claimed from local rendering or screenshots.
7. Review impressions, query intent, CTR and conversion over successive reporting periods. First improve pages gaining relevant impressions; add new guides based on actual questions. Search Console clicks are not purchase conversions; do not invent revenue attribution.
8. Keep guide dates tied to substantive changes. Maintain truthful pricing and product limitations. Earn relevant editorial links and legitimate directory listings manually; avoid purchased ranking links and automated spam.

## Validation

Automated release checks cover the indexing policy matrix, exported HTML metadata, canonical uniqueness, public/private indexing separation, sitemap coverage, valid JSON-LD, breadcrumb agreement, internal links and responsive guide pages. Build and browser results are recorded in the release response. External account verification, Google indexing decisions, live-domain crawl diagnostics and field performance remain external checks.

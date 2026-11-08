# TypeWit brand visibility and site SEO audit

8 November 2026 · Global English-language audience across all countries · Production: https://typewit.com (Netlify). Vercel remains non-indexable test hosting.

## What the evidence shows

Public research returned established Rust `typewit` documentation for brand-related queries. [The unrelated Rust crate](https://docs.rs/typewit/) is a real name collision, not a TypeWit competitor. It is a plausible disambiguation challenge, **not a proven cause** of the app's low Google visibility. Homepage metadata previously led with the generic product category, and the compact hero did not describe TypeWit by name.

The sampled `"TypeWit" "typewit.com"` query returned no results through the available search service. That service is not an authenticated, country-specific Google rank tracker. A `site:` query is not an index count. The owner reports Search Console indexing; indexing does not guarantee serving or rank for a query. No current country-specific Google rank, penalty, search volume or organic difficulty is established by that search sample.

The initial spreadsheet link was inaccessible (Google Sheets 403). The owner subsequently supplied the Search Console XLSX export, which was analysed locally. It confirms actual Google Search impressions and clicks, with the strongest disclosed opportunity in formatted-paste queries. The raw workbook and exact analytics remain outside this public repository. No bare-brand row is disclosed; anonymized queries and aggregation differences prevent treating that absence as zero branded searches. The export is historical and is not a current URL-inspection, manual-actions or country-specific rank report.

The [public SaaSHub listing](https://www.saashub.com/typewit) is verified live: it describes TypeWit and links to typewit.com. It is no longer merely pending. Product Hunt's current publication was not established; no unverified profile is added to structured data.

The research service could not fetch the live homepage, Google Docs page, robots or sitemap. The workspace proxy also excludes typewit.com. This is a research-access limitation, **not evidence of an outage or Googlebot block**. Effective production HTTP headers, deployed build, redirects and crawlability remain unverified.

## Changes implemented

| Priority | Finding | Fix and files |
|---|---|---|
| P0 | Generic-first homepage title and weak visible brand/category connection. | Brand-first HTML/Open Graph/Twitter titles and direct product description; visible TypeWit eyebrow and introductory sentence (`web/app/(marketing)/page.tsx`, `web/app/layout.tsx`). Existing slogan, controls, visuals and single-section layout retained. |
| P1 | No dedicated product/operator identity page. | Add `/about/`, explaining operator, Google cloud versus Word add-in, supported formatting, purpose, limitations, editorial responsibility and contact. No invented founders, expertise, customers or reviews. |
| P1 | Identity page absent from discovery and article bylines. | Add About links to both footer variants and existing guide bylines; canonical metadata, breadcrumbs and sitemap (`web/components/Footer.tsx`, guides route, `web/lib/search-content.ts`). |
| P1 | Site/software identity could be clearer. | Homepage WebSite domain alternate name, language and description; stable SoftwareApplication ID and verified SaaSHub product `sameAs`. AboutPage references the same software, website and publisher IDs. Existing organization identity retained. |
| P1 | Keyword map did not prioritize bare-brand navigation. | Add TypeWit and TypeWit auto typer as P0; branded provider/about variants. Existing category ownership preserved in `keyword-map.csv`. |
| P2 | Homepage sitemap date lagged content; privacy notice changed 5 November but sitemap still showed October. | Set actual homepage/About edit date; correct privacy date to its known last substantive edit. No blanket build-time freshness or refreshed article dates for a byline-link change. |
| P1 | Owner-supplied Search Console data shows formatted-paste search interest. | Rewrite the existing formatting guide’s title/description and direct answer; add normal-paste steps, separate plain-text shortcuts and troubleshooting before optional TypeWit instructions. Actual article update date recorded. No duplicate keyword article. |
| P2 | SEO checks did not test aligned homepage brand identity. | Extend `web/scripts/check-seo.mjs` to verify rendered brand-first/social titles, visible product copy, entity IDs, About association and discovery. All prior assertions retained. |

## Whole-site audit

| Area | Finding / evidence |
|---|---|
| Rendering | PASS source/static export: public content and metadata are prerendered by Next.js (`web/next.config.ts`). Live deployment still requires verification. |
| Titles/descriptions | Unique, present and reasonable-length metadata checked across all canonical public pages; homepage improved. No meta-keywords or keyword stuffing added. |
| Headings | One H1 checked on each public page. Compact homepage slogan retained; surrounding visible copy now supplies brand/category. Provider H1s directly describe their categories. |
| Canonicals | `web/lib/seo.ts` points to production typewit.com; trailing-slash paths retained. No preview-origin canonicals added. |
| Indexing | `web/lib/indexing.ts`: Netlify production eligible, Vercel/Netlify previews excluded. Explicit owner noindex overrides preserved. Private/sign-in routes remain noindex and crawlable so the directive can be read. |
| Robots/sitemap | `web/app/robots.ts`, `sitemap.ts`, public registry: canonical public pages only; About included. No account routes, duplicate URLs, priority/changefreq claims or sitewide crawl block added. |
| Redirects | www-to-apex 301 declared in `web/netlify.toml`. Historical Search Console data includes HTTP and slashless variants; this alone does not prove current duplicate serving. Check live redirects and Google-selected canonicals before changing route behavior. |
| Breadcrumbs | Visible navigation and BreadcrumbList tested on public non-home routes (`web/components/seo/Breadcrumbs.tsx`). |
| Structured data | Existing site, organization, software, offers and articles reviewed; identity strengthened. No fake reviews, guaranteed rich results or SearchAction for a nonexistent public search engine. |
| Internal links | Every relative link from exported public pages checked against actual output. About/footer/byline links improve identity discovery without duplicate keyword pages. |
| Content intent | Google page owns category, free, without-extension and background variants; Word page owns add-in intent. Seven existing guides cover comparison, scheduling, formatted paste, version history, voice and Word tasks. |
| Accuracy | Google cloud sessions and Word open-panel requirements remain distinct. No guarantee of Google history grouping or deceptive authorship claim introduced. Pricing/access rules unchanged. |
| Mobile/accessibility | Existing mobile, compact-home and accessibility tests retained; About uses the established responsive article layout. No extra landing section, gradient, tracker or modal. |
| Images | Existing brand/social assets retained, canonical social-image references checked. No unverified video schema or fabricated screenshots. |
| Performance | No dependencies or SEO runtime requests added. No field Core Web Vitals or PageSpeed score measured; local builds do not establish live performance. |
| International | English `lang` retained for global English content. No fake translations, country doorway pages or hreflang pointing to nonexistent versions. |
| Reputation | SaaSHub public reference verified; no backlink count, authority metric or Product Hunt approval inferred. No external posts/messages, mass submissions or paid ranking links created. |

## Keywords and competitors

Use [keyword-map.csv](keyword-map.csv) for route ownership. These priorities are qualitative; all volume/difficulty fields remain unavailable.

- **TypeWit / TypeWit auto typer:** homepage; establish the product identity first.
- **Google Docs auto typer / auto typer for Google Docs:** existing Google Docs page. One clear commercial destination, not near-duplicate pages.
- **Google Docs auto typer without extension / background auto typing:** same page; explain cloud operation and provider limits.
- **Microsoft Word auto typer / Word auto typer add-in:** existing Word page; explain the open-panel requirement.
- **Free auto typer for Google Docs:** Google page's Free section and FAQ, with actual limits.
- **Choose a Google Docs auto typer / extension vs cloud:** existing comparison guides, with repeatable evaluation steps.
- Scheduling, formatting and history questions: existing relevant guides, linked to the provider page.

[Dripwriter's features](https://www.dripwriter.com/features) emphasize category, pacing and background terms. [Write It's Word page](https://write-it.us/features/auto-typer-word) addresses Word installation, workflow and formatting. These observations describe public messaging, not their organic traffic or ranking difficulty. TypeWit's content should answer the task accurately rather than copy competitor claims or promise guaranteed history entries.

## Owner verification and measurement

1. Confirm Netlify's published production commit matches this release, Base directory `web`, production context and canonical domain. Check it does not inherit `NEXT_PUBLIC_NOINDEX=true` or `NEXT_PUBLIC_ALLOW_INDEXING=false`; keep preview exclusions.
2. In Search Console inspect `https://typewit.com/`. Record indexed state, **Google-selected canonical**, user canonical, last crawl and crawled title. Test live URL, inspect screenshot/HTML and confirm HTTP 200/index allowed/new copy. Repeat for Google/Word provider pages and About after publishing. Request indexing once where appropriate; repeated requests do not force rank.
3. Verify live robots advertises `https://typewit.com/sitemap.xml`; sitemap contains canonical public URLs and `/about/`. Confirm existing sitemap status; don't invent competing sitemaps.
4. Performance → Search results: compare last 28 days to previous 28. Filter exact `typewit`, then separately regex `(?i)type\s?wit`. Export Queries, Pages, Countries and Devices with impressions/clicks/CTR/average position. Small/anonymized queries can be omitted. An initial XLSX has now been supplied; use this procedure for the next comparison export. Don't make sensitive data public.
5. Check Manual actions, Security issues and Page indexing exclusions. If indexed with correct canonical and no issue, don't invent an indexing defect; work on identity, useful content and genuine mentions.
6. Run PageSpeed Insights mobile/desktop for root, provider pages and a guide. Prioritize measured field/Lighthouse issues only.
7. Use the exact TypeWit name and typewit.com across owned profiles. Request genuine relevant product coverage; no mass directory spam, fake reviews or keyword-stuffed anchors. No external profile was edited by this task.
8. Review weekly for 4–8 weeks, segmenting countries/devices and branded versus category queries. Track correct landing pages and signup quality alongside impressions. This is a measurement schedule, not a ranking or time-to-results guarantee.

## Official references

- [Google site names](https://developers.google.com/search/docs/appearance/site-names): consistent homepage naming, WebSite data and alternatives; selection is automated.
- [Google title links](https://developers.google.com/search/docs/appearance/title-link): concise descriptive brand titles; Google can rewrite them.
- [How Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works): crawling, indexing and serving differ.
- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): useful content, discovery and measurement.

## Verification scope

Baseline production build, lint, typecheck and static SEO checks passed before edits. SEO auditing is also added to CI after its production build. Final verification covers production build, lint, types, expanded SEO checks and the full existing browser suite. The existing exact homepage-title assertion is updated for the intentional brand-first title (same exact server-rendered check, not a relaxed match); the first browser run exposed that stale expectation. About is added to the existing narrow-screen accessibility loop. No test skipped or assertion weakened. No backend, database, authentication, payment, consent or plan behavior changed. Current live Google positions, URL-inspection state and effective production headers remain unverified. Historical metrics from the supplied export were analysed separately and kept private.

Final local results: production build, lint (zero errors; four existing hook warnings), TypeScript, 16 indexing-policy scenarios, 23 canonical public pages and 765 internal links passed. Full browser suite: 145 passed. Backend verification also passed: Deno typecheck/lint/format and 258 tests. Desktop and phone homepage screenshots were visually reviewed; the compact composition remains intact.

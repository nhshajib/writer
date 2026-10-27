# TypeWit search growth audit and implementation

Research date: 26 October 2026 (America/New_York). Primary site: https://typewit.com/ on Netlify. Vercel is a test copy and must remain noindex.

## Outcome and limits

The priority category is **Google Docs auto typer**, with **auto typer for Google Docs**, **background auto typing** and **without extension** variants on the same commercial page. Microsoft Word is a separate provider intent. Use these existing canonical pages rather than creating near-duplicate keyword landing pages. No position, first-page placement, keyword volume or organic difficulty is guaranteed or measured in this audit.

Work performed: public search-result and competitor-page research; source/static-export crawl checks; one original buyer/testing guide; relevant internal links; corrections to Word defaults and Google's voice-typing browser coverage; seven-guide discovery and sitemap integration; keyword CSV; verified listing routes and ready-to-use descriptions; an official-site link in the owned public repository README. No backend, billing, authentication, plan access or data collection changes.

## Google tools: actual access status

| Tool | Result / next action |
|---|---|
| Google Search Console | Owner previously confirmed verification. No connected Search Console tool or account data in this session. Requested export/access; no property performance, URL inspection, sitemap submission or indexing request claimed. |
| Google Ads Keyword Planner | Official instructions reviewed. Account setup is needed for its keyword features. No Ads credentials or export available; all volume/difficulty fields explicitly unavailable. Ad competition is not organic keyword difficulty. |
| Google Trends | Public comparison URL attempted; research tool could not access it. No relative-interest chart or trend conclusion available. Trends values would be normalized interest, not monthly searches. |
| PageSpeed Insights | Public analysis URL attempted; unavailable through research tool. No score or real-user Core Web Vitals claimed. Run mobile and desktop on live canonical pages when reachable. |
| Search Central | Official starter guide, spam policy and keyword-planner documentation reviewed. These inform implementation; reading documentation is not running a Google account audit. |

Public search was performed through the available web research service, not through an authenticated Google Search Console or a guaranteed Google-localized SERP. Search snippets can be cached. Searches across the category establish wording and competitors, not exact current Google positions. The sampled `site:typewit.com` query did not surface a TypeWit result in returned results; this is not evidence that Google has indexed zero pages. Use Search Console's Page Indexing report to establish that.

Direct requests to typewit.com were blocked by this workspace's outbound proxy (CONNECT 403), and the research tool could not open its robots/sitemap. That is a research-access limitation, **not an established production outage or indexing defect**. Source checks and static build do not establish which build or HTTP headers Netlify currently serves.

## Competitor observations

Terms below were observed in public titles/headings/body or search snippets. They are **not** extracted traffic keywords or a backlink-database report.

| Competitor / source | Observed category focus | TypeWit opportunity |
|---|---|---|
| [Dripwriter features](https://www.dripwriter.com/features) | Google Docs auto typer, background execution, pacing, corrections and history | Demonstrate comparable legitimate workflows with precise plan access and honest history limits. |
| [Duey Sessions](https://www.duey.ai/sessions) | Remote/cloud document entry, closed-tab operation, deadlines and writing hours | Explain cloud-vs-Word behavior and give visitors a verifiable setup/test checklist. |
| [AutoTyper category page](https://autotyper.net/auto-typer-for-google-docs) | Drip-writing, existing/new documents, variable intervals and revision history | Make formatting, sentence-based steps and Free/Day Pass/Pro limits easy to evaluate. |
| [Write It category comparison](https://write-it.us/blog/best-auto-typer-for-google-docs) | Search sample showed vendor comparison content | Meet evaluation intent with a repeatable test rather than asserting unsupported superiority. Full competitor comparison article not independently benchmarked. |

No claims about competitor conversion rates, traffic, domain authority, security implementation, exact rankings or hidden meta-keyword strategy. Some vendors market authorship-evasion claims; TypeWit should not copy these promises. No independent hands-on competitor feature testing was performed.

## Findings and resolutions

| Priority | Finding | Change / status |
|---|---|---|
| High | Ranking decisions lack actual query/CTR/conversion baseline. | Keyword map records evidence and unknown metrics; Search Console/Planner access requested. External dependency. |
| High | Category has strong competing vendors; keyword repetition alone adds little value. | Added `/guides/choose-google-docs-auto-typer/`: repeatable sample test, permissions, cloud requirements, billing checks and history limitations. |
| Medium | New sentence default absent from Word provider page and evaluation material. | Added accurate default and >20-word two-part explanation, preserving all other mode options. |
| Medium | Voice typing guide implied Chrome-only availability. | Corrected to latest Chrome, Edge and Safari using current Google help; updated only that article's substantive-change date. |
| Medium | Guide hub's pricing link omitted Day Pass. | Label now includes Free, Day Pass and Pro. |
| Medium | New resource needs discovery and metadata. | Added to shared guide registry: guide hub, related links, Article markup, breadcrumbs, sitemap and actual modification dates. Provider page links directly to evaluation guide. |
| Medium | Third-party posting has no usable submission connection in this session. | Verified SaaSHub submission path, Product Hunt account requirement, AlternativeTo verification/editorial rules, conditional BetaList route; supplied platform-specific copy and a submission ledger. **Zero submissions, zero published links.** |
| Medium | Production crawlability/performance need live verification. | Retained tested Netlify/Vercel indexing separation, canonical tags and private noindex rules. External domain access/Google reports pending; no fabricated “all green” production conclusion. |

Existing foundations were retained: concise homepage design, unique titles/descriptions, canonical URLs, Organization/SoftwareApplication schema, breadcrumb and Article markup, crawlable internal navigation, XML sitemap, private/auth noindex and preview exclusions. No keyword meta tag added: Google does not use it for ranking. No fabricated ratings or FAQ rich-result claims. No unnecessary changes to working robots or backend settings.

## Keyword and content strategy

The full per-page map is in [keyword-map.csv](keyword-map.csv). P1/P2/P3 are editorial priorities by intent and fit, not measured difficulty.

1. Primary commercial page owns the Google Docs auto typer category and natural variants. Explain free limits, no-extension cloud execution, existing documents, formatting and schedule controls with the actual product.
2. Word page owns Word add-in intent and clearly states its open-panel requirement. Do not compete for arbitrary desktop-app typing or claim Slides support.
3. New selection guide answers evaluation intent with an original practical checklist. Existing extension-vs-cloud guide remains about architecture; avoid duplicating it into another product landing page.
4. Existing scheduling, formatted paste and history guides answer specific tasks. Update these with actual support/Search Console questions before adding more articles.
5. Don't mass-generate pages for misspellings, word-order variants or year suffixes. Don't promise “undetectable,” guaranteed human history, a guaranteed version count or fabricated authorship.

## Next 90 days: measurement-led order

- Days 1–7: verify Netlify production serves this release; inspect homepage and provider/guide URLs in Search Console; confirm canonical selection, sitemap processing and Page Indexing exclusions. Submit the existing sitemap once if not already submitted. Run mobile/desktop PageSpeed; prioritize measured LCP/INP/CLS problems rather than chasing an unsupported score.
- Days 1–14: obtain Search Console query/page/device/country reports for the latest 28 days and previous 28 days, plus a 3-month view when available. Record clicks, impressions, CTR and average position by owning page. Export Keyword Planner for agreed target markets/language; keep locale/date and competition type explicit. No paid campaign is needed as part of this work and none was created.
- Days 7–30: complete the best-fit software listings from the prepared pack, through verified owner accounts where required. Record moderation and actual live links. Pitch the new resource only to editors whose existing material it improves; disclose affiliation.
- Days 30–60: improve pages already earning relevant impressions. If a query has impressions but weak CTR, compare its intent with the title/snippet and visible page answer before editing. Avoid interpreting low-sample average position as a stable rank.
- Days 60–90: expand distinct, validated topics and update existing guides based on user questions. Review organic sign-ups and paid activation only if lawful analytics already supports them; no new trackers or personal-data collection were added here. Keep growth/privacy claims accurate.

Core business measure: relevant organic visits that reach a successful authorized test session, followed by paid activation where measurable. Search impressions alone are not revenue. Use comparable date periods, isolate branded vs nonbranded queries and separate phone vs desktop. Agree target market before quoting locale-specific keyword metrics.

## Source references

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google Keyword Planner access and research](https://support.google.com/google-ads/answer/7337243)
- [Google Docs voice typing browser support](https://support.google.com/docs/answer/4492226)
- [Product Hunt posting requirements](https://help.producthunt.com/en/articles/479557-how-to-post-a-product)
- [AlternativeTo official submission/link rules](https://alternativeto.net/faq/)
- [SaaSHub product submission](https://www.saashub.com/services/submit)
- [BetaList criteria](https://betalist.com/criteria)

## Validation

Passed: production static build; TypeScript (`npm run typecheck`); SEO export checks (16 indexing-policy cases, 20 canonical public pages, 597 internal links, sitemap, JSON-LD and private-route exclusions); all 127 existing browser tests (5.8 minutes). The new guide additionally passed mobile overflow and axe WCAG checks at 320, 390 and 430 pixels in Chromium. No existing test was changed, weakened or removed. The static checks validate metadata uniqueness, public/private indexing, sitemap registry coverage, breadcrumbs, Article markup and internal link destinations; browser checks exercise responsive public pages and existing app flows.

Release source is pushed to `main` after these checks. Netlify live publication and Google indexing have not been independently verified from this environment. No database or edge-function deployment is needed for these content-only changes.

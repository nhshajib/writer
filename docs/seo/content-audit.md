# Site-wide content audit and polish

8 November 2026. Production site: typewit.com. This pass refines existing content; it does not add keyword landing-page variants or claim Google certification, a keyword-density target or a guaranteed ranking gain.

## Scope and method

- Reviewed the 23 canonical public pages using exported heading, paragraph, list and question text, plus source metadata and shared copy.
- Scanned candidate static JSX, labels, placeholders and helper-copy fragments across 88 page/component source files (1,680 candidates). Private dashboard, authentication, account and Word surfaces were included in this review; no customer text was loaded or rewritten.
- Compared visible explanations by task and page purpose. The baseline did not contain exact duplicate body paragraphs longer than ten words within a page; the main issues were repeated ideas, unnecessary catalogue navigation, verbose summaries and stale support advice.
- Kept essential disclosures at the point where they matter: approval, temporary edits, Word's open-panel requirement, Day Pass expiry, trial/renewal terms, account deletion and legal consent.
- Preserved the five legal/policy documents verbatim: Terms, Privacy, Cookies, Responsible Use and Service Providers. Repetition that serves a legal or consent purpose was not treated as marketing padding. No terms-version or acceptance behavior changed.

## Public-page coverage and search intent

| Page | Intent / action |
|---|---|
| `/` | TypeWit brand navigation. Retained the recently improved compact hero, product definition and brand-first title. No extra keyword block. |
| `/about/` | Product/operator identity. Shortened the repeated product tour while retaining operator, limitations, contact and editorial responsibility. |
| `/features/` | Controls and capability overview. Removed another numeric plan/pricing summary; linked to provider setup pages. |
| `/how-it-works/` | Setup sequence. Clarified paste → rhythm → approval; removed repeated approval instructions from the following paragraph. |
| `/use-cases/` | Workflow evaluation. Replaced the generic product intro with concrete test outcomes. |
| `/google-docs-auto-typer/` | Primary Google Docs auto typer, without-extension and background-auto-typing intent. Kept category metadata/H1 and natural wording; shortened repeated permissions, background and plan answers. Preserved formatting limits, timing, correction risks and history constraints. |
| `/word-auto-typer/` | Microsoft Word auto typer/add-in intent. Consolidated repeated open-panel explanations while retaining setup, execution requirements, desktop deployment and access limits. |
| `/pricing/` | Free, Day Pass and Pro purchase comparison. Added missing Day Pass intent to metadata; shortened repeated billing-period and FAQ explanations. Cards, feature comparison, actual prices, trial eligibility and renewal/cancellation disclosures remain. |
| `/faq/` | General product/account questions. Put Free first, condensed Discord and dictation answers, and kept provider/sign-in differences clear. Structured FAQ answers still derive from the same visible copy. |
| `/support/` | Troubleshooting and account help. Replaced generic reconnect/restart advice with attention/log review to avoid overlapping sessions. Updated deletion help to match the already-existing billing confirmation. |
| `/guides/` | Guide discovery. Shorter introduction and card descriptions instead of repeating full article summaries. |
| `/guides/choose-google-docs-auto-typer/` | Tool evaluation. Trimmed repeated rhythm descriptions and a long price table in prose; retained the test checklist, privacy questions and comparison criteria. |
| `/guides/schedule-text-google-docs/` | Scheduling. Clarified start versus duration and shortened repeated background/Day Pass explanations; retained block, rest, expiry and writing-hour details. |
| `/guides/paste-text-keep-formatting-google-docs/` | Formatting search queries supported by the supplied Search Console export. Retained the direct native-paste answer, shortcuts and troubleshooting; condensed the optional TypeWit section. |
| `/guides/google-docs-version-history/` | History interpretation. Shortened log/revision-pass explanations while preserving grouping, temporary-edit and authorship distinctions central to this topic. |
| `/guides/auto-typer-extension-vs-cloud/` | Execution-model comparison. Cut repeated definitions and closed-laptop claims; kept practical trade-offs and permission checks. |
| `/guides/auto-type-text-microsoft-word/` | Native Word automation versus paced entry. Clarified that Quick Parts steps apply to Word for Windows and condensed the add-in introduction. |
| `/guides/voice-typing-google-docs/` | Dictation. Replaced the generic price paragraph with review guidance specific to dictated text; clarified speech recognition versus scheduled entry. |
| `/terms/` | Legal agreement. Reviewed and retained; no promotional keyword insertion or obligation removal. |
| `/privacy/` | Data notice. Reviewed and retained; no shortening of rights, retention or transfer disclosures. |
| `/cookies/` | Storage/consent information. Reviewed and retained; no cookie behavior changes. |
| `/responsible-use/` | Acceptable-use rules. Reviewed and retained; document-entry simulations remain distinct from authorship. |
| `/subprocessors/` | Provider transparency. Reviewed and retained; no vendor/contract claims changed. |

## Private-page review

Private routes remain noindex; they receive task language rather than acquisition keywords.

- Signup: a direct description replaces the vague repeated slogan; age/guardian, email eligibility and agreement controls are unchanged.
- Login/reset: concise field instructions and recovery notices retained; no sign-in or reset logic changed.
- Dashboard home: the new-user helper now suggests a small editable test passage instead of another broad product pitch.
- Session details: shortened the automation note, retaining the Google API/account/server distinction and Word open-panel requirement.
- New session/Word: reviewed approval, pacing, temporary-edit and expiry explanations. Important context at approval was retained even where it appears elsewhere.
- Connected accounts/shared document workspace: condensed the Word description while preserving installation and interruption instructions.
- Settings: clearer defaults and data-section introductions; partial-export, consent, billing-cancellation and deletion caveats retained.
- Account, session list, Plan & usage, Manage billing and compatibility/account routes: existing labels, status/limit explanations and financial notices retained where they already serve the task. Repeated control names are necessary navigation, not redundant prose.

## Shared repetition fixes

1. A guide now offers two or three related articles chosen by task, instead of listing every other guide. The guide hub still links to all seven; no article is orphaned. Word's guide links to the Word product destination.
2. The shared metadata helper appends TypeWit only when the title does not already contain it. This fixes doubled branding in About, How it works and pricing titles/social metadata. Word’s separate layout uses an explicit title to avoid the same duplicate. Homepage wording is unchanged.
3. Numeric plan comparisons are concentrated on pricing and relevant conversion answers. General features and editorial guidance refer readers to that comparison rather than repeating a full plan pitch.
4. Article and sitemap dates reflect actual copy edits. Legal dates, publication dates and unchanged homepage dates were not artificially refreshed.

The initial before/after heading/paragraph/list sample across the 18 nonlegal public pages fell from 9,122 to about 8,300 words. This measurement excludes shared navigation, table cells and legal text; it is not a count of identical words deleted or an SEO score. Support became slightly longer to correct unsafe or stale guidance. Clarity and completeness take precedence over a blanket word-count reduction.

## Keyword policy

Use [keyword-map.csv](keyword-map.csv) as the route-ownership map. Primary approved terms stay on the provider pages; supporting pages use branded setup, feature, pricing, support and topic-specific phrases. No search-volume or difficulty figures have been invented. Legal and private routes do not receive forced commercial keywords. Common product names, button labels and required warnings may correctly repeat.

## Verification

The existing build, lint, types and static SEO checks are retained. SEO validation additionally checks that branding occurs once per public title and each guide's related links are unique, valid and exclude itself. Existing browser assertions are not weakened. Final verification covers mobile accessibility/layouts, public discovery, pricing, account flows, session controls and the Word add-in against fakes. No customer session, payment or deletion is used as a test.

Publication alone does not establish a ranking improvement. Compare the next Search Console period after recrawling against the private baseline analysed in the prior audit. The owner confirmed the preceding SEO release was published on Netlify; this content release needs its own published-commit check.

Local verification: full browser suite 145 passed; backend check/lint/format and 258 tests passed. Fresh metadata export passed build, lint, TypeScript, 16 indexing-policy scenarios, 23 public pages and 744 internal links. The focused SEO/browser suite also passed after the shared metadata change. Clean CI supplies final full-suite verification for the release revision. Four pre-existing React hook warnings remain; no dependency or runtime service changes.

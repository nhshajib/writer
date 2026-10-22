# Rhythm and text submission redesign

## Order and baseline

1. Record unchanged suites before editing: 214 backend tests and 87 browser tests passed.
2. Add optional `pacing.word_grouping`: `single` or `random`. Omitted settings keep the exact old seeded grouping. Preserve plan normalization, existing stored execution scripts, route shapes and engine operations.
3. Improve opt-in Pro final review, with at most three edit/restore pairs inside the final source unit and a maximum 128 UTF-16-unit suffix. Non-English or tiny endings retain the space/delete fallback. Exact original text and formatting are restored after each pair. Existing conditional writes and interrupted-write recovery remain responsible for collaborator protection.
4. Share word controls and an explanatory preview between Google Docs setup, paused Pro edits and the Word pane. Keep two stages, with optional advanced controls and exact-text approval.
5. Offer single words on every plan, update comparison copy, and test desktop/mobile and Word. Preserve rich paste, document picker/new-document naming, plan gates, billing and other existing flows.
6. Deploy affected function bundles, verify their source, push the working branch, and fast-forward main after verification.

## Product behavior

- Natural and Steady remain clean entry rhythms. Drafting and Pro customization can add temporary corrected typos and false starts.
- Single words never silently become grouped words to fit a short duration. The planner explains the minimum required time. Automatic duration suggestions allow more time for single words; manually chosen times remain under user control.
- “Your rhythm at a glance” describes source step size, variation, sentence pauses, longer breaks and temporary edits.
- Advanced controls are grouped into pace/variation, temporary mistakes, thinking pauses and longer breaks, with a one-click recommended configuration.
- A final review is deliberately bounded to the session-owned ending, not a whole-document semantic rewrite. Existing sessions retain their saved actions and schedule.
- No database migration, extra collected data, new tracking or retention change is required. The optional grouping setting lives in existing pacing JSON.
- Google controls revision grouping. Automated pacing does not prove manual authorship or guarantee a particular version-history appearance. Word continues to require its open document and add-in.

## Verification

- New backend tests: `word_grouping_test.ts` checks all plan tiers, preset normalization, legacy equivalence, invalid settings, insufficient duration, rich spans, recovery boundaries and bounded suffix reviews. `word_grouping_routes_test.ts` exercises the actual authenticated route parser with a fake database transport.
- New browser tests: `rhythm-flow.spec.ts` checks Free desktop/mobile single-word submissions, overflow and accessibility, and Pro recommended settings/approval. A new Word case checks Free single-word planning.
- Existing tests are preserved without weakened assertions.
- Only fakes and the mock API are used for writing/payment/account tests; no customer documents are changed.

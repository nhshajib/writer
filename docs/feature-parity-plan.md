# Plan expansion and document editing

Sources reviewed 21 October 2026: https://www.dripwriter.com/features and https://www.dripwriter.com/pricing. Competitor wording and claims are not copied.

## Ordered delivery

1. Centralize effective entitlements: Free 250 words/day, 60 minutes, one active session; Day Pass $3.99 once, 24 hours, unlimited words, one active session, writing hours; Pro unlimited words, seven days, three active sessions and all advanced tools.
2. Add idempotent Day Pass payment confirmation, expiry and refunds, retaining subscription reconciliation and checkout locking. Do not purchase anything to test.
3. Add timezone-aware writing windows, bounded paid queue preference and expiry checks to both server and Word engines. Preserve recovery and existing sessions.
4. Add opt-in Pro final revision pass that restores the exact approved text and only edits the session-owned suffix. Add read-only Pro session replay, explicitly distinct from Google's own revision history.
5. Update new-session flow, existing-document guidance, dashboard, billing, Word, pricing, search/help, terms and privacy. Preserve native mobile navigation, formatting and existing-document access on Free.
6. Add route, clock/expiry, DST, compilation, payment and browser regressions. Run backend, SQL, type, lint, browser and accessibility checks; apply additive migrations after 20261023000005, deploy/compare functions and verify worker health before main.

## Product boundaries

Free existing-document access remains available indefinitely. Monthly and yearly are Pro billing choices, alongside a separate Day Pass. Writing windows may extend elapsed completion time; the displayed finish is a target. Day Pass access starts on payment confirmation, never renews, and pauses unfinished pass sessions at expiry until access is renewed or upgraded. Existing text is not removed.

Session replay displays TypeWit's recorded actions; it is not an export or recreation of Google's official history. A final revision pass uses small reversible edits to the approved suffix, with no AI rewriting and no changes to collaborators' text. No claim is made that automation proves authorship, avoids detection, or is suitable for academic deception.

Baseline: commit ee3b6ce, 200 backend tests; previous unchanged release 83 browser tests. Fresh browser baseline was interrupted at 75 passing tests by environment restart. Final full suites are required.

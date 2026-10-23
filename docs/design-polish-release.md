# FAQ, pricing, homepage and editor polish

- FAQ uses a two-column support introduction and separate accessible disclosure cards, stacked on mobile.
- Pricing presents Free, Day Pass and Pro with a monthly/yearly Pro billing selector. Actual prices, trial disclosures, checkout intervals and entitlements are unchanged.
- Homepage uses the existing flat blue surface without the outer gradient/frame. Footer spacing is reduced. Mobile document, progress card and break note occupy separate rows.
- The editor adds underline, strikethrough, paragraph alignment and numbered lists to the existing heading/emphasis/highlight controls. File attachment opens the existing Pro text-import flow; attachments are not embedded.
- Optional formatting metadata is validated, retained during planning/drafting, previewed, and applied through Google Docs and Word. Older rich-text payloads remain valid; no schema migration is required.
- Google style-reset snapshot now includes underline/strike resets to avoid leaking these styles into later plain runs. Existing homepage geometry and pricing-card tests were updated for the requested layout; checkout assertions still verify both billing intervals.

Validation: Deno formatting/type/lint checks and 235 backend tests pass. Full browser suite and final responsive checks are recorded at release completion. Live formatting deployed as drips v42 (JWT true), drip-tick v35 (JWT false); deployed source matches the repository exactly.

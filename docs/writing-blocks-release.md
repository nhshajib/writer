# Writing Blocks release — 2026-10-22

Optional writing blocks are available to Day Pass and Pro. Choose 5 minutes–12 hours of writing per block and 15 minutes–8 hours between blocks. Existing Free sessions and sessions without blocks retain their previous scheduling path. All plan duration limits include rests and writing-hours waits.

## Implementation and coverage

| Area | Implementation | Evidence |
| --- | --- | --- |
| Safe schedule construction | `_shared/writingBlocks.ts`, `plan.ts`, `pacing.ts` | `writing_blocks_test.ts`: full rests, correction/source boundaries, rich formatting, bounds, legacy schedule equivalence, no terminal rest |
| Automatic continuation | `_shared/session.ts`, `progress.ts` | Simulated six/eight-hour rests, process restart, delayed confirmation, lost write response, manual pause/cancel, expiry and DST tests |
| Day Pass enforcement | Server-derived expiry in `drips/index.ts`, planner and manual resume | Exact-expiry, future restart/finish, writing-hours overflow, runtime expiry and real-route tests |
| Paused editing | `_shared/replan.ts`, `PausedSessionEditor.tsx` | Remaining rest retained unless settings explicitly replace it; readonly preview has no save/resume side effects; browser approval/save tests |
| User controls | Shared `WritingBlockControls.tsx`, `WritingBlockSummary.tsx`, new-session flow, defaults, Word | Browser tests for custom timings, account defaults, total elapsed time, Free gating, mobile accessibility and expiry errors |
| Database compatibility | `20261024000002_writing_blocks.sql` | Migration applied twice in isolated PostgreSQL; all six SQL fixture suites pass, including ownership, input validation and grants |
| Site consistency | Shared plan entitlement, pricing comparison, dashboard, playback, Google Docs/Word pages, help, Terms and Privacy | Typecheck, production static build, browser suites and SEO checks |

Baseline before implementation: 219 backend tests and 97 browser tests passed. Backend after implementation: 232 tests passed; function typechecks, lint and formatting passed. Independent [CI run 39825051859](https://github.com/nhshajib/writer/actions/runs/39825051859) passed backend and web jobs on runtime commit `1f5058b`, including the full 104 browser cases, dependency audit and production build. Existing tests were not weakened, skipped or deleted. One local run had an unchanged signup test lose its email input before submission; that case passed on a fresh run and the independent full CI run is green. New test locator corrections reflect the current contenteditable editor and upgrade control interaction.

## Deployment

Migration applied with Supabase MCP. Its new history version was aligned to the repository filename after MCP assigned an automatic timestamp. No previously applied migration was edited or renamed.

Pre-existing history exception: the repository's `20261024000001_session_defaults.sql` is recorded live as `20261022085807_session_defaults`. Its statements were compared and match. This earlier record was left intact.

Deployed `drips` v41 (`verify_jwt=true`) and `drip-tick` v34 (`verify_jwt=false`), including import maps and relative dependencies. Every returned deployed source file matches the repository exactly. Security and performance advisors have no new findings compared with the pre-change baseline. The first post-deploy log window shows three v34 HTTP 200 responses and no warning/error records; two scheduled cron runs succeeded. The public worker health endpoint reports healthy. This checks worker execution, not a live customer write.

Leaked-password protection remains a pre-existing Supabase Auth warning; enable it in Auth → Passwords. This release does not change Auth settings. See [Supabase's password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No real customer writing sessions, documents, billing state or accounts were changed for testing. Runtime scheduling was exercised with fakes and simulated time; database tests used isolated PostgreSQL and browser tests used the mock API.

## Timing and history limits

Google Docs continues server-side with the browser closed. Word requires its document and add-in to remain open. Times are targets: provider errors, conflicts, writing hours and service delays may move continuation later. Full requested inter-block rests are retained. Manual pause, cancellation and access expiry prevent automatic continuation.

Google decides how edits are grouped in version history. Long breaks cannot guarantee separate top-level revision groups. The UI and public copy state this limitation.

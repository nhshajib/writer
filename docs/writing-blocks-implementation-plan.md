# Writing blocks: implementation plan

Status: implemented design. Release checks and deployment results are recorded in the release report.

## User experience

Keep the existing setup and review stages. Add an optional **Writing blocks** choice beside the session timing controls, off by default.

Helper: “Enter your text in writing blocks, with a longer break between them. Entry continues automatically.”

When off, retain the current “Finish within” behavior and all existing pace controls.

When on:

- In duration mode, replace “Finish within” with **Writing time**. Helper: “Time spent entering text, including sentence pauses. Long breaks are added to this time.” Preserve the entered duration; do not silently increase it.
- Day Pass and Pro: editable **Write for about** and **Break between blocks** controls. Permit writing blocks from 5 minutes to 12 hours and breaks from 15 minutes to 8 hours. Offer common choices plus custom values: writing 15/30 minutes, 1/2/4 hours; breaks 15/30 minutes, 1/2/3/4/6/8 hours. A 1-hour/3-hour combination is an example, not a restriction. Enforce the overall plan limit and remaining access separately.
- Pro speed mode remains available; its writing time and finish are estimates calculated from WPM.
- These controls replace the existing longer-break controls while enabled. Sentence pauses and approved correction effects remain. Keep the other break settings remembered so disabling blocks restores them.
- Show one preview: **2 hours writing + 3 hours of breaks = 5 hours total**, followed by **Write → Break → Continue** and actual projected start/end times.
- If there is only one block, say “This schedule finishes in one writing block; no long break is needed.” If step size prevents splitting, explain that smaller insertion steps permit more blocks.
- Switching settings clears approval. The review page summarizes writing time, long-break time, total time and block count once.

On a running session, derive **Scheduled break · resumes at [time]** from progress. Keep scheduled breaks distinct from a user-paused session. Show the same timeline in the session preview and playback. Google Docs resumes server-side; Word resumes when its document and add-in are available.

Explain once: “Google controls version-history grouping. Long breaks do not guarantee separate versions.” A help link can describe manually naming a Google Docs version; naming is not part of automatic scheduling.

## Plan access

| Plan | Access |
| --- | --- |
| Free | Existing rhythms and breaks; 250 words/day, 60-minute total limit |
| Day Pass | Custom writing and break lengths; one active session; entire schedule must fit remaining access |
| Pro monthly/yearly | Custom block and break lengths; three active sessions; one-week total limit |

Enforce permissions on the server and expose them through the existing shared plan-lock and upgrade components. Day Pass customization applies only to writing-block durations; it must not enable Pro-only WPM, drafting, presets, paused edits or other advanced features.

## Data and compatibility

Add an optional writing-block configuration to pacing JSON, with separate writing-duration and block/rest values. Do not change the meaning of the existing `duration_seconds` field: stored session duration and the canonical plan response continue to mean full elapsed duration. Keep the user's writing-time input separately in the optional configuration.

Older clients and sessions without this configuration take the existing planning path unchanged. Their saved chunks, deletion scripts, schedules and break data are not rebuilt.

Extend break metadata only with optional block-kind/number information. Inspect database validation before implementation; add a new forward-only migration only if persisted runtime fields or constraints require it. Never edit an applied migration.

## Planning algorithm

1. Validate the plan, finite supported settings and input size before allocating a schedule. Reject blocks with All at once. Validate custom block/rest values server-side for both Day Pass and Pro, without granting unrelated Pro capabilities.
2. Compile the approved source and correction actions using the existing compiler. Preserve rich-text formatting and source-unit completion boundaries.
3. Build a base writing schedule using the current rhythm, sentence pauses and minimum edit spacing. In duration mode use the separately supplied writing duration; in speed mode use existing WPM estimates. Disable the old longer-break generator for this path so there are not two competing break schedules.
4. Find the first completed source-unit boundary at or after the block's writing-time target. A source-unit boundary includes its full typo/false-start correction sequence. Do not cut a unit or pause inside an unfinished temporary edit. Boundary alignment means “about 1 hour,” not an exact promise.
5. If source remains, insert the full requested rest after that boundary. Advance the next block target from this completed writing-time boundary, excluding the inserted rest. Continue once through the remaining boundaries. Never insert a rest after the last source unit.
6. Shift all subsequent action offsets by the sum of inserted rests. The source text, action ordering and formatting are unchanged.
7. Apply writing hours chronologically. A rest is elapsed wall-clock time from its preceding block's end; the next block starts no earlier than both rest completion and the next allowed writing window. Reproject action offsets and interval metadata together so the displayed breaks match actual scheduling. Avoid repeatedly charging overlapping writing-hours waits and rests.
8. Validate the complete elapsed duration, including long rests and writing-hours waits, against the plan ceiling and Day Pass expiry. Stop window projection at the applicable ceiling. Reject an incompatible plan with a useful message; never remove a requested block rest to make it fit.
   For Day Pass, explicitly check every projected block restart as well as the last action. A restart or finish at or after `day_pass_expires_at` is outside access. Calculate the next permitted writing time after the rest, including writing hours, a delayed start and applicable manual-pause shifts; checking the raw break length alone is insufficient.
9. Return canonical offsets, typed intervals, writing/break totals and the expected finish. Preview, creation and paused-session edits use this same planner and seed. Creation rechecks entitlement, expiry, quotas and concurrency using the existing checks.
10. Store the completed action schedule once. The worker consumes it using the existing idempotent engine; it does not repeatedly repartition blocks during ticks.

Before writing-hours projection:

`total elapsed = base writing duration + (number of inter-block rests × rest duration)`

Example: 2 hours of writing split into two approximately 1-hour blocks, with a 3-hour rest, produces a 5-hour session. A single completed source unit may produce only one block; the preview must report that accurately.

Planning should be linear in the existing action/source-boundary count, apart from the bounded writing-hours projection. Reject oversized schedules before expensive work. Randomness remains seeded; rest lengths themselves are not randomized in this initial feature.

## Runtime safety

- No document writes during a block rest. Release the lease and schedule the next claim near the next due action; do not hold a worker open for hours.
- Begin a rest only after confirming its preceding safe boundary. If that write finishes late, persist any necessary shift so the full rest still follows the actual confirmed completion. Make this transition lease-guarded and idempotent, including recovery after a lost confirmation response.
- Continue existing conflict, collaborator, cancellation, heading and provider-error protections. Never revive a stopped session at the next block.
- A manual pause stops automatic continuation. Resume preserves remaining work and uses the established schedule-shift behavior. Account for manual pause time once, including when it overlaps a rest.
- A paused Pro edit replans only remaining actions. Respect any still-outstanding rest before the next action unless the approved settings change explicitly replaces it. Retain confirmed text and recovery anchors. Show the revised finish before saving.
- Recheck Day Pass access before resuming writes. An access-expired session remains paused even if a rest has ended.
- Revalidate pass expiry when previewing, starting, editing remaining settings and resuming. Immediately before each write, use current server-side entitlement, not the browser's cached profile. A delay that makes an accepted schedule run out of access must pause it with the existing access-expiry handling, not silently extend the pass.
- Timing remains a target: provider outages may extend it. Avoid bursts or shrinking rests to catch up.

## Ordered implementation and release gates

1. Run and record the current full backend and browser baselines from latest main. The recently pulled main changed tests and UI, so earlier suite counts are not a substitute.
2. Implement the pure planner and server validation behind the optional field. Test legacy schedule equivalence, deterministic blocks, minimum gaps, boundary alignment, correction completion, exact source/format restoration, one-unit/short text, no terminal rest, malformed values and bounded planning cost.
3. Add runtime scheduling metadata only where needed. Simulate long rests across many ticks, delayed writes, crashes/lost confirmations, conflicts, manual pause/resume during rests, cancel/stop, work-window overlap/DST, paused edits and access expiry. Verify both Google and Word paths with fakes.
4. Add the single optional frontend control, shared plan gates, live preview and session break state. Restore settings correctly in saved defaults, presets, run-again, paused edits and Word. Keep the two-stage flow and exact-text approval.
5. Add focused browser coverage for Free locks, custom Day Pass and Pro blocks, validation and displayed totals, mobile/keyboard/screen-reader operation, approval reset and scheduled-break versus manual-pause controls. Keep existing tests intact and add coverage for the new opt-in behavior.
6. Update pricing comparison, plan descriptions and help from the same entitlement definition. Keep monthly/yearly Pro identical. Review policy wording; this feature requires no new text collection or retention policy.
7. Run full backend/browser suites, typecheck, lint, formatting, production build and relevant SQL checks if a migration is needed. Verify several combinations in simulated time, including 30m/6h, 1h/8h and 2h/4h, as well as plan-limit and expiry boundaries; do not use real customer documents.
8. Deploy affected backend bundles with unchanged authentication settings, compare deployed files, and inspect worker health. Publish frontend only after backend compatibility is verified and checks are green. Use the existing release branch/main workflow.

Release copy must not claim guaranteed separate Google revision groups. The feature preserves its own saved action order and requested inter-block rests, with safe delays on interruptions.

## Automatic resume acceptance criteria

The resume time is a target, not a guaranteed exact wall-clock instant. Under healthy provider/service conditions, the worker must claim and continue a due block through the normal claim/lookahead path without requiring a browser tab or a Resume click. Verify the expected tick/lookahead behavior explicitly rather than inventing a timing SLA.

- Test six- and eight-hour rests with the browser closed; confirm no writes during the rest and continuation at the first eligible execution opportunity after it.
- Simulate process restarts and lost responses; the persisted schedule/rest deadline must survive them without duplicated text or a second full rest.
- Simulate delayed cron/worker runs and provider throttling; resume safely when service recovers, disclose the delay, and retain normal pacing.
- Manual pause, cancellation, revoked permissions and expired access prevent automatic writes. Show the reason and required user action; do not override these controls to meet the scheduled time.
- Google Docs continues server-side. Microsoft Word still requires its document and add-in to be open.
- Display the scheduled resume time in the user's local time, and refresh the status when the next action is confirmed.

## Day Pass expiry explanation

Show pass expiry alongside the block preview. If a requested rest crosses expiry, show a specific inline error:

“Your Day Pass expires at [expiry date and time]. This break would resume writing at [restart date and time], after your access ends. Choose a shorter break or upgrade to Pro.”

If restart fits but completion does not, use:

“Writing can resume before your Day Pass expires, but this session would finish at [finish date and time], after your access ends. Reduce the writing time or breaks, or upgrade to Pro.”

Render all dates in the user's selected/display time zone, including the date when crossing midnight. Preserve their text and selected settings. Prevent Start or saving incompatible edited settings while showing a path to correct them. Do not auto-purchase access or promise that a future purchase will activate. If the schedule becomes invalid due to runtime delays, preserve confirmed progress and show the existing expiry recovery options.

Tests must include restart just before expiry, exactly at expiry and just after expiry; finish beyond expiry despite an earlier valid restart; writing hours pushing restart across expiry; a manual pause or provider delay crossing expiry; and a current valid Pro entitlement superseding Day Pass expiry.

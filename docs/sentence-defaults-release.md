# Sentence-first session defaults

New sessions without an explicitly saved step preference start with sentences in the dashboard, Settings and Word. Explicit saved Word preferences remain available; no account settings are overwritten. The API already defaulted to sentences and now shares the same default constant with the clients.

## Algorithm

1. Parse supported formatting into the approved plain text, as before.
2. Detect grammatical sentence boundaries with the existing Unicode/abbreviation-aware segmenter.
3. For each sentence with more than 20 whitespace-separated words, split its existing tokens into exactly two parts: ceil(word count / 2), then the remainder. A 31-word sentence becomes 16 + 15 words. Longer sentences still split into exactly two parts; 20 is the trigger, not a maximum part size.
4. Keep every original character, space, newline, punctuation mark and Unicode character. Formatting ranges are mapped onto the new steps by the existing formatter.
5. Apply the selected rhythm: Natural retains varied timing and pauses at true sentence endings; Steady retains its more consistent pacing without extra sentence pauses; Drafting retains its approved simulated mistakes/corrections. Halves do not acquire artificial sentence-ending pauses.
6. Store the complete planned steps and schedule as before. Existing sessions execute their stored steps unchanged. Explicit paused edits/replanning use the new rule for the newly planned remainder.

The selected duration still controls timing. The rule does not promise human authorship or particular Google version-history groups. Word, paragraph, character and even-part options remain available. No database migration, plan-limit change or privacy-policy change is needed.

## Verification and intentional test updates

Baseline: 235 backend and 120 browser tests passed before changes. Final checks: 238 backend and 127 browser tests passed, plus all function entrypoint type checks, Deno lint/fmt, web TypeScript and SEO checks.

- `sentence_steps_test.ts`: exact 20/21-word boundary, large sentences, whitespace/Unicode preservation, all three rhythms, formatting and execution-text identity, true sentence pauses, unchanged execution of a legacy stored unsplit session.
- `sentence-defaults.spec.ts` and Word tests: sentence-first previews/submissions across all rhythms and both providers; saved Word preferences remain usable.
- Two existing default-creation assertions now expect sentence instead of word, as explicitly requested. The existing Word-specific setup tests now explicitly choose Word mode and keep their original behavioral assertions.
- The speed-mode fixture's 400-word sentence now yields two steps, so its configured align-any break can occur between them. The test still asserts 600 active seconds and now explicitly asserts two steps, a 60-second break and 660 total seconds.

Deployment uses the existing import map and unchanged JWT settings. Publication status is recorded after deployment verification.

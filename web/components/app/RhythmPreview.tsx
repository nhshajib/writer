import type { Pace } from "./PaceControls";
import type { InsertionUnit } from "@/lib/types";
import { UNIT_LABEL } from "@/lib/types";

/** Describes the selected behavior, rather than suggesting it proves human authorship. */
export function RhythmPreview({ pace, unit, allAtOnce, revisionSweep }: {
  pace: Pace; unit: InsertionUnit; allAtOnce: boolean; revisionSweep: boolean;
}) {
  const corrections = pace.typoRate > 0 || pace.falseStartRate > 0;
  return (
    <section className="rhythm-preview" aria-label="Your rhythm at a glance" aria-live="polite">
      <strong>Your rhythm at a glance</strong>
      <dl>
        <div><dt>Text per step</dt><dd>{allAtOnce ? "All your text" : unit === "word" ? pace.wordGrouping === "single" ? "One word" : "1–5 words, varied" : unit === "sentence" ? "Sentences; long ones in two parts" : UNIT_LABEL[unit].title}</dd></div>
        <div><dt>Timing</dt><dd>{allAtOnce ? "No pacing" : pace.variation ? `Varies by up to ${pace.variation}%` : "Evenly spaced"}</dd></div>
        <div><dt>Pauses</dt><dd>{allAtOnce ? "None" : `${pace.sentencePauseSeconds ? `About ${pace.sentencePauseSeconds}s after sentences` : "No extra sentence pauses"}${pace.blocksOn ? ", plus scheduled block rests" : pace.breaksOn ? ", plus longer breaks when they fit" : ""}`}</dd></div>
        <div><dt>Temporary edits</dt><dd>{allAtOnce ? "Off" : corrections ? `Typos ${pace.typoRate}%, false starts ${pace.falseStartRate}%${revisionSweep ? ", plus final review" : ""}` : revisionSweep ? "Final review, then exact restoration" : "Off — clean entry"}</dd></div>
      </dl>
      <p className="hint">Your approved wording stays the same at completion. Google controls how the automated edits are grouped in version history.</p>
    </section>
  );
}

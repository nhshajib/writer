import { LONG_SENTENCE_WORDS } from "../../../supabase/functions/_shared/chunker.ts";

export function SentenceStepHint() {
  return <p className="hint sentence-step-hint">Sentences over {LONG_SENTENCE_WORDS} words are entered in two balanced parts. Your wording, punctuation and formatting stay the same. Your chosen duration controls the timing.</p>;
}

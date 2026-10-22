import type { SessionPlan } from "@/lib/types";
import { span } from "@/lib/time";
export function WritingBlockSummary({ plan }: { plan: SessionPlan | null }) {
  const blocks = plan?.block_summary;
  if (!blocks) return null;
  return <div className="block-summary" aria-live="polite">
    <strong>{blocks.blocks} writing {blocks.blocks === 1 ? "block" : "blocks"}</strong>
    <p>{span(blocks.writing_seconds * 1000)} writing + {span(blocks.rest_seconds * 1000)} long breaks{blocks.waiting_seconds > 0 ? ` + ${span(blocks.waiting_seconds * 1000)} outside writing hours` : ""} = {span(plan.duration_seconds * 1000)} total</p>
    {blocks.blocks === 1 ? <p className="hint">This schedule finishes in one writing block; no long break is needed. Smaller steps allow more places to split the writing.</p> : <p className="hint">Write → rest → continue automatically. A closed browser does not stop Google Docs sessions. Service delays can move the resume time later.</p>}
  </div>;
}

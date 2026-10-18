import Link from "next/link";
import { formatRelative } from "@/lib/dashboard";
import { type Drip, STATUS_LABEL } from "@/lib/types";

const UNIT_LABEL: Record<Drip["insertion_unit"], string> = {
  sentence: "Sentence by sentence",
  paragraph: "Paragraph by paragraph",
  chunk: "Even parts",
};

/** One session in a list: title, status, progress and a short summary. */
export function SessionRow({ drip }: { drip: Drip }) {
  const title = drip.document_title ?? "Untitled document";
  return (
    <div className="row">
      <div className="grow">
        <Link href={`/app/session?id=${drip.id}`} className="row-title">{title}</Link>
        <div className="row-sub">
          {drip.progress.words_written} of {drip.progress.words_total} words
          {" · "}{drip.mode === "as_soon_as_possible" ? "All at once" : UNIT_LABEL[drip.insertion_unit]}
          {" · "}{formatRelative(drip.created_at)}
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={`Progress for ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={drip.progress.percent}
          style={{ margin: "0.6rem 0 0", height: 6 }}
        >
          <div className="progress-fill" style={{ width: `${drip.progress.percent}%` }} />
        </div>
      </div>
      <span className={`pill ${drip.status}`}>{STATUS_LABEL[drip.status]}</span>
    </div>
  );
}

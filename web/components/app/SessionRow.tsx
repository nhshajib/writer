import Link from "next/link";
import { StatusBadge } from "@/components/app/StatusBadge";
import { formatRelative } from "@/lib/dashboard";
import type { Drip } from "@/lib/types";

/** One session in a list. The whole row opens it. */
export function SessionRow({ drip }: { drip: Drip }) {
  const title = drip.document_title ?? "Untitled document";
  return (
    <div className="list-item">
      <div className="main">
        <Link href={`/app/session?id=${drip.id}`} className="title">{title}</Link>
        <div className="meta">
          {drip.progress.words_written} of {drip.progress.words_total} words · {formatRelative(drip.created_at)}
        </div>
      </div>
      <div className="progress" style={{ width: 96 }} role="progressbar" aria-label={`Progress for ${title}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={drip.progress.percent}>
        <span style={{ width: `${drip.progress.percent}%` }} />
      </div>
      <StatusBadge status={drip.status} />
    </div>
  );
}

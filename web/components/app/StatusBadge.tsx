import { type DripStatus, STATUS_LABEL } from "@/lib/types";

const TONE: Record<DripStatus, string> = {
  scheduled: "badge-blue",
  running: "badge-blue",
  paused: "badge-amber",
  completed: "badge-green",
  failed: "badge-red",
  canceled: "",
};

export function StatusBadge({ status }: { status: DripStatus }) {
  return <span className={`badge ${TONE[status]}`}><span className="dot" aria-hidden="true" />{STATUS_LABEL[status]}</span>;
}

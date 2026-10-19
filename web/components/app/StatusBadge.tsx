import { type SessionState, STATE_LABEL } from "@/lib/types";

const TONE: Record<SessionState, string> = {
  preparing: "badge-blue",
  running: "badge-blue",
  recovering: "badge-amber",
  paused: "badge-amber",
  completed: "badge-green",
  failed: "badge-red",
  cancelled: "",
};

/** Session state as text, with colour only as a supplement. */
export function StatusBadge({ state }: { state: SessionState }) {
  return (
    <span className={`badge ${TONE[state]}`}>
      <span className="dot" aria-hidden="true" />
      <span className="sr-only">State: </span>
      {STATE_LABEL[state]}
    </span>
  );
}

import { HttpError } from "./http.ts";

const CONFIRM_FIELDS = new Set([
  "chunks_written",
  "pending_index",
  "pending_revision",
  "pending_doc_length",
  "retry_at",
  "last_revision_id",
  "last_written_at",
  "attempts",
  "conflict_runs",
  "last_error",
]);
export function validateConfirmPatch(patch: Record<string, unknown>, expected: unknown, total: number): void {
  if (
    !Number.isInteger(expected) || (expected as number) < 0 || (expected as number) >= total ||
    patch.chunks_written !== (expected as number) + 1
  ) throw new HttpError(400, "Confirm exactly the next part.");
  for (const [key, value] of Object.entries(patch)) {
    if (!CONFIRM_FIELDS.has(key)) throw new HttpError(400, "A confirmation can only record the part that was entered.");
    if (
      ["pending_index", "pending_revision", "pending_doc_length", "retry_at", "last_error"].includes(key) &&
      value !== null
    ) {
      throw new HttpError(400, "Invalid confirmation fields.");
    }
    if (["attempts", "conflict_runs"].includes(key) && value !== 0) {
      throw new HttpError(400, "Invalid confirmation fields.");
    }
    if (key === "last_revision_id" && value !== null && (typeof value !== "string" || value.length > 2000)) {
      throw new HttpError(400, "Invalid document revision.");
    }
    if (key === "last_written_at" && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) {
      throw new HttpError(400, "Invalid confirmation time.");
    }
  }
}
export const ENGINE_EVENTS = new Set([
  "chunk_written",
  "schedule_shifted",
  "retry_scheduled",
  "attention",
  "paused",
  "completed",
  "connection_checked",
  "insertion_uncertain",
]);
export function validateEngineEvents(raw: unknown): { kind: string; detail: Record<string, unknown> }[] {
  if (!Array.isArray(raw) || raw.length > 20) throw new HttpError(400, "Send at most 20 session events at a time.");
  return raw.map((e) => {
    if (
      !e || !ENGINE_EVENTS.has(e.kind) || typeof e.detail !== "object" || !e.detail || Array.isArray(e.detail) ||
      new TextEncoder().encode(JSON.stringify(e.detail)).length > 4096
    ) {
      throw new HttpError(400, "Invalid session event or event detail exceeds 4 KB.");
    }
    return { kind: e.kind, detail: e.detail };
  });
}

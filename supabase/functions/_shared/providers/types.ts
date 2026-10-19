export interface DocInfo {
  id: string;
  title: string;
  url: string | null;
}

/** What the worker needs to know about a document before and after each insertion. */
export interface DocState {
  /** Changes whenever the document's content changes. */
  revisionId: string;
  /**
   * The body text, in order. Elements that aren't text (images, page breaks,
   * tables) appear as U+FFFC so an insertion position check can't be fooled
   * by them. Google Docs bodies always end with a final "\n".
   */
  text: string;
}

export interface RevisionSummary {
  /** Revisions Google Drive reports for the file (it groups and may merge edits). */
  count: number;
  /** Revisions whose modifiedTime falls inside [from, to]. */
  in_window: number;
  first_modified: string | null;
  last_modified: string | null;
}

/** A document service the worker can write into (Google Docs, later Word Online). */
export interface DocProvider {
  readonly name: "google" | "microsoft" | "test";
  createDoc(title: string): Promise<DocInfo>;
  getDoc(documentId: string): Promise<DocInfo>;
  readDocument(documentId: string): Promise<DocState>;
  /**
   * Inserts text at the end of the body. With `requiredRevisionId`, the
   * insertion is refused (ProviderError "conflict") if the document changed
   * since that revision, so a check followed by a write can't race an edit.
   * Returns the revision after the insertion.
   */
  insertAtEnd(documentId: string, text: string, requiredRevisionId?: string): Promise<{ revisionId: string | null }>;
  /** Optional: what the provider's own version history reports, for the session log. */
  summarizeRevisions?(documentId: string, from: string, to: string): Promise<RevisionSummary>;
}

/**
 * How the worker should react to a failure:
 *   transient — retry with backoff (rate limits, 5xx, network)
 *   conflict  — the document changed between our check and our write; check again
 *   auth      — the user must reconnect the account; pause
 *   permanent — document gone / access denied / bad request; pause
 */
export type ProviderErrorKind = "transient" | "conflict" | "auth" | "permanent";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function classifyHttpStatus(status: number): ProviderErrorKind {
  if (status === 401) return "auth";
  if (status === 408 || status === 429 || status >= 500) return "transient";
  return "permanent";
}

/** Placeholder for non-text content in DocState.text. */
export const OBJECT_PLACEHOLDER = "￼";

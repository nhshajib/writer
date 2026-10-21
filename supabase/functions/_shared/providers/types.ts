import type { ChunkFormat } from "../markdown.ts";

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

/** A heading in a document, for "Insert under a heading". */
export interface DocHeading {
  /** The provider's stable id for the heading (Google: paragraphStyle.headingId). */
  id: string;
  text: string;
  level: number;
}

/** Where a session adds its text: the end of the section under this heading. */
export interface InsertTarget {
  heading_id: string;
  heading_text: string;
  level: number;
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
   * Returns the revision after the insertion. With `format` (Pro), the unit's
   * headings, bold, italic and bullets are applied in the same edit.
   *
   * A provider made with an insert target treats the end of that heading's
   * section as "the end": readDocument returns the text up to there.
   */
  insertAtEnd(
    documentId: string,
    text: string,
    requiredRevisionId?: string,
    format?: ChunkFormat | null,
  ): Promise<{ revisionId: string | null }>;
  /**
   * Replaces exactly `deleteCount` UTF-16 units at the insertion point. Used
   * only for session-owned temporary drafting text, never to edit source text
   * the person already had in the document. The revision guard is mandatory.
   */
  replaceTail?(
    documentId: string,
    deleteCount: number,
    text: string,
    requiredRevisionId: string,
    format?: ChunkFormat | null,
  ): Promise<{ revisionId: string | null }>;
  /** Confirms the account's access works (refreshes tokens), without touching any document. */
  verifyAccount(): Promise<void>;
  /**
   * Checks the document is editable without changing it: sends an edit that
   * matches nothing, refused if the document changed since `revisionId`.
   * Returns the revision afterwards.
   */
  probeEdit(documentId: string, revisionId: string): Promise<{ revisionId: string | null }>;
  /** Optional: what the provider's own version history reports, for the session log. */
  summarizeRevisions?(documentId: string, from: string, to: string): Promise<RevisionSummary>;
  /**
   * Optional (Pro): marks the document's latest revision as permanent so it is
   * never auto-compressed in the provider's own version history.
   */
  createMilestone?(documentId: string): Promise<void>;
  /** Optional (Pro): the document's headings, for "Insert under a heading". */
  listHeadings?(documentId: string): Promise<DocHeading[]>;
}

/** ProviderError codes for an insert target that can't be used. */
export const HEADING_MISSING = "heading_missing";
export const HEADING_NO_SPACE = "heading_no_space";

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
    /** A more specific reason, such as HEADING_MISSING. */
    readonly code?: string,
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
// Derive the marker from its numeric code point so source uploads stay ASCII-only.
export const OBJECT_PLACEHOLDER = String.fromCodePoint(0xfffc);

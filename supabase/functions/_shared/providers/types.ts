export interface DocInfo {
  id: string;
  title: string;
  url: string | null;
}

/** A document service the worker can write into (Google Docs, later Word Online). */
export interface DocProvider {
  readonly name: "google" | "microsoft" | "test";
  createDoc(title: string): Promise<DocInfo>;
  getDoc(documentId: string): Promise<DocInfo>;
  /** Appends text at the end of the document body. */
  appendText(documentId: string, text: string): Promise<void>;
}

/**
 * How the worker should react to a failure:
 *   transient — retry with backoff (rate limits, 5xx, network)
 *   auth      — the user must reconnect the account; stop
 *   permanent — document gone / access denied / bad request; stop
 */
export type ProviderErrorKind = "transient" | "auth" | "permanent";

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

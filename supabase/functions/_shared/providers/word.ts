import type { ChunkFormat } from "../markdown.ts";
import { type DocInfo, type DocProvider, type DocState, ProviderError } from "./types.ts";

/**
 * What TypeWit needs from the open Word document. In the add-in this is backed
 * by Word's JavaScript API (web/lib/wordHost.ts); in tests by a fake.
 */
export interface WordHost {
  /** The text of each paragraph, in order, without paragraph marks. */
  readParagraphs(): Promise<string[]>;
  /**
   * In one batch: reads the paragraphs, and only if `check` accepts them,
   * appends `lines[0]` to the last paragraph and each further line as a new
   * paragraph. Returns the paragraphs afterwards, or null if `check` refused.
   * With `format` (offsets into the lines joined by "\n"), sets bold, italic
   * and paragraph styles as it goes.
   */
  appendIf(
    check: (paragraphs: string[]) => boolean,
    lines: string[],
    format?: ChunkFormat | null,
  ): Promise<string[] | null>;
  /** Revision-checked replacement of a session-owned temporary suffix. */
  replaceTailIf?(
    check: (paragraphs: string[]) => boolean,
    deleteCount: number,
    text: string,
    format?: ChunkFormat | null,
  ): Promise<string[] | null>;
  /** False when the document is open read-only. */
  isEditable(): Promise<boolean>;
}

/**
 * The document as one string in the same shape as a Google Docs body: line
 * breaks as "\n" and a final "\n" for the last paragraph mark, so the session
 * engine's checks work unchanged. Manual line breaks (vertical tab) count as
 * line breaks.
 */
export function wordText(paragraphs: string[]): string {
  return paragraphs.map((p) => p.replace(/\r\n?|\v/g, "\n")).join("\n") + "\n";
}

/**
 * Word has no revision ids, so the revision is a hash of the text: it changes
 * exactly when the text does, which is what the engine's conditional writes
 * and interrupted-write checks rely on.
 */
export function textRevision(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `w${text.length}-${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
}

/**
 * Word document open in the TypeWit add-in. Only the document the add-in is
 * running in can be reached, so a session can't drift into another document.
 */
export class WordDocProvider implements DocProvider {
  readonly name = "microsoft" as const;

  constructor(private readonly host: WordHost, private readonly documentId: string, private readonly title: string) {}

  private ensure(documentId: string) {
    if (documentId !== this.documentId) {
      throw new ProviderError("permanent", "This session belongs to a different Word document.", 404);
    }
  }

  createDoc(): Promise<DocInfo> {
    return Promise.reject(
      new ProviderError("permanent", "Open the Word document you want to use, then start from there."),
    );
  }

  getDoc(documentId: string): Promise<DocInfo> {
    this.ensure(documentId);
    return Promise.resolve({
      id: documentId,
      title: this.title,
      url: /^https?:\/\//.test(documentId) ? documentId : null,
    });
  }

  async readDocument(documentId: string): Promise<DocState> {
    this.ensure(documentId);
    const text = wordText(await this.host.readParagraphs());
    return { revisionId: textRevision(text), text };
  }

  async insertAtEnd(documentId: string, text: string, requiredRevisionId?: string, format?: ChunkFormat | null) {
    this.ensure(documentId);
    const after = await this.host.appendIf(
      (paragraphs) => requiredRevisionId === undefined || textRevision(wordText(paragraphs)) === requiredRevisionId,
      text.split("\n"),
      format,
    );
    if (after === null) throw new ProviderError("conflict", "The document changed.", 400);
    return { revisionId: textRevision(wordText(after)) };
  }

  async replaceTail(
    documentId: string,
    deleteCount: number,
    text: string,
    requiredRevisionId: string,
    format?: ChunkFormat | null,
  ) {
    this.ensure(documentId);
    if (!Number.isSafeInteger(deleteCount) || deleteCount <= 0 || !requiredRevisionId) {
      throw new ProviderError("permanent", "Invalid tail correction.");
    }
    if (!this.host.replaceTailIf) {
      throw new ProviderError("permanent", "This Word host does not support simulated drafting corrections.", 422);
    }
    const after = await this.host.replaceTailIf(
      (paragraphs) => textRevision(wordText(paragraphs)) === requiredRevisionId,
      deleteCount,
      text,
      format,
    );
    if (after === null) throw new ProviderError("conflict", "The document changed.", 400);
    return { revisionId: textRevision(wordText(after)) };
  }

  verifyAccount(): Promise<void> {
    return Promise.resolve();
  }

  async probeEdit(documentId: string, revisionId: string) {
    this.ensure(documentId);
    if (!(await this.host.isEditable())) {
      throw new ProviderError("permanent", "The document is open read-only.", 403);
    }
    const doc = await this.readDocument(documentId);
    if (doc.revisionId !== revisionId) throw new ProviderError("conflict", "The document changed.", 400);
    return { revisionId: doc.revisionId };
  }
}

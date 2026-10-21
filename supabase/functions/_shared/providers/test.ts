import type { SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";
import { type DocInfo, type DocProvider, type DocState, ProviderError } from "./types.ts";

/**
 * Writes into the `test_documents` table. Lets the whole scheduling pipeline be
 * verified end to end without Google credentials. `revision` plays the part of
 * Google's revisionId, and edits made directly in the table count as edits by
 * someone else.
 */
export class TestDocProvider implements DocProvider {
  readonly name = "test" as const;

  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async createDoc(title: string): Promise<DocInfo> {
    const { data, error } = await this.db
      .from("test_documents")
      .insert({ user_id: this.userId, title })
      .select("id, title")
      .single();
    if (error) throw new ProviderError("transient", error.message);
    return { id: data.id, title: data.title, url: null };
  }

  async getDoc(documentId: string): Promise<DocInfo> {
    const { data, error } = await this.db
      .from("test_documents")
      .select("id, title")
      .eq("id", documentId)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new ProviderError("transient", error.message);
    if (!data) throw new ProviderError("permanent", "Test document not found.", 404);
    return { id: data.id, title: data.title, url: null };
  }

  async readDocument(documentId: string): Promise<DocState> {
    const { data, error } = await this.db
      .from("test_documents")
      .select("content, revision")
      .eq("id", documentId)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new ProviderError("transient", error.message);
    if (!data) throw new ProviderError("permanent", "Test document not found.", 404);
    // Like a Google Docs body, the text ends with a final newline.
    return { revisionId: String(data.revision), text: `${data.content}\n` };
  }

  verifyAccount(): Promise<void> {
    return Promise.resolve();
  }

  async probeEdit(documentId: string, revisionId: string) {
    const doc = await this.readDocument(documentId);
    if (doc.revisionId !== revisionId) throw new ProviderError("conflict", "The document changed.", 400);
    return { revisionId: doc.revisionId };
  }

  async replaceTail(documentId: string, deleteCount: number, text: string, requiredRevisionId: string) {
    if (
      !Number.isSafeInteger(deleteCount) || deleteCount <= 0 || !/^\d+$/.test(requiredRevisionId) ||
      !Number.isSafeInteger(Number(requiredRevisionId))
    ) {
      throw new ProviderError("permanent", "Invalid tail correction.");
    }
    const { data, error } = await this.db.rpc("replace_test_document_tail_checked", {
      doc_id: documentId,
      owner_id: this.userId,
      delete_utf16: deleteCount,
      replacement: text,
      required_revision: Number(requiredRevisionId),
    });
    if (error) {
      if (/revision_mismatch/.test(error.message)) throw new ProviderError("conflict", "The document changed.", 400);
      if (/tail_out_of_range|document_not_found/.test(error.message)) {
        throw new ProviderError("permanent", "The temporary text is no longer at the insertion point.", 422);
      }
      throw new ProviderError("transient", error.message);
    }
    return { revisionId: String(data) };
  }

  async insertAtEnd(documentId: string, text: string, requiredRevisionId?: string) {
    const { data, error } = await this.db.rpc("append_test_document_checked", {
      doc_id: documentId,
      owner_id: this.userId,
      chunk: text,
      required_revision: requiredRevisionId === undefined ? null : Number(requiredRevisionId),
    });
    if (error) {
      if (/revision_mismatch/.test(error.message)) throw new ProviderError("conflict", "The document changed.", 400);
      throw new ProviderError("transient", error.message);
    }
    return { revisionId: String(data) };
  }
}

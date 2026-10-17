import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { type DocInfo, type DocProvider, ProviderError } from "./types.ts";

/**
 * Writes into the `test_documents` table. Lets the whole scheduling pipeline be
 * verified end to end without Google credentials.
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

  async appendText(documentId: string, text: string): Promise<void> {
    const { error } = await this.db.rpc("append_test_document", { doc_id: documentId, chunk: text });
    if (error) throw new ProviderError("transient", error.message);
  }
}

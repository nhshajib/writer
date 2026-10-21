import { decrypt, encrypt } from "./crypto.ts";
import { adminClient, encryptionKey } from "./env.ts";
import { googleClientConfig } from "./oauth.ts";
import { GoogleDocsProvider, refreshAccessToken } from "./providers/google.ts";
import { TestDocProvider } from "./providers/test.ts";
import { type DocProvider, type InsertTarget, ProviderError } from "./providers/types.ts";

export interface ConnectionRow {
  id: string;
  user_id: string;
  provider: "google" | "microsoft" | "test";
  account_email: string | null;
  refresh_token_enc: string | null;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
}

const CONNECTION_COLUMNS =
  "id, user_id, provider, account_email, refresh_token_enc, access_token_enc, access_token_expires_at";

/** Loads a connection, scoped to its owner. */
export async function loadConnection(id: string, userId: string): Promise<ConnectionRow | null> {
  const { data, error } = await adminClient()
    .from("provider_connections")
    .select(CONNECTION_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConnectionRow | null;
}

export async function loadConnectionsByIds(ids: string[]): Promise<Map<string, ConnectionRow>> {
  const map = new Map<string, ConnectionRow>();
  if (ids.length === 0) return map;
  const { data, error } = await adminClient().from("provider_connections").select(CONNECTION_COLUMNS).in("id", ids);
  if (error) throw new Error(error.message);
  for (const row of data as ConnectionRow[]) map.set(row.id, row);
  return map;
}

/** With `target` (Pro), the provider adds text at the end of that heading's section. */
export function providerFor(connection: ConnectionRow, target: InsertTarget | null = null): DocProvider {
  switch (connection.provider) {
    case "google":
      return new GoogleDocsProvider((force) => googleAccessToken(connection, force), fetch, target);
    case "test":
      return new TestDocProvider(adminClient(), connection.user_id);
    case "microsoft":
      throw new ProviderError(
        "permanent",
        "Word sessions run in the TypeWit add-in in Word, not on TypeWit's servers.",
      );
  }
}

/** Seconds of headroom before expiry at which a cached access token is refreshed. */
const EXPIRY_SKEW_SECONDS = 60;

/**
 * Returns a valid Google access token for the connection, refreshing (and
 * persisting the new ciphertext) when the cached one is missing, near expiry,
 * or `force` is set. Mutates `connection` so repeated calls in one tick reuse it.
 */
export async function googleAccessToken(connection: ConnectionRow, force = false): Promise<string> {
  const key = await encryptionKey();
  const expiresAt = connection.access_token_expires_at ? Date.parse(connection.access_token_expires_at) : 0;

  if (!force && connection.access_token_enc && expiresAt - EXPIRY_SKEW_SECONDS * 1000 > Date.now()) {
    return await decrypt(connection.access_token_enc, key);
  }

  if (!connection.refresh_token_enc) {
    throw new ProviderError("auth", "No refresh token stored for this Google account.");
  }

  const refreshToken = await decrypt(connection.refresh_token_enc, key);
  const tokens = await refreshAccessToken(refreshToken, googleClientConfig());

  connection.access_token_enc = await encrypt(tokens.access_token, key);
  connection.access_token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const update: Record<string, string> = {
    access_token_enc: connection.access_token_enc,
    access_token_expires_at: connection.access_token_expires_at,
  };
  if (tokens.refresh_token) {
    connection.refresh_token_enc = await encrypt(tokens.refresh_token, key);
    update.refresh_token_enc = connection.refresh_token_enc;
  }

  const { error } = await adminClient().from("provider_connections").update(update).eq("id", connection.id);
  if (error) console.error("Failed to persist refreshed Google token", error.message);

  return tokens.access_token;
}

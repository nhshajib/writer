import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}.`);
  return value;
}

let serviceClient: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Never expose it to callers. */
export function adminClient(): SupabaseClient {
  serviceClient ??= createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

const secretCache = new Map<string, string>();

/**
 * Reads a secret from the function environment, falling back to a Vault entry
 * (read through the service-role-only `get_app_secret` RPC).
 */
export async function getSecret(envName: string, vaultName: string): Promise<string> {
  const fromEnv = Deno.env.get(envName);
  if (fromEnv) return fromEnv;

  const cached = secretCache.get(vaultName);
  if (cached) return cached;

  const { data, error } = await adminClient().rpc("get_app_secret", { secret_name: vaultName });
  if (error || !data) {
    throw new Error(`Secret ${envName} is not configured (env or Vault "${vaultName}").`);
  }
  secretCache.set(vaultName, data as string);
  return data as string;
}

export function encryptionKey(): Promise<string> {
  return getSecret("TOKEN_ENCRYPTION_KEY", "token_encryption_key");
}

/** The database-backed test provider is for development; it is off unless explicitly turned on. */
export function testProviderEnabled(): boolean {
  return Deno.env.get("ENABLE_TEST_PROVIDER") === "true";
}

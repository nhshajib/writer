/**
 * AES-256-GCM for OAuth tokens at rest, plus HMAC signing for OAuth `state`.
 *
 * Ciphertext format: "v1.<base64url iv>.<base64url ciphertext+tag>".
 * The key is any string; it is stretched to 256 bits with SHA-256.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function rawKey(secret: string): Promise<ArrayBuffer> {
  if (!secret) {
    throw new Error("Encryption key is not configured.");
  }
  return await crypto.subtle.digest("SHA-256", encoder.encode(secret));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", await rawKey(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  // Domain-separate the signing key from the encryption key.
  return await crypto.subtle.importKey(
    "raw",
    await rawKey(`hmac:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encrypt(plaintext: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), encoder.encode(plaintext));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(data))}`;
}

export async function decrypt(token: string, secret: string): Promise<string> {
  const [version, iv, data] = token.split(".");
  if (version !== "v1" || !iv || !data) {
    throw new Error("Unrecognized ciphertext format.");
  }
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    await aesKey(secret),
    fromBase64Url(data),
  );
  return decoder.decode(plain);
}

/** Signs a JSON payload: "<base64url payload>.<base64url signature>". */
export async function sign(payload: unknown, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Verifies a value from `sign`; returns the payload, or null if tampered. */
export async function verify<T>(token: string, secret: string): Promise<T | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(sig), encoder.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    return JSON.parse(decoder.decode(fromBase64Url(body))) as T;
  } catch {
    return null;
  }
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/** Hex SHA-256 of a UTF-8 string. Used to tie an approval to the exact text. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

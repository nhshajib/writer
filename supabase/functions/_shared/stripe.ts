/**
 * Minimal Stripe REST client (form-encoded requests) and webhook signature
 * verification. Avoids pulling the Node SDK into the Edge runtime.
 */

const encoder = new TextEncoder();

export class StripeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "StripeError";
  }
}

export async function stripeRequest<T>(
  secretKey: string,
  path: string,
  params: Record<string, string> = {},
  fetchFn: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchFn(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StripeError(res.status, body?.error?.message ?? `Stripe request failed (${res.status}).`);
  }
  return body as T;
}

/**
 * Verifies a `Stripe-Signature` header ("t=...,v1=...,v1=...") against the raw
 * request body. Rejects signatures older than `toleranceSeconds`.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!header || !secret) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  const t = Number(timestamp);
  if (!Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowMs / 1000 - t) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Subscription statuses that give the user Pro features. */
export function planForSubscriptionStatus(status: string | null | undefined): "pro" | "free" {
  return status === "trialing" || status === "active" || status === "past_due" ? "pro" : "free";
}

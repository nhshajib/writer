/**
 * Minimal Stripe REST client (form-encoded requests) and webhook signature
 * verification. Avoids pulling the Node SDK into the Edge runtime.
 */

const encoder = new TextEncoder();

export class StripeError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly param?: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

export async function stripeRequest<T>(
  secretKey: string,
  path: string,
  params: Record<string, string> = {},
  fetchFn: typeof fetch = fetch,
  idempotencyKey?: string,
  apiVersion?: string,
): Promise<T> {
  const res = await fetchFn(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(apiVersion ? { "Stripe-Version": apiVersion } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StripeError(
      res.status,
      body?.error?.message ?? `Stripe request failed (${res.status}).`,
      typeof body?.error?.code === "string" ? body.error.code : undefined,
      typeof body?.error?.param === "string" ? body.error.param : undefined,
    );
  }
  return body as T;
}

/** A read from the Stripe API: parameters go in the query string. */
export async function stripeGet<T>(
  secretKey: string,
  path: string,
  params: Record<string, string> = {},
  fetchFn: typeof fetch = fetch,
): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const res = await fetchFn(`https://api.stripe.com/v1/${path}${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StripeError(
      res.status,
      body?.error?.message ?? `Stripe request failed (${res.status}).`,
      typeof body?.error?.code === "string" ? body.error.code : undefined,
      typeof body?.error?.param === "string" ? body.error.param : undefined,
    );
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

export interface CustomerSubscription {
  id: string;
  status: string;
  customer?: string;
  trial_end?: number | null;
  metadata?: { user_id?: string };
}
export function subscriptionHasNotEnded(status: string | null | undefined): boolean {
  return Boolean(status && status !== "canceled" && status !== "incomplete_expired");
}
/** Prefer a paying/trial subscription, then another non-ended subscription. */
export function preferredSubscription<T extends CustomerSubscription>(subscriptions: T[]): T | null {
  return subscriptions.find((s) => planForSubscriptionStatus(s.status) === "pro") ??
    subscriptions.find((s) => subscriptionHasNotEnded(s.status)) ?? subscriptions[0] ?? null;
}
/** Read every page; a canceled newest subscription must not hide a live older one. */
export async function customerSubscriptions<T extends CustomerSubscription>(
  secret: string,
  customer: string,
  expandPaymentMethod = false,
  fetchFn: typeof fetch = fetch,
): Promise<T[]> {
  const subscriptions: T[] = [];
  let cursor = "";
  for (let page = 0; page < 100; page++) {
    const list = await stripeGet<{ data: T[]; has_more?: boolean }>(secret, "subscriptions", {
      customer,
      status: "all",
      limit: "100",
      ...(cursor ? { starting_after: cursor } : {}),
      ...(expandPaymentMethod ? { "expand[]": "data.default_payment_method" } : {}),
    }, fetchFn);
    subscriptions.push(...list.data);
    if (!list.has_more) return subscriptions;
    const next = list.data.at(-1)?.id;
    if (!next || next === cursor) throw new StripeError(502, "Subscription list could not be completed.");
    cursor = next;
  }
  // Never infer Free from a partial list.
  throw new StripeError(502, "Subscription list could not be completed.");
}

/** Only a missing customer reference is recoverable; missing prices and API failures are not. */
export function isMissingStripeCustomer(error: unknown): boolean {
  return error instanceof StripeError && (error.status === 400 || error.status === 404) &&
    error.code === "resource_missing" && error.param === "customer";
}

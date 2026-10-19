import { adminClient } from "./env.ts";
import { HttpError } from "./http.ts";

/** Per-user request budgets: [max requests, window in seconds]. */
export const RATE_LIMITS = {
  start: [30, 3600],
  document: [20, 3600],
  plan: [600, 3600],
  check: [60, 3600],
  picker: [60, 3600],
} as const satisfies Record<string, readonly [number, number]>;

/**
 * Counts one request against the user's budget and throws 429 once it is used
 * up. If the counter itself fails, the request goes through: a database hiccup
 * shouldn't lock people out.
 */
export async function rateLimit(userId: string, bucket: keyof typeof RATE_LIMITS): Promise<void> {
  const [max, windowSeconds] = RATE_LIMITS[bucket];
  const { data, error } = await adminClient().rpc("hit_rate_limit", {
    owner: userId,
    bucket_name: bucket,
    max_hits: max,
    window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return;
  }
  if (data === false) {
    throw new HttpError(429, "Too many requests. Wait a few minutes and try again.");
  }
}

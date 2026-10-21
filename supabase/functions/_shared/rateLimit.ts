import { adminClient } from "./env.ts";
import { HttpError } from "./http.ts";

/** Per-user request budgets: [max requests, window in seconds]. */
export const RATE_LIMITS = {
  start: [30, 3600],
  pause: [120, 60],
  resume: [120, 60],
  cancel: [120, 60],
  engine: [2000, 60],
  clear: [30, 60],
  delete: [120, 60],
  disconnect: [30, 60],
  microsoft: [120, 60],
  document: [20, 3600],
  plan: [600, 3600],
  check: [60, 3600],
  picker: [60, 3600],
  googleConnect: [60, 3600],
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

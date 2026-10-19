import { adminClient } from "./env.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Older than this, short-lived bookkeeping rows are deleted (see cleanupOldData). */
export const RETENTION = {
  startRequestsDays: 7,
  rateLimitsDays: 2,
  stripeEventsDays: 90,
  readNotificationsDays: 90,
} as const;

/**
 * Records that the worker ran, and once a day deletes bookkeeping that is only
 * needed briefly. Sessions, their logs and unread notifications are kept until
 * people delete them. Problems are logged, never thrown: housekeeping must not
 * hold up a tick.
 */
export async function housekeeping(claimed: number, now = Date.now()): Promise<void> {
  try {
    const db = adminClient();
    const { data } = await db.from("worker_heartbeat").select("last_cleanup_at").eq("id", 1).maybeSingle();
    const due = !data?.last_cleanup_at || now - Date.parse(data.last_cleanup_at) >= DAY_MS;
    await db.from("worker_heartbeat").upsert({
      id: 1,
      last_tick_at: new Date(now).toISOString(),
      last_claimed: claimed,
      ...(due ? { last_cleanup_at: new Date(now).toISOString() } : {}),
    });
    if (due) await cleanupOldData(now);
  } catch (error) {
    console.error("Housekeeping failed", error);
  }
}

async function cleanupOldData(now: number): Promise<void> {
  const db = adminClient();
  const before = (days: number) => new Date(now - days * DAY_MS).toISOString();
  const results = await Promise.all([
    db.from("start_requests").delete().lt("created_at", before(RETENTION.startRequestsDays)),
    db.from("rate_limits").delete().lt("window_start", before(RETENTION.rateLimitsDays)),
    db.from("stripe_events").delete().lt("received_at", before(RETENTION.stripeEventsDays)),
    db.from("notifications").delete().not("read_at", "is", null).lt("read_at", before(RETENTION.readNotificationsDays)),
  ]);
  for (const { error } of results) if (error) console.error("Clean-up failed", error.message);
}

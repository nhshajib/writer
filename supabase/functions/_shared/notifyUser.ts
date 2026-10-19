import { adminClient } from "./env.ts";
import { buildEmail, buildNotification, emailConfigFromEnv, type NotificationKind, sendEmail } from "./notify.ts";

export interface NotifiableDrip {
  id: string;
  user_id: string;
  document_title: string | null;
  document_url: string | null;
  word_count: number;
  chunks_written: number;
  total_chunks: number;
}

/** Records an in-app notification (once per drip and kind) and emails the user if configured. */
export async function notifyUser(drip: NotifiableDrip, kind: NotificationKind): Promise<void> {
  try {
    const db = adminClient();
    const { data: current } = await db.from("drips").select("chunks_written, last_error").eq("id", drip.id)
      .maybeSingle();
    const notifyDrip = {
      document_title: drip.document_title,
      document_url: drip.document_url,
      word_count: drip.word_count,
      chunks_written: current?.chunks_written ?? drip.chunks_written,
      total_chunks: drip.total_chunks,
      last_error: current?.last_error ?? null,
    };
    const content = buildNotification(kind, notifyDrip);

    const { data: inserted, error } = await db
      .from("notifications")
      .upsert(
        { user_id: drip.user_id, drip_id: drip.id, kind, title: content.title, body: content.body },
        { onConflict: "drip_id,kind", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    if (!inserted?.length) return; // already notified

    const { data: profile } = await db.from("profiles")
      .select("email_notifications, email_on_completed, email_on_attention")
      .eq("user_id", drip.user_id)
      .maybeSingle();
    if (!wantsEmail(profile, kind)) return;

    const { data: userData } = await db.auth.admin.getUserById(drip.user_id);
    const email = userData?.user?.email;
    if (!email) return;

    const result = await sendEmail(
      email,
      buildEmail(content, notifyDrip, Deno.env.get("APP_URL")),
      emailConfigFromEnv(),
    );
    if (result === "sent") {
      await db.from("notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", inserted[0].id);
    }
  } catch (error) {
    // Never let a notification problem affect the session itself.
    console.error("Failed to notify user", drip.id, error);
  }
}

/** email_notifications is the master switch; the others choose per kind of update. */
export function wantsEmail(
  profile: { email_notifications?: boolean; email_on_completed?: boolean; email_on_attention?: boolean } | null,
  kind: NotificationKind,
): boolean {
  if (!profile) return true;
  if (profile.email_notifications === false) return false;
  if (kind === "drip_completed") return profile.email_on_completed !== false;
  if (kind === "drip_attention") return profile.email_on_attention !== false;
  return true;
}

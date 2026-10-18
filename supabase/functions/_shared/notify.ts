export type NotificationKind = "drip_completed" | "drip_failed";

export interface NotifyDrip {
  document_title: string | null;
  document_url: string | null;
  word_count: number;
  chunks_written: number;
  total_chunks: number;
  last_error: string | null;
}

export interface NotificationContent {
  title: string;
  body: string;
}

export function buildNotification(kind: NotificationKind, drip: NotifyDrip): NotificationContent {
  const name = drip.document_title ? `"${drip.document_title}"` : "your document";
  if (kind === "drip_completed") {
    return {
      title: "Your text is fully written",
      body: `All ${drip.word_count} words have been added to ${name}.`,
    };
  }
  return {
    title: "Writing stopped because of an error",
    body: `Writing into ${name} stopped after ${drip.chunks_written} of ${drip.total_chunks} parts. ` +
      `${drip.last_error ?? "An unknown error occurred."}`,
  };
}

export interface EmailMessage {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildEmail(content: NotificationContent, drip: NotifyDrip, appUrl?: string): EmailMessage {
  const links: string[] = [];
  if (drip.document_url) links.push(`Open the document: ${drip.document_url}`);
  if (appUrl) links.push(`View details: ${appUrl}`);

  const text = [content.body, ...links].join("\n\n");
  const html = `<p>${escapeHtml(content.body)}</p>` +
    (drip.document_url ? `<p><a href="${escapeHtml(drip.document_url)}">Open the document</a></p>` : "") +
    (appUrl ? `<p><a href="${escapeHtml(appUrl)}">View details</a></p>` : "");
  return { subject: content.title, text, html };
}

export interface EmailConfig {
  apiKey?: string;
  from: string;
}

export function emailConfigFromEnv(): EmailConfig {
  return {
    apiKey: Deno.env.get("RESEND_API_KEY") || undefined,
    from: Deno.env.get("EMAIL_FROM") || "TypeWit <onboarding@resend.dev>",
  };
}

export type SendResult = "sent" | "skipped" | "failed";

/** Sends through Resend. Returns "skipped" when no API key is configured. */
export async function sendEmail(
  to: string,
  message: EmailMessage,
  config: EmailConfig,
  fetchFn: typeof fetch = fetch,
): Promise<SendResult> {
  if (!config.apiKey) return "skipped";
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [to], ...message }),
    });
    if (!res.ok) {
      console.error("Email provider rejected the message", res.status, await res.text().catch(() => ""));
      return "failed";
    }
    await res.body?.cancel();
    return "sent";
  } catch (error) {
    console.error("Email send failed", error);
    return "failed";
  }
}

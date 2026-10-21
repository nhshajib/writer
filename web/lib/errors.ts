/**
 * Turns raw provider errors (Google API messages, network failures) into a
 * short explanation and a next step. Messages TypeWit already writes for people
 * are left as they are (null).
 */
export interface FriendlyError {
  title: string;
  help: string;
  action?: { label: string; href: string };
  /** The original text with anything that looks like a key or token removed. */
  details: string;
}

const RULES: { test: RegExp; title: string; help: string; action?: FriendlyError["action"] }[] = [
  {
    test: /has not been used in project|is disabled|accessNotConfigured|SERVICE_DISABLED|API has not been enabled/i,
    title: "Google Docs isn't available to TypeWit right now",
    help: "This is a setup problem on TypeWit's side, not with your document. Please let us know; your text is safe and the session can continue once it's fixed.",
    action: { label: "Contact support", href: "/support/" },
  },
  {
    test: /invalid_grant|token has been (expired|revoked)|unauthenticated|invalid credentials|\b401\b/i,
    title: "TypeWit lost access to your Google account",
    help: "This happens when access is removed in your Google account. Reconnect Google, then resume.",
    action: { label: "Reconnect Google", href: "/app/connections/" },
  },
  {
    test: /permission|insufficient|forbidden|\b403\b/i,
    title: "TypeWit can't edit this document",
    help: "The document may have been shared as view-only, or moved. Open it to check, or choose it again from Google Drive.",
  },
  {
    test: /not found|\b404\b|was deleted|trashed/i,
    title: "The document can't be found",
    help: "It may have been deleted or moved to the bin. Restore it in Google Drive, or run the session again into another document.",
  },
  {
    test: /quota|rate limit|too many requests|\b429\b/i,
    title: "Google Docs is busy",
    help: "Google asked TypeWit to slow down. It retries on its own; nothing you typed is lost.",
  },
  {
    test: /network|failed to fetch|timed? ?out|ECONN|ETIMEDOUT|socket|\b50[0-4]\b|unavailable/i,
    title: "Couldn't reach Google Docs",
    help: "This is usually brief. TypeWit retries on its own and moves the rest of the schedule later rather than rushing.",
  },
];

/** Removes things that look like secrets: Google tokens and keys, bearer tokens and long opaque strings. */
export function redact(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [hidden]")
    .replace(/\b(ya29\.[\w.-]+|AIza[\w-]{20,}|1\/\/[\w-]{20,})/g, "[hidden]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[hidden]");
}

export function friendlyError(message: string | null | undefined): FriendlyError | null {
  if (!message) return null;
  const rule = RULES.find((r) => r.test.test(message));
  if (!rule) return null;
  return { title: rule.title, help: rule.help, action: rule.action, details: redact(message) };
}

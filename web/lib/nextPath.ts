/** A same-site path to go to after signing in; anything else (another site, "//host") falls back to the dashboard. */
export function safeNext(raw: string | null | undefined, fallback = "/app/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

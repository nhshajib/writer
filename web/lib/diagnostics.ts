import { functionsUrl, supabase } from "./supabase";

type Kind = "runtime" | "promise" | "api_network" | "api_server";
let windowStart = 0, sent = 0;
const seen = new Set<string>();

/** Best-effort categories only; no messages, stacks, text, full URLs or persistent queue. */
export function reportClientIssue(kind: Kind, status = 0, requestId?: string | null): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const surface = path.startsWith("/app") ? "dashboard" : path.startsWith("/word") ? "word"
    : /^\/(?:login|signup|reset-password|auth)(?:\/|$)/.test(path) ? "auth" : "public";
  const now = Date.now();
  if (now - windowStart >= 60_000) { windowStart = now; sent = 0; seen.clear(); }
  const key = `${kind}:${surface}:${status}`;
  if (sent >= 10 || seen.has(key)) return;
  sent++; seen.add(key);
  void (async () => {
    const { data } = await supabase().auth.getSession();
    if (!data.session?.access_token) return;
    const response = await fetch(`${functionsUrl}/drips/client-errors`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ kind, surface, status, release: process.env.NEXT_PUBLIC_RELEASE ?? "local",
        ...(requestId && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId) ? { request_id: requestId } : {}) }),
      signal: AbortSignal.timeout(3_000),
    });
    await response.body?.cancel();
  })().catch(() => undefined); // Diagnostics must never replace the original UI result or recurse.
}

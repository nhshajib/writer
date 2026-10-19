import { functionsUrl, supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Plan problems (422 from POST /drips) or the attention a resume still needs (409). */
    readonly problems: { code: string; message: string }[] = [],
    readonly attention: string | null = null,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Calls a TypeWit Edge Function as the signed-in user. */
export async function api<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // No response at all: offline, blocked, or too slow. Status 0 tells callers the request may not have arrived.
    throw new ApiError(0, navigator.onLine === false
      ? "You're offline. Check your internet connection and try again."
      : "TypeWit didn't respond. Check your connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429 && !body?.error) throw new ApiError(429, "Too many requests. Wait a few minutes and try again.");
    throw new ApiError(res.status, body?.error ?? "Something went wrong. Please try again.", body?.problems ?? [], body?.attention ?? null);
  }
  return body as T;
}

/** Hex SHA-256 of the exact text, sent with the approval. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

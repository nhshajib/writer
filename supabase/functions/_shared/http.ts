import { diagnosticFailure } from "./diagnostics.ts";

export const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-request-id",
  "Vary": "Origin",
};

/**
 * Sites allowed to call the API from a browser: the app itself (APP_URL and
 * typewit.com, which also serves the Word add-in), local development, and any
 * extra origins in CORS_EXTRA_ORIGINS (comma-separated, e.g. a preview site).
 */
export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  const allowed = new Set(["https://typewit.com", "https://www.typewit.com"]);
  const app = Deno.env.get("APP_URL");
  if (app) {
    try {
      allowed.add(new URL(app).origin);
    } catch {
      // Ignore a malformed APP_URL here; it fails louder where it is used.
    }
  }
  for (const extra of (Deno.env.get("CORS_EXTRA_ORIGINS") ?? "").split(",")) {
    if (extra.trim()) allowed.add(extra.trim().replace(/\/$/, ""));
  }
  return allowed.has(origin) ? origin : null;
}

function withCors(response: Response, origin: string | null, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", requestId);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  const allowed = allowedOrigin(origin);
  if (allowed) headers.set("Access-Control-Allow-Origin", allowed);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  const limit = /active_drip_limit:(\d+)/.exec(error instanceof Error ? error.message : "");
  if (limit) {
    return json({ error: `Your plan allows ${limit[1]} active session${limit[1] === "1" ? "" : "s"} at a time.` }, 422);
  }
  return json({ error: "TypeWit could not complete this request. Please try again." }, 500);
}

/** Covers normal rich-text payloads and Word recovery without accepting unbounded JSON. */
export const MAX_BODY_BYTES = 16 * 1024 * 1024;

/** Count actual streamed UTF-8 bytes: Content-Length is only an early hint. */
export async function readTextBounded(req: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const tooLarge = () => new HttpError(413, "This request is too large. Reduce the text or formatting and try again.");
  if (Number(req.headers.get("content-length")) > maxBytes) {
    void req.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes || parts.length >= 65_536) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

export async function readJson<T>(req: Request, maxBytes = MAX_BODY_BYTES): Promise<T> {
  const text = await readTextBounded(req, maxBytes);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  return body as T;
}

/** Wraps a handler with CORS preflight handling and error mapping. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    const origin = req.headers.get("Origin");
    const requestId = crypto.randomUUID();
    if (req.method === "OPTIONS") {
      return withCors(new Response("ok"), origin, requestId);
    }
    try {
      return withCors(await handler(req), origin, requestId);
    } catch (error) {
      const response = errorResponse(error);
      if (response.status >= 500) {
        const services = [
          "drips",
          "drip-tick",
          "billing",
          "stripe-webhook",
          "google-oauth-start",
          "google-oauth-callback",
        ];
        const service = new URL(req.url).pathname.split("/").find((part) => services.includes(part)) ?? "unknown";
        console.error("typewit.request_error", {
          service,
          status: response.status,
          request_id: requestId,
          ...diagnosticFailure(error),
        });
      }
      return withCors(response, origin, requestId);
    }
  });
}

export const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
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
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  console.error(error);
  const limit = /active_drip_limit:(\d+)/.exec(error instanceof Error ? error.message : "");
  if (limit) {
    return json({ error: `Your plan allows ${limit[1]} active session${limit[1] === "1" ? "" : "s"} at a time.` }, 422);
  }
  return json({ error: "TypeWit could not complete this request. Please try again." }, 500);
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

/** Wraps a handler with CORS preflight handling and error mapping. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") {
      return withCors(new Response("ok"), origin);
    }
    try {
      return withCors(await handler(req), origin);
    } catch (error) {
      return withCors(errorResponse(error), origin);
    }
  });
}

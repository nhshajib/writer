import { HttpError, json, readJson } from "./http.ts";

/** Authenticated, rate-limited at the route. Only a small fixed vocabulary reaches logs. */
export async function acceptClientDiagnostic(req: Request): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(req, 2048);
  const allowed = ["kind", "surface", "status", "release", "request_id"];
  if (
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    typeof body.kind !== "string" || !["runtime", "promise", "api_network", "api_server"].includes(body.kind) ||
    typeof body.surface !== "string" || !["public", "auth", "word", "dashboard"].includes(body.surface) ||
    !(body.status === 0 || Number.isInteger(body.status) && Number(body.status) >= 500 && Number(body.status) <= 599) ||
    typeof body.release !== "string" || !/^(?:local|[a-f0-9]{7,40})$/i.test(body.release) ||
    body.request_id !== undefined &&
      (typeof body.request_id !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.request_id))
  ) {
    throw new HttpError(400, "Invalid diagnostic category.");
  }
  console.error("typewit.client_error", {
    source: "client",
    kind: body.kind,
    surface: body.surface,
    status: body.status,
    release: body.release,
    ...(body.request_id ? { request_id: body.request_id } : {}),
  });
  return json({ accepted: true });
}

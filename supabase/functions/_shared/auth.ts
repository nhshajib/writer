import { adminClient } from "./env.ts";
import { HttpError } from "./http.ts";

/** Resolves the calling user from the `Authorization: Bearer <jwt>` header. */
export async function requireUser(req: Request): Promise<{ id: string; email: string | null }> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing bearer token.");

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session.");
  return { id: data.user.id, email: data.user.email ?? null };
}

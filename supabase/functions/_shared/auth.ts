import { adminClient } from "./env.ts";
import { HttpError } from "./http.ts";

/** Resolves the calling user from the `Authorization: Bearer <jwt>` header. */
export async function requireUser(
  req: Request,
  options: { allowIneligible?: boolean } = {},
): Promise<{ id: string; email: string | null; eligibilityBlocked: boolean }> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing bearer token.");

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session.");
  const { data: profile, error: profileError } = await adminClient().from("profiles")
    .select("eligibility_blocked_at").eq("user_id", data.user.id).maybeSingle();
  if (profileError) throw new HttpError(503, "Your account could not be checked. Please try again.");
  if (
    profile?.eligibility_blocked_at && !options.allowIneligible &&
    !new URL(req.url).pathname.endsWith("/drips/account/delete")
  ) {
    throw new HttpError(403, "Sorry, you can't use TypeWit with these age details.");
  }
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    eligibilityBlocked: Boolean(profile?.eligibility_blocked_at),
  };
}

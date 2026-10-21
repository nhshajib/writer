import { assertEquals } from "jsr:@std/assert@1.0.13";
import { notifyUser } from "../functions/_shared/notifyUser.ts";

Deno.test("audit 12: repeat attention keeps fresh in-app notices but sends only one email per minute", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_FROM"];
  const before = names.map((n) => Deno.env.get(n));
  const originalFetch = globalThis.fetch;
  const owner = crypto.randomUUID();
  const id = crypto.randomUUID();
  let stamp: string | null = null;
  let notices = 0;
  let emails = 0;
  try {
    ["http://database.invalid", "fixture-key", "fixture-email-key", "TypeWit <fixture@example.invalid>"].forEach((
      v,
      i,
    ) => Deno.env.set(names[i], v));
    globalThis.fetch = (async (input, init) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname.endsWith("/drips")) {
        if (init?.method === "PATCH") {
          const body = JSON.parse(String(init.body));
          if (stamp && url.searchParams.has("or")) return Response.json([]);
          stamp = body.last_attention_email_at;
          return Response.json([{ id }]);
        }
        return Response.json({
          chunks_written: 1,
          last_error: "Testing attention notice",
          last_attention_email_at: stamp,
        });
      }
      if (url.pathname.endsWith("/notifications")) {
        if (init?.method === "POST") {
          notices++;
          return Response.json([{ id: crypto.randomUUID() }]);
        }
        return Response.json(null);
      }
      if (url.pathname.endsWith("/profiles")) {
        return Response.json({ email_notifications: true, email_on_attention: true });
      }
      if (url.pathname.includes("/auth/v1/admin/users/")) {
        return Response.json({ id: owner, email: "fixture@example.invalid" });
      }
      if (url.hostname === "api.resend.com") {
        emails++;
        return Response.json({ id: "fixture-mail" });
      }
      throw new Error(`Unexpected fake notification path: ${url.pathname}`);
    }) as typeof fetch;
    const row = {
      id,
      user_id: owner,
      document_title: "Testing document",
      document_url: null,
      word_count: 2,
      chunks_written: 1,
      total_chunks: 2,
    };
    await notifyUser(row, "drip_attention");
    await notifyUser(row, "drip_attention");
    assertEquals(notices, 2);
    assertEquals(emails, 1);
    await notifyUser(row, "drip_completed");
    assertEquals(notices, 3);
    assertEquals(emails, 2);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((n, i) => before[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, before[i]!));
  }
});

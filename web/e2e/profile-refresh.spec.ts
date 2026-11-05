import { expect, test } from "@playwright/test";

test("an older background refresh cannot undo a successfully saved notification preference", async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript(() => localStorage.setItem("sb-localhost-auth-token", JSON.stringify({
    access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: {}, app_metadata: { provider: "email", providers: ["email"] } },
  })));
  await page.goto("/app/settings/#notifications");
  const toggle = page.getByLabel("Email me when a session finishes.", { exact: true });
  await expect(toggle).toBeChecked();
  await page.waitForLoadState("networkidle");
  await page.clock.install();
  await page.clock.fastForward(5100);
  let release!: () => void;
  let captured!: () => void;
  const snapshot = new Promise<void>((resolve) => { captured = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/rest/v1/profiles?*", async (route) => {
    if (route.request().method() !== "GET" || !new URL(route.request().url()).searchParams.get("select")?.includes("email_notifications")) return route.continue();
    const response = await route.fetch();
    const body = await response.body();
    captured();
    await gate;
    await route.fulfill({ response, body });
  });
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await snapshot;
    await toggle.uncheck();
    await expect(page.locator(".toast")).toHaveText(/Saved\. We won't email you about that\./);
    const delivered = page.waitForResponse((r) => r.url().includes("/rest/v1/profiles?") && r.request().method() === "GET");
    release();
    await delivered;
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(toggle).not.toBeChecked();
  } finally {
    release();
  }
});

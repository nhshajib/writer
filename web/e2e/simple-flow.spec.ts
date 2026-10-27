import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
const session = { access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: {}, app_metadata: {} } };
test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((s) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)), session);
});
test("Free can start a complete Natural session without configuring advanced settings", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { plan: "free" } });
  await page.goto("/app/new/");
  await expect(page.locator(".session-advanced")).not.toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: /^Natural/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Steady/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Drafting/ })).toBeDisabled();
  const text = "The first sentence is ready. The second sentence follows. These are my approved words.";
  await page.getByLabel("Text to enter").fill(text);
  await page.getByRole("button", { name: "Review session", exact: true }).click();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const created = requests.find((r: { method: string; path: string }) => r.method === "POST" && /\/drips$/.test(r.path));
  expect(created.body.rhythm).toBe("natural");
  expect(created.body.insertion_unit).toBe("sentence");
  expect(created.body.pacing.drafting).toEqual({ typo_rate_pct: 0, false_start_rate_pct: 0, sentence_pause_seconds: 2, sentence_pause_variation_pct: 25 });
});
test("Pro Drafting is one choice and approval explains temporary corrections", async ({ page }) => {
  await page.goto("/app/new/");
  await page.getByLabel("Text to enter").fill("A first sentence. A second sentence. A third sentence for this session.");
  await page.getByRole("button", { name: /^Drafting/ }).click();
  await page.getByRole("button", { name: "Review session", exact: true }).click();
  await expect(page.getByLabel(/I've read this exact text/)).not.toBeChecked();
  await expect(page.getByText(/I also approve the enabled simulated mistakes/)).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
test("pricing shows included Free rhythms and adjustable Pro pauses", async ({ page }) => {
  await page.goto("/pricing/");
  const compare = page.getByRole("table");
  await expect(compare.getByRole("row", { name: /Natural and Steady ready-made rhythms/ })).toContainText("Both included");
  await expect(compare.getByRole("row", { name: /Natural breaks after sentences/ })).toContainText("Included in Natural rhythm");
});

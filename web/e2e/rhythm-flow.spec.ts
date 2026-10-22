import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { toStep } from "./helpers";
const session = {
  access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: {}, app_metadata: {} },
};
const text = "One approved sentence. Another approved sentence follows.";
test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript(s => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)), session);
});
for (const width of [390, 1280]) {
  test(`Free single-word setup submits its previewed mode at ${width}px`, async ({ page, request }, testInfo) => {
    await request.post("/__test/profile", { data: { plan: "free", subscription_status: null } });
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/app/new/");
    await page.getByLabel("Text to enter").fill(text);
    const response = page.waitForResponse(r => r.url().endsWith("/drips/plan") && r.request().postDataJSON()?.pacing?.word_grouping === "single");
    await page.getByRole("radio", { name: /^One word at a time/ }).check();
    const { plan } = await (await response).json();
    expect(plan.ok).toBe(true);
    expect(plan.source_unit_count).toBe(7);
    expect(plan.pacing.word_grouping).toBe("single");
    await expect(page.getByRole("region", { name: "Your rhythm at a glance" })).toContainText("One word");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("rhythm-mobile.png"), fullPage: true });
    await toStep(page, 5);
    await expect(page.locator("dl.summary-list").getByText("One word at a time", { exact: true })).toBeVisible();
    await page.getByLabel(/I've read this exact text/).check();
    await page.getByRole("button", { name: "Start session", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/session/);
    const { requests } = await (await request.get("/__test/requests")).json();
    const created = requests.find((r: { method: string; path: string }) => r.method === "POST" && /\/drips$/.test(r.path));
    expect(created.body.pacing.word_grouping).toBe("single");
    expect(created.body.text).toBe(text);
  });
}
test("recommended Pro settings preserve word grouping and require correction approval", async ({ page, request }) => {
  await page.goto("/app/new/");
  await page.getByLabel("Text to enter").fill(text);
  await page.getByRole("radio", { name: /^One word at a time/ }).check();
  await toStep(page, 4);
  await page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true }).fill("12");
  await page.getByRole("button", { name: "Use recommended settings", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true })).toHaveValue("1");
  await expect(page.getByRole("spinbutton", { name: "False starts", exact: true })).toHaveValue("1");
  await expect(page.getByRole("radio", { name: /^One word at a time/ })).toBeChecked();
  await page.getByLabel("Final revision pass (Pro)", { exact: true }).check();
  await toStep(page, 5);
  await expect(page.getByText(/I also approve the enabled simulated mistakes/)).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const created = requests.find((r: { method: string; path: string }) => r.method === "POST" && /\/drips$/.test(r.path));
  expect(created.body.pacing.word_grouping).toBe("single");
  expect(created.body.pacing.drafting.typo_rate_pct).toBe(1);
  expect(created.body.revision_sweep).toBe(true);
});

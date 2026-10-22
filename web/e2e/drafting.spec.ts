import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { toStep } from "./helpers";

const SESSION = {
  access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: {}, app_metadata: { provider: "email", providers: ["email"] } },
};
const SOURCE = "The garden is ready for spring. We will plant the flowers near the fence. Keep these approved words unchanged.";

async function timingStep(page: Page) {
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Drafting settings");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(SOURCE);
  await toStep(page, 4);
}
async function ready(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /one insertion each|automated edits/ })).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((session) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session)), SESSION);
});

test("Pro configures six remembered drafting knobs and sends them with exact source approval", async ({ page, request }) => {
  await timingStep(page);
  await page.getByRole("radio", { name: /^Typing speed/ }).check();
  const speed = page.getByRole("spinbutton", { name: "Typing speed (adjustable cadence)", exact: true });
  await expect(speed).toHaveAttribute("min", "20");
  await expect(speed).toHaveAttribute("max", "150");
  await speed.fill("85");
  await page.getByRole("spinbutton", { name: "Timing variation", exact: true }).fill("32");
  await page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true }).fill("8");
  await page.getByRole("spinbutton", { name: "False starts", exact: true }).fill("11");
  await page.getByRole("spinbutton", { name: "Natural breaks after sentences", exact: true }).fill("3");
  await page.getByRole("spinbutton", { name: "Sentence-pause variation", exact: true }).fill("20");
  await expect(page.getByText(/Temporary words and mistakes appear in the real document/)).toBeVisible();
  await ready(page);
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await toStep(page, 5);
  await expect(page.getByLabel(/I've read this exact text/)).not.toBeChecked();
  await expect(page.getByText(/I also approve the enabled simulated mistakes/)).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const created = requests.find((r: { method: string; path: string }) => r.method === "POST" && r.path === "/functions/v1/drips");
  expect(created.body.text).toBe(SOURCE);
  expect(created.body.pacing.wpm).toBe(85);
  expect(created.body.pacing.variation_pct).toBe(32);
  expect(created.body.pacing.drafting).toEqual({ typo_rate_pct: 8, false_start_rate_pct: 11, sentence_pause_seconds: 3, sentence_pause_variation_pct: 20 });
  expect(created.body.approval.confirmed).toBe(true);
  expect(created.body.schedule_seed).toBeDefined();
});

test("saved drafting settings survive a new visit and malformed values are sanitized", async ({ page }) => {
  await timingStep(page);
  await page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true }).fill("7");
  await page.getByRole("spinbutton", { name: "Natural breaks after sentences", exact: true }).fill("4");
  await page.reload();
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Remembered");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(SOURCE);
  await toStep(page, 4);
  await expect(page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true })).toHaveValue("7");
  await expect(page.getByRole("spinbutton", { name: "Natural breaks after sentences", exact: true })).toHaveValue("4");
  await page.evaluate(() => localStorage.setItem("typewit.pace", JSON.stringify({ wpm: 9999, typoRate: -100, falseStartRate: "invalid", sentencePauseSeconds: 9999, sentencePauseVariation: 9999 })));
  await page.reload();
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Sanitized");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(SOURCE);
  await toStep(page, 4);
  await page.getByRole("radio", { name: /^Typing speed/ }).check();
  await expect(page.getByRole("spinbutton", { name: "Typing speed (adjustable cadence)", exact: true })).toHaveValue("150");
  await expect(page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true })).toHaveValue("0");
  await expect(page.getByRole("spinbutton", { name: "False starts", exact: true })).toHaveValue("0");
  await expect(page.getByRole("spinbutton", { name: "Natural breaks after sentences", exact: true })).toHaveValue("30");
  await expect(page.getByRole("spinbutton", { name: "Sentence-pause variation", exact: true })).toHaveValue("50");
});

test("Free cannot use saved premium settings or access their controls", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { plan: "free", subscription_status: null } });
  await page.addInitScript(() => localStorage.setItem("typewit.pace", JSON.stringify({ wpm: 85, typoRate: 20, falseStartRate: 20, sentencePauseSeconds: 30, sentencePauseVariation: 50 })));
  await timingStep(page);
  await expect(page.getByRole("radio", { name: /^Typing speed/ })).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true })).toHaveCount(0);
  await ready(page);
  await toStep(page, 5);
  await expect(page.getByText(/I also approve the enabled simulated mistakes/)).toHaveCount(0);
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const created = requests.find((r: { method: string; path: string }) => r.method === "POST" && r.path === "/functions/v1/drips");
  expect(created.body.pacing.drafting).toEqual({ typo_rate_pct: 0, false_start_rate_pct: 0, sentence_pause_seconds: 2, sentence_pause_variation_pct: 25 });
});

test("enabling temporary edits clears an earlier approval", async ({ page }) => {
  await timingStep(page);
  await ready(page);
  await toStep(page, 5);
  await page.getByLabel(/I've read this exact text/).check();
  await toStep(page, 4);
  await page.getByRole("spinbutton", { name: "False starts", exact: true }).fill("10");
  await ready(page);
  await toStep(page, 5);
  await expect(page.getByLabel(/I've read this exact text/)).not.toBeChecked();
});


test("switching from All at once to paced drafting requires renewed approval", async ({ page }) => {
  await timingStep(page);
  await page.getByRole("spinbutton", { name: "False starts", exact: true }).fill("10");
  await page.getByRole("radio", { name: /^All at once/ }).check();
  await expect(page.getByRole("status").filter({ hasText: "whole text is entered in one insertion" })).toBeVisible();
  await toStep(page, 5);
  await page.getByRole("checkbox", { name: /I've read this exact text/ }).check();
  await toStep(page, 4);
  await page.getByRole("radio", { name: /^Finish time/ }).check();
  await ready(page);
  await toStep(page, 5);
  await expect(page.getByRole("checkbox", { name: /I've read this exact text/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /I've read this exact text/ })).toHaveAccessibleName(/I also approve the enabled simulated mistakes/);
});

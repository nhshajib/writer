import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { fillNewSession } from "./helpers";

/* The phone layout (390×844, touch), against the mock API. Desktop Chromium emulation, not a real iPhone. */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TEXT = "First line of the report. Second line follows. Third line ends it. A fourth adds more. The fifth closes.";

const SESSION = {
  access_token: "e2e-token",
  refresh_token: "e2e-refresh",
  token_type: "bearer",
  expires_in: 3600 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: { name: "Sam" }, app_metadata: {} },
};

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Creates a session through the desktop form (quicker than the steps), then returns to the phone size. */
async function createSession(page: Page, title: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/app/new/");
  await fillNewSession(page, { title, text: TEXT });
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  await page.setViewportSize({ width: 390, height: 844 });
  return new URL(page.url()).searchParams.get("id")!;
}

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((session) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session)), SESSION);
});

test("four tabs move between the main places, and Account lists every setting", async ({ page }) => {
  await page.goto("/app/");
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.getByRole("link")).toHaveCount(4);
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);

  await tabs.getByRole("link", { name: "Sessions" }).click();
  await page.waitForURL(/\/app\/sessions\/?$/);
  await expect(tabs.getByRole("link", { name: "Sessions" })).toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "Account" }).click();
  await page.waitForURL(/\/app\/account\/?$/);
  for (const row of ["Plan & usage", "Profile", "Notifications", "Security", "Data & privacy", "Help & support"]) {
    await expect(page.getByRole("link", { name: new RegExp(`^${row}`) })).toBeVisible();
  }
  await page.getByRole("button", { name: "Privacy Policy" }).click();
  await expect(page.getByRole("dialog", { name: "Privacy Policy" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expectNoAxeViolations(page);
});

test("search and updates open as sheets that keep focus inside", async ({ page, request }) => {
  const id = await createSession(page, "Field notes");
  await request.post("/__test/advance", { data: { id, written: 99 } });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Search sessions and pages" }).click();
  const search = page.getByRole("combobox", { name: "Search sessions and pages" });
  await expect(search).toBeFocused();
  await search.fill("field");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/session\/?\?id=/);

  await page.getByRole("button", { name: "Updates, 1 unread" }).click();
  const sheet = page.getByRole("dialog", { name: "Updates" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: '"Field notes" is finished' })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("the sessions list keeps its filter after Back, and sorting is in a sheet", async ({ page }) => {
  await createSession(page, "Quarterly summary");
  await page.goto("/app/sessions/");
  await page.getByRole("button", { name: /^Active/ }).click();
  await expect(page).toHaveURL(/filter=active/);
  await page.getByRole("button", { name: "More for Quarterly summary" }).click();
  const actions = page.getByRole("dialog", { name: "More for Quarterly summary" });
  await actions.getByRole("link", { name: "Open session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  await page.goBack();
  await expect(page.getByRole("button", { name: /^Active/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Sort and export" }).click();
  // Choosing an order applies it and closes the sheet.
  await page.getByRole("dialog", { name: "Sort and export" }).getByText("Oldest first").click();
  await expect(page.getByRole("dialog", { name: "Sort and export" })).toBeHidden();
  await expect(page).toHaveURL(/sort=oldest/);
  await expectNoAxeViolations(page);
});

test("a new session is five steps: each checks itself, Back keeps everything, and editing clears approval", async ({ page, request }) => {
  await page.goto("/app/new/");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByText("Step 1 of 5 · Document")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".step-bar .alert-error")).toHaveText("Give the new document a title.");
  await expect(page.getByLabel("Title")).toBeFocused();
  await page.getByLabel("Title").fill("Phone essay");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Step 2 of 5 · Text")).toBeVisible();
  await page.getByLabel("Text to enter").fill(TEXT);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: /^Sentences/ })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 4 of 5 · Timing")).toBeVisible();
  await expect(page.getByText("Advanced timing")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Step 5 of 5 · Review")).toBeVisible();
  const approve = page.getByLabel(/I've read this exact text/);
  await expect(approve).not.toBeChecked();
  await approve.check();
  await expectNoAxeViolations(page);

  // Back keeps the fields; changing the text clears the approval.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Text to enter")).toHaveValue(TEXT);
  await page.getByLabel("Text to enter").fill(`${TEXT} One more.`);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continue" }).click();
  // The schedule for the edited text has been checked.
  await expect(page.getByRole("status").filter({ hasText: "6 sentences, one insertion each" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(approve).not.toBeChecked();
  await approve.check();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);

  const { requests } = await (await request.get("/__test/requests")).json();
  const creates = requests.filter((r: { method: string; path: string }) => r.method === "POST" && /\/drips\/?$/.test(r.path));
  expect(creates.length).toBe(1);
  expect(creates[0].body.text).toBe(`${TEXT} One more.`);
});

test("leaving a new session asks first", async ({ page }) => {
  await page.goto("/app/new/");
  await page.getByRole("button", { name: "Exit" }).click();
  const sheet = page.getByRole("dialog", { name: "Leave without starting?" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Keep editing" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/app\/new\/?$/);
});

test("a raw Google error is explained, with the details behind a disclosure", async ({ page, request }) => {
  const id = await createSession(page, "Lab report");
  await request.post("/__test/attention", {
    data: { id, attention: "unreachable", message: "Google Docs API has not been used in project 1234 before or it is disabled. key=AIzaSyA1234567890abcdefghijklmnop" },
  });
  await page.goto(`/app/session/?id=${id}`);
  const panel = page.getByRole("alert").filter({ hasText: "couldn't be reached" });
  await expect(panel).toContainText("Google Docs isn't available to TypeWit right now");
  await panel.getByText("Technical details").click();
  await expect(panel.locator("code")).toContainText("[hidden]");
  await expect(panel.locator("code")).not.toContainText("AIza");
});

test("Documents explains where Word sessions run", async ({ page }) => {
  await page.goto("/app/documents/");
  await expect(page.getByText(/Word sessions start inside Word, not from this\s+website or a phone browser/)).toBeVisible();
  await expectNoAxeViolations(page);
});

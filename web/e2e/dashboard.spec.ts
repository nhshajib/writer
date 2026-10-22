import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { fillNewSession } from "./helpers";

/* Home, the top bar (search, updates, theme) and the sessions list's quick actions, against the mock API. */

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
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function createSession(page: Page, title: string) {
  await page.goto("/app/new/");
  await fillNewSession(page, { title, text: TEXT });
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  return new URL(page.url()).searchParams.get("id")!;
}

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((session) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
  }, SESSION);
});

test("Home shows what needs you with the fix right there, and live sessions can be paused in place", async ({ page, request }) => {
  const stuck = await createSession(page, "Lab report");
  await createSession(page, "History essay");
  await request.post("/__test/advance", { data: { id: stuck, written: 2 } });
  await request.post("/__test/attention", { data: { id: stuck, attention: "unreachable", message: "Google Docs didn't answer." } });

  await page.goto("/app/");
  const needs = page.getByRole("region", { name: "Needs your attention" });
  await expect(needs).toContainText("Lab report");
  await expect(needs).toContainText("The document couldn't be reached");
  await expect(page.getByRole("link", { name: "Home" })).toContainText("1");
  await expectNoAxeViolations(page);

  await needs.getByRole("button", { name: "Resume Lab report" }).click();
  await expect(page.locator(".toast")).toHaveText(/Session resumed\./);
  await expect(needs).toBeHidden();

  const live = page.getByRole("region", { name: /^Now/ });
  await live.getByRole("button", { name: "Pause History essay" }).click();
  await expect(page.locator(".toast")).toHaveText(/Session paused\./);
  await expect(live.getByRole("button", { name: "Resume History essay" })).toBeVisible();

  // One plan card instead of folded usage, activity and connection panels.
  const plan = page.getByRole("region", { name: "Your plan" });
  await expect(plan).toContainText("Active sessions");
  await expect(plan).toContainText("2 / 3");
  await expect(plan).not.toContainText("Compare plans");
  await expect(page.getByRole("region", { name: "Connected documents" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Get started" })).toHaveCount(0);

  // Stop asks first, and keeping it going changes nothing.
  await live.getByRole("button", { name: /^Stop / }).click();
  const confirm = live.getByRole("alertdialog", { name: "Stop this session?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep going" }).click();
  await expect(confirm).toBeHidden();

  await page.emulateMedia({ colorScheme: "dark" });
  await expectNoAxeViolations(page);
});

test("the bell lists updates and marks them read", async ({ page, request }) => {
  const id = await createSession(page, "Cover letter");
  await request.post("/__test/advance", { data: { id, written: 99 } });
  await page.goto("/app/");
  const bell = page.getByRole("button", { name: "Updates, 1 unread" });
  await bell.click();
  await expect(page.getByRole("link", { name: '"Cover letter" is finished' })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: "Updates", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: '"Cover letter" is finished' })).toBeHidden();
});

test("search jumps to a session or page from the keyboard", async ({ page }) => {
  await createSession(page, "Field notes");
  await page.goto("/app/settings/");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Search sessions and pages" });
  await expect(search).toBeFocused();
  await search.fill("field");
  await expect(page.getByRole("option", { name: /Field notes/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/session\/?\?id=/);

  await page.getByRole("button", { name: "Search sessions and pages" }).click();
  await page.getByRole("combobox").fill("plan");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/billing\/?$/);
  await expect(page.getByRole("heading", { name: "Plan & usage" })).toBeVisible();
});

test("the theme can be set to dark, kept across pages, and set back to the system's", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/app/sessions/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Sessions", level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
});

test("the sessions list pauses in place and shows a quick look without leaving the page", async ({ page }) => {
  await createSession(page, "Quarterly summary");
  await page.goto("/app/sessions/");
  await page.getByRole("button", { name: "Pause Quarterly summary" }).click();
  await expect(page.getByRole("button", { name: "Resume Quarterly summary" })).toBeVisible();

  await page.getByRole("link", { name: "Quarterly summary" }).click();
  const preview = page.getByRole("dialog", { name: "Quarterly summary" });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Session started with its full schedule");
  await expect(page).toHaveURL(/\/app\/sessions\/?$/);
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();

  await page.getByRole("button", { name: "More for Quarterly summary" }).click();
  await page.getByRole("link", { name: "Open session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
});

test("one session menu stops and deletes from the list, and Home's other live sessions can be stopped too", async ({ page }) => {
  await createSession(page, "Quarterly summary");
  await createSession(page, "Field notes");

  await page.goto("/app/");
  const others = page.getByRole("list", { name: "Other live sessions" });
  await others.getByRole("button", { name: /^More for / }).click();
  await expect(page.getByRole("button", { name: "Stop…" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/app/sessions/");
  await page.getByRole("button", { name: "More for Quarterly summary" }).click();
  await page.getByRole("button", { name: "Stop…" }).click();
  const stop = page.getByRole("dialog", { name: "Stop this session?" });
  await stop.getByRole("button", { name: "Stop session" }).click();
  await expect(page.locator(".toast")).toHaveText(/Session stopped\./);

  await page.getByRole("button", { name: "More for Quarterly summary" }).click();
  await expect(page.getByRole("link", { name: "Run again…" })).toBeVisible();
  await page.getByRole("button", { name: "Delete…" }).click();
  const remove = page.getByRole("dialog", { name: "Delete this session?" });
  await expectNoAxeViolations(page);
  await remove.getByRole("button", { name: "Delete session" }).click();
  await expect(page.locator(".toast")).toHaveText(/Session deleted\./);
  await expect(page.getByRole("link", { name: "Quarterly summary" })).toHaveCount(0);
});

test("the Home badge counts a session stopped by an error, like the Needs-you list", async ({ page, request }) => {
  const id = await createSession(page, "Lab report");
  await request.post("/__test/fail", { data: { id } });
  await page.goto("/app/");
  await expect(page.getByRole("region", { name: "Needs your attention" })).toContainText("Lab report");
  await expect(page.getByRole("link", { name: "Home" })).toContainText("1");
});

test("editing settings is offered on every plan: Pro pauses to edit, Free sees why it's locked", async ({ page, request }) => {
  const id = await createSession(page, "History essay");
  await page.goto(`/app/session/?id=${id}`);
  await page.getByRole("button", { name: "Edit text & settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Edit the remaining session/ })).toBeVisible();

  await request.post("/__test/profile", { data: { plan: "free", subscription_status: null } });
  await page.goto(`/app/session/?id=${id}&edit=1`);
  await expect(page.getByText("Editing a paused session's text and settings is part of Pro.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Edit the remaining session/ })).toHaveCount(0);
});

test("session defaults saved in Settings are where New session starts, and every Settings link lands on a section", async ({ page }) => {
  await page.goto("/app/settings/");
  for (const id of ["profile", "defaults", "notifications", "accessibility", "security", "data", "danger"]) {
    await expect(page.locator(`section#${id}`)).toHaveCount(1);
  }
  const form = page.getByRole("form", { name: "Session defaults" });
  await form.getByLabel("Rhythm").selectOption("steady");
  await form.getByLabel("Finish within").selectOption("120");
  await form.getByLabel("Steps").selectOption("sentence");
  await form.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.locator(".toast")).toHaveText(/New sessions start from these settings/);
  await expectNoAxeViolations(page);

  await page.goto("/app/new/");
  await expect(page.getByRole("button", { name: /^Steady/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Finish within", { exact: true })).toHaveValue("120");
  await page.locator(".session-advanced").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await expect(page.getByRole("radio", { name: /^Sentences/ })).toBeChecked();

  // Changing a session and saving it as the defaults updates Settings too.
  await page.getByRole("button", { name: /^Natural/ }).click();
  await page.getByRole("button", { name: /Save rhythm, finish time and steps as my defaults/ }).click();
  await expect(page.locator(".toast")).toHaveText(/Saved as your defaults/);
  await page.goto("/app/settings/#defaults");
  await expect(page.getByRole("form", { name: "Session defaults" }).getByLabel("Rhythm")).toHaveValue("natural");
});

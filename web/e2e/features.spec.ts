import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/* Run again, Start later, drafts, settings, sessions list and the 404 page, against the mock API. */

const TEXT = "First line of the report. Second line follows. Third line ends it.";

const SESSION = {
  access_token: "e2e-token",
  refresh_token: "e2e-refresh",
  token_type: "bearer",
  expires_in: 3600 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: {}, app_metadata: { provider: "email", providers: ["email"] } },
};

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function createSession(page: Page, opts: { startLater?: boolean } = {}) {
  await page.goto("/app/new/");
  await page.getByLabel("Title").fill("Lab report");
  await page.getByLabel("Text to enter").fill(TEXT);
  await expect(page.getByText(/sentences, one insertion each/)).toBeVisible();
  if (opts.startLater) await page.getByLabel("Start later instead of now").check();
  await page.getByLabel(/I've read this exact text/).check();
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

test("Start later sends the chosen time and the session shows when it starts", async ({ page, request }) => {
  await createSession(page, { startLater: true });
  const { requests } = await (await request.get("/__test/requests")).json();
  const create = requests.find((r: { method: string; path: string }) => r.method === "POST" && r.path === "/functions/v1/drips");
  const startAt = Date.parse(create.body.start_at);
  expect(startAt).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
  expect(startAt).toBeLessThan(Date.now() + 70 * 60 * 1000);
  await expect(page.getByText(/· starts /)).toBeVisible();
});

test("Run again starts a new session from a finished one's text, settings and document", async ({ page, request }) => {
  const id = await createSession(page);
  await request.post("/__test/advance", { data: { id, written: 99 } });
  await page.reload();
  await page.getByRole("link", { name: "Run again…" }).click();
  await page.waitForURL(/\/app\/new\/?\?from=/);
  await expect(page.getByLabel("Text to enter")).toHaveValue(TEXT);
  await expect(page.getByText(/Started from "Lab report"/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Existing document/ })).toBeChecked();
  // A fresh approval is always needed.
  await expect(page.getByLabel(/I've read this exact text/)).not.toBeChecked();
});

test("unsent text is kept in this browser and can be restored or discarded", async ({ page }) => {
  await page.goto("/app/new/");
  await page.getByLabel("Text to enter").fill("A draft I don't want to lose.");
  await page.waitForTimeout(700);
  await page.goto("/app/new/");
  await expect(page.getByText(/You have unsent text from before \(7 words\)/)).toBeVisible();
  await page.getByRole("button", { name: "Restore it" }).click();
  await expect(page.getByLabel("Text to enter")).toHaveValue("A draft I don't want to lose.");

  await page.getByLabel("Text to enter").fill("");
  await page.goto("/app/new/");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.goto("/app/new/");
  await expect(page.getByText(/You have unsent text/)).toHaveCount(0);
});

test("settings: email choices save with a confirmation, and deleting the account needs the email typed", async ({ page, request }) => {
  await page.goto("/app/settings/");
  await expect(page.getByLabel("Email me when a session finishes.")).toBeChecked();
  await expect(page.getByLabel("Email me when a session finishes.")).toBeEnabled();
  await page.getByLabel("Email me when a session finishes.").click();
  await expect(page.getByLabel("Email me when a session finishes.")).not.toBeChecked();
  await expect(page.locator(".toast")).toHaveText(/Saved\. We won't email you about that\./);
  const { requests } = await (await request.get("/__test/requests")).json();
  const patch = requests.find((r: { method: string; path: string }) => r.method === "PATCH" && r.path === "/rest/v1/profiles");
  expect(patch.body).toEqual({ email_on_completed: false, email_on_attention: true, email_notifications: true });

  // Changing the password asks for the current one.
  await page.getByLabel("New password", { exact: true }).fill("a new password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter your current password." })).toBeVisible();

  await page.getByRole("button", { name: "Delete my account…" }).click();
  const confirm = page.getByRole("button", { name: "Delete account" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Type me@gmail.com to confirm").fill("someone@else.com");
  await expect(confirm).toBeDisabled();
  await expectNoAxeViolations(page);
  await page.getByLabel("Type me@gmail.com to confirm").fill("me@gmail.com");
  await confirm.click();
  await page.waitForURL(/\/\?account=deleted/);
});

test("the sessions list sorts, and CSV export follows the filter", async ({ page }) => {
  await createSession(page);
  await page.goto("/app/sessions/");
  await page.getByLabel("Sort sessions").selectOption("title");
  await page.getByRole("button", { name: /^Finished/ }).click();
  await expect(page.getByText("No sessions match.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
  await page.getByRole("button", { name: /^Active/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/ }).click();
  expect((await download).suggestedFilename()).toBe("typewit-sessions-active.csv");
});

test("an unknown address shows a helpful 404 page", async ({ page }) => {
  const response = await page.goto("/no-such-page/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to your dashboard" })).toBeVisible();
  await expect(page).toHaveTitle("Page not found · TypeWit");
  await expectNoAxeViolations(page);
});

test("dashboard pages have their own titles", async ({ page }) => {
  await page.goto("/app/sessions/");
  await expect(page).toHaveTitle("Sessions · TypeWit");
  await page.goto("/app/settings/");
  await expect(page).toHaveTitle("Settings · TypeWit");
});

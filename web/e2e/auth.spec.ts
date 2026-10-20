import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/* Sign-in, password reset and the way back to the page someone wanted, against the mock API. */

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  await request.post("/__test/reset");
});

test("signing in returns to the page that asked for it", async ({ page }) => {
  await page.goto("/app/sessions/");
  await page.waitForURL(/\/login\/?\?next=%2Fapp%2Fsessions%2F/);
  await page.getByLabel("Email").fill("me@gmail.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/sessions\/?$/);
});

test("a sign-in link can't send people to another site", async ({ page }) => {
  await page.goto("/login/?next=//evil.example/steal");
  await page.getByLabel("Email").fill("me@gmail.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/?$/);
});

test("the password-reset link lets people choose a new password", async ({ page, request }) => {
  const token = "e2e-recovery";
  await page.goto(
    `/reset-password/#access_token=${token}&expires_in=3600&expires_at=${Math.floor(Date.now() / 1000) + 3600}` +
      "&refresh_token=r1&token_type=bearer&type=recovery",
  );
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Repeat new password").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator(".alert-error")).toHaveText("Use a password with at least 8 characters.");

  await page.getByLabel("New password", { exact: true }).fill("a much better password");
  await page.getByLabel("Repeat new password").fill("a much better password!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator(".alert-error")).toHaveText("The two passwords don't match.");

  await page.getByLabel("Repeat new password").fill("a much better password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your password is changed")).toBeVisible();

  const { requests } = await (await request.get("/__test/requests")).json();
  const update = requests.find((r: { method: string; path: string }) => r.method === "PUT" && r.path === "/auth/v1/user");
  expect(update.body.password).toBe("a much better password");
});

test("an expired reset link says so and offers a new one", async ({ page }) => {
  await page.goto("/reset-password/#error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByText("This reset link has expired or was already used.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
});

test("reset links that land on the home page are forwarded", async ({ page }) => {
  await page.goto("/#access_token=t&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery");
  await page.waitForURL(/\/reset-password\//);
});

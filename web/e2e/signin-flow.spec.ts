import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LAST_SIGN_IN_KEY } from "../lib/signInPreference";

test.beforeEach(async ({ request }) => {
  await request.post("/__test/reset");
});

test("focused sign-in is accessible, flat and touch-friendly on phones and desktop", async ({ page }, info) => {
  test.setTimeout(120000);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(size);
      await page.goto("/login/");
      await expect(page.getByRole("heading", { name: "Sign in to TypeWit" })).toBeVisible();
      await expect(page.getByRole("link", { name: "TypeWit home", exact: true })).toBeVisible();
      await expect(page.locator(".auth-tabs, .auth-split, .auth-visual")).toHaveCount(0);
      await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
      await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
      await expect(page.locator(".signin-page")).toHaveCSS("background-image", "none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const method of ["Google", "Discord", "Email"]) {
        const button = page.getByRole("button", { name: `Continue with ${method}`, exact: true });
        await expect(button).toBeEnabled();
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(48);
        if (size.width === 390) await expect(button).toBeInViewport();
      }
      for (const label of ["Privacy Policy", "Terms of Service"]) {
        await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
      }
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath(`signin-${size.width}-${theme}.png`), fullPage: true });
      await page.getByRole("button", { name: "Continue with Email", exact: true }).click();
      await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    }
  }
});

test("email disclosure preserves input and restores keyboard focus to its choice", async ({ page }) => {
  await page.goto("/login/");
  const choice = page.getByRole("button", { name: "Continue with Email", exact: true });
  await choice.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("fixture password");
  await page.getByRole("button", { name: "Other sign-in options", exact: true }).click();
  await expect(choice).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await choice.click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("fixture@example.invalid");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("fixture password");
});

for (const method of ["google", "discord", "email"] as const) {
  test(`last-used ${method} is a hint without automatically opening or reordering methods`, async ({ page }) => {
    await page.addInitScript(({ key, method }) => localStorage.setItem(key, method), { key: LAST_SIGN_IN_KEY, method });
    await page.goto("/login/");
    const label = method === "email" ? "Email" : method === "google" ? "Google" : "Discord";
    const button = page.getByRole("button", { name: `Continue with ${label}`, exact: true });
    await expect(button.locator(".signin-last-used")).toHaveText("Last used");
    await expect(page.locator(".signin-last-used")).toHaveCount(1);
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  });
}

test("last-used email changes only after successful authentication", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "discord"), LAST_SIGN_IN_KEY);
  await page.goto("/login/");
  await page.getByRole("button", { name: "Continue with Email", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("wrong fixture password");
  await page.route("**/auth/v1/token**", route => route.fulfill({
    status: 400, json: { error: "invalid_grant", error_description: "Invalid login credentials" },
  }));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The email or password is incorrect.");
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_SIGN_IN_KEY)).toBe("discord");
  await page.unroute("**/auth/v1/token**");
  await page.getByLabel("Password", { exact: true }).fill("correct fixture password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/app/?$"));
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_SIGN_IN_KEY)).toBe("email");
});

test("social choice is remembered after returning with a session, not after a canceled attempt", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "email"), LAST_SIGN_IN_KEY);
  await page.goto("/login/");
  await page.route("**/auth/v1/authorize**", route => route.fulfill({ status: 200, body: "OAuth fixture boundary" }));
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await page.waitForURL(url => url.pathname.endsWith("/auth/v1/authorize"));
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_SIGN_IN_KEY)).toBe("email");
  await page.evaluate(() => localStorage.setItem("sb-localhost-auth-token", JSON.stringify({
    access_token: "fixture-token", refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid",
      app_metadata: { provider: "google" }, user_metadata: {} },
  })));
  await page.goto("/app/");
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), LAST_SIGN_IN_KEY)).toBe("google");
});

test("blocked browser storage does not hide or disable sign-in options", async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ["getItem", "setItem", "removeItem"]) {
      Object.defineProperty(Storage.prototype, name, { value: () => { throw new DOMException("Blocked", "SecurityError"); } });
    }
  });
  await page.goto("/login/");
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeEnabled();
  await expect(page.locator(".signin-last-used")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue with Email", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
});

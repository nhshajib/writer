import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test(
  "desktop homepage matches the compact reference frame and preserves its navigation",
  async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const frame = await page.locator(".home-frame").boundingBox();
    expect(frame!.width).toBeCloseTo(1136, 0);
    expect(frame!.height).toBeLessThanOrEqual(830);
    expect(await page.evaluate(() => document.documentElement.scrollHeight))
      .toBeLessThanOrEqual(980);
    await expect(page.locator("main > section")).toHaveCount(1);
    await expect(page.locator(".footer-invitation")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Get started free", exact: true }).last(),
    ).toHaveAttribute("href", "/signup/");
    await page.screenshot({
      path: info.outputPath("homepage-desktop.png"),
      fullPage: true,
    });
    for (
      const [name, path] of [
        ["How it works", "/how-it-works/"],
        ["Features", "/features/"],
        ["Use cases", "/use-cases/"],
        ["FAQ", "/faq/"],
      ]
    ) {
      await page.locator(".site-header").getByRole("navigation", {
        name: "Main",
        exact: true,
      }).getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(path));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21aa",
        ]).analyze()).violations.map((v) => v.id),
      ).toEqual([]);
    }
  },
);

test(
  "legacy section links reach the standalone pages and mobile menu closes with Escape",
  async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#faq");
    await expect(page).toHaveURL(/\/faq\//);
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open menu", exact: true });
    await menu.click();
    await expect(
      page.getByRole("navigation", { name: "Main mobile", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("homepage-mobile.png"),
      fullPage: true,
    });
  },
);

test(
  "account card restyling retains the existing signup fields and mobile form accessibility",
  async ({ page }, info) => {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto("/signup/");
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
      await expect(
        page.getByLabel(/First name|Phone number|Gender|Confirm password/),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Continue with Google", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21aa",
        ]).analyze()).violations.map((v) => v.id),
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`signup-${width}.png`),
        fullPage: true,
      });
    }
  },
);

test("standalone information pages retain their content, breadcrumbs and small-screen accessibility", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (
      const path of ["/how-it-works/", "/features/", "/use-cases/", "/faq/"]
    ) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21aa",
        ]).analyze()).violations.map((v) => v.id),
      ).toEqual([]);
    }
  }
});

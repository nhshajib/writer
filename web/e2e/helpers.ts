import { expect, type Page } from "@playwright/test";

/** Moves through the new-session steps with the action bar until step `n` is shown. */
export async function toStep(page: Page, n: number) {
  const form = page.locator("form[data-step]");
  const current = Number(await form.getAttribute("data-step"));
  if (n === 5) {
    if (current !== 5) await page.getByRole("button", { name: "Review session", exact: true }).click();
    await expect(form).toHaveAttribute("data-step", "5");
    return;
  }
  if (current === 5) await page.locator(".step-bar").getByRole("button", { name: "Back", exact: true }).click();
  if (n === 1) await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  if (n === 2) await page.locator(".format-choice").evaluate((el) => { (el.parentElement as HTMLDetailsElement).open = true; });
  if (n === 3 || n === 4) await page.locator(".session-advanced").evaluate((el: HTMLDetailsElement) => { el.open = true; });

}

/** Fills a new session step by step and approves it, ready for Start. `atTiming` runs on the timing step. */
export async function fillNewSession(page: Page, { title, text, atTiming }: { title?: string; text: string; atTiming?: () => Promise<void> }) {
  if (title !== undefined) { await toStep(page, 1); await page.getByLabel("Title").fill(title); }
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(text);
  await toStep(page, 4);
  // Existing session scenarios use an explicit sentence/one-hour fixture.
  await page.getByRole("radio", { name: /^Sentences/ }).check();
  if (!await page.locator("#duration option[value=\"60\"]").isDisabled()) await page.getByLabel("Total duration", { exact: true }).selectOption("60");
  if (atTiming) await atTiming();
  await expect(page.getByRole("status").filter({ hasText: /one insertion each|automated edits/ })).toBeVisible();
  await toStep(page, 5);
  await page.getByLabel(/I've read this exact text/).check();
}

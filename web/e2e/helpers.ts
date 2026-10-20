import { expect, type Page } from "@playwright/test";

/** Moves through the new-session steps with the action bar until step `n` is shown. */
export async function toStep(page: Page, n: number) {
  const form = page.locator("form[data-step]");
  for (let i = 0; i < 8; i++) {
    const current = Number(await form.getAttribute("data-step"));
    if (current === n) return;
    const bar = page.locator(".step-bar");
    await (current < n ? bar.getByRole("button", { name: /^Continue/ }) : bar.getByRole("button", { name: "Back" })).click();
    await expect(form).not.toHaveAttribute("data-step", String(current));
  }
  throw new Error(`Couldn't reach step ${n}`);
}

/** Fills a new session step by step and approves it, ready for Start. `atTiming` runs on the timing step. */
export async function fillNewSession(page: Page, { title, text, atTiming }: { title?: string; text: string; atTiming?: () => Promise<void> }) {
  if (title !== undefined) await page.getByLabel("Title").fill(title);
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(text);
  await toStep(page, 4);
  if (atTiming) await atTiming();
  await expect(page.getByRole("status").filter({ hasText: "one insertion each" })).toBeVisible();
  await toStep(page, 5);
  await page.getByLabel(/I've read this exact text/).check();
}

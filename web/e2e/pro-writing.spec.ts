import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { fillNewSession, toStep } from "./helpers";

/* Pro writing features: keep formatting, import files, insert under a heading, longer breaks. */

const SESSION = {
  access_token: "e2e-token",
  refresh_token: "e2e-refresh",
  token_type: "bearer",
  expires_in: 3600 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: {}, app_metadata: { provider: "email", providers: ["email"] } },
};
const FIXTURES = path.join(__dirname, "fixtures");

async function expectNoAxeViolations(page: Page) {
  // Wait for animations to settle; one cancelled mid-way (its element hidden or removed) rejects "finished" and counts as settled.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function createRequest(request: import("@playwright/test").APIRequestContext) {
  const { requests } = await (await request.get("/__test/requests")).json();
  return requests.find((r: { method: string; path: string }) => r.method === "POST" && r.path === "/functions/v1/drips");
}

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((session) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
  }, SESSION);
});

test("Free keeps pasted formatting, while imports and advanced insertion remain Pro", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { plan: "free", subscription_status: null } });
  await page.goto("/app/new/");
  await expect(page.getByRole("button", { name: /Import file/ })).toBeDisabled();
  await pasteRich(page, '<h1>Weekly plan</h1><p>Read <b>bold</b> and <i>italic</i> <mark>notes</mark>.</p>');
  const editor = page.getByLabel("Text to enter");
  await expect(editor.locator('h1')).toHaveText('Weekly plan');
  await expect(editor.locator('[style*="font-weight"]')).toContainText(['bold']);
  await expect(page.locator('#text-count')).toContainText('7 words');
  await expectNoAxeViolations(page);
  await toStep(page, 3);
  await expect(page.getByRole("radio", { name: /Under a heading/ })).toBeDisabled();
  await toStep(page, 5);
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const create = await createRequest(request);
  expect(create.body.text_format).toBe('rich');
  const source = JSON.parse(create.body.text);
  expect(source.plain).toBe('Weekly plan\nRead bold and italic notes.');
  expect(source.spans.some((s: { highlight?: string }) => s.highlight === '#ffff00')).toBe(true);
});

async function pasteRich(page: Page, html: string) {
  await page.getByLabel('Text to enter').focus();
  await page.getByLabel('Text to enter').evaluate((el, markup) => {
    const data = new DataTransfer(); data.setData('text/html', markup);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, html);
}

test("rich paste strips scripts and remote elements and preserves combined Unicode styles", async ({ page }) => {
  await page.goto('/app/new/');
  await pasteRich(page, '<p><b><i><span style="background-color:rgb(10, 180, 90)">Café 👩🏽‍💻</span></i></b></p><script>window.evil=true</script><img src="https://evil.invalid/a" onerror="alert(1)">');
  const editor = page.getByLabel('Text to enter');
  await expect(editor).toHaveText('Café 👩🏽‍💻');
  await expect(editor.locator('script,img,iframe')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { evil?: boolean }).evil)).toBeUndefined();
  await page.getByRole('button', { name: 'Review session', exact: true }).click();
  await expect(page.locator('.md-preview mark')).toHaveText('Café 👩🏽‍💻');
});

test("Pro imports .md, .txt and .docx into the visual editor", async ({ page }) => {
  await page.goto('/app/new/');
  const input = page.getByTestId('import-file');
  await input.setInputFiles(path.join(FIXTURES, 'sample.md'));
  await expect(page.getByLabel('Text to enter').locator('h2')).toHaveText('Shopping list');
  await expect(page.getByLabel('Text to enter').locator('[style*="font-weight"]')).toHaveText('Bread');
  await input.setInputFiles(path.join(FIXTURES, 'sample.txt'));
  await expect(page.getByLabel('Text to enter')).toContainText('Plain notes line one.');
  await input.setInputFiles(path.join(FIXTURES, 'sample.docx'));
  await expect(page.getByLabel('Text to enter').locator('h1')).toHaveText('Garden notes');
  await expect(page.getByLabel('Text to enter').locator('[style*="font-weight"]')).toHaveText('tomatoes');
});

test("Pro adds text under a chosen heading of an existing document", async ({ page, request }) => {
  // A first session puts the document in the list; it is stopped so the document is free again.
  await page.goto("/app/new/");
  await fillNewSession(page, { title: "Report", text: "Opening line here." });
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const first = await createRequest(request);
  expect(first.body.insert_target).toBeUndefined();
  const { drips } = await (await request.get("/functions/v1/drips")).json();
  await request.post(`/functions/v1/drips/${drips[0].id}/cancel`);

  await page.goto("/app/new/");
  await toStep(page, 1);
  await page.getByRole("radio", { name: /Existing document/ }).check();
  await page.locator("#doc").selectOption({ label: "Report" });
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill("A new finding for this part.");
  await toStep(page, 3);
  await page.getByRole("radio", { name: /Under a heading/ }).check();
  await page.locator(".step-bar").getByRole("button", { name: /^Review session/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose a heading." })).toBeVisible();
  await page.getByLabel("Heading", { exact: true }).selectOption({ label: "Results" });
  await expectNoAxeViolations(page);
  await toStep(page, 4);
  await expect(page.getByRole("status").filter({ hasText: /one insertion each|automated edits/ })).toBeVisible();
  await toStep(page, 5);
  await expect(page.getByText('At the end of the "Results" section')).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const creates = requests.filter((r: { method: string; path: string }) => r.method === "POST" && r.path === "/functions/v1/drips");
  expect(creates.at(-1).body.insert_target).toEqual({ heading_id: "h.results", heading_text: "Results", level: 1 });
});

test("Pro breaks can be set in hours, up to 8", async ({ page }) => {
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Long one");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill("One sentence. Another sentence. A third one.");
  await toStep(page, 4);
  await page.getByLabel("Total duration").selectOption("1440");
  await page.getByLabel("Longest break in").selectOption("h");
  await page.getByRole("spinbutton", { name: "Longest break" }).fill("3");
  await page.getByRole("spinbutton", { name: "Longest break" }).blur();
  await expect(page.locator(".break-field").filter({ hasText: "Longest break" }).locator(".hint")).toContainText("3 h");
  await expect(page.getByRole("status").filter({ hasText: /one insertion each|automated edits/ })).toBeVisible();
  await expect(page.locator(".plan-preview .alert-error")).toHaveCount(0);
});

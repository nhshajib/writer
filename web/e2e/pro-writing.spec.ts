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
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
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

test("Free sees the Pro writing features marked, and the server refuses formatting", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { plan: "free", subscription_status: null } });
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Note");
  await toStep(page, 2);
  await expect(page.getByRole("radio", { name: /Keep formatting/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Import file/ })).toBeDisabled();
  await page.getByLabel("Text to enter").fill("A short note for today.");
  await toStep(page, 3);
  await expect(page.getByRole("radio", { name: /Under a heading/ })).toBeDisabled();
  await expectNoAxeViolations(page);

  const refused = await request.post("/functions/v1/drips", { data: { text: "# Hi", text_format: "markdown" } });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error).toMatch(/part of Pro/);
});

test("Pro keeps formatting: the preview shows it and the session is created with Markdown", async ({ page, request }) => {
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Plan");
  await toStep(page, 2);
  await page.getByRole("radio", { name: /Keep formatting/ }).check();
  await page.getByLabel("Text to enter").fill("# Weekly plan\nStart with **reading**. Then *write* notes.\n- Monday\n- Tuesday");
  const preview = page.locator(".format-preview");
  await expect(preview.getByRole("heading", { name: "Weekly plan" })).toBeVisible();
  await expect(preview.locator("strong")).toHaveText("reading");
  await expect(preview.locator("em")).toHaveText("write");
  await expect(preview.getByRole("listitem")).toHaveCount(2);
  // Counts are of the text that goes into the document, without the markers.
  await expect(page.locator("#text-count")).toContainText("10 words");
  await expectNoAxeViolations(page);

  await toStep(page, 4);
  await expect(page.getByRole("status").filter({ hasText: /one insertion each|automated edits/ })).toBeVisible();
  await toStep(page, 5);
  await expect(page.getByText("Headings, bold, italic and bullets kept")).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const create = await createRequest(request);
  expect(create.body.text_format).toBe("markdown");
  expect(create.body.text.startsWith("# Weekly plan")).toBe(true);
});

test("Pro imports .md, .txt and .docx files into the text box", async ({ page }) => {
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Imports");
  await toStep(page, 2);
  const input = page.getByTestId("import-file");

  await input.setInputFiles(path.join(FIXTURES, "sample.md"));
  await expect(page.getByLabel("Text to enter")).toHaveValue("## Shopping list\n- Apples\n- **Bread**");
  await expect(page.getByRole("radio", { name: /Keep formatting/ })).toBeChecked();
  await expect(page.getByText(/Imported "sample.md" with its headings/)).toBeVisible();

  await input.setInputFiles(path.join(FIXTURES, "sample.txt"));
  await expect(page.getByLabel("Text to enter")).toHaveValue("Plain notes line one.\nLine two.");
  await expect(page.getByRole("radio", { name: "Plain text" })).toBeChecked();

  await input.setInputFiles(path.join(FIXTURES, "sample.docx"));
  await expect(page.getByLabel("Text to enter")).toHaveValue("# Garden notes\n\nWater the **tomatoes** every *morning*.");
  await expect(page.locator(".format-preview strong")).toHaveText("tomatoes");
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

import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

const ESSAY = "The river rose overnight. By morning the lower fields were under water. Neighbours came with boats! " +
  "Nobody knew how long it would last? We waited, and watched, and waited again. The water finally fell on Sunday. " +
  "Then the cleaning began. It took weeks. Everyone helped. The bridge reopened in spring.";

const SESSION = {
  access_token: "e2e-token",
  refresh_token: "e2e-refresh",
  token_type: "bearer",
  expires_in: 3600 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: { name: "Sam" }, app_metadata: {} },
};

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((session) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
  }, SESSION);
});

/** Presses Tab until `target` has focus, proving it is reachable by keyboard. */
async function tabTo(page: Page, target: Locator, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Couldn't reach ${target} with Tab`);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function startSession(page: Page, opts: { minutes?: string } = {}) {
  await page.goto("/app/new/");
  await page.getByLabel("Title").fill("Flood essay");
  await page.getByLabel("Text to enter").fill(ESSAY);
  if (opts.minutes) await page.getByLabel("Session length").selectOption(opts.minutes);
  await expect(page.getByText(/sentences, one insertion each/)).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  // Wait for the first load, so later changes count as changes.
  await expect(page.getByText("Session started with its full schedule")).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}

test("a session can be set up and started with the keyboard alone", async ({ page, request }) => {
  await page.goto("/app/new/");
  const title = page.getByLabel("Title");
  await tabTo(page, title);
  await page.keyboard.type("Flood essay");

  await tabTo(page, page.getByLabel("Text to enter"));
  await page.keyboard.insertText(ESSAY);

  // Sentences is the default; arrow keys move within the step-size group.
  const sentences = page.getByRole("radio", { name: /^Sentences/ });
  await expect(sentences).toBeChecked();
  await tabTo(page, sentences);
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /^Paragraphs/ })).toBeChecked();
  await page.keyboard.press("ArrowUp");
  await expect(sentences).toBeChecked();

  // The checked plan is announced politely in one sentence, not per keystroke.
  const summary = page.getByRole("status").filter({ hasText: "one insertion each" });
  await expect(summary).toContainText("10 sentences, one insertion each");
  await expect(summary).toContainText("1 hour mark");
  await expect(page.getByRole("img", { name: /Planned schedule/ })).toBeVisible();

  const approve = page.getByLabel(/I've read this exact text/);
  await tabTo(page, approve);
  await page.keyboard.press("Space");
  await expect(approve).toBeChecked();

  await tabTo(page, page.getByRole("button", { name: "Start session" }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/session\/?\?id=/);

  // The session follows the schedule that was previewed.
  const { requests } = await (await request.get("/__test/requests")).json();
  const plans = requests.filter((r: { path: string }) => r.path.endsWith("/drips/plan"));
  const create = requests.find((r: { method: string; path: string }) => r.method === "POST" && r.path.endsWith("/drips"));
  expect(create.body.insertion_unit).toBe("sentence");
  expect(create.body.duration_minutes).toBe(60);
  expect(create.body.schedule_seed).toBe(plans.at(-1).body.schedule_seed);
  expect(create.body.text).toBe(ESSAY);
});

test("a duration that is too short is explained before starting", async ({ page }) => {
  await page.goto("/app/new/");
  await page.getByLabel("Title").fill("Flood essay");
  await page.getByLabel("Text to enter").fill(ESSAY);
  await page.getByRole("radio", { name: /^Characters/ }).check();
  await page.getByLabel("Session length").selectOption("5");
  await expect(page.getByText(/characters need at least/)).toBeVisible();
  await expect(page.getByText(/60 edits a minute/)).toBeVisible();
  // Each step size shows whether it fits.
  await expect(page.getByRole("radio", { name: /^Characters.*needs at least 1[0-9] minutes/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Words \d+ words$/ })).toBeVisible();

  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "This session can't run as set up" });
  await expect(alert).toContainText("need at least");
  await expect(alert).toBeFocused();
});

test("the new-session page passes axe in light and dark mode", async ({ page }) => {
  await page.goto("/app/new/");
  await page.getByLabel("Text to enter").fill(ESSAY);
  await expect(page.getByText(/one insertion each/)).toBeVisible();
  await page.getByText(/See the 10 sentences/).click();
  await expectNoAxeViolations(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expectNoAxeViolations(page);
});

test("pause, resume and stop work from the keyboard and are announced", async ({ page }) => {
  await startSession(page);
  await expect(page.getByRole("note", { name: "Automated text entry" })).toContainText("Automated text entry in progress");
  const live = page.locator("#session-announcer");

  const pause = page.getByRole("button", { name: "Pause" });
  await tabTo(page, pause);
  await page.keyboard.press("Enter");
  await expect(live).toHaveText("Session paused.");
  await expect(page.getByRole("heading", { name: "Progress" })).toBeFocused();
  await expect(page.getByRole("note", { name: "Automated text entry" })).toContainText("paused");
  await expect(page.getByText("Finish if resumed now")).toBeVisible();

  await tabTo(page, page.getByRole("button", { name: "Resume" }));
  await page.keyboard.press("Enter");
  await expect(live).toHaveText("Session resumed.");
  await expect(page.getByText("After 0 seconds paused, the rest moved later").or(page.getByText(/seconds? paused, the rest moved later/))).toBeVisible();

  // Stop asks first; Escape backs out and returns focus to Stop.
  const stop = page.getByRole("button", { name: "Stop", exact: true });
  await tabTo(page, stop);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: "Stop this session?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop session" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(stop).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // "Stop session" has focus
  await expect(live).toHaveText("Session stopped.");
  await expect(page.getByText("Stopped", { exact: true }).first()).toBeVisible();
});

test("screen readers hear progress milestones, not every insertion", async ({ page, request }) => {
  const id = await startSession(page);
  const live = page.locator("#session-announcer");
  const reload = () => page.evaluate(() => window.dispatchEvent(new Event("online")));

  await request.post("/__test/advance", { data: { id, written: 1 } }); // under 10%
  await reload();
  await expect(page.getByText("Part 1 of 10 entered", { exact: false })).toBeVisible();
  await expect(live).toHaveText("Session status: Entering text.");

  await request.post("/__test/advance", { data: { id, written: 3 } });
  await reload();
  await expect(live).toHaveText(/^\d0% entered: 3 of 10 parts\.$/);
  const first = await live.textContent();

  // One more insertion inside the same 10% band: nothing new is announced.
  await request.post("/__test/advance", { data: { id, written: 4 } });
  await reload();
  await expect(page.getByText("Part 4 of 10 entered", { exact: false })).toBeVisible();
  const second = await live.textContent();
  expect(second === first || /^\d0% entered: 4 of 10 parts\.$/.test(second ?? "")).toBe(true);

  // Turning milestones off keeps status changes.
  await page.getByLabel(/Announce progress every 10%/).uncheck();
  await request.post("/__test/advance", { data: { id, written: 7 } });
  await reload();
  await expect(page.getByText("Part 7 of 10 entered", { exact: false })).toBeVisible();
  await expect(live).not.toHaveText(/7 of 10/);

  await request.post("/__test/advance", { data: { id, written: 10 } });
  await reload();
  await expect(live).toHaveText(/^Finished\. All \d+ words are in the document\.$/);
  await expect(page.getByText("Checked: the document ends with exactly the approved text.")).toBeVisible();
  await expect(page.getByText(/Google Drive listed 3 revisions during this session for 10 insertions/)).toBeVisible();
});

test("a session TypeWit paused itself explains why and offers the right choices", async ({ page, request }) => {
  const id = await startSession(page);
  await request.post("/__test/advance", { data: { id, written: 2 } });
  await request.post("/__test/attention", {
    data: { id, attention: "confirm_last_part", message: "TypeWit was interrupted while entering a part." },
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  const panel = page.getByRole("alert").filter({ hasText: "Check the last part" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("region", { name: "The part to check" })).toContainText("Neighbours came with boats!");
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toHaveCount(0);

  await tabTo(page, panel.getByRole("button", { name: /It's there/ }));
  await page.keyboard.press("Enter");
  await expect(panel).toBeHidden();
  const { drip } = await (await request.get(`/functions/v1/drips/${id}`)).json();
  expect(drip.progress.chunks_written).toBe(3);
  expect(drip.status).toBe("scheduled");
});

test("the session page passes axe in light and dark mode, with reduced motion respected", async ({ page, request }) => {
  const id = await startSession(page);
  await request.post("/__test/advance", { data: { id, written: 4 } });
  await request.post("/__test/attention", { data: { id, attention: "document_changed", message: "The end changed." } });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("alert").filter({ hasText: "The end of the document changed" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expectNoAxeViolations(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transition = await page.locator(".progress > span").first().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(transition).toBe("0s");
});

import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { fillNewSession, toStep } from "./helpers";

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
  // Colours animate briefly (e.g. after switching to dark mode); check the settled page.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function startSession(page: Page, opts: { minutes?: string } = {}) {
  await page.goto("/app/new/");
  await fillNewSession(page, {
    title: "Flood essay",
    text: ESSAY,
    atTiming: async () => {
      if (opts.minutes) await page.getByLabel("Total duration").selectOption(opts.minutes);
    },
  });
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  // Wait for the first load, so later changes count as changes.
  await expect(page.getByText("Session started with its full schedule")).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}

test("a session starts with the keyboard using the recommended rhythm and an automatic title", async ({ page, request }) => {
  await page.goto("/app/new/");
  await tabTo(page, page.getByLabel("Text to enter"));
  await page.keyboard.insertText(ESSAY);
  const review = page.getByRole("button", { name: "Review session", exact: true });
  await expect(review).toBeEnabled();
  await tabTo(page, review);
  await page.keyboard.press("Enter");
  await expect(page.locator("form[data-step]")).toHaveAttribute("data-step", "5");
  const approve = page.getByLabel(/I've read this exact text/);
  await tabTo(page, approve);
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("button", { name: "Start session" }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/session\/?\?id=/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const create = requests.find((r: { method: string; path: string }) => r.method === "POST" && /\/drips$/.test(r.path));
  expect(create.body.rhythm).toBe("natural");
  expect(create.body.insertion_unit).toBe("word");
  expect(create.body.new_document_title).toBe(ESSAY.split(/(?<=[.!?])\s/)[0]);
  expect(create.body.text).toBe(ESSAY);
});

test("a duration that is too short is explained before starting", async ({ page }) => {
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Flood essay");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(ESSAY);
  await toStep(page, 3);
  await page.getByRole("radio", { name: /^Characters/ }).check();
  await toStep(page, 4);
  await page.getByLabel("Total duration").selectOption("5");
  await expect(page.getByText(/characters need at least/).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/60 edits a minute/).filter({ visible: true })).toBeVisible();
  // Each step size shows whether it fits.
  await toStep(page, 3);
  await expect(page.getByRole("radio", { name: /^Characters.*needs at least 1[0-9] minutes/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Word groups \d+ word groups/ })).toBeVisible();

  // Continuing from the timing step is refused with the reason, and focus goes to the setting to change.
  await toStep(page, 4);
  await page.locator(".step-bar").getByRole("button", { name: /^Review session/ }).click();
  await expect(page.locator(".step-bar .alert-error")).toContainText("need at least");
  await expect(page.getByLabel("Total duration")).toBeFocused();
  await expect(page.locator("form[data-step]")).toHaveAttribute("data-step", "1");
});

test("the new-session page passes axe in light and dark mode", async ({ page }) => {
  await page.goto("/app/new/");
  await expectNoAxeViolations(page);
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Flood essay");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(ESSAY);
  await expectNoAxeViolations(page);
  await toStep(page, 4);
  await expect(page.getByRole("status").filter({ hasText: /one insertion each|automated edits/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await toStep(page, 5);
  await page.getByText(/See the .* in order/).click();
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

  // Stop is in the "More actions" menu and asks first; Escape backs out and returns focus to the menu button.
  const more = page.getByRole("button", { name: "More actions" });
  const stop = page.getByRole("button", { name: "Stop", exact: true });
  await tabTo(page, more);
  await page.keyboard.press("Enter");
  await tabTo(page, stop);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: "Stop this session?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop session" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(more).toBeFocused();

  await page.keyboard.press("Enter");
  await tabTo(page, stop);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // "Stop session" has focus
  await expect(live).toHaveText("Session stopped.");
  await expect(page.locator(".badge").filter({ hasText: "State: Cancelled" })).toBeVisible();
});

test("screen readers hear progress milestones, not every insertion", async ({ page, request }) => {
  const id = await startSession(page);
  const live = page.locator("#session-announcer");
  const reload = () => page.evaluate(() => window.dispatchEvent(new Event("online")));

  await request.post("/__test/advance", { data: { id, written: 1 } }); // under 10%
  await reload();
  await expect(page.getByText("Part 1 of 10 entered", { exact: false })).toBeVisible();
  await expect(live).toHaveText("Session state: Running.");

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

  // Turning milestones off keeps status changes. The option is on the "Settings & data" tab.
  await page.getByRole("tab", { name: "Settings & data" }).click();
  await page.getByLabel(/Announce progress every 10%/).uncheck();
  await page.getByRole("tab", { name: "Activity" }).click();
  await request.post("/__test/advance", { data: { id, written: 7 } });
  await reload();
  await expect(page.getByText("Part 7 of 10 entered", { exact: false })).toBeVisible();
  await expect(live).not.toHaveText(/7 of 10/);

  await request.post("/__test/advance", { data: { id, written: 10 } });
  await reload();
  await expect(live).toHaveText(/^Completed\. All \d+ words are in the document\.$/);
  await expect(page.getByText("Checked: the document ends with exactly the approved text.")).toBeVisible();
  await expect(page.getByText(/Google Drive listed 3 revisions during this session for 10 insertions/)).toBeVisible();
});

test("Timeline insertion labels remain distinct from the activity log for screen-reader locators", async ({ page, request }) => {
  const id = await startSession(page);
  await request.post("/__test/advance", { data: { id, written: 3 } });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  // Both panels remain mounted. The activity wording must still identify one
  // entry even when Timeline is hidden, preserving unambiguous reader output.
  await expect(page.getByText("Part 3 of 10 entered", { exact: false })).toHaveCount(1);
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Timeline" }).getByText("Insertion 3 of 10", { exact: true })).toBeVisible();
  await expect(page.getByText("Part 3 of 10 entered", { exact: false })).toHaveCount(1);
  await expectNoAxeViolations(page);
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(page.getByText("Part 3 of 10 entered", { exact: false })).toBeVisible();
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

test("when the document's end changed, the session shows what changed and how to fix it", async ({ page, request }) => {
  const id = await startSession(page);
  await request.post("/__test/advance", { data: { id, written: 2 } });
  await request.post("/__test/type", { data: { id, text: "\nMy own note. " } });

  // While it runs, Test connection (in the "More actions" menu) shows the difference and offers to pause.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("TypeWit expected the document to end with")).toBeVisible();
  await expect(page.locator(".what-changed pre").nth(1)).toContainText("¶\nMy own note.·");
  await page.getByRole("button", { name: "Pause to fix it" }).click();
  await expect(page.locator(".badge").filter({ hasText: "State: Paused" })).toBeVisible();

  // Once TypeWit has paused it for this reason, the panel offers both fixes and "Show what changed".
  await request.post("/__test/attention", {
    data: { id, attention: "document_changed", message: "The end of the document no longer matches what TypeWit entered." },
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const panel = page.getByRole("alert").filter({ hasText: "I've fixed it" });
  await expect(panel.getByRole("button", { name: "Continue after the document's current end" })).toBeVisible();
  await panel.getByRole("button", { name: "Show what changed" }).click();
  await expect(page.getByText("Your document ends with")).toBeVisible();
  await expectNoAxeViolations(page);
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

test("pace settings: every slider has a labelled number box, and the estimate follows them", async ({ page }) => {
  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByLabel("Title").fill("Flood essay");
  await toStep(page, 2);
  await page.getByLabel("Text to enter").fill(ESSAY);
  await toStep(page, 4);
  await page.getByRole("radio", { name: /^Typing speed/ }).check();
  const summary = page.getByRole("status").filter({ hasText: "estimated to take" });
  await expect(summary).toBeVisible();
  const before = await summary.textContent();

  // The number box and the slider are the same setting.
  const speedBox = page.getByRole("spinbutton", { name: "Typing speed" });
  const speedSlider = page.getByRole("slider", { name: "Typing speed" });
  await expect(speedBox).toHaveValue("40");
  await speedSlider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(speedBox).toHaveValue("41");
  await expect(speedSlider).toHaveAttribute("aria-valuetext", "41 words per minute");
  await speedBox.fill("20");
  await speedBox.blur();
  await expect(speedSlider).toHaveValue("20");
  await expect(summary).not.toHaveText(before!);
  const slower = await summary.textContent();

  // A break every minute adds breaks to the estimate; turning breaks off removes them again.
  const every = page.getByRole("spinbutton", { name: "Active time between breaks" });
  await every.fill("1");
  await every.blur();
  await expect(summary).toContainText("break");
  const withBreaks = await summary.textContent();
  expect(withBreaks).not.toBe(slower);
  await page.getByLabel("Take breaks").uncheck();
  await expect(summary).toHaveText(slower!);

  for (const name of ["Timing variation"]) {
    await expect(page.getByRole("spinbutton", { name })).toBeVisible();
    await expect(page.getByRole("slider", { name })).toBeVisible();
  }
  await page.getByLabel("Take breaks").check();
  for (const name of ["Active time between breaks", "Variation in that time", "Shortest break", "Longest break"]) {
    await expect(page.getByRole("spinbutton", { name })).toBeVisible();
    await expect(page.getByRole("slider", { name })).toBeVisible();
  }
  // The longest break can't go below the shortest.
  await page.getByRole("spinbutton", { name: "Shortest break" }).fill("300");
  await page.getByRole("spinbutton", { name: "Shortest break" }).blur();
  await expect(page.getByRole("spinbutton", { name: "Longest break" })).toHaveValue("300");
  // Out-of-range typing is clamped.
  await page.getByRole("spinbutton", { name: "Timing variation" }).fill("90");
  await page.getByRole("spinbutton", { name: "Timing variation" }).blur();
  await expect(page.getByRole("spinbutton", { name: "Timing variation" })).toHaveValue("50");
  await expect(page.getByText(/WPM.*5 characters|"word" is 5 characters/).first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test("review keeps the useful facts without repeating default settings", async ({ page }) => {
  await page.goto("/app/new/");
  await page.getByLabel("Text to enter").fill(ESSAY);
  await page.getByRole("button", { name: "Review session", exact: true }).click();
  const list = page.locator("dl.summary-list");
  await expect(list).toContainText("New Google Doc");
  await expect(list).toContainText(`${ESSAY.length} characters`);
  await expect(list).toContainText("Natural");
  await expect(list).toContainText("Planned duration");
  await expect(list).not.toContainText("Plain text");
  await expect(page.locator(".new-rail")).toHaveCount(0);
});

test("test connection reports each check without changing anything", async ({ page, request }) => {
  await page.goto("/app/new/");
  await toStep(page, 1);
  await page.getByText("Check the connection (optional)", { exact: true }).click();
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Connection works.")).toBeVisible();
  await expect(page.getByText(/Google account:.*OK/)).toBeVisible();
  const { requests } = await (await request.get("/__test/requests")).json();
  expect(requests.some((r: { path: string }) => r.path.endsWith("/drips/check"))).toBe(true);
  expect(requests.some((r: { method: string; path: string }) => r.method === "POST" && r.path.endsWith("/drips"))).toBe(false);
});

test("a double click on Start starts one session", async ({ page, request }) => {
  await page.goto("/app/new/");
  await fillNewSession(page, { title: "Flood essay", text: ESSAY });
  await page.getByRole("button", { name: "Start session" }).dblclick();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const creates = requests.filter((r: { method: string; path: string }) => r.method === "POST" && /\/drips\/?$/.test(r.path));
  expect(creates.length).toBe(1);
});

test("the session page shows state, activity, breaks and test connection; finished sessions can be deleted", async ({ page, request }) => {
  const id = await startSession(page);
  await expect(page.getByText("State:", { exact: false }).first()).toBeAttached();
  await expect(page.locator(".activity")).toContainText(/Waiting for the next insertion|Entering text/);
  await expect(page.getByText(/Next break: after part/)).toBeVisible();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/Insertion point:.*OK/)).toBeVisible();

  await request.post("/__test/advance", { data: { id, written: 10 } });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".badge").filter({ hasText: "State: Completed" })).toBeVisible();
  await page.getByRole("tab", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "Delete this session" }).click();
  await expect(page.getByRole("alertdialog", { name: /Delete this session/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/sessions\/?$/);
  const res = await request.get(`/functions/v1/drips/${id}`);
  expect(res.status()).toBe(404);
});

test("settings explain where data is kept and can clear finished sessions", async ({ page, request }) => {
  const id = await startSession(page);
  await request.post("/__test/advance", { data: { id, written: 10 } });
  await page.goto("/app/settings/");
  await expect(page.getByText(/activity log stores times, counts and outcomes, not your text/)).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Delete finished sessions (1)" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted 1 finished session and their saved text.")).toBeVisible();
  expect((await request.get(`/functions/v1/drips/${id}`)).status()).toBe(404);
});



test("Pro edits only the remaining text while paused, approves, saves, then resumes", async ({ page, request }) => {
  const id = await startSession(page);
  await request.post("/__test/advance", { data: { id, written: 1 } });
  await page.reload();
  await page.getByRole("button", { name: "Pause", exact: true }).first().click();
  await page.getByRole("button", { name: /Edit remaining text/ }).click();
  const editor = page.getByRole("form", { name: /Edit the remaining session/ });
  await expect(editor.getByRole("button", { name: "Save changes and stay paused" })).toBeDisabled();
  await editor.getByLabel("Remaining text", { exact: true }).fill("A revised ending for this document.");
  await editor.getByLabel("Insertion steps", { exact: true }).selectOption("word");
  await editor.getByRole("checkbox", { name: /I have reviewed and approve/ }).check();
  await editor.getByRole("button", { name: "Save changes and stay paused" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "Remaining text and settings updated" })).toBeVisible();
  const detail = await (await request.get(`/functions/v1/drips/${id}`)).json();
  expect(detail.drip.status).toBe("paused");
  expect(detail.drip.progress.written_text).toBe("The river rose overnight. ");
  expect(detail.drip.progress.remaining_text).toBe("A revised ending for this document.");
  const response = page.waitForResponse((r) => r.url().endsWith("/resume") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Resume", exact: true }).first().click();
  expect((await response).ok()).toBe(true);
  const resumed = await (await request.get(`/functions/v1/drips/${id}`)).json();
  expect(["running", "scheduled"]).toContain(resumed.drip.status);
});


test("desktop setup has one focused column and no duplicate summary", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/new/");
  await expect(page.locator(".new-rail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review session", exact: true })).toBeVisible();
  await expect(page.locator(".session-advanced")).not.toHaveAttribute("open", "");
});

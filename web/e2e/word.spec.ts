import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { fillNewSession } from "./helpers";

/*
 * The Word add-in pane and Google Picker, against the mock API. Office.js and
 * Google's Picker script can't run here, so small fakes stand in for them:
 * the fake Word keeps the document as a list of paragraphs, like Word's API.
 */

const SESSION = {
  access_token: "e2e-token",
  refresh_token: "e2e-refresh",
  token_type: "bearer",
  expires_in: 3600 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: {}, app_metadata: {} },
};

const DOC_URL = "https://contoso-my.sharepoint.com/personal/sam/Documents/Flood%20essay.docx";

/** Stands in for https://appsforoffice.microsoft.com/lib/1/hosted/office.js. */
function fakeOfficeJs(opts: { host: string | null; url: string | null; mode?: string }) {
  return `
    window.__paras = window.__paras || ["Notes from class: "];
    window.__batches = 0;
    window.Office = {
      onReady: () => Promise.resolve({ host: ${JSON.stringify(opts.host)} }),
      context: { document: { url: ${JSON.stringify(opts.url)}, mode: ${JSON.stringify(opts.mode ?? "readWrite")} } },
    };
    window.Word = {
      run: async (batch) => {
        window.__batches++;
        const pending = [];
        const context = {
          document: { body: {
            paragraphs: {
              items: [],
              load() {
                this.items = window.__paras.map((text, i) => ({
                  text,
                  insertText: (more) => pending.push(() => { window.__paras[i] += more; }),
                }));
              },
            },
            insertParagraph: (text) => pending.push(() => { window.__paras.push(text); }),
          } },
          sync: async () => { pending.splice(0).forEach((f) => f()); },
        };
        return await batch(context);
      },
    };
    // Office.js replaces these; the pane must put them back.
    window.history.pushState = null;
    window.history.replaceState = null;
  `;
}

async function useFakeWord(page: Page, opts: { host: string | null; url: string | null; mode?: string }) {
  await page.route("https://appsforoffice.microsoft.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeOfficeJs(opts) }));
}

async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Couldn't reach ${target} with Tab`);
}

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript((session) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
  }, SESSION);
});

test("the Word add-in enters the approved text into the open document, operated by keyboard", async ({ page, request }) => {
  await useFakeWord(page, { host: "Word", url: DOC_URL });
  await page.goto("/word/");
  await expect(page.getByText("Document:")).toContainText("Flood essay");

  const text = "Flood day.\nThe river rose overnight, émojis 👨‍👩‍👧 stay whole.\n\nThe end.";
  await tabTo(page, page.getByLabel("Text to enter"));
  await page.keyboard.insertText(text);
  await page.getByRole("radio", { name: "All at once" }).check();
  await expect(page.getByText(/planned 1 second/)).toBeVisible();

  // Test connection checks the document without changing it.
  const before = await page.evaluate(() => [...(window as unknown as { __paras: string[] }).__paras]);
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Connection works.")).toBeVisible();
  await expect(page.getByText(/Word add-in:/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __paras: string[] }).__paras)).toEqual(before);

  await tabTo(page, page.getByLabel(/I've read this exact text/));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("button", { name: "Start session" }));
  await page.keyboard.press("Enter");

  await expect(page.getByText("State: Completed")).toBeVisible({ timeout: 20_000 });
  // The first line continues the last paragraph; each line break is a real new paragraph.
  expect(await page.evaluate(() => (window as unknown as { __paras: string[] }).__paras)).toEqual([
    "Notes from class: Flood day.",
    "The river rose overnight, émojis 👨‍👩‍👧 stay whole.",
    "",
    "The end.",
  ]);
  await expect(page.getByText(/100% confirmed/)).toBeVisible();

  // The log on the server has the connection check, the insertion and the completion, and no document text.
  const { requests } = await (await request.get("/__test/requests")).json();
  const ops = requests.filter((r: { path: string }) => r.path.endsWith("/engine")).map((r: { body: { op: string } }) => r.body.op);
  expect(ops).toContain("claim");
  expect(ops).toContain("confirm");
  const logged = requests.filter((r: { body: { op?: string } }) => r.body?.op === "log")
    .flatMap((r: { body: { events: { kind: string; detail: unknown }[] } }) => r.body.events);
  expect(logged.map((e: { kind: string }) => e.kind)).toEqual(expect.arrayContaining(["connection_checked", "chunk_written", "completed"]));
  expect(JSON.stringify(logged)).not.toContain("river rose");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("the Word add-in pauses and resumes, and stopping explains that entered text stays", async ({ page }) => {
  await useFakeWord(page, { host: "Word", url: DOC_URL });
  await page.goto("/word/");
  await page.getByLabel("Text to enter").fill("One. Two. Three.");
  await expect(page.getByText(/planned 1 hour/)).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();

  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("State: Paused")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await page.getByRole("button", { name: "Stop…" }).click();
  await expect(page.getByText("Text already entered stays in your document")).toBeVisible();
  await page.getByRole("button", { name: "Stop session" }).click();
  await expect(page.getByText("State: Cancelled")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start another session" })).toBeVisible();
});

test("outside Word, or in an unsaved document, the pane explains what to do", async ({ page }) => {
  await useFakeWord(page, { host: null, url: null });
  await page.goto("/word/");
  await expect(page.getByRole("heading", { name: "Open TypeWit from Word" })).toBeVisible();

  const second = await page.context().newPage();
  await useFakeWord(second, { host: "Word", url: null });
  await second.goto("/word/");
  await expect(second.getByText("Save this document first")).toBeVisible();
});

test("a read-only Word document is reported by Test connection", async ({ page }) => {
  await useFakeWord(page, { host: "Word", url: DOC_URL, mode: "readOnly" });
  await page.goto("/word/");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Connection problem.")).toBeVisible();
  await expect(page.getByText(/isn't editable/).first()).toBeVisible();
});

test("any Google Doc can be chosen with Google Picker and is used for the session", async ({ page, request }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { __pickerCalls: string[] }).__pickerCalls = calls;
    const picker = {
      ViewId: { DOCUMENTS: "documents" },
      Response: { ACTION: "action", DOCUMENTS: "docs" },
      Action: { PICKED: "picked", CANCEL: "cancel" },
      Document: { ID: "id", NAME: "name" },
      DocsView: class {
        setMimeTypes(m: string) { calls.push(`mime:${m}`); return this; }
        setIncludeFolders() { return this; }
        setSelectFolderEnabled() { return this; }
      },
      PickerBuilder: class {
        private callback: (data: Record<string, unknown>) => void = () => {};
        addView() { return this; }
        setTitle() { return this; }
        setOAuthToken(t: string) { calls.push(`token:${t}`); return this; }
        setAppId(id: string) { calls.push(`app:${id}`); return this; }
        setDeveloperKey(k: string) { calls.push(`key:${k}`); return this; }
        setCallback(cb: (data: Record<string, unknown>) => void) { this.callback = cb; return this; }
        build() {
          return { setVisible: () => setTimeout(() => this.callback({ action: "picked", docs: [{ id: "picked-doc-123", name: "Lab report" }] }), 50) };
        }
      },
    };
    (window as unknown as Record<string, unknown>).google = { picker };
    (window as unknown as Record<string, unknown>).gapi = { load: (_n: string, o: { callback: () => void }) => o.callback() };
  });

  await page.goto("/app/new/");
  await page.locator(".destination-options").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.getByRole("radio", { name: /Existing document/ }).check();
  await page.getByRole("button", { name: "Choose from Google Drive…" }).click();
  await expect(page.locator("#doc")).toHaveValue("c1:picked-doc-123");
  await expect(page.locator("#doc option:checked")).toHaveText("Lab report");
  expect(await page.evaluate(() => (window as unknown as { __pickerCalls: string[] }).__pickerCalls)).toEqual(
    expect.arrayContaining(["mime:application/vnd.google-apps.document", "token:picker-token", "app:654277390095"]),
  );

  await fillNewSession(page, { text: "A short report. It has two sentences." });
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  const { requests } = await (await request.get("/__test/requests")).json();
  const create = requests.find((r: { method: string; path: string }) => r.method === "POST" && r.path === "/functions/v1/drips");
  expect(create.body.document_id).toBe("picked-doc-123");
});

test("Free Word offers the same Natural and Steady rhythms", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { plan: "free" } });
  await useFakeWord(page, { host: "Word", url: DOC_URL });
  await page.goto("/word/");
  await expect(page.getByLabel("Writing rhythm")).toHaveValue("natural");
  const response = page.waitForResponse((r) => r.url().endsWith("/drips/plan") && r.request().method() === "POST");
  await page.getByLabel("Text to enter").fill("One sentence for this document. Another sentence follows.");
  const natural = await (await response).json();
  expect(natural.plan.ok).toBe(true);
  expect(natural.plan.pacing.drafting.sentence_pause_seconds).toBe(2);
  const steadyResponse = page.waitForResponse((r) => r.url().endsWith("/drips/plan") && r.request().method() === "POST");
  await page.getByLabel("Writing rhythm").selectOption("steady");
  const steady = await (await steadyResponse).json();
  expect(steady.plan.ok).toBe(true);
  expect(steady.plan.pacing.drafting.sentence_pause_seconds).toBe(0);
});

test("Word detects a concurrent edit after its write and recovers without a duplicate", async ({ page }) => {
  const body = fakeOfficeJs({ host: "Word", url: "https://example.invalid/fixture.docx" }).replace(
    "pending.splice(0).forEach((f) => f());",
    `const writes = pending.splice(0); writes.forEach((f) => f());
     if (writes.length && !window.__concurrentFixture) {
       window.__concurrentFixture = true;
       window.__paras[window.__paras.length - 1] += " Concurrent testing note.";
     }`,
  );
  await page.route("https://appsforoffice.microsoft.com/**", route => route.fulfill({ contentType: "text/javascript", body }));
  await page.goto("/word/");
  await page.getByLabel("Text to enter").fill("Approved testing text.");
  await page.getByRole("radio", { name: "All at once" }).check();
  await expect(page.getByText(/planned 1 second/)).toBeVisible();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText("State: Paused")).toBeVisible({ timeout: 20000 });
  const text = await page.evaluate(() => (window as unknown as { __paras: string[] }).__paras.join("\n"));
  expect(text.split("Approved testing text.").length - 1).toBe(1);
  expect(text).toContain("Concurrent testing note.");
});

test("Free Word offers strict single-word entry without premium pacing controls", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { plan: "free" } });
  await useFakeWord(page, { host: "Word", url: DOC_URL });
  await page.goto("/word/");
  await page.getByLabel("Insert one", { exact: true }).selectOption("word");
  await page.getByLabel("Text to enter").fill("One approved sentence. Another follows.");
  const response = page.waitForResponse(r => r.url().endsWith("/drips/plan") && r.request().postDataJSON()?.pacing?.word_grouping === "single");
  await page.getByRole("radio", { name: /^One word at a time/ }).check();
  const { plan } = await (await response).json();
  expect(plan.ok).toBe(true);
  expect(plan.pacing.word_grouping).toBe("single");
  expect(plan.source_unit_count).toBe(5);
  await expect(page.getByRole("region", { name: "Your rhythm at a glance" })).toContainText("One word");
  await expect(page.getByRole("spinbutton", { name: "Neighbor-key typos", exact: true })).toHaveCount(0);
});

test("Day Pass Word plans customizable block rests", async ({page,request})=>{
  await request.post("/__test/profile",{data:{plan:"free",day_pass_expires_at:new Date(Date.now()+86400000).toISOString()}});
  await useFakeWord(page,{host:"Word",url:DOC_URL});
  await page.goto("/word/");
  await page.getByLabel("Text to enter",{exact:true}).fill("An approved sentence. ".repeat(30));
  await page.getByLabel("Take a long break between writing blocks",{exact:true}).check();
  await page.getByLabel("Writing time",{exact:true}).selectOption("120");
  const response=page.waitForResponse(r=>r.url().endsWith("/drips/plan")&&r.request().postDataJSON()?.pacing?.writing_blocks?.break_seconds===28800);
  await page.getByLabel("Break between blocks",{exact:true}).selectOption("480");
  const {plan}=await(await response).json();
  expect(plan.ok).toBe(true);
  expect(plan.duration_seconds).toBe(36000);
  expect(plan.block_summary.blocks).toBe(2);
});

test("Word restores paid writing-block defaults and shows pass expiry", async ({page,request})=>{
  await request.post("/__test/profile",{data:{plan:"free",day_pass_expires_at:new Date(Date.now()+86400000).toISOString(),session_defaults:{minutes:120,writing_blocks:{block_seconds:7200,break_seconds:28800}}}});
  await useFakeWord(page,{host:"Word",url:DOC_URL});
  await page.goto("/word/");
  await expect(page.getByLabel("Take a long break between writing blocks",{exact:true})).toBeChecked();
  await expect(page.getByLabel("Write for about",{exact:true})).toHaveValue("120");
  await expect(page.getByLabel("Break between blocks",{exact:true})).toHaveValue("480");
  await expect(page.getByText(/Every restart and the finish must be before then/)).toBeVisible();
});

for(const rhythm of ['natural','steady','drafting'] as const) {
  test(`Word ${rhythm} defaults to sentences and splits long sentences without changing text`,async({page})=>{
    await useFakeWord(page,{host:'Word',url:DOC_URL});
    await page.goto('/word/');
    await expect(page.getByLabel('Insert one',{exact:true})).toHaveValue('sentence');
    await page.getByLabel('Writing rhythm',{exact:true}).selectOption(rhythm);
    const text=Array.from({length:31},()=> 'approved').join(' ')+'.';
    const response=page.waitForResponse(r=>r.url().endsWith('/drips/plan')&&r.request().postDataJSON()?.text===text&&r.request().postDataJSON()?.rhythm===rhythm);
    await page.getByLabel('Text to enter',{exact:true}).fill(text);
    const {plan}=await(await response).json();
    expect(plan.ok).toBe(true);expect(plan.unit).toBe('sentence');expect(plan.source_unit_count).toBe(2);
    expect(plan.source_unit_lengths.reduce((a:number,b:number)=>a+b,0)).toBe(text.length);
    await expect(page.locator('.sentence-step-hint')).toContainText('over 20 words');
  });
}

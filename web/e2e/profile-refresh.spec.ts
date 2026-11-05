import { expect, test } from "@playwright/test";
import { CURRENT_TERMS_VERSION } from "../lib/terms";

test("an older OAuth profile snapshot cannot undo an agreement already recorded by another refresh", async ({ page, request }) => {
  await request.post("/__test/reset");
  await request.post("/__test/profile", { data: { age_confirmed_at: null, birth_year: null, birth_month: null, agreed_terms_version: null } });
  await page.addInitScript((version) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify({ access_token:"e2e-token", refresh_token:"e2e-refresh", token_type:"bearer", expires_in:86400, expires_at:Math.floor(Date.now()/1000)+86400, user:{id:"u1",aud:"authenticated",role:"authenticated",email:"fixture@example.invalid",user_metadata:{},app_metadata:{provider:"discord",providers:["discord"]}} }));
    sessionStorage.setItem("typewit:agreed-before-google", version);
  }, CURRENT_TERMS_VERSION);
  await page.clock.install();
  let releaseFirst!: () => void, releaseLate!: () => void;
  let firstSeen!: () => void, lateSeen!: () => void;
  const firstGate = new Promise<void>((r) => { releaseFirst = r; });
  const lateGate = new Promise<void>((r) => { releaseLate = r; });
  const firstCaptured = new Promise<void>((r) => { firstSeen = r; });
  const lateCaptured = new Promise<void>((r) => { lateSeen = r; });
  let firstConnection = true, profiles = 0;
  await page.route("**/functions/v1/drips/connections", async (route) => {
    if (!firstConnection) return route.continue();
    firstConnection = false;
    const response = await route.fetch();
    firstSeen();
    await firstGate;
    await route.fulfill({ response });
  });
  await page.route("**/rest/v1/profiles?*", async (route) => {
    if (route.request().method() !== "GET" || !new URL(route.request().url()).searchParams.get("select")?.includes("email_notifications")) return route.continue();
    if (++profiles === 1) return route.continue();
    const response = await route.fetch();
    const body = await response.body();
    lateSeen();
    await lateGate;
    await route.fulfill({ response, body });
  });
  try {
    await page.goto("/app/");
    await firstCaptured;
    await page.clock.fastForward(5100);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await lateCaptured;
    releaseFirst();
    await expect(page.getByRole("heading", { name: "One last step" })).toBeVisible();
    await expect(page.locator("#gate-agree")).toHaveCount(0);
    const delivered = page.waitForResponse((r) => r.url().includes("/rest/v1/profiles?") && new URL(r.url()).searchParams.get("select")?.includes("email_notifications") === true);
    releaseLate();
    await delivered;
    await page.getByLabel("Country you live in").selectOption("BD");
    await page.getByLabel("Month you were born").selectOption("1");
    await page.getByLabel("Year you were born").selectOption("1990");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
    const { requests } = await (await request.get("/__test/requests")).json();
    expect(requests.some((r: { path:string }) => r.path === "/rest/v1/rpc/confirm_age")).toBe(true);
    expect(requests.some((r: { path:string; body:{version?:string} }) => r.path === "/rest/v1/rpc/agree_to_terms" && r.body.version === CURRENT_TERMS_VERSION)).toBe(true);
  } finally {
    releaseFirst(); releaseLate();
  }
});

test("an older background refresh cannot undo a successfully saved notification preference", async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript(() => localStorage.setItem("sb-localhost-auth-token", JSON.stringify({
    access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: {}, app_metadata: { provider: "email", providers: ["email"] } },
  })));
  await page.goto("/app/settings/#notifications");
  const toggle = page.getByLabel("Email me when a session finishes.", { exact: true });
  await expect(toggle).toBeChecked();
  await page.waitForLoadState("networkidle");
  await page.clock.install();
  await page.clock.fastForward(5100);
  let release!: () => void;
  let captured!: () => void;
  const snapshot = new Promise<void>((resolve) => { captured = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/rest/v1/profiles?*", async (route) => {
    if (route.request().method() !== "GET" || !new URL(route.request().url()).searchParams.get("select")?.includes("email_notifications")) return route.continue();
    const response = await route.fetch();
    const body = await response.body();
    captured();
    await gate;
    await route.fulfill({ response, body });
  });
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await snapshot;
    await toggle.uncheck();
    await expect(page.locator(".toast")).toHaveText(/Saved\. We won't email you about that\./);
    const delivered = page.waitForResponse((r) => r.url().includes("/rest/v1/profiles?") && r.request().method() === "GET");
    release();
    await delivered;
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(toggle).not.toBeChecked();
  } finally {
    release();
  }
});

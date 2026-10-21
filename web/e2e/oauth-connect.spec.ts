import { test, expect } from "@playwright/test";
const SESSION = {
  access_token: "fixture-token", refresh_token: "fixture-refresh", token_type: "bearer",
  expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: { id: "fixture-user", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: {}, app_metadata: {} },
};
test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript(session => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session)), SESSION);
});
test("Google connect finishes in its initiating tab and removes the code fragment", async ({ page }) => {
  await page.route("**/functions/v1/google-oauth-start?*", async route => {
    const challenge = new URL(route.request().url()).searchParams.get("browser_challenge");
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await route.fulfill({ json: { url: "http://localhost:54399/__test/google-consent" } });
  });
  await page.route("**/__test/google-consent", route => route.fulfill({ status: 302,
    headers: { Location: "http://localhost:54399/app/connections/#google_connect=fixture-state&google_code=fixture-code" } }));
  let finishes = 0;
  await page.route("**/functions/v1/google-oauth-callback", async route => {
    const body = route.request().postDataJSON();
    expect(body.state).toBe("fixture-state");
    expect(body.code).toBe("fixture-code");
    expect(body.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(new URL(page.url()).hash).toBe("");
    finishes++;
    await route.fulfill({ json: { connected: true } });
  });
  await page.goto("/app/connections/");
  await page.getByRole("button", { name: /Connect another account|Connect Google/ }).first().click();
  await expect(page.getByText("Your Google account is connected.")).toBeVisible();
  expect(finishes).toBe(1);
  expect(new URL(page.url()).hash).toBe("");
});
test("a forwarded Google return without the tab verifier does not finalize a connection", async ({ page }) => {
  let finishes = 0;
  await page.route("**/functions/v1/google-oauth-callback", async route => { finishes++; await route.abort(); });
  await page.goto("/app/connections/#google_connect=forwarded-state&google_code=fixture-code");
  await expect(page.getByText(/couldn't connect your Google account/)).toBeVisible();
  expect(finishes).toBe(0);
  expect(new URL(page.url()).hash).toBe("");
});

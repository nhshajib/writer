import { expect, test } from "@playwright/test";

test("signed-in runtime diagnostics send only coarse categories, never the error message", async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.addInitScript(() => localStorage.setItem("sb-localhost-auth-token", JSON.stringify({
    access_token:"e2e-token", refresh_token:"e2e-refresh", token_type:"bearer", expires_in:86400, expires_at:Math.floor(Date.now()/1000)+86400,
    user:{id:"u1",aud:"authenticated",role:"authenticated",email:"fixture@example.invalid",user_metadata:{},app_metadata:{provider:"email",providers:["email"]}},
  })));
  await page.goto("/app/");
  await expect(page.getByRole("heading", { level:1 })).toHaveText(/Good (morning|afternoon|evening)/);
  const emitted = page.waitForRequest((r) => r.url().endsWith("/drips/client-errors"));
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { message: "Fixture sensitive marker" })));
  const payload = (await emitted).postDataJSON();
  expect(Object.keys(payload).sort()).toEqual(["kind","release","status","surface"]);
  expect(payload).toMatchObject({ kind:"runtime", surface:"dashboard", status:0 });
  expect(JSON.stringify(payload)).not.toContain("Fixture sensitive marker");
  expect(payload.release).toMatch(/^(local|[a-f0-9]{40})$/i);
});

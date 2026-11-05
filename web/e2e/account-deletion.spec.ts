import { expect, test } from "@playwright/test";

test("deletion requires explicit Pro cancellation and clears this device's drafts after success", async ({ page, request }) => {
  await request.post("/__test/reset");
  await request.post("/__test/user-email", { data: { email: "deletion@example.invalid" } });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("fixture-deletion-initialized")) return;
    sessionStorage.setItem("fixture-deletion-initialized", "yes");
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify({
      access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400,
      expires_at: Math.floor(Date.now()/1000)+86400,
      user: { id:"u1", aud:"authenticated", role:"authenticated", email:"deletion@example.invalid", user_metadata:{}, app_metadata:{provider:"email",providers:["email"]} },
    }));
    localStorage.setItem("typewit.draft", "Synthetic draft only");
    localStorage.setItem("unrelated-app", "keep");
  });
  await page.goto("/app/settings/#danger");
  await page.getByRole("button", { name: "Delete my account…" }).click();
  await page.getByLabel("Type deletion@example.invalid to confirm").fill("deletion@example.invalid");
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "select End Pro now" })).toBeVisible();
  await expect(page).toHaveURL(/settings/);
  await page.getByLabel("End Pro now so I can delete my account.").check();
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  await page.waitForURL(/\?account=deleted/);
  expect(await page.evaluate(() => localStorage.getItem("typewit.draft"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("unrelated-app"))).toBe("keep");
  const { requests } = await (await request.get("/__test/requests")).json();
  const attempts = requests.filter((r: {path:string}) => r.path === "/functions/v1/drips/account/delete");
  expect(attempts.map((r: {body:{cancel_subscription:boolean}}) => r.body.cancel_subscription)).toEqual([false,true]);
});

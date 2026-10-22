import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/* Sign-in, password reset and the way back to the page someone wanted, against the mock API. */

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  await request.post("/__test/reset");
});

test("signing in returns to the page that asked for it", async ({ page }) => {
  await page.goto("/app/sessions/");
  await page.waitForURL(/\/login\/?\?next=%2Fapp%2Fsessions%2F/);
  await page.getByLabel("Email").fill("me@gmail.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/sessions\/?$/);
});

test("a sign-in link can't send people to another site", async ({ page }) => {
  await page.goto("/login/?next=//evil.example/steal");
  await page.getByLabel("Email").fill("me@gmail.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/?$/);
});

test("the password-reset link lets people choose a new password", async ({ page, request }) => {
  const token = "e2e-recovery";
  await page.goto(
    `/reset-password/#access_token=${token}&expires_in=3600&expires_at=${Math.floor(Date.now() / 1000) + 3600}` +
      "&refresh_token=r1&token_type=bearer&type=recovery",
  );
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Repeat new password").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator(".alert-error")).toHaveText("Use a password with at least 8 characters.");

  await page.getByLabel("New password", { exact: true }).fill("a much better password");
  await page.getByLabel("Repeat new password").fill("a much better password!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator(".alert-error")).toHaveText("The two passwords don't match.");

  await page.getByLabel("Repeat new password").fill("a much better password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your password is changed")).toBeVisible();

  const { requests } = await (await request.get("/__test/requests")).json();
  const update = requests.find((r: { method: string; path: string }) => r.method === "PUT" && r.path === "/auth/v1/user");
  expect(update.body.password).toBe("a much better password");
});

test("an expired reset link says so and offers a new one", async ({ page }) => {
  await page.goto("/reset-password/#error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByText("This reset link has expired or was already used.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
});

test("reset links that land on the home page are forwarded", async ({ page }) => {
  await page.goto("/#access_token=t&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery");
  await page.waitForURL(/\/reset-password\//);
});

test("sign in comes first, and Join is one click away", async ({ page }) => {
  await page.goto("/login/");
  const tabs = page.getByRole("navigation", { name: "Sign in or join" });
  await expect(tabs.getByRole("link", { name: "Sign in" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Join" }).click();
  await page.waitForURL(/\/signup\/?$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("Terms, Privacy and the agreement open in place and close with Escape", async ({ page }) => {
  await page.goto("/login/");
  await page.getByLabel("Email").fill("me@gmail.com");
  for (const [button, title] of [["Terms", "Terms of Service"], ["Privacy", "Privacy Policy"], ["Responsible use", "Responsible Use Agreement"]]) {
    await page.getByRole("navigation", { name: "Policies and help" }).getByRole("button", { name: button }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  // Nothing typed was lost.
  await expect(page.getByLabel("Email")).toHaveValue("me@gmail.com");
});

const year = new Date().getFullYear();

async function aboutYou(page: Page, country: string, age: number) {
  await page.getByLabel("Country you live in").selectOption(country);
  await page.getByLabel("Month you were born").selectOption("1");
  await page.getByLabel("Year you were born").selectOption(String(year - age));
}

test("sign-up is one step: every field is there at once and the age answer shows straight away", async ({ page }) => {
  await page.goto("/signup/");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.getByRole("checkbox", { name: /I agree to the Terms/ })).not.toBeChecked();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByText("Choose your country and the month and year you were born.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByText("Tick the box to accept the Terms and Responsible Use Agreement.")).toBeVisible();
  await expect(page.getByLabel("Country you live in")).toBeFocused();
  await expectNoAxeViolations(page);

  await aboutYou(page, "US", 30);
  await expect(page.getByText("You can join")).toBeVisible();
});

test("joining under 18 needs a parent or guardian, and the answers go with the sign-up", async ({ page, request }) => {
  await page.goto("/signup/");
  await page.getByLabel("Email").fill("teen@gmail.com");
  await page.getByLabel("Password").fill("a good password");
  await page.getByLabel(/I agree to the Terms/).check();
  await aboutYou(page, "US", 15);
  const guardian = page.getByLabel(/A parent or guardian knows I'm using TypeWit/);
  await expect(guardian).toBeVisible();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByText("Tick the box to confirm a parent or guardian agrees.")).toBeVisible();
  await expect(guardian).toBeFocused();
  await guardian.check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const { requests } = await (await request.get("/__test/requests")).json();
  const signup = requests.find((r: { path: string }) => r.path === "/auth/v1/signup");
  expect(signup.body.data).toMatchObject({ country: "US", birth_year: year - 15, birth_month: 1, guardian_agreed: true });
  expect(signup.body.data).not.toHaveProperty("birth_day");
});

test("someone below the minimum age is told at once what they can do, and a reload stays closed", async ({ page, request }) => {
  await page.goto("/signup/");
  await page.getByLabel("Email").fill("kid@gmail.com");
  await aboutYou(page, "GB", 12);
  const refusal = page.getByRole("alert").filter({ hasText: "Sorry, you can't join TypeWit yet." });
  await expect(refusal).toBeVisible();
  await expect(refusal.getByRole("link", { name: "help page" })).toHaveAttribute("href", "/support/");
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create free account" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await expectNoAxeViolations(page);
  // A wrong pick can be fixed straight away.
  await page.getByLabel("Year you were born").selectOption(String(year - 30));
  await expect(refusal).toBeHidden();
  await expect(page.getByLabel("Email")).toBeEnabled();
  const { requests } = await (await request.get("/__test/requests")).json();
  expect(requests.find((r: { path: string }) => r.path === "/auth/v1/signup")).toBeUndefined();
  // The refusal is remembered in this browser.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sorry, you can't join yet" })).toBeVisible();
});

test("Continue with Google works on the first tap and carries answers already given", async ({ page }) => {
  await page.goto("/signup/");
  await aboutYou(page, "US", 30);
  await page.getByLabel(/I agree to the Terms/).check();
  await page.route("**/auth/v1/authorize**", (route) => route.fulfill({ status: 200, body: "google" }));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL(/\/auth\/v1\/authorize/);
  const stored = await page.evaluate(() => [sessionStorage.getItem("typewit:agreed-before-google"), sessionStorage.getItem("typewit:age-before-google")]);
  expect(stored[0]).toBeTruthy();
  expect(JSON.parse(stored[1]!)).toMatchObject({ country: "US", birth_year: year - 30, birth_month: 1 });
});

test("an account without age answers is asked once before the dashboard", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { age_confirmed_at: null, birth_year: null, birth_month: null } });
  await page.addInitScript((session) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session)), {
    access_token: "e2e-token", refresh_token: "r", token_type: "bearer", expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "me@gmail.com", user_metadata: {}, app_metadata: {} },
  });
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "One last step" })).toBeVisible();
  await expectNoAxeViolations(page);
  await aboutYou(page, "DE", 30);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
});

test("a concurrent successful age confirmation completes onboarding without changing the first answer", async ({ page, request }) => {
  await request.post("/__test/profile", { data: { age_confirmed_at: null, birth_year: null, birth_month: null } });
  await page.addInitScript((session) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session)), {
    access_token: "fixture-token", refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: "fixture-user", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: {}, app_metadata: {} },
  });
  let confirmations = 0;
  await page.route("**/rest/v1/rpc/confirm_age", async route => {
    confirmations++;
    await request.post("/__test/profile", { data: { age_confirmed_at: new Date().toISOString(), birth_year: 1990, birth_month: 1 } });
    await route.fulfill({ status: 400, json: { message: "Your age has already been confirmed." } });
  });
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "One last step" })).toBeVisible();
  await aboutYou(page, "BD", 30);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
  expect(confirmations).toBe(1);
});

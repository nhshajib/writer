import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`blue palette stays readable across public, account and dashboard screens in ${theme} mode`, async ({page,request},testInfo) => {
    test.setTimeout(120000);
    await request.post("/__test/reset");
    await page.emulateMedia({reducedMotion:"reduce",colorScheme:theme});
    for (const path of ["/", "/pricing/", "/signup/"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveCSS("--midnight","#000f22");
      expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join(",")}`)).toEqual([]);
    }
    await page.screenshot({path:testInfo.outputPath(`signup-${theme}.png`),fullPage:true});
    await page.goto("/login/");
    await page.getByLabel("Email").fill("fixture@gmail.com");
    await page.getByLabel("Password").fill("a good password");
    await page.getByRole("button",{name:"Sign in",exact:true}).click();
    await expect(page.getByRole("heading",{level:1})).toHaveText(/Good (morning|afternoon|evening)/);
    expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()).violations.map(v=>v.id)).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`dashboard-${theme}.png`),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.goto("/pricing/");
    const footer=page.locator("footer.site-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link",{name:/Start for free/})).toBeVisible();
    await expect(footer.getByRole("link",{name:"Privacy",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).include("footer.site-footer").withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()).violations.map(v=>v.id)).toEqual([]);
    await footer.screenshot({path:testInfo.outputPath(`footer-mobile-${theme}.png`)});
  });
}

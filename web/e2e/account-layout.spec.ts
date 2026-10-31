import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const session = {access_token:'e2e-token',refresh_token:'e2e-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id:'u1',aud:'authenticated',role:'authenticated',email:'layout@example.test',user_metadata:{name:'Writer'},app_metadata:{provider:'email',providers:['email']}}};
test.beforeEach(async ({page,request}) => {
  await request.post('/__test/reset');
  await page.addInitScript(s => localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
});

test('settings show one section, retain drafts, and support deep links and browser history', async ({page}, info) => {
  await page.goto('/app/settings/');
  await expect(page.locator('.setting:visible')).toHaveCount(1);
  await expect(page.locator('#profile')).toBeVisible();
  await page.getByLabel('Name',{exact:true}).fill('Unsaved name');
  const nav = page.getByRole('navigation',{name:'Settings sections'});
  for (const [id,label] of [['defaults','Session defaults'],['notifications','Notifications'],['accessibility','Accessibility'],['security','Security'],['data','Data & privacy'],['danger','Delete account']]) {
    await nav.getByRole('link',{name:label,exact:true}).click();
    await expect(page.locator('.setting:visible')).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(nav.getByRole('link',{name:label,exact:true})).toHaveAttribute('aria-current','page');
  }
  await page.goBack();
  await expect(page.locator('#data')).toBeVisible();
  await expect(page.getByRole('link',{name:'Read the agreement'})).toBeVisible();
  await page.goForward();
  await expect(page.locator('#danger')).toBeVisible();
  await nav.getByRole('link',{name:'Profile',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved name');
  await page.goto('/app/settings/#notifications');
  await page.reload();
  await expect(page.locator('#notifications')).toBeVisible();
  await expect(page.locator('#profile')).toBeHidden();
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({path:info.outputPath('settings-desktop.png'),fullPage:true});
});

for (const width of [320,390,1280]) {
  test(`plan overview and settings fit ${width}px across Free, Day Pass and Pro`, async ({page,request},info) => {
    await page.setViewportSize({width,height:900});
    for (const plan of ['free','day_pass','pro']) {
      await request.post('/__test/profile',{data:{plan,subscription_status:plan==='pro'?'active':null,day_pass_expires_at:plan==='day_pass'?new Date(Date.now()+12*3600000).toISOString():null}});
      await page.goto('/app/billing/');
      await expect(page.getByRole('heading',{name:'Plan & usage',exact:true})).toBeVisible();
      await expect(page.locator('.billing-overview')).toContainText(plan==='free'?'Free':plan==='pro'?'Pro':'Day Pass');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if (plan==='free') {
        await expect(page.getByRole('button',{name:'Get Day Pass · $4.99',exact:true})).toBeVisible();
        await page.getByRole('button',{name:'Monthly',exact:true}).click();
        await expect(page.locator('.billing-offer-pro .price')).toContainText('$6.99');
        await page.getByRole('button',{name:/Yearly ·/}).click();
        await expect(page.locator('.billing-offer-pro .price')).toContainText('$5');
      } else {
        await expect(page.getByRole('button',{name:'Get Day Pass · $4.99',exact:true})).toHaveCount(0);
        await expect(page.getByRole('link',{name:plan==='pro'?'Manage billing':'Billing history',exact:true})).toBeVisible();
      }
      await page.getByText(plan==='pro'?'Included in your Pro plan':'See all Pro features',{exact:true}).click();
      await expect(page.locator('.billing-inclusions').getByText('Edit remaining text and settings while paused',{exact:true})).toBeVisible();

      const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
      await page.getByText(plan==='pro'?'Included in your Pro plan':'See all Pro features',{exact:true}).click();
      await page.evaluate(()=>window.scrollTo(0,0));
      await expect(page.getByRole('heading',{name:'Plan & usage',exact:true})).toBeInViewport();
      if (width===390||width===1280) await page.screenshot({path:info.outputPath(`billing-${plan}-${width}.png`),fullPage:true});
    }
    await page.goto('/app/settings/');
    if(width<768) {
      await page.getByLabel('Settings section',{exact:true}).selectOption('security');
      await expect(page.locator('#security')).toBeVisible();
      await expect(page.locator('.setting:visible')).toHaveCount(1);
      await expect(page.getByLabel('Settings section',{exact:true})).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`settings-${width}.png`),fullPage:true});
    }
  });
}

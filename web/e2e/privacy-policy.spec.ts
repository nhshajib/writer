import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('privacy, terms and storage/provider disclosures are linked and readable on phones and desktop', async ({page}) => {
  for (const width of [320,1280]) {
    await page.setViewportSize({width,height:844});
    for (const path of ['/privacy/','/terms/','/cookies/','/subprocessors/']) {
      await page.goto(path);
      await expect(page.getByRole('heading',{level:1})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} at ${width}`).toBe(true);
      await expect(page.locator('footer').getByRole('link',{name:'Cookies',exact:true})).toHaveAttribute('href','/cookies/');
      await expect(page.locator('footer').getByRole('link',{name:'Service providers',exact:true})).toHaveAttribute('href','/subprocessors/');
      const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      expect(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(',')}`)).toEqual([]);
    }
  }
  await page.goto('/privacy/');
  for(const name of ['Lawful basis for processing — GDPR Article 6','Your rights and how to use them','Retention and deletion','Security and personal data breaches']) {
    await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  }
  await expect(page.getByText(/Our primary Supabase project is configured in Ohio, United States/)).toBeVisible();
  await expect(page.getByText(/72 hours after becoming aware/)).toBeVisible();
  await expect(page.getByText(/one month of receiving a request/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Cookie and Storage Policy',exact:true})).toHaveAttribute('href','/cookies/');
});

test('Settings labels its partial JSON accurately and keeps a separate complete-request route', async ({page,request}) => {
  await request.post('/__test/reset');
  const session={access_token:'e2e-token',refresh_token:'e2e-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id:'u1',aud:'authenticated',role:'authenticated',email:'privacy@example.invalid',user_metadata:{},app_metadata:{provider:'email',providers:['email']}}};
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
  await page.goto('/app/settings/#data');
  await expect(page.getByText(/not your complete personal-data record/)).toBeVisible();
  await expect(page.getByRole('link',{name:'contact TypeWit about privacy',exact:true})).toHaveAttribute('href','mailto:support@typewit.com?subject=Privacy%20request');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download account summary',exact:true}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe('typewit-my-data.json');
  const data=JSON.parse(await readFile((await download.path())!,'utf8'));
  expect(data.account.email).toBe('privacy@example.invalid');
  expect(Array.isArray(data.sessions)).toBe(true);
});

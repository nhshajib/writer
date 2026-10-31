import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {CURRENT_TERMS_VERSION} from '../lib/terms';
const session={access_token:'fixture-token',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id:'fixture-user',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',user_metadata:{},app_metadata:{provider:'discord',providers:['discord']}}};
test.beforeEach(async({request})=>{await request.post('/__test/reset');});
for(const route of ['login','signup']) {
 test(`Discord ${route} starts OAuth and preserves the safe destination`,async({page})=>{
  await page.goto(`/${route}/?next=${encodeURIComponent('/app/billing/')}`);
  if(route==='signup')await page.getByLabel(/I agree to the Terms/).check();
  await expect(page.getByLabel('Year you were born')).toHaveCount(0);
  await page.route('**/auth/v1/authorize**',r=>r.fulfill({status:200,body:'Discord OAuth test boundary'}));
  await page.getByRole('button',{name:'Continue with Discord',exact:true}).click();
  await page.waitForURL(/\/auth\/v1\/authorize/);
  const url=new URL(page.url());
  expect(url.searchParams.get('provider')).toBe('discord');
  expect(url.searchParams.get('redirect_to')).toBe('http://localhost:54399/app/billing/');
  if(route==='signup')expect(await page.evaluate(()=>sessionStorage.getItem('typewit:agreed-before-google'))).toBe(CURRENT_TERMS_VERSION);
 });
}
test('Discord rejects an external next destination',async({page})=>{
 await page.goto('/login/?next=https%3A%2F%2Fexternal.invalid%2F');
 await page.route('**/auth/v1/authorize**',r=>r.fulfill({status:200,body:'OAuth boundary'}));
 await page.getByRole('button',{name:'Continue with Discord'}).click();
 await page.waitForURL(/\/auth\/v1\/authorize/);
 expect(new URL(page.url()).searchParams.get('redirect_to')).toBe('http://localhost:54399/app/');
});
test('both social options remain accessible on narrow phones in light and dark themes',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 for(const theme of ['light','dark'] as const) {
  await page.emulateMedia({colorScheme:theme});
  for(const route of ['login','signup']) {
   await page.goto(`/${route}/`);
   for(const provider of ['Google','Discord'])await expect(page.getByRole('button',{name:`Continue with ${provider}`,exact:true})).toBeEnabled();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   expect(a.violations.map(v=>v.id)).toEqual([]);
  }
 }
});
test('a Discord account is labeled correctly and can set a password for Word',async({page})=>{
 await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
 await page.goto('/app/settings/#profile');
 await expect(page.locator('dd').filter({hasText:/^Discord$/})).toBeVisible();
 await page.getByRole('link',{name:'Security',exact:true}).click();
 await expect(page.getByRole('form',{name:'Set a password'})).toBeVisible();
 await expect(page.getByText(/Your Google or Discord sign-in keeps working/)).toBeVisible();
});
test('new Discord accounts still confirm age and record the pending agreement',async({page,request})=>{
 await request.post('/__test/profile',{data:{age_confirmed_at:null,birth_year:null,birth_month:null,agreed_terms_version:null}});
 await page.addInitScript(({s,version})=>{
  localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));
  sessionStorage.setItem('typewit:agreed-before-google',version);
 },{s:session,version:CURRENT_TERMS_VERSION});
 await page.goto('/app/');
 await expect(page.getByRole('heading',{name:'One last step'})).toBeVisible();
 await page.getByLabel('Country you live in').selectOption('BD');
 await page.getByLabel('Month you were born').selectOption('1');
 await page.getByLabel('Year you were born').selectOption(String(new Date().getFullYear()-30));
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText(/Good (morning|afternoon|evening)/);
 const {requests}=await (await request.get('/__test/requests')).json();
 expect(requests.some((r:{path:string})=>r.path==='/rest/v1/rpc/confirm_age')).toBe(true);
 expect(requests.find((r:{path:string})=>r.path==='/rest/v1/rpc/agree_to_terms').body).toEqual({version:CURRENT_TERMS_VERSION});
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
const session = { access_token: 'e2e-token', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now()/1000)+86400, user: { id:'u1', aud:'authenticated', role:'authenticated', email:'me@gmail.com', user_metadata:{}, app_metadata:{} } };
test.beforeEach(async ({page,request}) => {
  await request.post('/__test/reset');
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)),session);
});
test('Connected accounts is a dedicated desktop destination and a mobile Account setting', async ({page}) => {
  await page.goto('/app/');
  await page.locator('.sidebar').getByRole('link',{name:'Connected accounts',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/connections/);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Connected accounts');
  await expect(page.getByRole('button',{name:'Disconnect',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toContainText('active sessions on this account stop');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/account/');
  await page.getByRole('link',{name:'Connected Google accounts'}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Connected accounts');
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  expect(result.violations.map(v=>v.id)).toEqual([]);
});
test('pricing has four transparent options and each Pro button selects the correct interval', async ({page}) => {
  const intervals:string[]=[];
  await page.route('**/functions/v1/billing/checkout',async route=>{
    intervals.push(route.request().postDataJSON().interval);
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Checkout test response'})});
  });
  await page.goto('/pricing/');
  await expect(page.locator('.pricing-cards .plan')).toHaveCount(4);
  await expect(page.getByRole('heading',{name:'Yearly',exact:true})).toBeVisible();
  await expect(page.getByText('$60 billed yearly · save 28%')).toBeVisible();
  await page.getByRole('button',{name:'Try Yearly free'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Checkout test response'})).toBeVisible();
  await page.getByRole('button',{name:'Try Monthly free'}).click();
  await expect.poll(()=>intervals.length).toBe(2);
  expect(intervals).toEqual(['year','month']);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  expect(result.violations.map(v=>v.id)).toEqual([]);
});
test('plain input keeps literal Markdown characters and leading, blank and trailing lines', async ({page,request}) => {
  await page.goto('/app/new/');
  const source='  # Literal **characters** stay.\n\nA final line.\n';
  await page.getByLabel('Text to enter',{exact:true}).fill(source);
  await page.getByRole('button',{name:'Review session',exact:true}).click();
  await page.getByLabel(/I've read this exact text/).check();
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/session/);
  const {requests}=await (await request.get('/__test/requests')).json();
  const create=requests.find((r:{path:string;method:string})=>r.method==='POST' && r.path==='/functions/v1/drips');
  expect(create.body.text).toBe(source);
  expect(create.body.text_format).toBe('plain');
});

test('HTML whitespace between bold and italic runs does not join words', async ({page}) => {
  await page.goto('/app/new/');
  await page.getByLabel('Text to enter').evaluate(el => {
    const data = new DataTransfer(); data.setData('text/html', '<p><b>First</b>\n<i>second</i></p>');
    el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await expect(page.getByLabel('Text to enter')).toHaveText('First second');
});

import {expect,test} from '@playwright/test';
const session={access_token:'e2e-token',refresh_token:'e2e-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id:'u1',aud:'authenticated',role:'authenticated',email:'sentences@example.test',user_metadata:{},app_metadata:{}}};
const text=Array.from({length:31},()=> 'approved').join(' ')+'. A short ending.';
test.beforeEach(async({page,request})=>{
  await request.post('/__test/reset');
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
});
for(const rhythm of ['natural','steady','drafting'] as const) {
  test(`${rhythm} starts with sentence steps and previews exactly the text it submits`,async({page,request})=>{
    await request.post('/__test/profile',{data:{plan:rhythm==='drafting'?'pro':'free'}});
    await page.setViewportSize({width:rhythm==='steady'?1280:390,height:844});
    await page.goto('/app/new/');
    await page.getByRole('button',{name:new RegExp('^'+rhythm,'i')}).click();
    await expect(page.locator('.word-grouping')).toHaveCount(0);
    await expect(page.locator('.sentence-step-hint')).toContainText('over 20 words');
    const response=page.waitForResponse(r=>r.url().endsWith('/drips/plan')&&r.request().postDataJSON()?.text===text&&r.request().postDataJSON()?.rhythm===rhythm);
    await page.getByLabel('Text to enter',{exact:true}).fill(text);
    const {plan}=await(await response).json();
    expect(plan.ok).toBe(true);expect(plan.unit).toBe('sentence');expect(plan.source_unit_count).toBe(3);
    expect(plan.source_unit_lengths.reduce((a:number,b:number)=>a+b,0)).toBe(text.length);
    await page.getByRole('button',{name:'Review session',exact:true}).click();
    await page.getByLabel(/I've read this exact text/).check();
    await page.getByRole('button',{name:'Start session',exact:true}).click();
    await expect(page).toHaveURL(/\/app\/session/);
    const {requests}=await(await request.get('/__test/requests')).json();
    const create=requests.find((r:{method:string;path:string})=>r.method==='POST'&&r.path==='/functions/v1/drips');
    expect(create.body.insertion_unit).toBe('sentence');expect(create.body.rhythm).toBe(rhythm);expect(create.body.text).toBe(text);
  });
}

test('Settings recommends sentences while an explicitly saved Word preference remains usable',async({page,request})=>{
  await page.goto('/app/settings/');
  const form=page.getByRole('form',{name:'Session defaults',exact:true});
  await expect(form.getByLabel('Steps',{exact:true})).toHaveValue('sentence');
  await expect(form.getByRole('group',{name:'How words arrive',exact:true})).toHaveCount(0);
  await form.getByLabel('Steps',{exact:true}).selectOption('word');
  await form.getByRole('radio',{name:'One word at a time',exact:true}).check();
  await form.getByRole('button',{name:'Save defaults',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('New sessions start from these settings');
  await page.goto('/app/new/');
  await expect(page.getByRole('radio',{name:/^One word at a time/})).toBeChecked();
  await page.locator('.session-advanced').evaluate((el:HTMLDetailsElement)=>{el.open=true;});
  await expect(page.getByRole('radio',{name:/^Word groups/})).toBeChecked();
});

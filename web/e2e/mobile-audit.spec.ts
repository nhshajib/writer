import AxeBuilder from '@axe-core/playwright';
import {expect,test,type Page} from '@playwright/test';
import {fillNewSession} from './helpers';
const session={access_token:'e2e-token',refresh_token:'e2e-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id:'u1',aud:'authenticated',role:'authenticated',email:'mobile@example.test',user_metadata:{},app_metadata:{}}};
async function checkAccessibility(page:Page) {
  // Match the existing suite: inspect settled colors, not an intermediate theme transition.
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`)).toEqual([]);
}
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
test.beforeEach(async({request})=>{await request.post('/__test/reset');});

test('every public page has a reachable phone menu, closes on selection, and restores focus',async({page})=>{
  for(const path of ['/','/features/','/faq/','/pricing/','/guides/','/support/','/privacy/']) {
    await page.goto(path);
    const menu=page.getByRole('button',{name:'Open menu',exact:true});
    await expect(menu).toBeVisible();
    const rect=await menu.boundingBox();expect(rect!.height).toBeGreaterThanOrEqual(44);
    await menu.click();
    const sheet=page.getByRole('dialog',{name:'Explore TypeWit'});
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link',{name:'Pricing',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');await expect(sheet).toBeHidden();await expect(menu).toBeFocused();
  }
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('navigation',{name:'Main mobile'}).getByRole('link',{name:'Features',exact:true}).click();
  await expect(page).toHaveURL(/\/features\//);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('public, auth and dashboard layouts fit narrow phones, including enlarged text',async({page},info)=>{
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
  const routes=['/','/how-it-works/','/features/','/use-cases/','/faq/','/pricing/','/guides/','/support/','/privacy/','/terms/','/responsible-use/','/google-docs-auto-typer/','/word-auto-typer/','/login/','/signup/','/reset-password/','/app/','/app/new/','/app/sessions/','/app/account/','/app/settings/','/app/connections/','/app/documents/','/app/billing/','/word/'];
  for(const width of [320,390,430]) {
    await page.setViewportSize({width,height:844});
    for(const path of routes) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} at ${width}px`).toBe(true);
      if(path==='/app/new/') {
        for(const selector of ['.editor-toolbar','.rich-editor']) {
          const bounds=await page.locator(selector).boundingBox();
          expect(bounds!.x+bounds!.width,`${selector} must fit inside its card at ${width}px`).toBeLessThanOrEqual(width-16);
        }
      }
      if(width===390&&['/','/app/new/','/app/account/','/signup/'].includes(path))await page.screenshot({path:info.outputPath(`${path.replaceAll('/','-')||'home'}.png`),fullPage:true});
    }
  }
  await page.goto('/app/account/');
  await page.addStyleTag({content:'html {font-size:125% !important}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
});

test('settings section picker and explicit parent navigation work; billing keeps Account selected',async({page})=>{
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
  await page.goto('/app/settings/');
  await page.getByLabel('Settings section',{exact:true}).selectOption('security');
  await expect(page).toHaveURL(/#security$/);
  // Selection switches panels in place instead of jumping past the mobile picker.
  await expect(page.locator('#security')).toBeVisible();
  await expect(page.locator('#profile')).toBeHidden();
  await expect(page.getByLabel('Settings section',{exact:true})).toBeInViewport();
  await page.locator('.mobile-parent-link').click();await expect(page).toHaveURL(/\/app\/account\//);
  await page.goto('/app/billing/manage/');
  await expect(page.getByRole('navigation',{name:'Main',exact:true}).getByRole('link',{name:'Account',exact:true})).toHaveAttribute('aria-current','page');
});

test('phone keyboard clears fixed controls, and reviewing a session keeps plan controls and focus usable',async({page,request})=>{
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
  await request.post('/__test/profile',{data:{plan:'free'}});
  await page.goto('/app/new/');
  await page.getByLabel('Text to enter',{exact:true}).fill('Approved text for a mobile document.');
  await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{value:400,configurable:true});window.visualViewport!.dispatchEvent(new Event('resize'));});
  await expect(page.locator('html')).toHaveAttribute('data-keyboard-open','');
  await expect(page.locator('.step-bar')).toBeHidden();
  await page.evaluate(()=>{(document.activeElement as HTMLElement).blur();Object.defineProperty(window.visualViewport,'height',{value:844,configurable:true});window.visualViewport!.dispatchEvent(new Event('resize'));});
  await expect(page.locator('.step-bar')).toBeVisible();
  await page.getByRole('button',{name:'Review session',exact:true}).click();
  await page.getByLabel(/I've read this exact text/).check();
  await expect(page.getByRole('button',{name:'Start session',exact:true})).toBeEnabled();
  await checkAccessibility(page);
});


test('active and paused sessions stay readable with safe areas and long titles',async({page},info)=>{
  await page.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
  await page.goto('/app/new/');
  await fillNewSession(page,{title:'Mobile document '+ 'LongTitle'.repeat(10),text:'Approved notes for a mobile layout test. Another paragraph of approved words follows. The final sentence completes this draft.'});
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/session/);
  await page.addStyleTag({content:':root {--safe-top:20px;--safe-bottom:34px}'});
  for(const width of [320,390,430]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const pause=page.locator('.session-primary').getByRole('button',{name:'Pause',exact:true});
    await expect(pause).toBeVisible();
    const box=await pause.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  await page.screenshot({path:info.outputPath('session-active.png'),fullPage:true});
  await page.locator('.session-primary').getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Edit remaining text & settings',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Remaining text',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('session-paused-edit.png'),fullPage:true});
  await page.emulateMedia({colorScheme:'dark'});
  await checkAccessibility(page);
});

import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';

test.use({isMobile:true,hasTouch:true,reducedMotion:'reduce'});
test('phone landing is a welcome screen with one integrated, readable preview',async({page},info)=>{
  for(const [width,height] of [[320,568],[390,844],[430,932]]) {
    await page.setViewportSize({width,height});
    await page.goto('/');
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
    const primary=page.locator('#hero-cta');
    const action=await primary.boundingBox();
    expect(action!.width).toBeGreaterThanOrEqual(width-42);
    expect(action!.height).toBeGreaterThanOrEqual(48);
    expect(action!.y+action!.height).toBeLessThan(height);
    const secondary=await page.locator('.home-actions .btn-secondary').boundingBox();
    expect(secondary!.y).toBeGreaterThanOrEqual(action!.y+action!.height);
    const visual=await page.locator('.home-visual').boundingBox();
    const doc=await page.locator('.home-visual .lp-doc').boundingBox();
    const controls=await page.locator('.home-visual .lp-card').boundingBox();
    expect(controls!.y).toBeGreaterThanOrEqual(doc!.y+doc!.height);
    expect(controls!.x+controls!.width).toBeLessThanOrEqual(visual!.x+visual!.width);
    await expect(page.locator('.lp-doc-page')).toHaveCSS('font-size','15px');
    await expect(page.locator('.home-visual-label')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`landing-${width}.png`),fullPage:true});
  }
});

test('mobile landing keeps the demo, navigation and colors usable in both themes',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  for(const colorScheme of ['light','dark'] as const) {
    await page.emulateMedia({colorScheme});
    const demo=page.getByRole('figure',{name:/Preview · an example session/});
    await demo.getByRole('button',{name:'Pause the example session',exact:true}).click();
    await expect(demo.getByRole('button',{name:'Resume the example session',exact:true})).toHaveAttribute('aria-pressed','true');
    await demo.getByRole('button',{name:'Resume the example session',exact:true}).click();
    await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join(',')}`)).toEqual([]);
  }
  await expect(page.locator('#hero-cta')).toHaveAttribute('href','/signup/');
  await expect(page.getByRole('link',{name:'See how it works',exact:true})).toHaveAttribute('href','/how-it-works/');
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Explore TypeWit'})).toBeVisible();
});

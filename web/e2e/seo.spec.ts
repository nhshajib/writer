import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PUBLIC_PAGES } from '../lib/search-content';

test('guides have visible breadcrumbs and working related links', async ({page}) => {
  await page.goto('/guides/');
  await page.getByRole('link', {name:/How to Schedule Text Entry in Google Docs/}).click();
  await expect(page).toHaveURL(/\/guides\/schedule-text-google-docs\//);
  const trail=page.getByRole('navigation',{name:'Breadcrumb',exact:true});
  await expect(trail.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('href','/');
  await expect(trail.getByRole('link',{name:'Guides',exact:true})).toHaveAttribute('href','/guides/');
  await expect(trail.locator('[aria-current="page"]')).toHaveText('How to Schedule Text Entry in Google Docs');
  await page.getByRole('navigation',{name:'On this page',exact:true}).getByRole('link',{name:'Pause, revise, and resume'}).click();
  await expect(page).toHaveURL(/#section-4$/);
  await expect(page.locator('#section-4')).toBeInViewport();
  await page.getByRole('complementary',{name:'Related guides'}).getByRole('link',{name:'Google Docs Version History and Automated Edits'}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Google Docs Version History and Automated Edits');
});

test('new public pages remain readable and accessible on mobile', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  for(const url of ['/google-docs-auto-typer/','/word-auto-typer/','/guides/','/guides/paste-text-keep-formatting-google-docs/']) {
    await page.goto(url);
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
  await page.emulateMedia({colorScheme:'dark'});
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  expect(result.violations.map(v=>v.id)).toEqual([]);
});

test('public metadata is present without JavaScript and private pages are excluded', async ({request}) => {
  const home=await (await request.get('/')).text();
  expect(home).toContain('<title>Auto Typer for Google Docs &amp; Word · TypeWit</title>');
  expect(home).not.toContain('It never imitates human typing');
  const xml=await (await request.get('/sitemap.xml')).text();
  expect((xml.match(/<loc>/g)||[]).length).toBe(PUBLIC_PAGES.length);
  expect(xml).not.toContain('/app/');
  const login=await (await request.get('/login/')).text();
  expect(login).toMatch(/name="robots" content="noindex/);
  expect((await request.get('/guides/not-a-real-guide/')).status()).toBe(404);
});

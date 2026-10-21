import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { allowIndexing } from '../lib/indexing.ts';
import { PUBLIC_PAGES } from '../lib/search-content.ts';

const cases = [
  [{ VERCEL: '1', VERCEL_ENV: 'production' }, false],
  [{ VERCEL: '1', VERCEL_ENV: 'preview' }, false],
  [{ VERCEL: '1', VERCEL_ENV: 'preview', NEXT_PUBLIC_ALLOW_INDEXING: 'true' }, false],
  [{ VERCEL: '1', VERCEL_ENV: 'development' }, false],
  [{ VERCEL: '1' }, false],
  [{ VERCEL_ENV: 'production', NEXT_PUBLIC_NOINDEX: 'true' }, false],
  [{ VERCEL_ENV: 'production', NEXT_PUBLIC_ALLOW_INDEXING: 'false' }, false],
  [{ VERCEL_ENV: 'production', NEXT_PUBLIC_ALLOW_INDEXING: 'true' }, false],
  [{ NETLIFY: 'true', CONTEXT: 'production' }, true],
  [{ NETLIFY: 'true', CONTEXT: 'production', NEXT_PUBLIC_NOINDEX: 'true' }, false],
  [{ NETLIFY: 'true', CONTEXT: 'production', NEXT_PUBLIC_ALLOW_INDEXING: 'false' }, false],
  [{ CONTEXT: 'deploy-preview', NEXT_PUBLIC_ALLOW_INDEXING: 'true' }, false],
  [{ CONTEXT: 'branch-deploy' }, false],
  [{ NODE_ENV: 'production' }, true],
  [{ NODE_ENV: 'development' }, false],
  [{ NEXT_PUBLIC_NOINDEX: 'true' }, false],
];
for (const [env, expected] of cases) assert.equal(allowIndexing(env), expected, JSON.stringify(env));
const out = fileURLToPath(new URL('../out/', import.meta.url));
const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://typewit.com').origin;
const sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
const indexable = allowIndexing(process.env);
assert.equal(urls.length, indexable ? PUBLIC_PAGES.length : 0, 'Sitemap must match hosting indexing policy');
if (indexable) assert.deepEqual([...urls].sort(), PUBLIC_PAGES.map(p => origin+p).sort());
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
assert(!/priority|changefreq/.test(sitemap));
assert(!urls.some(url => /\/(app|login|signup|account|word)(\/|$)/.test(new URL(url).pathname)));
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => attrs(m[0]));
const titles = new Set();
const descriptions = new Set();
let linkCount = 0;
for (const url of PUBLIC_PAGES.map(p => origin+p)) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, origin);
  assert(parsed.pathname.endsWith('/'));
  const html = await readFile(path.join(out, parsed.pathname, 'index.html'), 'utf8');
  const meta = tags(html, 'meta');
  const links = tags(html, 'link');
  const title = decode(/<title>(.*?)<\/title>/.exec(html)?.[1] || '');
  const description = meta.find(m => m.name === 'description')?.content;
  assert(title && title.length < 100, `${url}: missing or excessive title`);
  assert(!titles.has(title), `Duplicate title: ${title}`); titles.add(title);
  assert(description && description.length >= 60 && description.length <= 200, `${url}: description`);
  assert(!descriptions.has(description), `Duplicate description: ${url}`); descriptions.add(description);
  assert.deepEqual(links.filter(l => l.rel === 'canonical').map(l => l.href), [url], `${url}: canonical`);
  assert(meta.some(m => m.name === 'robots' && (indexable ? /\bindex\b/ : /noindex/).test(m.content)), `${url}: index policy`);
  if (indexable) assert(!meta.some(m => /robots|googlebot/.test(m.name || '') && /noindex/.test(m.content)), `${url}: unexpected noindex`);
  assert.equal(meta.find(m => m.property === 'og:url')?.content, url);
  assert.equal(meta.find(m => m.property === 'og:description')?.content, description);
  assert(meta.some(m => m.property === 'og:image' && m.content.startsWith(origin)));
  assert(meta.some(m => m.name === 'twitter:card' && m.content === 'summary_large_image'));
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${url}: one meaningful H1`);
  assert(/<html[^>]+lang="en"/.test(html));
  const data = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  if (parsed.pathname !== '/') {
    const crumbs = data.find(d => d['@type'] === 'BreadcrumbList')?.itemListElement;
    assert(crumbs?.length >= 2, `${url}: breadcrumbs`);
    assert.equal(crumbs.at(-1).item, url);
    crumbs.forEach((c, i) => assert.equal(c.position, i+1));
    assert(/aria-label="Breadcrumb"/.test(html));
  }
  if (parsed.pathname.startsWith('/guides/') && parsed.pathname !== '/guides/') {
    assert(data.some(d => d['@type'] === 'Article' && d.mainEntityOfPage === url));
    assert.equal(meta.find(m => m.property === 'og:type')?.content, 'article');
  }
  for (const a of tags(html, 'a')) {
    if (!a.href || !a.href.startsWith('/') || a.href.startsWith('//')) continue;
    const dest = new URL(a.href, origin).pathname;
    if (/\.[a-z0-9]+$/i.test(dest)) await access(path.join(out, dest));
    else await access(path.join(out, dest, 'index.html'));
    linkCount++;
  }
}
for (const route of ['app','app/new','app/session','app/connections','login','signup','reset-password','account','word']) {
  const html = await readFile(path.join(out, route, 'index.html'), 'utf8');
  assert(tags(html, 'meta').some(m => m.name === 'robots' && /noindex/.test(m.content)), `${route}: must be noindex`);
}
const robots = await readFile(path.join(out, 'robots.txt'), 'utf8');
assert.equal(robots.includes(`Sitemap: ${origin}/sitemap.xml`), indexable);
assert(!/Disallow: \/(?:\s|$)/.test(robots), 'Production must not block all crawlers');
assert(!/Disallow: \/(?:app|login|signup|word)/.test(robots), 'Crawlers must see private-page noindex');
const homepage = await readFile(path.join(out, 'index.html'), 'utf8');
assert(!homepage.includes('It never imitates human typing'));
assert(!homepage.includes('"@type":"FAQPage"'));
console.log(`SEO checks passed: ${cases.length} indexing-policy cases, ${PUBLIC_PAGES.length} canonical public pages (${indexable ? "Netlify production" : "non-indexable build"}), ${linkCount} internal links, private-route exclusions, sitemap and JSON-LD.`);

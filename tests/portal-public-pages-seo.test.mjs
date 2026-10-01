// Every indexable public page under apps/portal carries the same discovery
// metadata: a title, a description, a canonical URL, Open Graph title,
// description, url and an absolute image that exists in the tree, a Twitter
// card, and exactly one SVG icon plus one apple-touch icon. Static shells and
// generated pages (discover, guide, journal) are walked from the committed
// files, so a page added without its head fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const portal = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const ORIGIN = 'https://lestersarcade.io';
const walk = (dir) => readdirSync(join(portal, dir), { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(`${dir}/${entry.name}`) : entry.name === 'index.html' ? [`${dir}/${entry.name}`] : []);
// The jackpot rules page stays noindex until the jackpot is live; the level editor is a tool, not a page.
const PUBLIC_PAGES = ['index.html', 'how-ranked-works.html', 'trust.html', ...readdirSync(join(portal, 'discover')).map((name) => `discover/${name}`), ...walk('blog')];
const attr = (html, pattern) => html.match(pattern)?.[1];
const meta = (html, attribute, key) => attr(html, new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`));
const count = (html, pattern) => (html.match(pattern) ?? []).length;

test('the public page list covers the shells, the discover pages, the guide and the journal', () => {
  assert.ok(PUBLIC_PAGES.length >= 14, PUBLIC_PAGES.join(', '));
  for (const name of ['index.html', 'how-ranked-works.html', 'trust.html', 'discover/games.html', 'blog/index.html', 'blog/category/news/index.html']) assert.ok(PUBLIC_PAGES.includes(name), name);
});

for (const name of PUBLIC_PAGES) {
  test(`${name} carries title, description, canonical, Open Graph, Twitter card and icons`, () => {
    const html = readFileSync(join(portal, name), 'utf8');
    assert.match(html, /<html lang="en">/);
    const title = attr(html, /<title>([^<]+)<\/title>/);
    assert.ok(title && title.trim().length >= 10 && title.length <= 120, `title: ${title}`);
    const description = meta(html, 'name', 'description');
    assert.ok(description && description.length >= 40 && description.length <= 320, `description: ${description}`);
    assert.equal(meta(html, 'name', 'robots'), 'index, follow');
    const canonical = attr(html, /<link rel="canonical" href="([^"]+)" \/>/);
    assert.ok(canonical?.startsWith(ORIGIN + '/'), `canonical: ${canonical}`);
    assert.equal(count(html, /<link rel="canonical"/g), 1);
    assert.equal(meta(html, 'property', 'og:url'), canonical, 'og:url equals the canonical URL');
    assert.ok(meta(html, 'property', 'og:title'), 'og:title');
    assert.ok(meta(html, 'property', 'og:description'), 'og:description');
    assert.ok(['website', 'article'].includes(meta(html, 'property', 'og:type')), 'og:type');
    const image = meta(html, 'property', 'og:image');
    assert.ok(image?.startsWith(ORIGIN + '/assets/'), `og:image is absolute and served from /assets: ${image}`);
    assert.ok(existsSync(join(portal, image.slice(ORIGIN.length + 1))), `og:image exists: ${image}`);
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
    assert.equal(count(html, /<link rel="icon" type="image\/svg\+xml"/g), 1, 'one SVG icon');
    assert.equal(count(html, /<link rel="apple-touch-icon"/g), 1, 'one apple-touch icon');
    assert.doesNotMatch(html, /lester-pilot\.svg/, 'the retired avatar is not an icon');
  });
}

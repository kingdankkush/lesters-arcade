import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('STACKED child shell loads only its versioned bundle and dedicated Pixi vendor', async () => {
  const html = await read('../apps/portal/stacked/index.html');
  const main = await read('../apps/stacked/src/main.mjs');
  assert.match(html, /id="stackedStage"/u);
  assert.match(html, /href="\.\.\/dist\/stacked\/stacked-pixi-v1\.js"/u);
  assert.match(html, /src="\.\.\/dist\/stacked\/game\.js"/u);
  assert.match(html, /href="\.\/game\.css"/u);
  assert.match(html, /rel="icon" href="\.\.\/assets\/favicon\.svg"/u);
  assert.doesNotMatch(html, /wallet|ethers|sendTransaction|privateKey/iu);
  assert.match(html, /<title>STACKED — Lester's Arcade<\/title>/u);
  assert.match(html, /aria-label="STACKED board renderer"/u);
  assert.match(html, />Loading STACKED board renderer\. Awaiting parent runtime\.<\/p>/u);
  assert.doesNotMatch(html, /HALVING/u);
  assert.match(main, /aria-label','STACKED render-only board preview'/u);
  assert.match(main, /STACKED board renderer loaded with a render-only QA fixture/u);
  assert.match(main, /STACKED renderer failed to load/u);
  assert.doesNotMatch(main, /createStackedRuntime/u);
  assert.doesNotMatch(main, /HALVING/u);
});

test('STACKED dedicated Pixi vendor installs the no-eval compatibility patch before exporting classes', async () => {
  const vendor = await read('../apps/stacked/src/pixi-vendor.mjs');
  const patchIndex = vendor.indexOf("import 'pixi.js/unsafe-eval';");
  const exportIndex = vendor.indexOf('export {');
  assert.notEqual(patchIndex, -1, 'missing Pixi no-eval compatibility import');
  assert.notEqual(exportIndex, -1, 'missing dedicated Pixi exports');
  assert.ok(patchIndex < exportIndex, 'Pixi no-eval compatibility must load before class exports');
});

test('STACKED has a strict iframeable CSP and atomic cache/catch-all routing', async () => {
  const config = JSON.parse(await read('../vercel.json'));
  const child = config.headers.find((rule) => rule.source === '/stacked/(.*)');
  const csp = child?.headers.find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
  assert.match(csp, /script-src 'self'(?:;|$)/u);
  assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'/u);
  assert.match(csp, /connect-src 'self'(?:;|$)/u);
  assert.match(csp, /worker-src 'self' blob:/u);
  assert.match(csp, /frame-ancestors 'self'/u);

  const catchAll = config.headers.find((rule) => rule.headers?.some((header) => header.value?.includes("frame-ancestors 'none'")));
  assert.equal(catchAll?.source, '/((?!(?:hmh-reboot|chikun|stacked)/).*)');
  const cache = config.headers.find((rule) => rule.source === '/dist/(hmh-reboot|chikun|stacked)/(.*)');
  assert.ok(cache?.headers.some((header) => header.key === 'Cache-Control' && header.value === 'public, max-age=0, must-revalidate'));
  assert.notEqual(config.headers.find((rule) => rule.source === '/dist/chunks/(.*)')?.source, cache?.source);
});

test('service worker precaches every STACKED shell artifact outside immutable chunks', async () => {
  const source = await read('../apps/portal/sw.js');
  const precache = source.match(/const PRECACHE_URLS = \[([^\]]+)\]/su)?.[1] ?? '';
  for (const asset of [
    '/stacked/index.html',
    '/stacked/game.css',
    '/dist/stacked/game.js',
    '/dist/stacked/stacked-pixi-v1.js',
  ]) assert.match(precache, new RegExp(asset.replace(/[./-]/gu, '\\$&')));
  assert.doesNotMatch(precache, /dist\/chunks\/stacked/iu);
});

test('build defines distinct STACKED entry/vendor routing and leaves HMH vendor source untouched', async () => {
  const build = await read('../build.mjs');
  const hmhVendor = await read('../apps/hmh-reboot/src/pixi-vendor.mjs');
  assert.match(build, /'stacked\/game': stackedEntry/u);
  assert.match(build, /stacked-pixi-v1/u);
  assert.ok(build.includes('const SHARED_PIXI_IMPORTERS = /\\/apps\\/(?:hmh-reboot|stacked)\\/src\\//;'));
  assert.match(build, /assertStackedJsBudget/u);
  assert.doesNotMatch(hmhVendor, /ParticleContainer|GlProgram|RenderTexture|Geometry/u);
});

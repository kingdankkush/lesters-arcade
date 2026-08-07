import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bundleBudgetModule = await import('../scripts/hmh-reboot-bundle-budget.mjs').catch(() => ({}));

test('HMH production build enforces the raw entry plus preloaded Pixi aggregate cap', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.equal(typeof bundleBudgetModule.assertHmhInitialJsBudget, 'function', 'aggregate budget helper must exist');
  assert.match(build, /HMH_INITIAL_JS_CAP\s*=\s*1_050_000/);
  assert.match(build, /assertHmhInitialJsBudget\(/);

  assert.deepEqual(bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 320_000, vendorBytes: 700_000 }), {
    cap: 1_050_000,
    combinedInitialChildBytes: 1_020_000,
    entryBytes: 320_000,
    remaining: 30_000,
    vendorBytes: 700_000,
  });
  assert.throws(
    () => bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 321_272, vendorBytes: 730_790 }),
    /HMH initial JS exceeds raw aggregate cap: 1,052,062 > 1,050,000/,
  );
});

test('HMH Pixi vendor uses tree-shakeable library modules instead of the monolithic dist bundle', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.match(build, /pixi\.js[\\/]lib[\\/]index\.mjs/);
  assert.doesNotMatch(build, /pixi\.js[\\/]dist[\\/]pixi\.mjs/);
});

test('HMH Pixi vendor is one standalone preloaded file with no hidden static chunks', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  const vendorBuild = build.slice(build.indexOf('const vendorResult = await build'), build.indexOf('const combinedMetafile'));
  assert.match(vendorBuild, /splitting:\s*false/);
  assert.match(vendorBuild, /entryPoints:\s*\{\s*'chunks\/hmh-pixi':\s*hmhPixiVendor\s*\}/);
  assert.doesNotMatch(vendorBuild, /chunkNames:/, 'standalone vendor build must not emit hidden static chunks');
});

test('HMH Pixi is a stable preloaded child vendor chunk instead of consuming the capped game entry', async () => {
  const [build, shell] = await Promise.all([
    readFile(new URL('../build.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../apps/portal/hmh-reboot/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(build, /'chunks\/hmh-pixi': hmhPixiVendor/);
  assert.match(build, /path:\s*'\.\.\/chunks\/hmh-pixi\.js',\s*external:\s*true/);
  assert.match(shell, /rel="modulepreload" href="\.\.\/dist\/chunks\/hmh-pixi\.js"/);
});

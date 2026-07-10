import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildLoadSpeedReport, HMH_LOAD_SPEED_BUDGETS } from '../scripts/hmh-load-speed-report.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-36 index boots through optimized dist bundle with first-screen preload hints', () => {
  const index = repoText('apps/portal/index.html');
  assert.equal(index.includes('src="./dist/main.js?v=hmh-jul10-compact-world-v32"'), true);
  assert.equal(index.includes('rel="modulepreload" href="./dist/main.js?v=hmh-jul10-compact-world-v32"'), true);
  assert.equal(index.includes('hard-money-heroes-keyart-bg.jpg'), true);
  assert.equal(index.includes('fetchpriority="high"'), true);
  const sw = repoText('apps/portal/sw.js');
  assert.equal(sw.includes("'/dist/main.js'"), true);
  assert.equal(sw.includes('v3-hmh-art-v27'), true);
});

test('WO-36 Vercel build generates the optimized dist bundle before deploy', () => {
  const pkg = JSON.parse(repoText('package.json'));
  assert.equal(pkg.scripts['vercel:build'].includes('npm run build'), true);
});

test('WO-36 production build keeps sourcemaps opt-in instead of default deploy payload', () => {
  const buildScript = repoText('build.mjs');
  assert.equal(buildScript.includes('const wantSourceMap = process.argv.includes(\'--sourcemap\')'), true);
  assert.equal(buildScript.includes('sourcemap: wantSourceMap'), true);
});

test('WO-36 load speed report passes bundle and source-map budgets after build', () => {
  execFileSync(process.execPath, ['build.mjs'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'ignore',
  });
  const report = buildLoadSpeedReport();
  assert.equal(report.summary.status, 'PASS', JSON.stringify(report.checks, null, 2));
  assert.ok(report.metrics.mainBytes <= HMH_LOAD_SPEED_BUDGETS.mainBundleMaxBytes);
  assert.equal(report.metrics.sourceMapCount, 0);
});

test('WO-36 Level 1 prewarm decodes only spawn-near terrain and props', () => {
  const source = repoText('apps/portal/main.js');
  const prewarm = source.slice(source.indexOf('async function prewarmHmhLevelAssets'), source.indexOf('function isLevelOneCuratedRuntime'));
  assert.equal(prewarm.includes('textureKeysNear('), true);
  assert.equal(prewarm.includes('window: 26'), true);
  assert.equal(prewarm.includes('window: 140'), false);
});

test('selected hero opening frame is decoded before READY and roguelike never draws the old block fallback', () => {
  const source = repoText('apps/portal/main.js');
  const rosterPreload = source.slice(source.indexOf('async function preloadHeroRoster'), source.indexOf('// --- Roguelike biome-themed enemy sprites'));
  const drawPlayer = source.slice(source.indexOf('function drawPlayer(ctx)'), source.indexOf('function manifestEnemyKeyFor'));
  const beginLevel = source.slice(source.indexOf('async function beginOfficialLevel'), source.indexOf('async function advanceOfficialCampaignLevel'));

  assert.match(beginLevel, /await ensureHMHLoaded\(\)/, 'direct and deep-linked HMH starts must load the lazy roster payload');
  assert.match(source, /await preloadHeroRoster\(combat\.characterId\)/);
  assert.match(rosterPreload, /await Promise\.all\(/);
  assert.equal(rosterPreload.includes('for (const dirs of Object.values(anims))'), false, 'startup must not decode every state and direction');
  const noFallbackGuard = drawPlayer.indexOf('draw nothing rather than resurrecting old block art');
  const oldBlockFallback = drawPlayer.indexOf("ctx.fillStyle = '#ff7b2f'");
  assert.ok(noFallbackGuard >= 0 && noFallbackGuard < oldBlockFallback, 'roguelike guard must return before the legacy block fallback');
});

test('WO-36 syntax gate includes load-speed report', () => {
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(syntaxCheck.includes('scripts/hmh-load-speed-report.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-load-speed.test.mjs'), true);
});

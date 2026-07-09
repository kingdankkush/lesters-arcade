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
  assert.equal(index.includes('src="./dist/main.js?v=hmh-jul9-1116-v30"'), true);
  assert.equal(index.includes('rel="modulepreload" href="./dist/main.js?v=hmh-jul9-1116-v30"'), true);
  assert.equal(index.includes('hard-money-heroes-keyart-bg.jpg'), true);
  assert.equal(index.includes('fetchpriority="high"'), true);
  const sw = repoText('apps/portal/sw.js');
  assert.equal(sw.includes("'/dist/main.js'"), true);
  assert.equal(sw.includes('v3-hmh-art-v26'), true);
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

test('WO-36 syntax gate includes load-speed report', () => {
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(syntaxCheck.includes('scripts/hmh-load-speed-report.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-load-speed.test.mjs'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE_VERSION, GAME_VERSION, isCurrentVersion } from '../apps/portal/src/version-tracking.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const token = 'hmh-briefing-20260911';

test('playable update gives all linked startup resources the same fresh cache token', () => {
  const html = read('apps/portal/index.html');
  const links = [...html.matchAll(/(?:href|src)="([^"?]+)\?v=([^"&]+)"/g)];
  assert.equal(links.length, 7);
  assert.deepEqual(new Set(links.map((m) => m[1])), new Set(['./src/design-tokens.css', './dist/main.js', './styles.css', './styles-arcade-polish.css']));
  assert.ok(links.every((m) => m[2] === token));
  assert.doesNotMatch(html, /hmh-aaa-cycle-081-gameplan-defects/);
});

test('playable update invalidates the prior service-worker asset cache', () => {
  const sw = read('apps/portal/sw.js');
  assert.match(sw, /const CACHE_VERSION = 'lesters-arcade-v35-hmh-briefing';/);
  assert.doesNotMatch(sw, /lesters-arcade-v32-hmh-gameplan-defects/);
});

test('playable update versions canonical sessions without deleting historical versions', () => {
  assert.equal(SITE_VERSION, '1.4.0');
  assert.equal(GAME_VERSION, '1.4.0');
  const retained = Object.freeze({ siteVersion: '1.3.0', gameVersion: '1.3.0' });
  assert.equal(isCurrentVersion(retained), false);
  assert.deepEqual(retained, { siteVersion: '1.3.0', gameVersion: '1.3.0' });
});

test('playable update smoke probes and syntax registry track the shipped token and test', () => {
  for (const path of ['scripts/smoke-portal-flow.mjs', 'scripts/smoke-portal-interactions.mjs']) {
    const src = read(path);
    assert.ok(src.includes(token), path);
    assert.ok(!src.includes('hmh-aaa-cycle-081-gameplan-defects'), path);
  }
  assert.ok(read('scripts/syntax-check.mjs').includes('tests/hmh-playable-release.test.mjs'));
});

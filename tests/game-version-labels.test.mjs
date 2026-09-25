// Game version labels (version-column brief, acceptance 2): one pure module,
// shared by the server (E5, E6 and E9 rows) and the browser, turns a run's
// buildHash or runtimeId into 'HMH v0.5', 'Chikun v7' or 'STACKED v0.2', and
// anything unexpected into a '<Game> v?' / 'v?' fallback, never a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GAME_VERSION_SHORT_NAMES,
  HMH_PRE_CABINET_VERSION,
  UNKNOWN_GAME_VERSION,
  versionLabelFor,
} from '../apps/portal/src/game-version-labels.mjs';
import { HMH_CABINET_VERSION } from '../apps/portal/src/hmh-cabinet-version.mjs';
import { getPlaySessionIdentity } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_RUNTIME_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { STACKED_CABINET_VERSION } from '../apps/portal/src/stacked-cabinet.mjs';
import { RANKED_GAMES, RANKED_GAME_IDS } from '../apps/portal/src/ranked-identity.mjs';

const hmh = (buildHash) => versionLabelFor('lester-blaster', { buildHash });
const chikun = (runtimeId) => versionLabelFor('chikun', { runtimeId });
const stacked = (buildHash) => versionLabelFor('stacked', { buildHash });
const majorMinor = (version) => version.split('.').slice(0, 2).join('.');

test('the module is pure: no imports, no environment, no clock', () => {
  const source = readFileSync(new URL('../apps/portal/src/game-version-labels.mjs', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false, 'no static imports');
  assert.equal(/import\(/.test(source), false, 'no dynamic imports');
  for (const token of ['process', 'window', 'document', 'Date', 'localStorage', 'fetch']) {
    assert.equal(new RegExp(`\\b${token}\\b`).test(source.replace(/^\s*\/\/.*$/gm, '')), false, token);
  }
  assert.deepEqual(Object.keys(GAME_VERSION_SHORT_NAMES), RANKED_GAME_IDS, 'one short name per ranked game');
  assert.equal(Object.isFrozen(GAME_VERSION_SHORT_NAMES), true);
  assert.equal(HMH_PRE_CABINET_VERSION, '0.5');
  assert.equal(UNKNOWN_GAME_VERSION, 'v?');
});

test('HMH reads the cabinet major.minor; a build without a cabinet segment is HMH v0.5', () => {
  assert.equal(hmh('site-1.8.2:game-1.8.2:cabinet-0.5.0'), 'HMH v0.5');
  assert.equal(hmh('site-1.8.2:game-1.8.2:cabinet-0.5.7'), 'HMH v0.5', 'the patch is not shown');
  assert.equal(hmh('site-1.9.0:game-1.9.0:cabinet-0.6.0'), 'HMH v0.6');
  assert.equal(hmh('site-2.0.0:game-2.0.0:cabinet-12.34.0'), 'HMH v12.34');
  assert.equal(hmh('site-2.0.0:game-2.0.0:cabinet-007.010.0'), 'HMH v7.10', 'leading zeros are normalized');
  // 1.8.x rows (live before the cabinet version existed) and older ones.
  assert.equal(hmh('site-1.8.1:game-1.8.1'), 'HMH v0.5');
  assert.equal(hmh('site-1.7.0:game-1.7.0'), 'HMH v0.5');
  assert.equal(hmh('site-10.20.30:game-40.50.60'), 'HMH v0.5');
});

test('HMH majors and minors are shown as numbers, never as a trailing .0 of the major', () => {
  // cabinet-1.0.x is major 1, minor 0: shown as v1.0, not v1.
  assert.equal(hmh('site-2.0.0:game-2.0.0:cabinet-1.0.3'), 'HMH v1.0');
});

test('Chikun reads the runtime generation from its runtimeId', () => {
  assert.equal(chikun('chikun:canvas-runtime-v7'), 'Chikun v7');
  assert.equal(chikun('chikun:canvas-runtime-v4'), 'Chikun v4');
  assert.equal(chikun('chikun:canvas-runtime-v12'), 'Chikun v12');
  assert.equal(chikun('canvas-runtime-v7'), 'Chikun v7', 'the bare CHIKUN_RUNTIME_VERSION reads the same');
  assert.equal(chikun(`chikun:${CHIKUN_RUNTIME_VERSION}`), `Chikun v${CHIKUN_RUNTIME_VERSION.replace('canvas-runtime-v', '')}`);
  // The build hash does not decide a Chikun label.
  assert.equal(versionLabelFor('chikun', { buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.9.0', runtimeId: 'chikun:canvas-runtime-v7' }), 'Chikun v7');
  assert.equal(versionLabelFor('chikun', { buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.9.0' }), 'Chikun v?');
});

test('STACKED reads the cabinet major.minor', () => {
  assert.equal(stacked('site-1.8.1:game-1.8.1:cabinet-0.2.0'), 'STACKED v0.2');
  assert.equal(stacked('site-1.9.0:game-1.9.0:cabinet-0.3.1'), 'STACKED v0.3');
  assert.equal(stacked('site-1.7.0:game-1.7.0:cabinet-1.6.0'), 'STACKED v1.6');
  // STACKED always had a cabinet segment: without one the version is unknown.
  assert.equal(stacked('site-1.8.1:game-1.8.1'), 'STACKED v?');
  // The runtime id does not decide a STACKED label.
  assert.equal(versionLabelFor('stacked', { runtimeId: 'stacked:stacked-result-v1' }), 'STACKED v?');
});

test('every live build and runtime gets its own label', () => {
  const [major, minor] = HMH_CABINET_VERSION.split('.').map(Number);
  assert.match(HMH_CABINET_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(hmh(getPlaySessionIdentity('lester-blaster').buildHash), `HMH v${major}.${minor}`);
  assert.equal(versionLabelFor('chikun', { buildHash: getPlaySessionIdentity('chikun').buildHash, runtimeId: RANKED_GAMES.chikun.runtimeId }), 'Chikun v7');
  assert.equal(stacked(getPlaySessionIdentity('stacked').buildHash), `STACKED v${majorMinor(STACKED_CABINET_VERSION)}`);
  assert.equal(stacked(getPlaySessionIdentity('stacked').buildHash), 'STACKED v0.2');
});

test('unexpected inputs fall back to "<Game> v?" and never throw', () => {
  const malformedBuilds = [
    null, undefined, '', ' ', 42, {}, [], true,
    'site-1.8.1:game-1.8.1:cabinet-0.5', // two-part cabinet
    'site-1.8.1:game-1.8.1:cabinet-', 'site-1.8.1:game-1.8.1:cabinet-a.b.c',
    'site-1.8.1:game-1.8.1:cabinet-0.5.0:cabinet-0.6.0', 'site-1.8.1:game-1.8.1:cab-0.5.0',
    ' site-1.8.1:game-1.8.1', 'site-1.8.1:game-1.8.1 ', 'site-1.8.1:game-1.8.1\n', 'site-1.8:game-1.8.1', 'game-1.8.1',
    'site-1.8.1:game-1.8.1:cabinet-1234567.0.0', // over six digits shown
    `site-1.8.1:game-1.8.1:cabinet-0.5.0${'0'.repeat(200)}`, // over 128 characters
    'site-1.8.1:game-1.8.1:cabinet-０.５.０', // full-width digits
    '<script>alert(1)</script>',
  ];
  for (const buildHash of malformedBuilds) {
    assert.equal(versionLabelFor('lester-blaster', { buildHash }), 'HMH v?', String(buildHash));
    assert.equal(versionLabelFor('stacked', { buildHash }), 'STACKED v?', String(buildHash));
  }
  for (const runtimeId of [null, undefined, '', 7, 'chikun:canvas-runtime-v', 'chikun:canvas-runtime-vX', 'chikun:canvas-runtime-v7 ', 'stacked:canvas-runtime-v7',
    'chikun:canvas-runtime-v1234567', 'chikun:chikun:canvas-runtime-v7', 'Chikun:canvas-runtime-v7', 'lester-blaster:hmh-run-summary-v6']) {
    assert.equal(chikun(runtimeId), 'Chikun v?', String(runtimeId));
  }
  // Unknown games, and no source at all.
  for (const gameId of [undefined, null, '', 'pong', 'hard-money-heroes', 'LESTER-BLASTER', '__proto__', 'constructor', 'toString', 7, {}]) {
    assert.equal(versionLabelFor(gameId, { buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.5.0', runtimeId: 'chikun:canvas-runtime-v7' }), 'v?', String(gameId));
  }
  for (const source of [undefined, null, 'site-1.8.1:game-1.8.1', 7, [], true]) {
    assert.equal(versionLabelFor('lester-blaster', source), 'HMH v?', String(source));
    assert.equal(versionLabelFor('chikun', source), 'Chikun v?', String(source));
    assert.equal(versionLabelFor('stacked', source), 'STACKED v?', String(source));
  }
  assert.equal(versionLabelFor('lester-blaster'), 'HMH v?');
  // A row the chain indexer created carries no build hash (contract §4.3.10).
  assert.equal(versionLabelFor('lester-blaster', { buildHash: null, runtimeId: RANKED_GAMES['lester-blaster'].runtimeId }), 'HMH v?');
});

test('every label is short, printable ASCII (a compact column and a phone chip)', () => {
  const samples = [
    hmh('site-1.8.1:game-1.8.1'), hmh('site-9.9.9:game-9.9.9:cabinet-999999.999999.0'), chikun('chikun:canvas-runtime-v999999'),
    stacked('site-9.9.9:game-9.9.9:cabinet-999999.999999.0'), stacked(null), versionLabelFor('pong'),
  ];
  for (const label of samples) {
    assert.match(label, /^(?:(?:HMH|Chikun|STACKED) )?v(?:\d+(?:\.\d+)?|\?)$/, label);
    assert.ok(label.length <= 24, label);
  }
});

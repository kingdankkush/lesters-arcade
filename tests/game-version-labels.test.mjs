// Game version labels (version-column brief, acceptance 2): one pure module,
// shared by the server (E5, E6 and E9 rows) and the browser, turns a run's
// buildHash or runtimeId into 'HMH v0.5', 'Chikun v7' or 'STACKED v0.2', and
// anything unexpected into a '<Game> v?' / 'v?' fallback, never a throw. An
// HMH or STACKED cabinet (client-asserted, contract A11) is shown only inside
// the range this deploy has shipped, and a row with no build hash reads the
// game's only shipped cabinet while there is just one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GAME_VERSION_SHORT_NAMES,
  HMH_PRE_CABINET_VERSION,
  SHIPPED_CABINETS,
  UNKNOWN_GAME_VERSION,
  versionLabelFor,
  versionLabelText,
  versionLabelTitle,
} from '../apps/portal/src/game-version-labels.mjs';
import { HMH_CABINET_VERSION } from '../apps/portal/src/hmh-cabinet-version.mjs';
import { getPlaySessionIdentity } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_RUNTIME_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { STACKED_CABINET_VERSION } from '../apps/portal/src/stacked-cabinet.mjs';
import { RANKED_GAMES, RANKED_GAME_IDS } from '../apps/portal/src/ranked-identity.mjs';

const hmh = (buildHash, options) => versionLabelFor('lester-blaster', { buildHash }, options);
const chikun = (runtimeId) => versionLabelFor('chikun', { runtimeId });
const stacked = (buildHash, options) => versionLabelFor('stacked', { buildHash }, options);
const majorMinor = (version) => version.split('.').slice(0, 2).join('.');
// A later deploy, for the shapes this one has not shipped: HMH and STACKED
// cabinets up to 999999.999999.
const LATER = Object.freeze({ cabinets: Object.freeze({
  'lester-blaster': Object.freeze({ first: '0.5', current: '999999.999999' }),
  stacked: Object.freeze({ first: '0.2', current: '999999.999999' }),
}) });

test('the module is pure: only the two cabinet constants, no environment, no clock', () => {
  const source = readFileSync(new URL('../apps/portal/src/game-version-labels.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^\s*import\s[^;]*?from\s*'([^']+)';/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ['./hmh-cabinet-version.mjs', './stacked-cabinet.mjs'], 'static imports');
  assert.equal((source.match(/^\s*import\s/gm) ?? []).length, 2);
  for (const constant of ['hmh-cabinet-version.mjs', 'stacked-cabinet.mjs']) {
    const constantSource = readFileSync(new URL(`../apps/portal/src/${constant}`, import.meta.url), 'utf8');
    assert.equal(constantSource.trim().split('\n').length, 1, `${constant}: one line`);
    assert.equal(/\bimport\b/.test(constantSource), false, `${constant}: no imports`);
  }
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
  assert.equal(hmh('site-1.8.2:game-1.8.2:cabinet-00.005.0'), 'HMH v0.5', 'leading zeros are normalized');
  // A later deploy that has shipped these cabinets labels them the same way.
  assert.equal(hmh('site-1.9.0:game-1.9.0:cabinet-0.6.0', LATER), 'HMH v0.6');
  assert.equal(hmh('site-2.0.0:game-2.0.0:cabinet-12.34.0', LATER), 'HMH v12.34');
  assert.equal(hmh('site-2.0.0:game-2.0.0:cabinet-007.010.0', LATER), 'HMH v7.10', 'leading zeros are normalized');
  // 1.8.x rows (live before the cabinet version existed) and older ones.
  assert.equal(hmh('site-1.8.1:game-1.8.1'), 'HMH v0.5');
  assert.equal(hmh('site-1.7.0:game-1.7.0'), 'HMH v0.5');
  assert.equal(hmh('site-10.20.30:game-40.50.60'), 'HMH v0.5');
});

test('HMH majors and minors are shown as numbers, never as a trailing .0 of the major', () => {
  // cabinet-1.0.x is major 1, minor 0: shown as v1.0, not v1.
  assert.equal(hmh('site-2.0.0:game-2.0.0:cabinet-1.0.3', LATER), 'HMH v1.0');
});

// The server format-checks a buildHash but cannot prove its cabinet (contract
// A11): a claimed cabinet is shown only inside the range this deploy shipped.
test('an HMH or STACKED cabinet outside the shipped range reads "<Game> v?"', () => {
  assert.deepEqual(SHIPPED_CABINETS, {
    'lester-blaster': { first: '0.5', current: majorMinor(HMH_CABINET_VERSION) },
    stacked: { first: '0.2', current: majorMinor(STACKED_CABINET_VERSION) },
  });
  assert.equal(Object.isFrozen(SHIPPED_CABINETS) && Object.values(SHIPPED_CABINETS).every(Object.isFrozen), true);
  const [major, minor] = HMH_CABINET_VERSION.split('.').map(Number);
  const [stackedMajor, stackedMinor] = STACKED_CABINET_VERSION.split('.').map(Number);
  const futures = (majorPart, minorPart) => [
    `${majorPart}.${minorPart + 1}.0`, // the next minor, not shipped yet
    `${majorPart + 1}.0.0`, // the next major
    `${majorPart}.${minorPart + 1}.${999}`,
    '999999.999999.0', // oversized
    '999999.0.0',
    `${majorPart}.999999.0`,
  ];
  for (const cabinet of futures(major, minor)) {
    assert.equal(hmh(`site-1.8.1:game-1.8.1:cabinet-${cabinet}`), 'HMH v?', `future HMH ${cabinet}`);
    assert.equal(hmh(`site-1.8.1:game-1.8.1:cabinet-${cabinet}`, LATER), `HMH v${majorMinor(cabinet)}`, `${cabinet} after it ships`);
  }
  for (const cabinet of futures(stackedMajor, stackedMinor)) {
    assert.equal(stacked(`site-1.8.1:game-1.8.1:cabinet-${cabinet}`), 'STACKED v?', `future STACKED ${cabinet}`);
  }
  // Cabinets before the first one a ranked run could carry never existed.
  for (const cabinet of ['0.0.0', '0.4.9', '0.1.0']) {
    assert.equal(hmh(`site-0.0.0:game-0.0.0:cabinet-${cabinet}`), 'HMH v?', `HMH ${cabinet}`);
    assert.equal(hmh(`site-0.0.0:game-0.0.0:cabinet-${cabinet}`, LATER), 'HMH v?', `HMH ${cabinet}, later too`);
  }
  for (const cabinet of ['0.0.0', '0.1.0', '0.1.999']) {
    assert.equal(stacked(`site-1.8.1:game-1.8.1:cabinet-${cabinet}`), 'STACKED v?', `STACKED ${cabinet}`);
  }
  // The shipped edge itself, and a patch on it, are shown.
  assert.equal(hmh(`site-1.8.1:game-1.8.1:cabinet-${major}.${minor}.999`), `HMH v${major}.${minor}`);
  assert.equal(stacked(`site-1.8.1:game-1.8.1:cabinet-${stackedMajor}.${stackedMinor}.999`), `STACKED v${stackedMajor}.${stackedMinor}`);
  // The range follows the deploy: another range moves the edge, and a missing
  // or malformed one shows no cabinet at all (the pre-cabinet HMH label stays).
  const bumped = { cabinets: { 'lester-blaster': { first: '0.5', current: '0.6' }, stacked: { first: '0.2', current: '0.3' } } };
  assert.equal(hmh('site-1.9.0:game-1.9.0:cabinet-0.6.0', bumped), 'HMH v0.6');
  assert.equal(hmh('site-1.9.0:game-1.9.0:cabinet-0.7.0', bumped), 'HMH v?');
  assert.equal(stacked('site-1.9.0:game-1.9.0:cabinet-0.3.0', bumped), 'STACKED v0.3');
  assert.equal(stacked('site-1.9.0:game-1.9.0:cabinet-0.4.0', bumped), 'STACKED v?');
  for (const options of [{ cabinets: {} }, { cabinets: { 'lester-blaster': { first: 'x', current: 'y' } } }, { cabinets: { 'lester-blaster': null } }]) {
    assert.equal(hmh('site-1.8.2:game-1.8.2:cabinet-0.5.0', options), 'HMH v?', JSON.stringify(options));
    assert.equal(hmh('site-1.8.1:game-1.8.1', options), 'HMH v0.5');
  }
  // No options, or null ones, mean this deploy's range; never a throw.
  for (const options of [undefined, null, {}, { cabinets: null }, 7]) {
    assert.equal(hmh('site-1.8.2:game-1.8.2:cabinet-0.5.0', options), 'HMH v0.5', String(options));
  }
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
  assert.equal(stacked('site-1.8.1:game-1.8.1:cabinet-0.2.3'), 'STACKED v0.2', 'the patch is not shown');
  // Not shipped by this deploy (every ranked STACKED run is replayed under
  // today's rules), but labelled the same way once a later deploy has.
  assert.equal(stacked('site-1.9.0:game-1.9.0:cabinet-0.3.1'), 'STACKED v?');
  assert.equal(stacked('site-1.9.0:game-1.9.0:cabinet-0.3.1', LATER), 'STACKED v0.3');
  assert.equal(stacked('site-1.7.0:game-1.7.0:cabinet-1.6.0', LATER), 'STACKED v1.6');
  // STACKED always had a cabinet segment: without one the version is unknown.
  assert.equal(stacked('site-1.8.1:game-1.8.1'), 'STACKED v?');
  // The runtime id does not decide a STACKED label.
  assert.equal(versionLabelFor('stacked', { buildHash: 'site-1.8.1:game-1.8.1', runtimeId: 'stacked:stacked-result-v1' }), 'STACKED v?');
  assert.equal(versionLabelFor('stacked', { buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.2.0', runtimeId: 'stacked:stacked-result-v9' }), 'STACKED v0.2');
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
    '', ' ', 42, {}, [], true,
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
});

// Review finding (version-column fixer, round 2): the relayed agreement reads
// "rows without a cabinet segment also HMH v0.5". A chain-index row (the
// indexer mirrors a published run whose Neon row was lost, contract
// §4.3.10) stores no build hash at all. HMH and STACKED have each shipped one
// cabinet so far, so every ranked run of them was played on it.
test('a row with no build hash reads the only cabinet its game has shipped, else "<Game> v?"', () => {
  assert.equal(SHIPPED_CABINETS['lester-blaster'].first, SHIPPED_CABINETS['lester-blaster'].current, 'HMH has shipped one cabinet');
  assert.equal(SHIPPED_CABINETS.stacked.first, SHIPPED_CABINETS.stacked.current, 'STACKED has shipped one cabinet');
  for (const source of [{ buildHash: null }, { buildHash: undefined }, {}, { buildHash: null, runtimeId: RANKED_GAMES['lester-blaster'].runtimeId }, { runtimeId: '0x7a49' }]) {
    assert.equal(versionLabelFor('lester-blaster', source), 'HMH v0.5', JSON.stringify(source));
    assert.equal(versionLabelFor('stacked', source), 'STACKED v0.2', JSON.stringify(source));
  }
  // Chikun reads its runtime id, never a cabinet.
  assert.equal(versionLabelFor('chikun', { buildHash: null }), 'Chikun v?');
  assert.equal(versionLabelFor('chikun', { buildHash: null, runtimeId: 'chikun:canvas-runtime-v7' }), 'Chikun v7');
  // Once a second cabinet ships, such a row can no longer be dated.
  const bumped = { cabinets: { 'lester-blaster': { first: '0.5', current: '0.6' }, stacked: { first: '0.2', current: '0.3' } } };
  assert.equal(hmh(null, bumped), 'HMH v?');
  assert.equal(stacked(null, bumped), 'STACKED v?');
  assert.equal(hmh('site-1.8.1:game-1.8.1', bumped), 'HMH v0.5', 'a build without the segment still dates itself');
  // A missing, malformed or oversized range shows nothing; leading zeros normalize.
  for (const cabinets of [{}, { 'lester-blaster': null }, { 'lester-blaster': { first: 'x', current: 'x' } }, { 'lester-blaster': { first: '0.5' } },
    { 'lester-blaster': { first: '1234567.0', current: '1234567.0' } }, { 'lester-blaster': { first: 5, current: 5 } }]) {
    assert.equal(hmh(null, { cabinets }), 'HMH v?', JSON.stringify(cabinets));
  }
  assert.equal(hmh(null, { cabinets: { 'lester-blaster': { first: '00.05', current: '00.05' } } }), 'HMH v0.5');
  // Anything but a plain object is not a stored run.
  for (const source of [undefined, null, [], 'site-1.8.1:game-1.8.1', 0, false]) {
    assert.equal(versionLabelFor('lester-blaster', source), 'HMH v?', String(source));
    assert.equal(versionLabelFor('stacked', source), 'STACKED v?', String(source));
  }
});

test('every label is short, printable ASCII (a compact column and a phone chip)', () => {
  const samples = [
    hmh('site-1.8.1:game-1.8.1'), hmh('site-9.9.9:game-9.9.9:cabinet-999999.999999.0', LATER), chikun('chikun:canvas-runtime-v999999'),
    stacked('site-9.9.9:game-9.9.9:cabinet-999999.999999.0', LATER), stacked(null), versionLabelFor('pong'),
  ];
  assert.deepEqual(samples.slice(1, 4), ['HMH v999999.999999', 'Chikun v999999', 'STACKED v999999.999999'], 'the widest labels');
  for (const label of samples) {
    assert.match(label, /^(?:(?:HMH|Chikun|STACKED) )?v(?:\d+(?:\.\d+)?|\?)$/, label);
    assert.ok(label.length <= 24, label);
  }
});

test('versionLabelText accepts exactly the labels versionLabelFor writes', () => {
  const written = [
    hmh('site-1.8.1:game-1.8.1'), hmh('site-1.9.0:game-1.9.0:cabinet-0.6.0', LATER), hmh('site-1.9.0:game-1.9.0:cabinet-0.6.0'), hmh(null),
    chikun('chikun:canvas-runtime-v7'), chikun(null), stacked('site-1.8.1:game-1.8.1:cabinet-0.2.0'),
    stacked('site-9.9.9:game-9.9.9:cabinet-999999.999999.0', LATER), versionLabelFor('pong'),
  ];
  for (const label of written) assert.equal(versionLabelText(label), label, label);
  for (const bad of [undefined, null, 0, true, {}, ['HMH v0.5'], '', ' ', 'v', 'HMH', 'HMH v', 'HMH v0.5 ', ' HMH v0.5', 'HMH  v0.5', 'HMH v0.5.0',
    'HMH v1234567', 'HMH v0.1234567', 'H-M-H v0.5', 'Chikun v7\n', '<b>HMH</b> v0.5', 'ABCDEFGHIJKLM v1', 'HMH v0.5<script>',
    // Review finding (version-column fixer, round 2): only the three games' names.
    'Pong v1', 'Admin v1', 'Hmh v0.5', 'hmh v0.5', 'CHIKUN v7', 'Stacked v0.2', 'Lester v0.5', 'HMHS v0.5', 'XHMH v0.5']) {
    assert.equal(versionLabelText(bad), null, JSON.stringify(bad));
  }
  for (const name of Object.values(GAME_VERSION_SHORT_NAMES)) assert.equal(versionLabelText(`${name} v1`), `${name} v1`);
});

test('versionLabelText with the row game accepts only that game\'s labels', () => {
  const games = { 'lester-blaster': ['HMH v0.5', 'HMH v?'], chikun: ['Chikun v7', 'Chikun v?'], stacked: ['STACKED v0.2', 'STACKED v?'] };
  for (const [gameId, labels] of Object.entries(games)) {
    for (const label of labels) assert.equal(versionLabelText(label, gameId), label, `${gameId} ${label}`);
    for (const [otherId, otherLabels] of Object.entries(games)) {
      if (otherId === gameId) continue;
      for (const label of otherLabels) assert.equal(versionLabelText(label, gameId), null, `${label} on a ${gameId} row`);
    }
    assert.equal(versionLabelText('v?', gameId), null, 'a known game always names itself');
    const live = versionLabelFor(gameId, { buildHash: getPlaySessionIdentity(gameId).buildHash, runtimeId: RANKED_GAMES[gameId].runtimeId });
    assert.equal(versionLabelText(live, gameId), live, `${gameId}: its live label`);
  }
  // An unknown game's only label is 'v?' alone, as versionLabelFor writes it.
  for (const gameId of ['pong', '', 7, {}, '__proto__', 'constructor']) {
    assert.equal(versionLabelText('v?', gameId), 'v?', String(gameId));
    assert.equal(versionLabelText('HMH v0.5', gameId), null, String(gameId));
  }
  // No game given: any of the three games' shapes.
  for (const gameId of [null, undefined]) assert.equal(versionLabelText('Chikun v7', gameId), 'Chikun v7');
});

// Review finding (version-column fixer): the board, the profile and the share
// page treated an unknown version three ways. The hosted views now share one
// tooltip; the share page lists no unknown version at all.
test('versionLabelTitle: played on, unknown, or unavailable', () => {
  assert.equal(versionLabelTitle('HMH v0.5'), 'Played on HMH v0.5');
  assert.equal(versionLabelTitle('Chikun v7'), 'Played on Chikun v7');
  for (const unknown of ['HMH v?', 'STACKED v?', 'v?']) assert.equal(versionLabelTitle(unknown), 'Game version unknown for this run', unknown);
  for (const missing of [null, undefined, '']) assert.equal(versionLabelTitle(missing), 'Game version unavailable', String(missing));
});

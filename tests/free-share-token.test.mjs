import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as esbuild from 'esbuild';

import {
  FREE_SHARE_GAMES, FREE_SHARE_HEROES, FREE_SHARE_REGIONS, FREE_SHARE_TOKEN_VERSION, FREE_TOKEN_FIELDS,
  decodeFreeShareToken, encodeFreeShareToken, freeShareCardPath, freeSharePageUrl, normalizeFreeShareValues,
} from '../apps/portal/src/free-share-token.mjs';
import { CHIKUN_REGIONS } from '../apps/portal/src/chikun-course-regions.mjs';
import { STACKED_LEVEL_CAP } from '../apps/portal/src/stacked-contracts.mjs';
import { ROGUELIKE_LEVEL_CAP } from '../apps/portal/src/arcade-core.mjs';

// Free share token (plan docs/handoffs/free-share-20260926.md §3): a compact
// lowercase base36 string that fully determines a Free card and page, built by
// the results panel and decoded by the two functions. Self-reported (no
// integrity); the checksum is a probe filter; decode is strict and canonical.

const TOKEN = /^[0-9a-z]+$/;
const HMH = { hero: 'lit-valkyrie', score: 48210, kills: 312, maxCombo: 42, survivalSeconds: 724, level: 9, bossDefeated: true };
const CHIKUN = { region: 'coast', score: 19475, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalSeconds: 180, laps: 2, daily: true };
const STACKED = { assisted: false, score: 412900, lines: 186, level: 14, quadClears: 5, maxCombo: 7, survivalSeconds: 1500 };
const FIXTURES = { 'lester-blaster': HMH, chikun: CHIKUN, stacked: STACKED };

function slugOf(gameId) {
  return FREE_SHARE_GAMES[gameId].slug;
}

// Deterministic pseudo-random tuples for the canonicality sweep.
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('every game has a fixed token length, a code and a route slug', () => {
  assert.equal(FREE_SHARE_TOKEN_VERSION, 'a');
  assert.deepEqual(FREE_SHARE_GAMES, {
    'lester-blaster': { code: 'h', slug: 'hard-money-heroes', length: 30 },
    chikun: { code: 'c', slug: 'chikun', length: 40 },
    stacked: { code: 's', slug: 'stacked', length: 34 },
  });
  assert.ok(Object.isFrozen(FREE_SHARE_GAMES));
  for (const [gameId, values] of Object.entries(FIXTURES)) {
    const token = encodeFreeShareToken(gameId, values);
    assert.equal(token.length, FREE_SHARE_GAMES[gameId].length, gameId);
    assert.match(token, TOKEN, gameId);
    assert.equal(token[0], 'a', `${gameId}: version char`);
    assert.equal(token[1], FREE_SHARE_GAMES[gameId].code, `${gameId}: game char`);
    // 1 version + 1 game + the field widths + 2 checksum.
    const widths = FREE_TOKEN_FIELDS[gameId].reduce((sum, [, width]) => sum + width, 0);
    assert.equal(widths + 4, FREE_SHARE_GAMES[gameId].length, `${gameId}: widths add up`);
  }
});

test('typical and maximal values round-trip through encode and decode', () => {
  for (const [gameId, values] of Object.entries(FIXTURES)) {
    const token = encodeFreeShareToken(gameId, values);
    const decoded = decodeFreeShareToken(slugOf(gameId), token);
    assert.deepEqual(decoded, { ok: true, gameId, slug: slugOf(gameId), version: 'a', values: normalizeFreeShareValues(gameId, values) }, gameId);
    assert.deepEqual(decoded.values, values, `${gameId}: the fixture is already normal`);
    assert.ok(Object.isFrozen(decoded.values), gameId);
  }
  const maxima = {
    'lester-blaster': { hero: 'lilly', score: 999_999_999_999, kills: 9_999_999, maxCombo: 9_999_999, survivalSeconds: 359_999, level: ROGUELIKE_LEVEL_CAP, bossDefeated: true },
    chikun: { region: 'coast', score: 999_999_999_999, forksPassed: 9_999_999, nearMisses: 9_999_999, coinsCollected: 9_999_999, bestCombo: 9_999_999, survivalSeconds: 3_600, laps: 99, daily: true },
    stacked: { assisted: true, score: 999_999_999_999, lines: 9_999_999, level: STACKED_LEVEL_CAP, quadClears: 2_499_999, maxCombo: 9_999_999, survivalSeconds: 7_200 },
  };
  const minima = {
    'lester-blaster': { hero: '', score: 0, kills: 0, maxCombo: 0, survivalSeconds: 0, level: 1, bossDefeated: false },
    chikun: { region: 'farmland', score: 0, forksPassed: 0, nearMisses: 0, coinsCollected: 0, bestCombo: 0, survivalSeconds: 0, laps: 0, daily: false },
    stacked: { assisted: false, score: 0, lines: 0, level: 1, quadClears: 0, maxCombo: 0, survivalSeconds: 0 },
  };
  for (const fixtures of [maxima, minima]) {
    for (const [gameId, values] of Object.entries(fixtures)) {
      const token = encodeFreeShareToken(gameId, values);
      assert.equal(token.length, FREE_SHARE_GAMES[gameId].length, gameId);
      assert.deepEqual(decodeFreeShareToken(slugOf(gameId), token).values, values, gameId);
    }
  }
});

test('normalize rounds, clamps, coerces flags and enum ids, applies the cross-field rules and is idempotent', () => {
  const hmh = normalizeFreeShareValues('lester-blaster', { hero: 'pinball', score: 1e15, kills: -4, maxCombo: 41.6, survivalSeconds: '12', level: 0, bossDefeated: 'yes' });
  assert.deepEqual(hmh, { hero: '', score: 999_999_999_999, kills: 0, maxCombo: 42, survivalSeconds: 0, level: 1, bossDefeated: false });
  assert.deepEqual(normalizeFreeShareValues('lester-blaster', { hero: 'lester-original', level: 999, bossDefeated: true }), { hero: 'lester-original', score: 0, kills: 0, maxCombo: 0, survivalSeconds: 0, level: ROGUELIKE_LEVEL_CAP, bossDefeated: true });
  assert.deepEqual(normalizeFreeShareValues('lester-blaster', {}).hero, '', 'no hero is the empty id');
  const chikun = normalizeFreeShareValues('chikun', { region: 'moon', laps: 5, forksPassed: 95, survivalSeconds: 180.49, daily: 1 });
  assert.equal(chikun.region, 'farmland', 'unknown region reads as farmland');
  assert.equal(chikun.laps, 1, 'laps never exceed forksPassed / 48');
  assert.equal(chikun.survivalSeconds, 180);
  assert.equal(chikun.daily, false, 'only true is a flag');
  assert.equal(normalizeFreeShareValues('chikun', { survivalSeconds: 9_999 }).survivalSeconds, 3_600, 'CHIKUN_MAX_RUN_TICKS / 60');
  const stacked = normalizeFreeShareValues('stacked', { assisted: true, lines: 186, quadClears: 47, level: 31, survivalSeconds: 99_999 });
  assert.deepEqual(stacked, { assisted: true, score: 0, lines: 186, level: STACKED_LEVEL_CAP, quadClears: 46, maxCombo: 0, survivalSeconds: 7_200 });
  for (const [gameId, values] of Object.entries(FIXTURES)) {
    const once = normalizeFreeShareValues(gameId, values);
    assert.deepEqual(normalizeFreeShareValues(gameId, once), once, `${gameId}: idempotent`);
    assert.ok(Object.isFrozen(once));
  }
  // NaN, null and undefined read as the minimum; a numeric string is not a number.
  assert.deepEqual(normalizeFreeShareValues('stacked', { score: NaN, lines: null, level: undefined }), { assisted: false, score: 0, lines: 0, level: 1, quadClears: 0, maxCombo: 0, survivalSeconds: 0 });
  for (const gameId of ['pinball', 'toString', '__proto__', 'constructor', '', null]) {
    assert.throws(() => normalizeFreeShareValues(gameId, {}), /no free share token for/, String(gameId));
    assert.throws(() => encodeFreeShareToken(gameId, {}), /no free share token for/, String(gameId));
  }
});

test('encode never throws on a results panel value set: the token it builds always decodes', () => {
  const hostile = { hero: { toString: () => 'lilly' }, score: Infinity, kills: '312', maxCombo: [], survivalSeconds: -Infinity, level: 1e9, bossDefeated: null };
  const token = encodeFreeShareToken('lester-blaster', hostile);
  assert.equal(token.length, 30);
  assert.deepEqual(decodeFreeShareToken('hard-money-heroes', token).values, { hero: '', score: 999_999_999_999, kills: 0, maxCombo: 0, survivalSeconds: 0, level: ROGUELIKE_LEVEL_CAP, bossDefeated: false });
  assert.equal(encodeFreeShareToken('chikun', undefined).length, 40);
  assert.equal(encodeFreeShareToken('stacked', null).length, 34);
});

test('decode rejects every malformed token with a result, never a throw', () => {
  const token = encodeFreeShareToken('chikun', CHIKUN);
  const invalidGame = { ok: false, error: 'invalid-game' };
  const invalidToken = { ok: false, error: 'invalid-token' };
  for (const slug of ['pinball', 'lester-blaster', 'toString', '__proto__', 'constructor', 'CHIKUN', '', null, undefined, 3, {}]) {
    assert.deepEqual(decodeFreeShareToken(slug, token), invalidGame, `slug ${String(slug)}`);
  }
  const flip = (text, index, char) => `${text.slice(0, index)}${char}${text.slice(index + 1)}`;
  const cases = {
    'length -1': token.slice(0, -1),
    'length +1': `${token}0`,
    'uppercase': token.toUpperCase(),
    'base64 =': flip(token, 10, '='),
    'base64 +': flip(token, 10, '+'),
    'base64 /': flip(token, 10, '/'),
    'dash': flip(token, 10, '-'),
    'underscore': flip(token, 10, '_'),
    'unicode digit': flip(token, 10, '٣'),
    'fullwidth letter': flip(token, 10, 'ａ'),
    'version b': flip(token, 0, 'b'),
    'wrong game char': flip(token, 1, 's'),
    'checksum flipped': flip(token, token.length - 1, token[token.length - 1] === '0' ? '1' : '0'),
    'checksum flipped (first char)': flip(token, token.length - 2, token[token.length - 2] === '0' ? '1' : '0'),
    'empty': '',
    'not a string': 42,
    'null': null,
    'undefined': undefined,
    'object': { length: 40 },
    'a different game token': encodeFreeShareToken('stacked', STACKED),
  };
  for (const [label, bad] of Object.entries(cases)) {
    assert.deepEqual(decodeFreeShareToken('chikun', bad), invalidToken, label);
  }
});

// Builds a token from raw field integers (bypassing normalize) with a valid
// checksum, so the decoder's range, enum and cross-field checks are what
// rejects it.
function rawToken(gameId, fields, checksum) {
  const { code } = FREE_SHARE_GAMES[gameId];
  let body = `${FREE_SHARE_TOKEN_VERSION}${code}`;
  for (const [key, width] of FREE_TOKEN_FIELDS[gameId]) body += fields[key].toString(36).padStart(width, '0');
  return `${body}${checksum(body)}`;
}

test('decode rejects out-of-range, unknown enum and cross-field values through canonical re-encoding', () => {
  // Recover the checksum function from a valid token: the last two chars of
  // any token are the checksum of everything before them.
  const sample = encodeFreeShareToken('lester-blaster', HMH);
  const checksum = (body) => {
    let c = 0;
    for (const char of body) c = (c * 31 + char.charCodeAt(0)) % 1296;
    return c.toString(36).padStart(2, '0');
  };
  assert.equal(checksum(sample.slice(0, -2)), sample.slice(-2), 'the checksum is (c*31 + code) mod 1296 over the preceding chars');

  const hmhFields = { hero: 2, score: 48210, kills: 312, maxCombo: 42, survivalSeconds: 724, level: 9, flags: 1 };
  assert.deepEqual(decodeFreeShareToken('hard-money-heroes', rawToken('lester-blaster', hmhFields, checksum)), { ok: true, gameId: 'lester-blaster', slug: 'hard-money-heroes', version: 'a', values: HMH }, 'the raw fixture is the fixture');
  const hmhBad = [
    ['hero 5', { hero: 5 }], ['score max+1', { score: 1_000_000_000_000 }], ['kills max+1', { kills: 10_000_000 }], ['maxCombo max+1', { maxCombo: 10_000_000 }],
    ['survivalSeconds max+1', { survivalSeconds: 360_000 }], ['level 0', { level: 0 }], ['level cap+1', { level: ROGUELIKE_LEVEL_CAP + 1 }], ['flags 2', { flags: 2 }], ['flags 3', { flags: 3 }],
  ];
  for (const [label, patch] of hmhBad) {
    assert.deepEqual(decodeFreeShareToken('hard-money-heroes', rawToken('lester-blaster', { ...hmhFields, ...patch }, checksum)), { ok: false, error: 'invalid-token' }, label);
  }
  const chikunFields = { region: 6, score: 19475, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalSeconds: 180, laps: 2, flags: 1 };
  assert.equal(decodeFreeShareToken('chikun', rawToken('chikun', chikunFields, checksum)).ok, true);
  for (const [label, patch] of [['region 7', { region: 7 }], ['laps 2 with 95 forks', { laps: 2, forksPassed: 95 }], ['laps 100', { laps: 100, forksPassed: 9_999_999 }], ['survivalSeconds 3601', { survivalSeconds: 3_601 }], ['flags 2', { flags: 2 }]]) {
    assert.deepEqual(decodeFreeShareToken('chikun', rawToken('chikun', { ...chikunFields, ...patch }, checksum)), { ok: false, error: 'invalid-token' }, label);
  }
  const stackedFields = { flags: 0, score: 412900, lines: 186, level: 14, quadClears: 5, maxCombo: 7, survivalSeconds: 1500 };
  assert.equal(decodeFreeShareToken('stacked', rawToken('stacked', stackedFields, checksum)).ok, true);
  for (const [label, patch] of [['level 31', { level: STACKED_LEVEL_CAP + 1 }], ['level 0', { level: 0 }], ['47 Halvings from 186 lines', { quadClears: 47 }], ['survivalSeconds 7201', { survivalSeconds: 7_201 }], ['flags 2', { flags: 2 }]]) {
    assert.deepEqual(decodeFreeShareToken('stacked', rawToken('stacked', { ...stackedFields, ...patch }, checksum)), { ok: false, error: 'invalid-token' }, label);
  }
});

test('every decoded token is canonical: encode(decode(t).values) === t over 500 seeded tuples', () => {
  const random = lcg(20260926);
  const pick = (max) => Math.floor(random() * (max + 1));
  for (let i = 0; i < 500; i += 1) {
    const gameId = ['lester-blaster', 'chikun', 'stacked'][i % 3];
    const values = gameId === 'lester-blaster'
      ? { hero: ['', ...FREE_SHARE_HEROES][pick(4)], score: pick(999_999_999_999), kills: pick(9_999_999), maxCombo: pick(9_999_999), survivalSeconds: pick(359_999), level: 1 + pick(ROGUELIKE_LEVEL_CAP - 1), bossDefeated: random() < 0.5 }
      : gameId === 'chikun'
        ? { region: FREE_SHARE_REGIONS[pick(6)], score: pick(999_999_999_999), forksPassed: pick(9_999_999), nearMisses: pick(9_999_999), coinsCollected: pick(9_999_999), bestCombo: pick(9_999_999), survivalSeconds: pick(3_600), laps: pick(99), daily: random() < 0.5 }
        : { assisted: random() < 0.5, score: pick(999_999_999_999), lines: pick(9_999_999), level: 1 + pick(STACKED_LEVEL_CAP - 1), quadClears: pick(9_999_999), maxCombo: pick(9_999_999), survivalSeconds: pick(7_200) };
    const token = encodeFreeShareToken(gameId, values);
    const decoded = decodeFreeShareToken(slugOf(gameId), token);
    assert.equal(decoded.ok, true, `${gameId} #${i}`);
    assert.equal(encodeFreeShareToken(gameId, decoded.values), token, `${gameId} #${i}: canonical`);
    assert.deepEqual(decoded.values, normalizeFreeShareValues(gameId, values), `${gameId} #${i}`);
  }
});

test('the URLs carry only the slug and the token', () => {
  const token = encodeFreeShareToken('lester-blaster', HMH);
  assert.equal(freeSharePageUrl('lester-blaster', token), `https://lestersarcade.io/f/hard-money-heroes/${token}`);
  assert.equal(freeSharePageUrl('chikun', token, 'http://127.0.0.1:8931'), `http://127.0.0.1:8931/f/chikun/${token}`);
  assert.equal(freeShareCardPath('stacked', token), `/api/free-card/stacked/${token}.png`);
  assert.throws(() => freeSharePageUrl('pinball', token), /no free share token for/);
  assert.throws(() => freeShareCardPath('pinball', token), /no free share token for/);
  // No personal data can enter a token: the values are ids, booleans and bounded integers only.
  const decoded = decodeFreeShareToken('hard-money-heroes', token);
  for (const value of Object.values(decoded.values)) assert.ok(typeof value === 'number' || typeof value === 'boolean' || FREE_SHARE_HEROES.includes(value) || value === '', String(value));
});

test('the enums and caps are pinned to the games they describe', async () => {
  const main = await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const heroes = /const HMH_REBOOT_HERO_IDS = Object\.freeze\(\[([^\]]+)\]\);/.exec(main);
  assert.ok(heroes, 'main.js declares HMH_REBOOT_HERO_IDS');
  assert.deepEqual([...FREE_SHARE_HEROES], heroes[1].split(',').map((item) => item.trim().replace(/^'|'$/g, '')));
  assert.deepEqual([...FREE_SHARE_REGIONS], CHIKUN_REGIONS.map((region) => region.id));
  assert.equal(CHIKUN_REGIONS.reduce((sum, region) => sum + region.slots, 0), 48, 'REGION_LOOP_SLOTS: one lap is 48 obstacles');
  const bound = (gameId, key) => FREE_TOKEN_FIELDS[gameId].find(([name]) => name === key);
  assert.deepEqual(bound('lester-blaster', 'level').slice(2), [ROGUELIKE_LEVEL_CAP, 1]);
  assert.deepEqual(bound('stacked', 'level').slice(2), [STACKED_LEVEL_CAP, 1]);
  assert.deepEqual(bound('chikun', 'survivalSeconds').slice(2), [3_600, 0], 'CHIKUN_MAX_RUN_TICKS / 60');
  assert.deepEqual(bound('stacked', 'survivalSeconds').slice(2), [7_200, 0], 'STACKED_MAX_TICKS / 60');
  assert.deepEqual(bound('lester-blaster', 'survivalSeconds').slice(2), [359_999, 0], 'the share clock cap');
  for (const gameId of Object.keys(FREE_SHARE_GAMES)) assert.deepEqual(bound(gameId, 'score').slice(2), [999_999_999_999, 0], gameId);
  assert.ok(Object.isFrozen(FREE_SHARE_HEROES) && Object.isFrozen(FREE_SHARE_REGIONS) && Object.isFrozen(FREE_TOKEN_FIELDS));
});

test('the module is import-free and small: it ships in the Chikun and STACKED children', async () => {
  const source = await readFile(new URL('../apps/portal/src/free-share-token.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import /m, 'no imports: the children pay for every byte');
  assert.match(source, /self-reported/i, 'the header says what the token is not');
  // Measured 2,677 B at the first implementation (the readable field table
  // is most of it); the children's real gates are STACKED_ENTRY_JS_CAP and
  // STACKED_INITIAL_JS_CAP, which this module never approaches.
  const { code } = await esbuild.transform(source, { minify: true, format: 'esm' });
  assert.ok(code.length <= 2_800, `minified ${code.length} B <= 2,800 B`);
});

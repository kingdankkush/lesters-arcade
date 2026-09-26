import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as freeCardApi from '../api/free-card.mjs';
import { ipBucket } from '../server/http.mjs';
import { decodeFreeRun, FREE_GAMES, HERO_LABELS, REGION_LABELS, chipText, identityText, summaryText, tiles } from '../server/share/free-run.mjs';
import {
  FREE_CARD_ACCENT, FREE_CARD_RIBBON, GLYPHS, PORTRAIT_BOX, RIBBON_BOX, buildFreeCardElement, scoreFontSize,
} from '../server/share/render-free-card.mjs';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../server/share/render-card.mjs';
import { FREE_SHARE_HEROES, encodeFreeShareToken } from '../apps/portal/src/free-share-token.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { fakeRequest } from './helpers/fake-http.mjs';

// Free share card, E12 (plan docs/handoffs/free-share-20260926.md §6, §8):
// GET /api/free-card/<slug>/<token>.png → /api/free-card?game=&token=. The
// URL fully determines the bytes; nothing is read from Neon; a database only
// adds the per-IP render limit.

const SESSION_VALUE = `free-card-fixture-${'f1'.repeat(16)}`;
const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: SESSION_VALUE });
const NOW = Date.parse('2026-09-26T12:00:00.000Z');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HMH = { hero: 'lit-valkyrie', score: 48210, kills: 312, maxCombo: 42, survivalSeconds: 724, level: 9, bossDefeated: true };
const CHIKUN = { region: 'coast', score: 19475, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalSeconds: 180, laps: 2, daily: true };
const STACKED = { assisted: true, score: 412900, lines: 186, level: 14, quadClears: 5, maxCombo: 7, survivalSeconds: 1500 };
const HMH_TOKEN = encodeFreeShareToken('lester-blaster', HMH);
const CHIKUN_TOKEN = encodeFreeShareToken('chikun', CHIKUN);
const STACKED_TOKEN = encodeFreeShareToken('stacked', STACKED);
const INVALID_CACHE = 'public, max-age=0, s-maxage=60';

function binaryResponse() {
  const headers = {};
  let body = null;
  return {
    statusCode: 0,
    headers,
    setHeader(key, value) { headers[String(key).toLowerCase()] = String(value); },
    end(chunk) { body = chunk === undefined ? null : Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)); },
    get body() { return body; },
  };
}

async function call(handler, request) {
  const res = binaryResponse();
  await handler(fakeRequest(request), res);
  const isJson = /application\/json/.test(res.headers['content-type'] ?? '');
  return { status: res.statusCode, headers: res.headers, body: res.body, json: isJson && res.body ? JSON.parse(res.body.toString('utf8')) : null };
}

function mount(db) {
  return freeCardApi.createHandler(() => freeCardApi.buildDeps(env, { db, nowMs: NOW }));
}

// Blocks every non-data fetch while a render runs: Satori must never reach a
// font or emoji CDN, and the handler must never fetch its own assets.
async function withoutNetwork(run) {
  const original = globalThis.fetch;
  const attempts = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input);
    if (url.startsWith('data:')) return original(input, init);
    attempts.push(url);
    throw new Error(`network blocked: ${url}`);
  };
  try {
    return { result: await run(), attempts };
  } finally {
    globalThis.fetch = original;
  }
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) walk(child, visit);
}

function textOf(element) {
  const parts = [];
  walk(element, (node) => {
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) if (typeof child === 'string') parts.push(child);
  });
  return parts.join(' | ');
}

function stylesOf(element) {
  const values = [];
  walk(element, (node) => { for (const value of Object.values(node.props?.style ?? {})) values.push(String(value)); });
  return values;
}

function assertPng(body) {
  assert.deepEqual(body.subarray(0, 8), PNG_SIGNATURE, 'PNG signature');
  assert.equal(body.subarray(12, 16).toString('latin1'), 'IHDR');
  assert.equal(body.readUInt32BE(16), 1200, 'IHDR width');
  assert.equal(body.readUInt32BE(20), 630, 'IHDR height');
}

function run(gameId, values) {
  const slug = FREE_GAMES[gameId].slug;
  const decoded = decodeFreeRun(slug, encodeFreeShareToken(gameId, values));
  assert.equal(decoded.ok, true);
  return decoded.run;
}

test('renders a 1200x630 PNG from the token alone, cached for a day at the edge, limited per IP when a database exists', async () => {
  const db = createPgliteClient();
  try {
    const started = performance.now();
    const { result: response, attempts } = await withoutNetwork(() => call(mount(db), { url: `/api/free-card?game=hard-money-heroes&token=${HMH_TOKEN}`, headers: { 'x-forwarded-for': '203.0.113.9' } }));
    const elapsed = performance.now() - started;
    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.headers['content-type'], 'image/png');
    assertPng(response.body);
    assert.equal(response.headers['content-length'], String(response.body.length));
    assert.equal(response.headers['cache-control'], freeCardApi.FREE_CARD_CACHE);
    assert.equal(freeCardApi.FREE_CARD_CACHE, 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    assert.doesNotMatch(response.headers['cache-control'], /immutable/);
    assert.equal(response.headers['x-robots-tag'], 'noindex');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(attempts, [], 'no network fetch while rendering');
    assert.ok(elapsed < 20_000, `render took ${Math.round(elapsed)} ms`);
    // Renders count against free-card:ip:<ipBucket>, never the Ranked card bucket.
    const bucket = `free-card:ip:${ipBucket('203.0.113.9', SESSION_VALUE)}`;
    const hits = await db.query('SELECT hits::int AS hits FROM rate_limits WHERE bucket = $1', [bucket]);
    assert.deepEqual(hits.map((item) => item.hits), [1]);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM rate_limits WHERE bucket LIKE 'card:ip:%'"))[0].n, 0);
    // HEAD answers the headers without rendering or counting.
    const head = await call(mount(db), { method: 'HEAD', url: `/api/free-card?game=hard-money-heroes&token=${HMH_TOKEN}`, headers: { 'x-forwarded-for': '203.0.113.10' } });
    assert.deepEqual([head.status, head.headers['content-type'], head.headers['cache-control'], head.body], [200, 'image/png', freeCardApi.FREE_CARD_CACHE, null]);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM rate_limits WHERE bucket LIKE 'free-card:ip:%'"))[0].n, 1, 'HEAD adds no bucket row');
  } finally {
    await db.close();
  }
});

test('works with no database at all: the CDN absorbs identical URLs', async () => {
  const handler = freeCardApi.createHandler(() => freeCardApi.buildDeps(env, { db: null }));
  for (const [slug, token] of [['chikun', CHIKUN_TOKEN], ['stacked', STACKED_TOKEN], ['hard-money-heroes', HMH_TOKEN]]) {
    const { result: response, attempts } = await withoutNetwork(() => call(handler, { url: `/api/free-card?game=${slug}&token=${token}` }));
    assert.equal(response.status, 200, slug);
    assertPng(response.body);
    assert.equal(response.headers['cache-control'], freeCardApi.FREE_CARD_CACHE, slug);
    assert.deepEqual(attempts, [], slug);
  }
  // The bare production default (no env, no overrides) renders too.
  const bare = await call(freeCardApi.createHandler(() => freeCardApi.buildDeps({})), { url: `/api/free-card?game=stacked&token=${STACKED_TOKEN}` });
  assert.equal(bare.status, 200);
  assertPng(bare.body);
  // The pure request function tolerates a deps object without a database.
  const pure = await freeCardApi.freeCardRequest({ method: 'HEAD', query: { game: 'chikun', token: CHIKUN_TOKEN } }, { db: null });
  assert.deepEqual([pure.status, pure.body], [200, null]);
});

test('renders beyond 120 per hour per IP bucket are refused when a database exists', async () => {
  const db = createPgliteClient();
  try {
    const ip = '192.0.2.44';
    // The bucket table exists only after the handler's ensureSchema; one render creates it.
    const first = await call(mount(db), { url: `/api/free-card?game=stacked&token=${STACKED_TOKEN}`, headers: { 'x-forwarded-for': ip } });
    assert.equal(first.status, 200);
    const bucket = `free-card:ip:${ipBucket(ip, SESSION_VALUE)}`;
    const windowStart = Math.floor(NOW / 1000 / 3600) * 3600;
    await db.query('UPDATE rate_limits SET hits = 120 WHERE bucket = $1 AND window_start = to_timestamp($2::double precision)', [bucket, String(windowStart)]);
    const response = await call(mount(db), { url: `/api/free-card?game=stacked&token=${STACKED_TOKEN}`, headers: { 'x-forwarded-for': ip } });
    assert.equal(response.status, 429);
    assert.equal(response.json.error, 'rate-limited');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.ok(Number(response.headers['retry-after']) > 0);
    const other = await call(mount(db), { url: `/api/free-card?game=stacked&token=${STACKED_TOKEN}`, headers: { 'x-forwarded-for': '192.0.2.45' } });
    assert.equal(other.status, 200, 'another IP still renders');
    assert.deepEqual(freeCardApi.FREE_CARD_RENDER_LIMITS, { ip: 120, windowSeconds: 3600 });
  } finally {
    await db.close();
  }
});

test('only game and token are accepted; a bad pair is a cacheable 400 with no render and no limit row', async () => {
  const db = createPgliteClient();
  try {
    const flip = (text, index, char) => `${text.slice(0, index)}${char}${text.slice(index + 1)}`;
    const noStore = [
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN}&cb=1`, 'invalid-query'],
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN}&width=2000`, 'invalid-query'],
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN}&token=${STACKED_TOKEN}`, 'invalid-query'],
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN}&v=1`, 'invalid-query'],
    ];
    for (const [url, error] of noStore) {
      const response = await call(mount(db), { url });
      assert.deepEqual([response.status, response.json], [400, { ok: false, error }], url);
      assert.equal(response.headers['cache-control'], 'no-store', url);
    }
    const cacheable = [
      ['/api/free-card', 'invalid-game'],
      [`/api/free-card?token=${CHIKUN_TOKEN}`, 'invalid-game'],
      [`/api/free-card?game=pinball&token=${CHIKUN_TOKEN}`, 'invalid-game'],
      [`/api/free-card?game=lester-blaster&token=${HMH_TOKEN}`, 'invalid-game'],
      [`/api/free-card?game=__proto__&token=${HMH_TOKEN}`, 'invalid-game'],
      ['/api/free-card?game=chikun', 'invalid-token'],
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN.slice(0, -1)}`, 'invalid-token'],
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN}0`, 'invalid-token'],
      [`/api/free-card?game=chikun&token=${CHIKUN_TOKEN.toUpperCase()}`, 'invalid-token'],
      [`/api/free-card?game=chikun&token=${flip(CHIKUN_TOKEN, 0, 'b')}`, 'invalid-token'],
      [`/api/free-card?game=chikun&token=${flip(CHIKUN_TOKEN, 39, CHIKUN_TOKEN[39] === '0' ? '1' : '0')}`, 'invalid-token'],
      [`/api/free-card?game=chikun&token=${STACKED_TOKEN}`, 'invalid-token'],
      [`/api/free-card?game=stacked&token=${CHIKUN_TOKEN}`, 'invalid-token'],
      [`/api/free-card?game=hard-money-heroes&token=${flip(HMH_TOKEN, 2, '5')}`, 'invalid-token'],
    ];
    for (const [url, error] of cacheable) {
      const response = await call(mount(db), { url, headers: { 'x-forwarded-for': '198.51.100.7' } });
      assert.deepEqual([response.status, response.json], [400, { ok: false, error }], url);
      assert.equal(response.headers['cache-control'], INVALID_CACHE, url);
      assert.equal(freeCardApi.FREE_CARD_INVALID_CACHE, INVALID_CACHE);
    }
    const rows = await db.query("SELECT count(*)::int AS n FROM rate_limits WHERE bucket LIKE 'free-card:ip:%'").catch(() => [{ n: 0 }]);
    assert.equal(rows[0].n, 0, 'a rejected request never counts as a render');
    const post = await call(mount(db), { method: 'POST', url: `/api/free-card?game=chikun&token=${CHIKUN_TOKEN}` });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    assert.equal(post.headers['cache-control'], 'no-store');
    assert.deepEqual([...freeCardApi.FREE_CARD_QUERY], ['game', 'token']);
  } finally {
    await db.close();
  }
});

test('a failing deps factory answers 500 JSON and logs only the error name and code', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => { logged.push(args); };
  try {
    const failure = Object.assign(new Error('connect postgres://arcade:hunter2-secret@db.example/neon failed'), { name: 'NeonDbError', code: '57P01' });
    const handler = freeCardApi.createHandler(async () => { throw failure; });
    const response = await call(handler, { url: `/api/free-card?game=chikun&token=${CHIKUN_TOKEN}` });
    assert.deepEqual([response.status, response.json], [500, { ok: false, error: 'internal-error' }]);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.doesNotMatch(response.body.toString('utf8'), /hunter2|postgres:\/\/|NeonDbError/);
    assert.deepEqual(logged, [['[free-card] internal-error', { name: 'NeonDbError', code: '57P01', sqlstate: '57P01' }]]);
  } finally {
    console.error = original;
  }
});

test('the card tree follows Satori rules and can never be mistaken for the Ranked card', () => {
  for (const [gameId, values] of [['lester-blaster', HMH], ['chikun', CHIKUN], ['stacked', STACKED]]) {
    const heroPortrait = gameId === 'lester-blaster' ? 'data:image/png;base64,AAAA' : null;
    const element = buildFreeCardElement({ run: run(gameId, values), background: 'data:image/png;base64,AAAA', heroPortrait });
    assert.equal(element.props.style.width, SHARE_CARD_WIDTH, gameId);
    assert.equal(element.props.style.height, SHARE_CARD_HEIGHT, gameId);
    assert.equal(element.props.style.overflow, 'hidden', `${gameId}: the ribbon overflows the corner`);
    const images = [];
    let svgs = 0;
    let ribbons = 0;
    walk(element, (node) => {
      const children = node.props?.children;
      // The flex rule is Satori's for HTML elements; an inline svg holds its paths.
      if (node.type !== 'svg' && Array.isArray(children) && children.length > 1) assert.equal(node.props.style?.display, 'flex', `${gameId}: every multi-child node is flex`);
      if (node.type === 'img') images.push(node.props.src);
      if (node.type === 'svg') svgs += 1;
      if (Array.isArray(children) ? children.includes(FREE_CARD_RIBBON) : children === FREE_CARD_RIBBON) ribbons += 1;
    });
    assert.ok(images.every((src) => src.startsWith('data:image/')), `${gameId}: images are data URIs only`);
    assert.equal(images.length, gameId === 'lester-blaster' ? 2 : 1, `${gameId}: the background, plus the hero portrait for HMH`);
    assert.equal(svgs, 3, `${gameId}: one glyph per stat tile`);
    assert.equal(ribbons, 1, `${gameId}: the ribbon text exactly once`);
    const text = textOf(element);
    assert.doesNotMatch(text, /VERIF|LITVM|RANKED|PUBLISH/i, gameId);
    assert.match(text, /FREE PLAY · SELF-REPORTED/, gameId);
    assert.match(text, /LESTER'S ARCADE · FREE PLAY/, gameId);
    assert.match(text, /lestersarcade\.io/, gameId);
    const styles = stylesOf(element);
    assert.ok(styles.every((value) => !/#45ff8a|69, 255, 138/i.test(value)), `${gameId}: never the verified green`);
    assert.ok(styles.some((value) => /255, 61, 242/.test(value) && /solid/.test(value)), `${gameId}: the frame is magenta`);
    for (const char of text) {
      const code = char.codePointAt(0);
      assert.ok((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || [0x2013, 0x2014, 0x2022, 0x2026].includes(code), `${gameId}: unsafe glyph U+${code.toString(16)}`);
    }
  }
  assert.equal(FREE_CARD_RIBBON, 'FREE PLAY · SELF-REPORTED');
  assert.equal(FREE_CARD_ACCENT, '#ff3df2');
  assert.deepEqual(PORTRAIT_BOX, { left: 738, top: 188, size: 442 });
  assert.deepEqual(RIBBON_BOX, { left: 750, top: 142, width: 560, height: 56 });
  for (const glyph of ['skull', 'clock', 'flame', 'fork', 'bolt', 'coin', 'chart', 'arrow', 'halving']) assert.equal(GLYPHS[glyph]?.type, 'svg', glyph);
  assert.throws(() => buildFreeCardElement({}), /needs a run/);
});

test('identity, chips and tiles per game; the hero portrait only when the token names a hero', () => {
  const hmh = run('lester-blaster', HMH);
  assert.equal(identityText(hmh), 'Lit Valkyrie · Level 9');
  assert.equal(chipText(hmh), 'LIQUIDATOR LIQUIDATED');
  assert.deepEqual(tiles(hmh).map(({ glyph, label, value }) => [glyph, label, value]), [['skull', 'KILLS', '312'], ['clock', 'TIME', '12:04'], ['flame', 'COMBO', '×42']]);
  assert.equal(summaryText(hmh), '312 kills · 12:04 survived · ×42 combo');
  const noHero = run('lester-blaster', { ...HMH, hero: '', bossDefeated: false });
  assert.equal(identityText(noHero), 'Survivor · Level 9');
  assert.equal(chipText(noHero), '');
  assert.deepEqual(HERO_LABELS, { '': 'Survivor', 'lit-commando': 'Lit Commando', 'lit-valkyrie': 'Lit Valkyrie', 'lester-original': 'Lester', lilly: 'Lilly' });
  const chikun = run('chikun', CHIKUN);
  assert.equal(identityText(chikun), 'Lap 3 · Coast');
  assert.equal(chipText(chikun), 'DAILY COURSE');
  assert.deepEqual(tiles(chikun).map(({ glyph, label, value }) => [glyph, label, value]), [['fork', 'FORKS', '100'], ['bolt', 'NEAR-MISSES', '18'], ['coin', 'COINS', '41']]);
  assert.equal(summaryText(chikun), '100 forks · 18 near-misses · 41 coins');
  assert.equal(chipText(run('chikun', { ...CHIKUN, daily: false })), '');
  assert.deepEqual(Object.values(REGION_LABELS), ['Farmland', 'Forest', 'Town', 'City', 'Industrial', 'Suburbs', 'Coast']);
  const stacked = run('stacked', STACKED);
  assert.equal(identityText(stacked), '25:00 played · ×7 best combo');
  assert.equal(chipText(stacked), 'ASSISTED');
  assert.deepEqual(tiles(stacked).map(({ glyph, label, value }) => [glyph, label, value]), [['chart', 'LINES', '186'], ['arrow', 'LEVEL', '14'], ['halving', 'HALVINGS', '5']]);
  assert.equal(summaryText(stacked), '186 lines · level 14 · 5 Halvings');
  assert.equal(chipText(run('stacked', { ...STACKED, assisted: false })), '');
  // The clock rolls into hours on the card and page (the Ranked clock).
  assert.equal(identityText(run('stacked', { ...STACKED, survivalSeconds: 7200 })), '2:00:00 played · ×7 best combo');
  // Hero portrait rules on the tree.
  const portraits = (element) => { const out = []; walk(element, (node) => { if (node.type === 'img' && node.props.width === PORTRAIT_BOX.size) out.push(node); }); return out; };
  assert.equal(portraits(buildFreeCardElement({ run: hmh, heroPortrait: 'data:image/png;base64,AAAA' })).length, 1, 'a named hero with a resolved file');
  assert.equal(portraits(buildFreeCardElement({ run: hmh, heroPortrait: null })).length, 0, 'a missing file omits the portrait');
  assert.equal(portraits(buildFreeCardElement({ run: hmh, heroPortrait: 'https://cdn.example/x.png' })).length, 0, 'never a URL');
  assert.equal(portraits(buildFreeCardElement({ run: noHero, heroPortrait: 'data:image/png;base64,AAAA' })).length, 0, 'no hero id, no portrait');
  assert.equal(portraits(buildFreeCardElement({ run: chikun, heroPortrait: 'data:image/png;base64,AAAA' })).length, 0, 'other games never draw one');
  const text = textOf(buildFreeCardElement({ run: run('chikun', { ...CHIKUN, region: 'coast', laps: 2 }) }));
  assert.match(text, /Lap 3 · Coast/);
  assert.match(text, /19,475/);
  assert.match(textOf(buildFreeCardElement({ run: stacked })), /ASSISTED/);
});

test('the score steps down its ladder so it never runs into the portrait', () => {
  const cases = [['48,210', 724, 148], ['999,999', 724, 140], ['9,999,999', 724, 120], ['999,999,999', 724, 88], ['999,999,999,999', 724, 60], ['999,999,999,999', 1088, 104], ['0', 724, 148]];
  for (const [text, maxWidth, size] of cases) assert.equal(scoreFontSize(text, maxWidth), size, `${text} @ ${maxWidth}`);
});

test('the hero portraits are 384x384 PNGs under 80 KB inside the traced share-cards directory', async () => {
  const root = new URL('../apps/portal/assets/share-cards/heroes/', import.meta.url);
  const files = (await readdir(root)).sort();
  assert.deepEqual(files, [...FREE_SHARE_HEROES].sort().map((id) => `${id}.png`), 'exactly the four heroes; rerun python scripts/build-share-card-backgrounds.py');
  for (const file of files) {
    const bytes = await readFile(new URL(file, root));
    assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, file);
    assert.equal(bytes.readUInt32BE(16), 384, `${file} width`);
    assert.equal(bytes.readUInt32BE(20), 384, `${file} height`);
    assert.ok((await stat(new URL(file, root))).size < 80_000, `${file} under 80 KB`);
  }
  for (const id of FREE_SHARE_HEROES) {
    const url = freeCardApi.heroPortraitUrl(id);
    assert.match(url.href, new RegExp(`/apps/portal/assets/share-cards/heroes/${id}\\.png$`), id);
  }
  for (const hostile of ['', 'pinball', '../x', 'lester', 'toString', '__proto__', null, undefined, 0]) assert.equal(freeCardApi.heroPortraitUrl(hostile), null, String(hostile));
  assert.equal(freeCardApi.freeCardBackgroundUrl('pinball'), null);
  assert.match(freeCardApi.freeCardBackgroundUrl('chikun').href, /\/apps\/portal\/assets\/share-cards\/chikun\.png$/);
  // No directory-level asset URL for the file tracer to copy whole; nothing from cwd.
  const source = await readFile(new URL('../api/free-card.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /new URL\('[^'`]*\/', import\.meta\.url\)/);
  assert.doesNotMatch(source, /process\.cwd\(\)/);
  assert.doesNotMatch(source, /readPublicSession|ensureSchema\(deps\.db\)[^;]*;\s*const session/, 'no Neon read');
});

test('a card renders for every hero, for no hero and without a background, with no network', async () => {
  for (const hero of ['', ...FREE_SHARE_HEROES]) {
    const decoded = decodeFreeRun('hard-money-heroes', encodeFreeShareToken('lester-blaster', { ...HMH, hero, score: 999_999_999_999 }));
    const { result, attempts } = await withoutNetwork(() => freeCardApi.renderFreeCardPng(decoded.run));
    assertPng(result);
    assert.deepEqual(attempts, [], hero || '(no hero)');
  }
  const bare = decodeFreeRun('stacked', STACKED_TOKEN);
  const { result } = await withoutNetwork(() => freeCardApi.renderFreeCardPng({ ...bare.run, gameId: 'pinball' }));
  assertPng(result);
});

test('the builder script verifies the committed backgrounds, badges and portraits', (t) => {
  const script = fileURLToPath(new URL('../scripts/build-share-card-backgrounds.py', import.meta.url));
  const result = spawnSync('python', [script, '--check'], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 120_000 });
  if (result.error?.code === 'ENOENT') { t.skip('python is not on PATH'); return; }
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /share-cards\/heroes: 4 portraits/);
});

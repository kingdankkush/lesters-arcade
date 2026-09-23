import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import * as shareCardApi from '../api/share-card.mjs';
import { ipBucket } from '../server/http.mjs';
import { readPublicSession } from '../server/neon/queries.mjs';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, buildShareCardElement, cardHandle, cardText } from '../server/share/render-card.mjs';
import { createPgliteClient, seedAchievementUnlock, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';
import { fakeRequest } from './helpers/fake-http.mjs';

// Contract §7.5 and §4.3.9 (E11), A29, A30; security review S6, S13, S14.

const SESSION_VALUE = `share-card-fixture-${'c4'.repeat(16)}`;
const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: SESSION_VALUE });
const NOW = Date.parse('2026-09-23T12:00:00.000Z');
const WALLET = `0x${'5e'.repeat(20)}`;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  return shareCardApi.createHandler(() => shareCardApi.buildDeps(env, { db, nowMs: NOW }));
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

async function seedRun(db, { status = 'confirmed', profile = { displayName: 'Card Pilot' }, gameId = 'chikun' } = {}) {
  const row = await seedVerifiedSession(db, {
    gameId, status, wallet: WALLET, score: 19475,
    stats: { score: 19475, forksPassed: 52, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalSeconds: 180, regionReached: 'farmland', laps: 1, kills: 312, maxCombo: 42, lines: 186, level: 14, quadClears: 5 },
  });
  if (profile) await seedWalletProfile(db, { wallet: WALLET, ...profile });
  return { row, shareId: row.sessionId32.slice(2) };
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

test('renders a 1200x630 PNG', async () => {
  const db = createPgliteClient();
  try {
    const { row, shareId } = await seedRun(db);
    await seedAchievementUnlock(db, { wallet: WALLET, gameId: 'chikun', achievementId: 'chikun-forks-150', sessionId32: row.sessionId32, tier: 'platinum' });
    const session = await readPublicSession(db, row.sessionId32);
    const started = performance.now();
    const { result: response, attempts } = await withoutNetwork(() => call(mount(db), { url: `/api/share-card?id=${shareId}&v=${session.cardRev}`, headers: { 'x-forwarded-for': '203.0.113.9' } }));
    const elapsed = performance.now() - started;
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'image/png');
    assert.deepEqual(response.body.subarray(0, 8), PNG_SIGNATURE, 'PNG signature');
    assert.equal(response.body.subarray(12, 16).toString('latin1'), 'IHDR');
    assert.equal(response.body.readUInt32BE(16), 1200, 'IHDR width');
    assert.equal(response.body.readUInt32BE(20), 630, 'IHDR height');
    assert.equal(response.headers['content-length'], String(response.body.length));
    assert.deepEqual(attempts, [], 'no network fetch while rendering');
    assert.ok(elapsed < 20_000, `render took ${Math.round(elapsed)} ms`);
    // Renders count against card:ip:<ipBucket>.
    const bucket = `card:ip:${ipBucket('203.0.113.9', SESSION_VALUE)}`;
    const hits = await db.query('SELECT hits::int AS hits FROM rate_limits WHERE bucket = $1', [bucket]);
    assert.deepEqual(hits.map((item) => item.hits), [1]);
    // A missing v renders the current revision.
    const bare = await call(mount(db), { url: `/api/share-card?id=${shareId}` });
    assert.equal(bare.status, 200);
    assert.deepEqual(bare.body.subarray(0, 8), PNG_SIGNATURE);
  } finally {
    await db.close();
  }
});

test('confirmed cards are never immutable', async () => {
  const db = createPgliteClient();
  try {
    const { shareId } = await seedRun(db);
    const response = await call(mount(db), { url: `/api/share-card?id=${shareId}` });
    assert.equal(response.headers['cache-control'], 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    assert.doesNotMatch(response.headers['cache-control'], /immutable/);
    assert.equal(shareCardApi.CONFIRMED_CARD_CACHE.includes('immutable'), false);
  } finally {
    await db.close();
  }
});

test('unpublished runs carry no verified badge', async () => {
  const session = { gameId: 'stacked', status: 'submitted', score: 412900, displayName: 'Stack Pilot', walletShort: '0x5e5e…5e5e', standing: { weekly: null, monthly: null, allTime: null }, stats: { lines: 186, level: 14, quadClears: 5 }, achievements: [] };
  const pending = textOf(buildShareCardElement({ session }));
  assert.match(pending, /PUBLISHING TO LITVM…/);
  assert.doesNotMatch(pending, /VERIFIED/i);
  for (const status of ['signed', 'failed', 'pending', undefined]) {
    assert.doesNotMatch(textOf(buildShareCardElement({ session: { ...session, status } })), /VERIFIED/i, String(status));
  }
  const confirmed = textOf(buildShareCardElement({ session: { ...session, status: 'confirmed', standing: { weekly: 3, monthly: 4, allTime: 12 } } }));
  assert.match(confirmed, /VERIFIED ON LITVM/);
  assert.match(confirmed, /412,900/);
  assert.match(confirmed, /#3 this week · #12 all-time/);
  assert.match(confirmed, /Lines \| 186 \| Level \| 14 \| Halvings \| 5/);
  // The handler caches an unpublished card briefly only.
  const db = createPgliteClient();
  try {
    const { shareId } = await seedRun(db, { status: 'submitted' });
    const response = await call(mount(db), { url: `/api/share-card?id=${shareId}` });
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'public, max-age=0, s-maxage=30');
  } finally {
    await db.close();
  }
});

test('hidden profiles render the short wallet', async () => {
  const db = createPgliteClient();
  try {
    const { row } = await seedRun(db, { profile: { displayName: 'Secret Name', hidden: true } });
    const session = await readPublicSession(db, row.sessionId32);
    assert.equal(session.displayName, null);
    const text = textOf(buildShareCardElement({ session }));
    assert.match(text, /0x5e5e…5e5e/);
    assert.doesNotMatch(text, /Secret Name/);
    assert.equal(cardHandle({ displayName: null, walletShort: '0x5e5e…5e5e' }), '0x5e5e…5e5e');
    assert.equal(cardHandle({ displayName: 'Lit Pilot', walletShort: '0x5e5e…5e5e' }), 'Lit Pilot');
    assert.match(textOf(buildShareCardElement({ session: { ...session, displayName: null } })), /0x5e5e…5e5e/, 'blocked names arrive as null too');
  } finally {
    await db.close();
  }
});

test('a stale revision redirects instead of rendering', async () => {
  const db = createPgliteClient();
  try {
    const { row, shareId } = await seedRun(db);
    const session = await readPublicSession(db, row.sessionId32);
    for (const stale of ['000000000000', 'nope', '']) {
      const response = await call(mount(db), { url: `/api/share-card?id=${shareId}&v=${stale}`, headers: { 'x-forwarded-for': '198.51.100.7' } });
      assert.equal(response.status, 302, stale);
      assert.equal(response.headers.location, `/api/share-card/${shareId}.png?v=${session.cardRev}`);
      assert.equal(response.headers['cache-control'], 'public, s-maxage=60');
      assert.equal(response.body, null);
    }
    const counted = await db.query("SELECT count(*)::int AS n FROM rate_limits WHERE bucket LIKE 'card:ip:%'");
    assert.equal(counted[0].n, 0, 'redirects never count as renders');
    // A rename changes the revision, so the old URL redirects to the new one.
    await seedWalletProfile(db, { wallet: WALLET, displayName: 'New Name' });
    const renamed = await readPublicSession(db, row.sessionId32);
    assert.notEqual(renamed.cardRev, session.cardRev);
    const old = await call(mount(db), { url: `/api/share-card?id=${shareId}&v=${session.cardRev}` });
    assert.equal(old.status, 302);
    assert.equal(old.headers.location, `/api/share-card/${shareId}.png?v=${renamed.cardRev}`);
    // HEAD answers headers without rendering.
    const head = await call(mount(db), { method: 'HEAD', url: `/api/share-card?id=${shareId}&v=${renamed.cardRev}` });
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-type'], 'image/png');
    assert.equal(head.body, null);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM rate_limits WHERE bucket LIKE 'card:ip:%'"))[0].n, 0);
  } finally {
    await db.close();
  }
});

test('unknown parameters are rejected', async () => {
  const db = createPgliteClient();
  try {
    const { shareId } = await seedRun(db);
    const cases = [
      [`/api/share-card?id=${shareId}&v=abc&cb=1`, 400, 'invalid-query'],
      [`/api/share-card?id=${shareId}&width=2000`, 400, 'invalid-query'],
      ['/api/share-card?id=session-1', 400, 'invalid-session-id'],
      ['/api/share-card', 400, 'invalid-session-id'],
    ];
    for (const [url, status, error] of cases) {
      const response = await call(mount(db), { url });
      assert.deepEqual([response.status, response.json], [status, { ok: false, error }], url);
      assert.equal(response.headers['cache-control'], 'no-store', url);
    }
    const post = await call(mount(db), { method: 'POST', url: `/api/share-card?id=${shareId}` });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    const missing = await call(mount(db), { url: `/api/share-card?id=${'0f'.repeat(32)}` });
    assert.deepEqual([missing.status, missing.json.error, missing.headers['cache-control']], [404, 'session-not-found', 'public, s-maxage=30']);
    const offline = await call(shareCardApi.createHandler(() => shareCardApi.buildDeps(env, { db: null })), { url: `/api/share-card?id=${shareId}` });
    assert.deepEqual([offline.status, offline.json.error], [503, 'index-not-configured']);
    // The 0x form of the key is accepted too (§2.5).
    assert.equal((await call(mount(db), { method: 'HEAD', url: `/api/share-card?id=0x${shareId}` })).status, 200);
  } finally {
    await db.close();
  }
});

test('renders beyond 120 per hour per IP bucket are refused', async () => {
  const db = createPgliteClient();
  try {
    const { shareId } = await seedRun(db);
    const ip = '192.0.2.44';
    const bucket = `card:ip:${ipBucket(ip, SESSION_VALUE)}`;
    const windowStart = Math.floor(NOW / 1000 / 3600) * 3600;
    await db.query('INSERT INTO rate_limits (bucket, window_start, hits) VALUES ($1, to_timestamp($2::double precision), 120)', [bucket, String(windowStart)]);
    const response = await call(mount(db), { url: `/api/share-card?id=${shareId}`, headers: { 'x-forwarded-for': ip } });
    assert.equal(response.status, 429);
    assert.equal(response.json.error, 'rate-limited');
    assert.ok(Number(response.headers['retry-after']) > 0);
    const other = await call(mount(db), { url: `/api/share-card?id=${shareId}`, headers: { 'x-forwarded-for': '192.0.2.45' } });
    assert.equal(other.status, 200, 'another IP still renders');
  } finally {
    await db.close();
  }
});

test('the card tree follows Satori rules, draws at most four badges and only Geist-safe text', () => {
  const session = {
    gameId: 'chikun', status: 'confirmed', score: 1234567, displayName: 'Lit 🔥 Pilot​', walletShort: '0x5e5e…5e5e',
    standing: { weekly: 3, monthly: null, allTime: 12 }, stats: { forksPassed: 52, nearMisses: 18, coinsCollected: 41 },
    achievements: ['chikun-forks-150', 'chikun-first-flight', 'a', 'b', 'c', 'd'].map((id) => ({ id, tier: 'gold' })),
  };
  const element = buildShareCardElement({ session, background: 'data:image/png;base64,AAAA', badgeImages: { 'chikun-forks-150': 'data:image/png;base64,AAAA', 'chikun-first-flight': 'https://cdn.example/x.png' } });
  assert.equal(element.props.style.width, SHARE_CARD_WIDTH);
  assert.equal(element.props.style.height, SHARE_CARD_HEIGHT);
  const images = [];
  walk(element, (node) => {
    const children = node.props?.children;
    if (Array.isArray(children) && children.length > 1) assert.equal(node.props.style?.display, 'flex', 'every multi-child node is flex');
    if (node.type === 'img') images.push(node.props.src);
  });
  assert.ok(images.every((src) => src.startsWith('data:image/')), 'images are data URIs only (no fetch)');
  assert.equal(images.length, 2, 'the background and the one badge with a data URI');
  const badgeRings = [];
  walk(element, (node) => { if (node.props?.style?.borderRadius === 36) badgeRings.push(node); });
  assert.equal(badgeRings.length, 4, 'at most four badges');
  const text = textOf(element);
  assert.match(text, /Lit Pilot/);
  for (const char of text) {
    const code = char.codePointAt(0);
    assert.ok((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || [0x2013, 0x2014, 0x2022, 0x2026].includes(code), `unsafe glyph U+${code.toString(16)}`);
  }
  assert.equal(cardText('🐔 Chikun\u0000'), 'Chikun');
  assert.throws(() => buildShareCardElement({}), /needs a session/);
});

test('the committed backgrounds are 1200x630 PNGs under 300 KB and the builder script is registered', async () => {
  for (const gameId of ['lester-blaster', 'chikun', 'stacked']) {
    const path = new URL(`../apps/portal/assets/share-cards/${gameId}.png`, import.meta.url);
    const bytes = await readFile(path);
    assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, gameId);
    assert.equal(bytes.readUInt32BE(16), 1200, gameId);
    assert.equal(bytes.readUInt32BE(20), 630, gameId);
    assert.ok((await stat(path)).size < 300_000, `${gameId} under 300 KB`);
  }
  const check = await readFile(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(check, /'scripts\/build-chikun-ground-props\.py',\n\s*'scripts\/build-share-card-backgrounds\.py',/);
});

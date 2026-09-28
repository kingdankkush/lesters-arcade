import assert from 'node:assert/strict';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';

import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import * as avatarApi from '../api/avatar.mjs';
import * as leaderboardApi from '../api/leaderboard.mjs';
import * as profileApi from '../api/profile.mjs';
import * as sessionApi from '../api/verified-session.mjs';
import * as sharePageApi from '../api/share-page.mjs';
import { AVATAR_MIGRATION_NAME, AVATAR_MIGRATION_VERSION, LATEST_SCHEMA_VERSION, MIGRATIONS } from '../server/neon/migrations.mjs';
import { readLeaderboard } from '../server/neon/queries.mjs';
import { AVATAR_MAX_BYTES, decodeAvatarBase64, sniffAvatarImage, validateAvatarUpload } from '../server/profile/avatar-image.mjs';
import { runModerateProfile } from '../scripts/moderate-profile.mjs';
import { createPgliteClient, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';
import { fakeRequest } from './helpers/fake-http.mjs';

/**
 * 1.9.3 custom avatars: api/avatar.mjs (PUT/DELETE with the wallet session,
 * public GET of the bytes), migration 4 (avatar_uploads), the avatarUrl every
 * read path adds, and the owner's hide switch. The handlers are mounted
 * against an UNMIGRATED PGlite, so a missing ensureSchema call fails here.
 */

const SESSION_VALUE = `session-fixture-${'a7'.repeat(16)}`;
const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: SESSION_VALUE });
const DEPLOYMENT = Object.freeze({ status: 'unavailable', chainId: 4441, startBlock: null, addresses: Object.freeze({}) });
const ALICE = `0x${'a1'.repeat(20)}`;
const BOB = `0x${'b2'.repeat(20)}`;

// --- image fixtures (headers are what the server reads; PNGs are fully valid) ---

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

export function pngBytes(width, height, { animated = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = Buffer.alloc((width * 3 + 1) * height, 0x40);
  for (let y = 0; y < height; y += 1) rows[y * (width * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...(animated ? [pngChunk('acTL', Buffer.from([0, 0, 0, 2, 0, 0, 0, 0]))] : []),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function riff(chunk, payload) {
  const body = Buffer.concat([Buffer.from(chunk, 'latin1'), Buffer.alloc(4), payload]);
  body.writeUInt32LE(payload.length, 4);
  const head = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1')]);
  head.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([head, body]);
}

function webpLossless(width, height) {
  const payload = Buffer.alloc(40);
  payload[0] = 0x2f;
  payload.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 1);
  return riff('VP8L', payload);
}

function webpLossy(width, height) {
  const payload = Buffer.alloc(40);
  payload.set([0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a], 0);
  payload.writeUInt16LE(width, 6);
  payload.writeUInt16LE(height, 8);
  return riff('VP8 ', payload);
}

function webpExtended(width, height, { animated = false } = {}) {
  const payload = Buffer.alloc(40);
  payload[0] = animated ? 0x02 : 0x00;
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return riff('VP8X', payload);
}

function jpegBytes(width, height) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// --- harness ---

function bearer(wallet) {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SESSION_VALUE, wallet, nowMs: NOW, audience: 'lestersarcade:development' });
  return `Bearer ${token}`;
}

function mount(api, { db, envOverride = env, nowMs = NOW } = {}) {
  const overrides = { deployment: DEPLOYMENT, nowMs };
  if (db !== undefined) overrides.db = db;
  return api.createHandler(() => api.buildDeps(envOverride, overrides));
}

// Like helpers/fake-http invoke, but keeps a binary body as a Buffer.
async function call(handler, request = {}) {
  const headers = {};
  let chunk;
  const res = {
    statusCode: 0,
    setHeader(key, value) { headers[String(key).toLowerCase()] = String(value); },
    getHeader(key) { return headers[String(key).toLowerCase()]; },
    end(value) { chunk = value; },
  };
  await handler(fakeRequest(request), res);
  const isJson = String(headers['content-type'] ?? '').startsWith('application/json');
  return {
    status: res.statusCode,
    headers,
    raw: chunk === undefined ? null : Buffer.from(chunk),
    body: isJson && chunk !== undefined ? JSON.parse(String(chunk)) : null,
  };
}

const put = (handler, wallet, body) => call(handler, { method: 'PUT', url: '/api/avatar', headers: wallet ? { authorization: bearer(wallet), 'content-type': 'application/json' } : {}, body });

async function withFreshDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

// --- the image checks ---

test('the image check sniffs WebP, PNG and JPEG by magic bytes and reads their size', () => {
  assert.deepEqual(sniffAvatarImage(pngBytes(256, 256)), { contentType: 'image/png', width: 256, height: 256, animated: false });
  assert.deepEqual(sniffAvatarImage(webpLossless(256, 250)), { contentType: 'image/webp', width: 256, height: 250, animated: false });
  assert.deepEqual(sniffAvatarImage(webpLossy(128, 128)), { contentType: 'image/webp', width: 128, height: 128, animated: false });
  assert.deepEqual(sniffAvatarImage(webpExtended(300, 300)), { contentType: 'image/webp', width: 300, height: 300, animated: false });
  assert.deepEqual(sniffAvatarImage(jpegBytes(200, 190)), { contentType: 'image/jpeg', width: 200, height: 190, animated: false });
  assert.equal(sniffAvatarImage(webpExtended(256, 256, { animated: true })).animated, true);
  assert.equal(sniffAvatarImage(pngBytes(256, 256, { animated: true })).animated, true);
  for (const bytes of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    Buffer.from('<!doctype html><script>alert(1)</script>'),
    Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1'),
    Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    Buffer.alloc(64),
  ]) assert.equal(sniffAvatarImage(bytes), null, bytes.subarray(0, 8).toString('latin1'));
});

test('uploads are strict base64, at most 96 KB, a known format, 64-512 px, square-ish and still', () => {
  const ok = validateAvatarUpload(b64(pngBytes(256, 256)));
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.contentType, ok.width, ok.height, ok.sha256], ['image/png', 256, 256, sha(pngBytes(256, 256))]);
  assert.equal(validateAvatarUpload(b64(jpegBytes(512, 480))).ok, true, 'JPEG is accepted');
  for (const [input, status, error] of [
    ['', 400, 'invalid-image'],
    [`data:image/png;base64,${b64(pngBytes(256, 256))}`, 400, 'invalid-image'],
    [`${b64(pngBytes(256, 256))}\n`, 400, 'invalid-image'],
    ['QUJD=', 400, 'invalid-image'],
    [b64(Buffer.alloc(AVATAR_MAX_BYTES + 1, 1)), 413, 'image-too-large'],
    [b64(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), 415, 'unsupported-image-type'],
    [b64(webpExtended(256, 256, { animated: true })), 415, 'animated-image'],
    [b64(pngBytes(64, 64, { animated: true })), 415, 'animated-image'],
    [b64(pngBytes(63, 63)), 422, 'invalid-image-dimensions'],
    [b64(webpLossless(513, 513)), 422, 'invalid-image-dimensions'],
    [b64(webpLossless(256, 128)), 422, 'invalid-image-dimensions'],
    [b64(jpegBytes(300, 200)), 422, 'invalid-image-dimensions'],
  ]) {
    const result = validateAvatarUpload(input);
    assert.deepEqual([result.ok, result.status, result.error], [false, status, error], `${String(input).slice(0, 24)} → ${error}`);
  }
  assert.deepEqual(decodeAvatarBase64('QUJD'), Buffer.from('ABC'));
});

test('migration 4 adds avatar_uploads and nothing else', () => {
  assert.equal(AVATAR_MIGRATION_VERSION, 4);
  assert.equal(LATEST_SCHEMA_VERSION, 4);
  assert.equal(AVATAR_MIGRATION_NAME, '0004_avatar_uploads');
  const migration = MIGRATIONS.find((entry) => entry.version === 4);
  assert.equal(migration.statements.length, 1);
  assert.match(migration.statements[0], /^CREATE TABLE IF NOT EXISTS avatar_uploads \(/);
  assert.match(migration.statements[0], /hidden\s+BOOLEAN NOT NULL DEFAULT false/);
});

test('the avatar table rejects bad rows on its own', async () => withFreshDb(async (db) => {
  await seedWalletProfile(db, { wallet: ALICE });
  const insert = (wallet, contentType, width, bytes) => db.query(
    "INSERT INTO avatar_uploads (wallet, sha256, content_type, width, height, image) VALUES ($1, $2, $3, $4::int, $4::int, decode($5, 'base64'))",
    [wallet, 'ab'.repeat(32), contentType, String(width), b64(bytes)],
  );
  await insert(ALICE, 'image/png', 256, pngBytes(256, 256));
  for (const args of [
    [ALICE.toUpperCase().replace('0X', '0x'), 'image/png', 256, pngBytes(8, 8)],
    [BOB, 'image/svg+xml', 256, pngBytes(8, 8)],
    [BOB, 'image/png', 1024, pngBytes(8, 8)],
    [BOB, 'image/png', 256, Buffer.alloc(98305, 1)],
  ]) await assert.rejects(insert(...args), undefined, String(args[1]));
}));

// --- the endpoint ---

test('PUT needs the wallet session and stores the checked image for that wallet', async () => withFreshDb(async (db) => {
  const handler = mount(avatarApi, { db });
  const image = pngBytes(256, 256);
  const anonymous = await put(handler, null, { image: b64(image) });
  assert.deepEqual([anonymous.status, anonymous.body], [401, { ok: false, error: 'invalid-session' }]);
  const forged = await call(handler, { method: 'PUT', url: '/api/avatar', headers: { authorization: 'Bearer not-a-token' }, body: { image: b64(image) } });
  assert.equal(forged.status, 401);
  const noSecret = await call(mount(avatarApi, { db, envOverride: { VERCEL_ENV: 'development' } }), { method: 'PUT', url: '/api/avatar', headers: { authorization: bearer(ALICE) }, body: { image: b64(image) } });
  assert.deepEqual([noSecret.status, noSecret.body.error], [503, 'session-not-configured']);

  const saved = await put(handler, ALICE, { image: b64(image) });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const v = sha(image).slice(0, 12);
  assert.deepEqual(saved.body, { ok: true, wallet: ALICE, avatarUrl: `/api/avatar?wallet=${ALICE}&v=${v}`, contentType: 'image/png', width: 256, height: 256 });
  assert.equal(saved.headers['cache-control'], 'no-store');
  const [row] = await db.query("SELECT wallet, sha256, content_type, width, height, hidden, encode(image, 'base64') AS image FROM avatar_uploads");
  // Postgres wraps base64 every 76 characters.
  assert.deepEqual({ ...row, image: row.image.replace(/\s+/g, '') }, { wallet: ALICE, sha256: sha(image), content_type: 'image/png', width: 256, height: 256, hidden: false, image: b64(image) });

  // A wallet in the body is ignored: extra keys are refused outright.
  const smuggled = await put(handler, BOB, { image: b64(image), wallet: ALICE });
  assert.deepEqual([smuggled.status, smuggled.body.error], [400, 'invalid-body']);
  for (const body of [null, [], { image: 42 }, { picture: b64(image) }]) {
    const response = await put(handler, BOB, body);
    assert.deepEqual([response.status, response.body.error], [400, 'invalid-body'], JSON.stringify(body));
  }
  const svg = await put(handler, BOB, { image: b64(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')) });
  assert.deepEqual([svg.status, svg.body.error], [415, 'unsupported-image-type']);
  const small = await put(handler, BOB, { image: b64(pngBytes(32, 32)) });
  assert.deepEqual([small.status, small.body.error], [422, 'invalid-image-dimensions']);
  const huge = await put(handler, BOB, { image: 'A'.repeat(avatarApi.AVATAR_PUT_MAX_BYTES + 10) });
  assert.deepEqual([huge.status, huge.body.error], [413, 'body-too-large'], 'the body cap stops an oversized request before parsing');
  const big = await put(handler, BOB, { image: b64(Buffer.alloc(AVATAR_MAX_BYTES + 3, 7)) });
  assert.deepEqual([big.status, big.body.error], [413, 'image-too-large']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM avatar_uploads'))[0].n, 1, 'no refused upload was stored');

  const other = await call(handler, { method: 'POST', url: '/api/avatar', headers: { authorization: bearer(ALICE) } });
  assert.deepEqual([other.status, other.headers.allow], [405, 'GET, HEAD, PUT, DELETE']);
  const query = await call(handler, { method: 'PUT', url: `/api/avatar?wallet=${ALICE}`, headers: { authorization: bearer(ALICE) }, body: { image: b64(image) } });
  assert.deepEqual([query.status, query.body.error], [400, 'invalid-query']);
}));

test('GET serves the bytes with an immutable cache, nosniff and no X-Robots-Tag', async () => withFreshDb(async (db) => {
  const handler = mount(avatarApi, { db });
  const image = webpLossless(256, 256);
  assert.equal((await put(handler, ALICE, { image: b64(image) })).status, 200);
  const v = sha(image).slice(0, 12);
  const got = await call(handler, { url: `/api/avatar?wallet=${ALICE.toUpperCase().replace('0X', '0x')}&v=${v}` });
  assert.equal(got.status, 200);
  assert.ok(got.raw.equals(image), 'the stored bytes come back unchanged');
  assert.equal(got.headers['content-type'], 'image/webp');
  assert.equal(got.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(got.headers['x-content-type-options'], 'nosniff');
  assert.equal(got.headers['content-length'], String(image.length));
  assert.equal(got.headers['x-robots-tag'], undefined, 'X skips card images marked noindex');
  const head = await call(handler, { method: 'HEAD', url: `/api/avatar?wallet=${ALICE}&v=${v}` });
  assert.deepEqual([head.status, head.raw, head.headers['content-type'], head.headers['content-length']], [200, null, 'image/webp', String(image.length)]);

  const stale = await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=000000000000` });
  assert.deepEqual([stale.status, stale.body.error, stale.headers['cache-control']], [404, 'avatar-not-found', 'public, max-age=60, s-maxage=60'], 'an old version is gone, briefly cached');
  const none = await call(handler, { url: `/api/avatar?wallet=${BOB}&v=${v}` });
  assert.equal(none.status, 404);
  for (const [url, error] of [
    [`/api/avatar?wallet=0x12&v=${v}`, 'invalid-wallet'],
    [`/api/avatar?wallet=${ALICE}`, 'invalid-version'],
    [`/api/avatar?wallet=${ALICE}&v=${v.toUpperCase()}`, 'invalid-version'],
    [`/api/avatar?wallet=${ALICE}&v=${v}&cb=1`, 'invalid-query'],
  ]) {
    const response = await call(handler, { url });
    assert.deepEqual([response.status, response.body.error, response.headers['cache-control']], [400, error, 'no-store'], url);
  }
  const noDb = await call(mount(avatarApi, { db: null }), { url: `/api/avatar?wallet=${ALICE}&v=${v}` });
  assert.deepEqual([noDb.status, noDb.body.error], [503, 'index-not-configured']);
}));

test('DELETE removes the upload; a replaced image gets a new URL', async () => withFreshDb(async (db) => {
  const handler = mount(avatarApi, { db });
  const first = pngBytes(256, 256);
  const second = jpegBytes(256, 256);
  await put(handler, ALICE, { image: b64(first) });
  const replaced = await put(handler, ALICE, { image: b64(second) });
  assert.equal(replaced.body.avatarUrl, `/api/avatar?wallet=${ALICE}&v=${sha(second).slice(0, 12)}`);
  assert.equal((await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=${sha(first).slice(0, 12)}` })).status, 404, 'the old URL no longer serves');
  const anonymous = await call(handler, { method: 'DELETE', url: '/api/avatar' });
  assert.equal(anonymous.status, 401);
  const removed = await call(handler, { method: 'DELETE', url: '/api/avatar', headers: { authorization: bearer(ALICE) } });
  assert.deepEqual([removed.status, removed.body], [200, { ok: true, wallet: ALICE, removed: true }]);
  const again = await call(handler, { method: 'DELETE', url: '/api/avatar', headers: { authorization: bearer(ALICE) } });
  assert.deepEqual(again.body, { ok: true, wallet: ALICE, removed: false });
  assert.equal((await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=${sha(second).slice(0, 12)}` })).status, 404);
}));

test('writes are limited to 10 per wallet per hour', async () => withFreshDb(async (db) => {
  const handler = mount(avatarApi, { db });
  const image = b64(pngBytes(128, 128));
  for (let i = 0; i < avatarApi.AVATAR_WRITE_LIMITS.wallet; i += 1) {
    const response = i % 2 ? await call(handler, { method: 'DELETE', url: '/api/avatar', headers: { authorization: bearer(ALICE) } }) : await put(handler, ALICE, { image });
    assert.equal(response.status, 200, `write ${i + 1}`);
  }
  const limited = await put(handler, ALICE, { image });
  assert.deepEqual([limited.status, limited.body.error, limited.headers['retry-after']], [429, 'rate-limited', String(3600 - (Math.floor(NOW / 1000) % 3600))]);
  assert.equal((await put(handler, BOB, { image })).status, 200, 'another wallet has its own bucket');
  const nextHour = mount(avatarApi, { db, nowMs: NOW + 3600_000 });
  assert.equal((await put(nextHour, ALICE, { image })).status, 200, 'the window resets');
}));

test('a hidden upload is never served, returned, replaced or deleted', async () => withFreshDb(async (db) => {
  const handler = mount(avatarApi, { db });
  const image = pngBytes(256, 256);
  const v = sha(image).slice(0, 12);
  await put(handler, ALICE, { image: b64(image) });
  await seedVerifiedSession(db, { wallet: ALICE, score: 500 });

  // Dry run, then the owner's switch.
  const lines = [];
  assert.deepEqual(await runModerateProfile({ argv: ['--wallet', ALICE, '--hide-avatar'], db, out: (line) => lines.push(line) }), { exitCode: 0, changed: false });
  assert.match(lines.join('\n'), /dry run: would set avatar hidden = true\. Re-run with --apply --confirm HIDE_AVATAR/);
  assert.equal((await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=${v}` })).status, 200, 'a dry run hides nothing');
  const applied = [];
  assert.deepEqual(await runModerateProfile({ argv: ['--wallet', ALICE, '--hide-avatar', '--apply', '--confirm', 'HIDE_AVATAR'], db, out: (line) => applied.push(line) }), { exitCode: 0, changed: true });
  assert.match(applied.join('\n'), /applied: avatar hidden = true/);
  assert.match(applied.join('\n'), /purge/);

  assert.equal((await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=${v}` })).status, 404);
  const board = await readLeaderboard(db, { gameId: 'chikun', seasonId: 'chikun-season-preview-1', period: 'all-time' });
  assert.equal(Object.hasOwn(board.rows[0], 'avatarUrl'), false);
  const replace = await put(handler, ALICE, { image: b64(pngBytes(128, 128)) });
  assert.deepEqual([replace.status, replace.body.error], [403, 'avatar-hidden']);
  const remove = await call(handler, { method: 'DELETE', url: '/api/avatar', headers: { authorization: bearer(ALICE) } });
  assert.deepEqual([remove.status, remove.body.error], [403, 'avatar-hidden']);
  const [row] = await db.query('SELECT sha256, hidden FROM avatar_uploads WHERE wallet = $1', [ALICE]);
  assert.deepEqual(row, { sha256: sha(image), hidden: true }, 'the hidden image is kept as it was');

  const self = await call(mount(profileApi, { db }), { url: `/api/profile?wallet=${ALICE}&self=1`, headers: { authorization: bearer(ALICE) } });
  assert.equal(self.body.profile.customAvatarHidden, true, 'the owner sees why');
  assert.equal(Object.hasOwn(self.body.profile, 'avatarUrl'), false);
  const publicView = await call(mount(profileApi, { db }), { url: `/api/profile?wallet=${ALICE}` });
  assert.equal(Object.hasOwn(publicView.body.profile, 'customAvatarHidden'), false, 'never public');

  assert.deepEqual(await runModerateProfile({ argv: ['--wallet', ALICE, '--unhide-avatar', '--apply', '--confirm', 'UNHIDE_AVATAR'], db, out: () => {} }), { exitCode: 0, changed: true });
  assert.equal((await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=${v}` })).status, 200);
  const nothing = [];
  assert.deepEqual(await runModerateProfile({ argv: ['--wallet', BOB, '--hide-avatar', '--apply', '--confirm', 'HIDE_AVATAR'], db, out: (line) => nothing.push(line) }), { exitCode: 0, changed: false });
  assert.match(nothing.join('\n'), /no custom avatar uploaded/);

  // The whole-profile switch hides the upload too.
  await seedWalletProfile(db, { wallet: ALICE, hidden: true });
  assert.equal((await call(handler, { url: `/api/avatar?wallet=${ALICE}&v=${v}` })).status, 404);
}));

// --- every read path ---

test('boards, profiles, sessions and the share page return the upload first', async () => withFreshDb(async (db) => {
  const image = pngBytes(256, 256);
  const avatarUrl = `/api/avatar?wallet=${ALICE}&v=${sha(image).slice(0, 12)}`;
  const session = await seedVerifiedSession(db, { wallet: ALICE, gameId: 'chikun', score: 900 });
  await seedVerifiedSession(db, { wallet: BOB, gameId: 'chikun', score: 100 });
  await seedWalletProfile(db, { wallet: ALICE, displayName: 'Pic Pilot', avatarUri: 'lestersarcade:avatar/lilly' });
  await seedWalletProfile(db, { wallet: BOB, displayName: 'Plain Pilot', avatarUri: 'lestersarcade:avatar/lester' });

  const readAll = async () => {
    const board = await call(mount(leaderboardApi, { db }), { url: '/api/leaderboard?game=chikun&period=all-time' });
    const profile = await call(mount(profileApi, { db }), { url: `/api/profile?wallet=${ALICE}` });
    const self = await call(mount(profileApi, { db }), { url: `/api/profile?wallet=${ALICE}&self=1`, headers: { authorization: bearer(ALICE) } });
    const run = await call(mount(sessionApi, { db }), { url: `/api/verified-session?id=${session.sessionId32}` });
    const page = await call(mount(sharePageApi, { db }), { url: `/api/share-page?id=${session.sessionId32.slice(2)}` });
    return { board, profile, self, run, page };
  };

  const before = await readAll();
  assert.equal(Object.hasOwn(before.board.body.rows[0], 'avatarUrl'), false, 'no upload: the row shape is unchanged');
  assert.equal(Object.hasOwn(before.profile.body.profile, 'avatarUrl'), false);
  assert.equal(Object.hasOwn(before.run.body.session, 'avatarUrl'), false);
  assert.match(before.page.raw.toString(), /<p class="who"><img src="\/assets\/generated\/arcade-avatars\/lilly\.webp"/);

  assert.equal((await put(mount(avatarApi, { db }), ALICE, { image: b64(image) })).status, 200);
  const after = await readAll();
  const [alice, bob] = after.board.body.rows;
  assert.deepEqual([alice.wallet, alice.avatarUri, alice.avatarUrl], [ALICE, 'lestersarcade:avatar/lilly', avatarUrl], 'the on-chain preset stays; the upload is added');
  assert.equal(Object.hasOwn(bob, 'avatarUrl'), false);
  assert.equal(after.profile.body.profile.avatarUrl, avatarUrl);
  assert.equal(after.self.body.profile.avatarUrl, avatarUrl);
  assert.equal(after.run.body.session.avatarUrl, avatarUrl);
  assert.equal(after.run.body.session.cardRev, before.run.body.session.cardRev, 'the card shows no avatar, so its revision is unchanged');
  assert.ok(after.page.raw.toString().includes(`<p class="who"><img src="${avatarUrl.replace('&', '&amp;')}" alt="" width="44" height="44">Pic Pilot</p>`), 'the share page shows the upload');

  // A hidden profile shows none of it.
  await seedWalletProfile(db, { wallet: ALICE, displayName: 'Pic Pilot', hidden: true });
  const hidden = await readAll();
  assert.equal(Object.hasOwn(hidden.board.body.rows[0], 'avatarUrl'), false);
  assert.equal(Object.hasOwn(hidden.profile.body.profile, 'avatarUrl'), false);
  assert.equal(Object.hasOwn(hidden.run.body.session, 'avatarUrl'), false);
  assert.equal(hidden.page.raw.toString().includes('/api/avatar'), false);
}));

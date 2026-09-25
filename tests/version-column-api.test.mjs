// The version column on the server (version-column brief, acceptance 3): E5
// leaderboard rows, E6 recent sessions (public and self views) and E9
// session reads carry `versionLabel`, derived from the stored build_hash and
// runtime_id (no migration: both columns exist since migration 1). The raw
// build hash is never returned, runtimeId stays only where it was already
// public (E9), and every cache header is unchanged.
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test from 'node:test';

import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { versionLabelFor } from '../apps/portal/src/game-version-labels.mjs';
import { MIGRATIONS, migrate } from '../server/neon/migrations.mjs';
import { readLeaderboard, readPublicProfile, readPublicSession } from '../server/neon/queries.mjs';
import { INDEX_GAMES, leaderboardRow, recentSessionRow, rowVersionLabel } from '../server/neon/rows.mjs';
import * as leaderboardApi from '../api/leaderboard.mjs';
import * as profileApi from '../api/profile.mjs';
import * as sessionApi from '../api/verified-session.mjs';
import * as sharePageApi from '../api/share-page.mjs';
import { renderSharePage } from '../server/share/render-page.mjs';
import { createPgliteClient, seedVerifiedSession } from './helpers/pglite-client.mjs';
import { fakeRequest, fakeResponse, invoke } from './helpers/fake-http.mjs';

const SESSION_VALUE = `session-fixture-${'c7'.repeat(16)}`;
const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: SESSION_VALUE });
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 1,
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55',
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});
const W = (n) => `0x${String(n).padStart(2, '0').repeat(20)}`;
const ME = W(1);

// One HMH row per build era, one Chikun row per runtime, one STACKED row.
const HMH_ROWS = Object.freeze([
  { wallet: W(1), score: 9000, buildHash: 'site-1.8.1:game-1.8.1', label: 'HMH v0.5' },
  { wallet: W(2), score: 8000, buildHash: 'site-1.8.2:game-1.8.2:cabinet-0.5.0', label: 'HMH v0.5' },
  { wallet: W(3), score: 7000, buildHash: 'site-1.9.0:game-1.9.0:cabinet-0.6.0', label: 'HMH v0.6' },
  { wallet: W(4), score: 6000, buildHash: null, source: 'chain-index', label: 'HMH v?' },
]);
const CHIKUN_ROWS = Object.freeze([
  { wallet: W(1), score: 5000, runtimeId: 'chikun:canvas-runtime-v7', label: 'Chikun v7' },
  { wallet: W(5), score: 4000, runtimeId: 'chikun:canvas-runtime-v6', label: 'Chikun v6' },
]);
const STACKED_ROWS = Object.freeze([
  { wallet: W(1), score: 3000, buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.2.0', label: 'STACKED v0.2' },
  { wallet: W(6), score: 2000, buildHash: 'site-1.9.0:game-1.9.0:cabinet-0.3.0', label: 'STACKED v0.3' },
]);

async function seedEras(db) {
  const seeded = [];
  let minute = 0;
  const at = () => new Date(Date.parse('2026-09-24T10:00:00.000Z') + (minute += 1) * 60_000).toISOString();
  for (const row of HMH_ROWS) {
    // A chain-index row has no handle, build hash or seed (contract §4.3.10).
    const indexed = row.source === 'chain-index' ? { source: 'chain-index', sessionHandle: null, seed: null } : {};
    seeded.push({ ...row, gameId: 'lester-blaster', ...(await seedVerifiedSession(db, { gameId: 'lester-blaster', wallet: row.wallet, score: row.score, buildHash: row.buildHash, openedAt: at(), ...indexed })) });
  }
  for (const row of CHIKUN_ROWS) {
    seeded.push({ ...row, gameId: 'chikun', ...(await seedVerifiedSession(db, { gameId: 'chikun', wallet: row.wallet, score: row.score, runtimeId: row.runtimeId, openedAt: at() })) });
  }
  for (const row of STACKED_ROWS) {
    seeded.push({ ...row, gameId: 'stacked', ...(await seedVerifiedSession(db, { gameId: 'stacked', wallet: row.wallet, score: row.score, buildHash: row.buildHash, openedAt: at() })) });
  }
  return seeded;
}

async function withDb(run, { migrated = true } = {}) {
  const db = createPgliteClient();
  try {
    if (migrated) await migrate(db);
    await run(db);
  } finally {
    await db.close();
  }
}

function mount(api, db) {
  return api.createHandler(() => api.buildDeps(env, { db, deployment: DEPLOYED, nowMs: NOW }));
}

function bearer(wallet) {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SESSION_VALUE, wallet, nowMs: NOW, audience: 'lestersarcade:development' });
  return `Bearer ${token}`;
}

// No public body carries a raw build hash, under any spelling.
function assertNoBuildHash(body, label) {
  const text = JSON.stringify(body);
  for (const secret of ['build_hash', 'buildHash', 'site-1.', ':cabinet-']) assert.equal(text.includes(secret), false, `${label}: ${secret}`);
}

test('no migration is needed: build_hash and runtime_id are migration-1 columns', () => {
  const first = MIGRATIONS.find((migration) => migration.version === 1);
  const table = first.statements.find((statement) => /CREATE TABLE IF NOT EXISTS verified_sessions/.test(statement));
  assert.match(table, /\bruntime_id\s+TEXT NOT NULL/);
  assert.match(table, /\bbuild_hash\s+TEXT NULL/);
  assert.equal(MIGRATIONS.some((migration) => migration.statements.some((statement) => /version_label/i.test(statement))), false, 'the label is derived, never stored');
});

test('the row mappers label every game from the stored build hash and runtime id', () => {
  const base = { rank: 1, wallet: ME, score: '10', stats: '{}', session_id32: `0x${'ab'.repeat(32)}`, tx_hash: null, confirmed_at: null };
  for (const row of [...HMH_ROWS.map((entry) => ({ ...entry, gameId: 'lester-blaster' })), ...CHIKUN_ROWS.map((entry) => ({ ...entry, gameId: 'chikun' })), ...STACKED_ROWS.map((entry) => ({ ...entry, gameId: 'stacked' }))]) {
    const stored = { ...base, game_id: row.gameId, build_hash: row.buildHash ?? null, runtime_id: row.runtimeId ?? INDEX_GAMES[row.gameId].runtimeId };
    assert.equal(rowVersionLabel(row.gameId, stored), row.label);
    assert.equal(leaderboardRow(row.gameId, stored).versionLabel, row.label);
    assert.equal(recentSessionRow(stored).versionLabel, row.label);
    assert.equal(recentSessionRow(stored, { self: true }).versionLabel, row.label);
    assert.equal(rowVersionLabel(row.gameId, stored), versionLabelFor(row.gameId, { buildHash: stored.build_hash, runtimeId: stored.runtime_id }), 'one shared module');
  }
  assert.equal(rowVersionLabel('chikun', {}), 'Chikun v?');
  assert.equal(rowVersionLabel('lester-blaster', null), 'HMH v?');
});

test('E5 rows carry the label of the run that ranks, never the raw build hash', async () => withDb(async (db) => {
  await seedEras(db);
  for (const [gameId, rows] of [['lester-blaster', HMH_ROWS], ['chikun', CHIKUN_ROWS], ['stacked', STACKED_ROWS]]) {
    const board = await readLeaderboard(db, { gameId, seasonId: INDEX_GAMES[gameId].seasonId, period: 'all-time' });
    assert.deepEqual(board.rows.map((row) => [row.wallet, row.versionLabel]), rows.map((row) => [row.wallet, row.label]), gameId);
    for (const row of board.rows) {
      assert.equal('buildHash' in row || 'runtimeId' in row || 'build_hash' in row, false, 'only the label is public in E5');
    }
    assertNoBuildHash(board, gameId);
  }
  // The label follows the wallet's best run: a better run on a newer build relabels the row.
  await seedVerifiedSession(db, { gameId: 'lester-blaster', wallet: W(1), score: 9500, buildHash: 'site-1.9.0:game-1.9.0:cabinet-0.6.0' });
  const board = await readLeaderboard(db, { gameId: 'lester-blaster', seasonId: INDEX_GAMES['lester-blaster'].seasonId, period: 'all-time' });
  assert.deepEqual([board.rows[0].wallet, board.rows[0].score, board.rows[0].versionLabel], [W(1), 9500, 'HMH v0.6']);
}));

test('E6 recent sessions carry a label per run in the public and self views', async () => withDb(async (db) => {
  await seedEras(db);
  await seedVerifiedSession(db, { gameId: 'lester-blaster', wallet: ME, score: 10, status: 'failed', buildHash: 'site-1.8.2:game-1.8.2:cabinet-0.5.0', nextAttemptAt: '2026-09-25T13:00:00.000Z', lastError: 'rpc-timeout' });
  const expected = new Map([
    ['lester-blaster', 'HMH v0.5'], ['chikun', 'Chikun v7'], ['stacked', 'STACKED v0.2'],
  ]);
  const publicView = await readPublicProfile(db, ME, { nowMs: NOW, catalog: null });
  assert.equal(publicView.recentSessions.length, 3, 'confirmed runs only');
  for (const session of publicView.recentSessions) {
    assert.equal(session.versionLabel, expected.get(session.gameId), session.gameId);
    assert.equal('runtimeId' in session || 'buildHash' in session, false, 'runtimeId and buildHash were never public in E6');
  }
  assertNoBuildHash(publicView, 'E6 public');
  const selfView = await readPublicProfile(db, ME, { self: true, nowMs: NOW, catalog: null });
  assert.equal(selfView.recentSessions.length, 4);
  const failed = selfView.recentSessions.find((session) => session.status === 'failed');
  assert.deepEqual([failed.versionLabel, failed.retryable, failed.lastError], ['HMH v0.5', true, 'rpc-timeout'], 'unpublished runs are labelled too');
  assertNoBuildHash(selfView, 'E6 self');
}));

test('E9 carries the label beside the already public runtimeId', async () => withDb(async (db) => {
  const seeded = await seedEras(db);
  for (const row of seeded) {
    const session = await readPublicSession(db, row.sessionId32, { catalog: null });
    assert.equal(session.versionLabel, row.label, `${row.gameId} ${row.buildHash ?? row.runtimeId ?? 'chain-index'}`);
    assert.equal(session.runtimeId, row.runtimeId ?? INDEX_GAMES[row.gameId].runtimeId);
    assert.equal('buildHash' in session, false);
    assertNoBuildHash(session, 'E9');
  }
  const indexed = seeded.find((row) => row.source === 'chain-index');
  assert.equal((await readPublicSession(db, indexed.sessionId32, { catalog: null })).verification, 'chain-index');
}));

test('E5, E6 and E9 answer through the real handlers with unchanged cache headers', async () => withDb(async (db) => {
  const seeded = await seedEras(db);
  const board = await invoke(mount(leaderboardApi, db), { url: '/api/leaderboard?game=hard-money-heroes&period=all-time' });
  assert.equal(board.status, 200, JSON.stringify(board.body));
  assert.equal(board.headers['cache-control'], 'public, s-maxage=15, stale-while-revalidate=60');
  assert.deepEqual(board.body.rows.map((row) => row.versionLabel), HMH_ROWS.map((row) => row.label));
  assertNoBuildHash(board.body, 'E5 handler');

  const profile = await invoke(mount(profileApi, db), { url: `/api/profile?wallet=${ME}` });
  assert.equal(profile.status, 200, JSON.stringify(profile.body));
  assert.equal(profile.headers['cache-control'], 'public, s-maxage=10, stale-while-revalidate=30');
  assert.deepEqual(profile.body.recentSessions.map((session) => session.versionLabel).sort(), ['Chikun v7', 'HMH v0.5', 'STACKED v0.2']);
  assertNoBuildHash(profile.body, 'E6 handler');
  const self = await invoke(mount(profileApi, db), { url: `/api/profile?wallet=${ME}&self=1`, headers: { authorization: bearer(ME) } });
  assert.equal(self.status, 200, JSON.stringify(self.body));
  assert.equal(self.headers['cache-control'], 'private, no-store');
  assert.equal(self.body.recentSessions.every((session) => typeof session.versionLabel === 'string'), true);

  const chikun = seeded.find((row) => row.gameId === 'chikun' && row.label === 'Chikun v6');
  const session = await invoke(mount(sessionApi, db), { url: `/api/verified-session?id=${chikun.sessionId32.slice(2)}` });
  assert.equal(session.status, 200, JSON.stringify(session.body));
  assert.equal(session.headers['cache-control'], 'public, s-maxage=300, stale-while-revalidate=86400');
  assert.deepEqual([session.body.session.versionLabel, session.body.session.runtimeId], ['Chikun v6', 'chikun:canvas-runtime-v6']);
}, { migrated: false }));

test('the share page lists the version with the run stats (E10, from E9)', async () => withDb(async (db) => {
  const seeded = await seedEras(db);
  const handler = mount(sharePageApi, db);
  for (const row of seeded) {
    const res = fakeResponse();
    await handler(fakeRequest({ url: `/api/share-page?id=${row.sessionId32.slice(2)}` }), res);
    assert.equal(res.statusCode, 200, row.label);
    assert.equal(res.headers['cache-control'], 'public, s-maxage=300, stale-while-revalidate=86400', 'confirmed page cache unchanged');
    if (row.label.endsWith('v?')) {
      assert.doesNotMatch(res.text, /<dt>Version<\/dt>/, 'an unrecorded version is not listed');
      continue;
    }
    const escaped = row.label.replace(/[.?]/g, (ch) => `[${ch}]`);
    assert.match(res.text, new RegExp(`<dt>Version</dt><dd>${escaped}</dd></div></dl>`), `${row.label}: the last entry of the stats list`);
  }
  const hmh = seeded.find((row) => row.label === 'HMH v0.6');
  const session = await readPublicSession(db, hmh.sessionId32, { catalog: null });
  assert.match(renderSharePage({ session }).html, /<dt>Version<\/dt><dd>HMH v0\.6<\/dd>/);
  assert.doesNotMatch(renderSharePage({ session: { ...session, versionLabel: undefined } }).html, /<dt>Version<\/dt>/, 'an E9 body without the field shows no row');
  assert.doesNotMatch(renderSharePage({ session: { ...session, versionLabel: '<script>alert(1)</script> v1' } }).html, /<dt>Version<\/dt>|alert\(1\)/);
}, { migrated: false }));

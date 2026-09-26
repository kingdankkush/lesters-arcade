import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test from 'node:test';
import { ethers } from 'ethers';

import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { PROFILE_REGISTRY_ABI } from '../server/chain/abis.mjs';
import { ipBucket } from '../server/http.mjs';
import * as leaderboardApi from '../api/leaderboard.mjs';
import * as profileApi from '../api/profile.mjs';
import * as refreshApi from '../api/profile-refresh.mjs';
import * as sessionApi from '../api/verified-session.mjs';
import * as indexCronApi from '../api/cron/index-chain.mjs';
import * as sharePageApi from '../api/share-page.mjs';
import * as shareCardApi from '../api/share-card.mjs';
import { createPgliteClient, seedAchievementUnlock, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';
import { fakeRequest, fakeResponse, invoke } from './helpers/fake-http.mjs';

/**
 * Contract §4.3.5-§4.3.8 (E5-E9), §4.2 stubs, A29, A30, A34: the real
 * handlers mounted through createHandler(() => buildDeps(env, overrides))
 * against an UNMIGRATED PGlite, so a missing ensureSchema call fails here.
 */

const SESSION_VALUE = `session-fixture-${'e5'.repeat(16)}`;
const NOW = Date.parse('2026-09-23T12:00:00.000Z');
const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: SESSION_VALUE });
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 1,
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55',
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});
const ALICE = `0x${'a1'.repeat(20)}`;
const BOB = `0x${'b2'.repeat(20)}`;
const profileIface = new ethers.Interface(PROFILE_REGISTRY_ABI);

function mount(api, { db, envOverride = env, provider, deployment = DEPLOYED } = {}) {
  const overrides = { deployment, nowMs: NOW };
  if (db !== undefined) overrides.db = db;
  if (provider) overrides.provider = provider;
  return api.createHandler(() => api.buildDeps(envOverride, overrides));
}

function bearer(wallet) {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SESSION_VALUE, wallet, nowMs: NOW, audience: 'lestersarcade:development' });
  return `Bearer ${token}`;
}

async function withFreshDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

function fakeProfileProvider(profiles, { fail = false, block = 777 } = {}) {
  const calls = [];
  return {
    calls,
    async call({ to, data }) {
      calls.push(to);
      if (fail) throw new Error('missing response (https://rpc.example/secret)');
      const [wallet] = profileIface.decodeFunctionData('getProfile', data);
      const profile = profiles.get(String(wallet).toLowerCase());
      return profileIface.encodeFunctionResult('getProfile', [profile
        ? [ethers.id(profile.name.toLowerCase()), profile.name, profile.avatarUri ?? '', 1n, 1_790_000_000n, true]
        : [ethers.ZeroHash, '', '', 0n, 0n, false]]);
    },
    async getBlockNumber() { if (fail) throw new Error('down'); return block; },
  };
}

test('E5 leaderboard answers every status with its cache policy', async () => withFreshDb(async (db) => {
  const handler = mount(leaderboardApi, { db });
  const empty = await invoke(handler, { url: '/api/leaderboard?game=chikun' });
  assert.equal(empty.status, 200, JSON.stringify(empty.body));
  assert.equal(empty.headers['cache-control'], 'public, s-maxage=15, stale-while-revalidate=60');
  assert.deepEqual(empty.body, {
    ok: true, gameId: 'chikun', seasonId: 'chikun-season-preview-1', period: 'weekly', periodKey: '2026-W39',
    resetsAt: '2026-09-28T00:00:00.000Z', page: 1, pageSize: 25, total: 0, rows: [], you: null,
  }, 'the first request on an unmigrated database works: the handler ensured the schema');

  await seedVerifiedSession(db, { wallet: ALICE, gameId: 'lester-blaster', score: 48210, stats: { score: 48210, kills: 300, survivalSeconds: 1080, maxCombo: 30, level: 41, bossKills: 1, damageTaken: 12, heroId: 'lit-valkyrie' } });
  await seedVerifiedSession(db, { wallet: BOB, gameId: 'lester-blaster', score: 1000 });
  await seedWalletProfile(db, { wallet: ALICE, displayName: 'Lit Pilot' });
  const hmh = await invoke(handler, { url: `/api/leaderboard?game=hard-money-heroes&period=all-time&wallet=${BOB.toUpperCase().replace('0X', '0x')}&q=lit` });
  assert.equal(hmh.status, 200);
  assert.equal(hmh.body.gameId, 'lester-blaster', 'a route slug answers with the gameId');
  assert.deepEqual([hmh.body.periodKey, hmh.body.resetsAt, hmh.body.total], ['all-time', null, 1]);
  assert.deepEqual(hmh.body.rows[0].stats, { kills: 300, survivalSeconds: 1080, maxCombo: 30, level: 41, bossKills: 1 }, 'headline keys only');
  assert.equal(hmh.body.rows[0].displayName, 'Lit Pilot');
  assert.deepEqual([hmh.body.you.rank, hmh.body.you.score], [2, 1000]);
  const monthly = await invoke(handler, { url: '/api/leaderboard?game=lester-blaster&period=monthly&periodKey=2026-09&page=1' });
  assert.deepEqual([monthly.body.total, monthly.body.resetsAt], [2, '2026-10-01T00:00:00.000Z']);
  const daily = await invoke(handler, { url: '/api/leaderboard?game=lester-blaster&period=daily' });
  assert.deepEqual([daily.body.periodKey, daily.body.resetsAt], ['2026-09-23', '2026-09-24T00:00:00.000Z']);

  for (const [url, error] of [
    ['/api/leaderboard', 'invalid-game'],
    ['/api/leaderboard?game=tetris', 'invalid-game'],
    ['/api/leaderboard?game=chikun&period=yearly', 'invalid-period'],
    ['/api/leaderboard?game=chikun&periodKey=2026-39', 'invalid-period-key'],
    ['/api/leaderboard?game=chikun&period=monthly&periodKey=2026-W39', 'invalid-period-key'],
    ['/api/leaderboard?game=chikun&page=0', 'invalid-page'],
    ['/api/leaderboard?game=chikun&page=401', 'invalid-page'],
    ['/api/leaderboard?game=chikun&page=2.5', 'invalid-page'],
    [`/api/leaderboard?game=chikun&q=${'x'.repeat(33)}`, 'invalid-query'],
    ['/api/leaderboard?game=chikun&wallet=0x1234', 'invalid-wallet'],
    ['/api/leaderboard?game=chikun&cb=123', 'invalid-query'],
  ]) {
    const response = await invoke(handler, { url });
    assert.deepEqual([response.status, response.body], [400, { ok: false, error }], url);
    assert.equal(response.headers['cache-control'], 'no-store', url);
  }
  assert.equal((await invoke(handler, { url: `/api/leaderboard?game=chikun&q=${encodeURIComponent(`  ${'x'.repeat(32)}  `)}` })).status, 200, 'q is trimmed before the length check');
  assert.equal((await invoke(handler, { url: '/api/leaderboard?game=chikun&page=400' })).status, 200);
  assert.equal((await invoke(handler, { method: 'POST', url: '/api/leaderboard?game=chikun' })).status, 405);
  const unconfigured = await invoke(mount(leaderboardApi, { db: null }), { url: '/api/leaderboard?game=chikun' });
  assert.deepEqual([unconfigured.status, unconfigured.body.error], [503, 'index-not-configured']);
}));

test('the public profile lists only confirmed sessions', async () => withFreshDb(async (db) => {
  const handler = mount(profileApi, { db });
  const first = await invoke(handler, { url: `/api/profile?wallet=${ALICE}` });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.headers['cache-control'], 'public, s-maxage=10, stale-while-revalidate=30');
  assert.deepEqual(first.body.profile, { displayName: null, avatarUri: null, hidden: false, onchainUpdatedAt: null });
  assert.deepEqual(Object.keys(first.body.games).sort(), ['chikun', 'lester-blaster', 'stacked']);
  assert.equal(first.body.preferences, null);

  const confirmed = await seedVerifiedSession(db, { wallet: ALICE, score: 700 });
  await seedVerifiedSession(db, { wallet: ALICE, score: 5000, status: 'submitted' });
  await seedVerifiedSession(db, { wallet: ALICE, score: 6000, status: 'failed', lastError: 'rpc-timeout', nextAttemptAt: '2026-09-23T12:05:00.000Z' });
  await seedVerifiedSession(db, { wallet: ALICE, score: 7000, status: 'pending' });
  await seedAchievementUnlock(db, { wallet: ALICE, sessionId32: confirmed.sessionId32 });
  const response = await invoke(handler, { url: `/api/profile?wallet=${ALICE}` });
  assert.deepEqual(response.body.recentSessions.map((row) => [row.sessionId32, row.status, row.score]), [[confirmed.sessionId32, 'confirmed', 700]]);
  assert.equal('retryable' in response.body.recentSessions[0], false, 'retry details are for the owner only');
  assert.equal(response.body.games.chikun.bestScore, 700);
  assert.equal(response.body.achievements.length, 1);
  assert.equal(JSON.stringify(response.body).includes('rpc-timeout'), false);
  assert.deepEqual([(await invoke(handler, { url: '/api/profile?wallet=bob' })).status, (await invoke(handler, { url: '/api/profile' })).body.error], [400, 'invalid-wallet']);
  const unconfigured = await invoke(mount(profileApi, { db: null }), { url: `/api/profile?wallet=${ALICE}` });
  assert.deepEqual([unconfigured.status, unconfigured.body.error], [503, 'index-not-configured']);
  assert.equal((await invoke(handler, { method: 'DELETE', url: '/api/profile' })).status, 405);
}));

test('the self profile needs a matching bearer and is never cacheable', async () => withFreshDb(async (db) => {
  const handler = mount(profileApi, { db });
  const url = `/api/profile?wallet=${ALICE}&self=1`;
  for (const headers of [{}, { authorization: bearer(BOB) }, { authorization: `${bearer(ALICE)}x` }]) {
    const denied = await invoke(handler, { url, headers });
    assert.deepEqual([denied.status, denied.body.error, denied.headers['cache-control']], [401, 'invalid-session', 'private, no-store']);
  }
  const noSecret = await invoke(mount(profileApi, { db, envOverride: { VERCEL_ENV: 'development' } }), { url, headers: { authorization: bearer(ALICE) } });
  assert.equal(noSecret.status, 401, 'without SESSION_SECRET the self view is unauthorized');
  const wrongFlag = await invoke(handler, { url: `/api/profile?wallet=${ALICE}&self=true`, headers: { authorization: bearer(ALICE) } });
  assert.deepEqual([wrongFlag.status, wrongFlag.body.error, wrongFlag.headers['cache-control']], [400, 'invalid-query', 'private, no-store']);

  await seedVerifiedSession(db, { wallet: ALICE, score: 6000, status: 'failed', lastError: 'rpc-timeout', nextAttemptAt: '2026-09-23T12:05:00.000Z' });
  await seedWalletProfile(db, { wallet: ALICE, displayName: null, nameBlocked: 'profanity', preferences: { nameClaimDismissed: true } });
  const self = await invoke(handler, { url, headers: { authorization: bearer(ALICE) } });
  assert.equal(self.status, 200);
  assert.equal(self.headers['cache-control'], 'private, no-store');
  assert.deepEqual(self.body.preferences, { nameClaimDismissed: true });
  assert.equal(self.body.profile.nameBlocked, 'profanity');
  assert.deepEqual([self.body.recentSessions[0].retryable, self.body.recentSessions[0].lastError, self.body.recentSessions[0].nextAttemptAt], [true, 'rpc-timeout', '2026-09-23T12:05:00.000Z']);
}));

test('E7 stores preferences only, behind a Bearer checked before the body', async () => withFreshDb(async (db) => {
  const handler = mount(profileApi, { db });
  let bodyRead = false;
  const guarded = { method: 'PUT', url: '/api/profile', headers: { authorization: 'Bearer nope' } };
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(text) { this.body = JSON.parse(text); } };
  await handler({ ...guarded, get body() { bodyRead = true; return {}; } }, res);
  assert.deepEqual([res.statusCode, res.body.error], [401, 'invalid-session']);
  assert.equal(bodyRead, false, 'a bad token never reads the body');
  const noSecret = await invoke(mount(profileApi, { db, envOverride: { VERCEL_ENV: 'development' } }), { method: 'PUT', url: '/api/profile', headers: { authorization: bearer(ALICE) }, body: { preferences: {} } });
  assert.deepEqual([noSecret.status, noSecret.body.error], [503, 'session-not-configured']);
  const auth = { authorization: bearer(ALICE) };
  assert.deepEqual((await invoke(handler, { method: 'PUT', url: '/api/profile', headers: auth, body: { preferences: 'dark' } })).body, { ok: false, error: 'invalid-body' });
  assert.deepEqual((await invoke(handler, { method: 'PUT', url: '/api/profile', headers: auth, body: [] })).body, { ok: false, error: 'invalid-body' });
  const tooBig = await invoke(handler, { method: 'PUT', url: '/api/profile', headers: { ...auth, 'content-length': '5000' }, body: { preferences: {} } });
  assert.deepEqual([tooBig.status, tooBig.body.error], [413, 'body-too-large']);
  const saved = await invoke(handler, { method: 'PUT', url: '/api/profile', headers: auth, body: { preferences: { selectedCharacterId: 'lilly', cosmetics: { chikun: { hat: 'crown' } }, evil: 1 }, displayName: 'Hacker', stats: { score: 1e9 } } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.headers['cache-control'], 'no-store');
  assert.deepEqual(saved.body.preferences, { selectedCharacterId: 'lilly', cosmetics: { chikun: { hat: 'crown' } } });
  assert.equal(saved.body.wallet, ALICE);
  const [row] = await db.query('SELECT display_name FROM wallet_profiles WHERE wallet = $1', [ALICE]);
  assert.equal(row.display_name, null, 'names are never accepted from the browser');
  const dismissed = await invoke(handler, { method: 'PUT', url: '/api/profile', headers: auth, body: { preferences: { nameClaimDismissed: true } } });
  assert.deepEqual(dismissed.body.preferences, { selectedCharacterId: 'lilly', cosmetics: { chikun: { hat: 'crown' } }, nameClaimDismissed: true }, 'a partial PUT merges and keeps the other keys');
  const nearCap = { cosmetics: { chikun: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`slot-${'abcdefghijklmnopqrstuvwxyz'[i]}-${'z'.repeat(15)}`, `cosmetic-${'y'.repeat(38)}`])) } };
  assert.equal(JSON.stringify({ selectedCharacterId: 'lilly', nameClaimDismissed: true, ...nearCap }).length, 2032, 'fixture: the merged document fits');
  assert.equal(JSON.stringify({ selectedCharacterId: 'x'.repeat(32), nameClaimDismissed: true, ...nearCap }).length, 2059, 'fixture: a longer character id would not');
  assert.equal((await invoke(handler, { method: 'PUT', url: '/api/profile', headers: auth, body: { preferences: nearCap } })).status, 200);
  const grown = await invoke(handler, { method: 'PUT', url: '/api/profile', headers: auth, body: { preferences: { selectedCharacterId: 'x'.repeat(32) } } });
  assert.deepEqual([grown.status, grown.body], [400, { ok: false, error: 'invalid-body', detail: 'preferences-too-large' }], 'the merged document keeps the 2,048-byte cap');
  const noDb = await invoke(mount(profileApi, { db: null }), { method: 'PUT', url: '/api/profile', headers: auth, body: { preferences: {} } });
  assert.deepEqual([noDb.status, noDb.body.error], [503, 'index-not-configured']);
  assert.equal((await invoke(handler, { method: 'PUT', url: '/api/profile?wallet=x', headers: auth, body: { preferences: {} } })).status, 400);
}));

test('E8 refreshes the mirrored profile through the sanitizer', async () => withFreshDb(async (db) => {
  const provider = fakeProfileProvider(new Map([[ALICE, { name: ' Lit  Pilot ', avatarUri: 'lestersarcade:avatar/lester' }], [BOB, { name: 'Lester Official' }]]));
  const handler = mount(refreshApi, { db, provider });
  const refreshed = await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { 'x-forwarded-for': '203.0.113.5' } });
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  assert.equal(refreshed.headers['cache-control'], 'no-store');
  assert.deepEqual(refreshed.body, { ok: true, wallet: ALICE, profile: { displayName: 'Lit Pilot', avatarUri: 'lestersarcade:avatar/lester', hidden: false } });
  assert.deepEqual(provider.calls, [DEPLOYED.addresses.playerProfileRegistry]);
  const [row] = await db.query("SELECT profile_block::text AS block, to_char(onchain_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day FROM wallet_profiles WHERE wallet = $1", [ALICE]);
  assert.deepEqual(row, { block: '777', day: '2026-09-21' });
  const blocked = await invoke(handler, { method: 'POST', url: '/api/profile/refresh', body: { wallet: BOB } });
  assert.deepEqual(blocked.body.profile, { displayName: null, avatarUri: null, hidden: false }, 'a moderated name is never shown');
  await seedWalletProfile(db, { wallet: ALICE, displayName: 'Lit Pilot', hidden: true });
  const hidden = await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}` });
  assert.deepEqual(hidden.body.profile, { displayName: null, avatarUri: null, hidden: true }, 'refresh never clears the owner flag');

  assert.deepEqual((await invoke(handler, { method: 'POST', url: '/api/profile/refresh?wallet=0x12' })).body, { ok: false, error: 'invalid-wallet' });
  assert.deepEqual((await invoke(handler, { method: 'POST', url: '/api/profile/refresh' })).body, { ok: false, error: 'invalid-wallet' });
  assert.deepEqual((await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, body: { wallet: BOB } })).body, { ok: false, error: 'invalid-wallet' });
  const predicted = await invoke(mount(refreshApi, { db, provider, deployment: { ...DEPLOYED, status: 'predicted' } }), { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}` });
  assert.deepEqual([predicted.status, predicted.body.error], [503, 'chain-not-configured']);
  const noDb = await invoke(mount(refreshApi, { db: null, provider }), { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}` });
  assert.deepEqual([noDb.status, noDb.body.error], [503, 'index-not-configured']);
  const down = await invoke(mount(refreshApi, { db, provider: fakeProfileProvider(new Map(), { fail: true }) }), { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { 'x-forwarded-for': '198.51.100.77' } });
  assert.deepEqual([down.status, down.body.error], [502, 'chain-read-failed']);
  assert.equal(JSON.stringify(down.body).includes('secret'), false);
  assert.equal((await invoke(handler, { method: 'GET', url: `/api/profile/refresh?wallet=${ALICE}` })).status, 405);
}));

test('anonymous refreshes never spend a wallet\'s bucket', async () => withFreshDb(async (db) => {
  const provider = fakeProfileProvider(new Map([[ALICE, { name: 'Lit Pilot' }]]));
  const handler = mount(refreshApi, { db, provider });
  const attacker = { 'x-forwarded-for': '2001:db8:1:2::99' };
  assert.equal((await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: attacker })).status, 200);
  assert.equal((await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { ...attacker, authorization: bearer(BOB) } })).status, 200, 'another wallet\'s token counts as anonymous');
  const buckets = (await db.query('SELECT bucket, hits FROM rate_limits ORDER BY bucket')).map((row) => [row.bucket, row.hits]);
  const attackerBucket = `refresh:ip:${ipBucket('2001:db8:1:2::1', SESSION_VALUE)}`;
  assert.deepEqual(buckets, [[attackerBucket, 2]], 'only the caller\'s /64 IP bucket is spent');
  // The IP bucket allows exactly 60 per hour (§4.3.7): the 60th call passes,
  // the 61st is limited.
  assert.deepEqual({ ...refreshApi.REFRESH_LIMITS }, { wallet: 30, ip: 60, windowSeconds: 3600 });
  await db.query('UPDATE rate_limits SET hits = 59 WHERE bucket = $1', [attackerBucket]);
  assert.equal((await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: attacker })).status, 200, 'the 60th anonymous refresh in the hour passes');
  const limited = await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { 'x-forwarded-for': '2001:db8:1:2:abcd::1' } });
  assert.deepEqual([limited.status, limited.body.error], [429, 'rate-limited'], 'the 61st is limited, from anywhere in the /64');
  assert.match(limited.headers['retry-after'], /^[0-9]+$/);
  // The victim's own refresh uses the per-wallet bucket and still works.
  const own = await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { ...attacker, authorization: bearer(ALICE) } });
  assert.equal(own.status, 200);
  assert.deepEqual((await db.query("SELECT hits FROM rate_limits WHERE bucket = $1", [`refresh:w:${ALICE}`]))[0], { hits: 1 });
  await db.query('UPDATE rate_limits SET hits = 29 WHERE bucket = $1', [`refresh:w:${ALICE}`]);
  assert.equal((await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { authorization: bearer(ALICE) } })).status, 200, 'the 30th own-wallet refresh in the hour passes');
  assert.equal((await invoke(handler, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}`, headers: { authorization: bearer(ALICE) } })).status, 429, 'the wallet bucket allows 30 per hour');
}));

test('a hidden wallet\'s session shows no name on E9', async () => withFreshDb(async (db) => {
  const handler = mount(sessionApi, { db });
  const missing = await invoke(handler, { url: `/api/verified-session?id=${'ab'.repeat(32)}` });
  assert.deepEqual([missing.status, missing.body.error, missing.headers['cache-control']], [404, 'session-not-found', 'public, s-maxage=30'], 'first request on an unmigrated database');
  const session = await seedVerifiedSession(db, { wallet: ALICE, score: 800 });
  await seedWalletProfile(db, { wallet: ALICE, displayName: 'Lit Pilot' });
  const named = await invoke(handler, { url: `/api/verified-session?id=${session.sessionId32.slice(2).toUpperCase()}` });
  assert.equal(named.status, 200);
  assert.equal(named.headers['cache-control'], 'public, s-maxage=300, stale-while-revalidate=86400');
  assert.equal(named.body.session.displayName, 'Lit Pilot');
  assert.equal(named.body.session.shareId, session.sessionId32.slice(2));
  await seedWalletProfile(db, { wallet: ALICE, displayName: 'Lit Pilot', hidden: true });
  const hidden = await invoke(handler, { url: `/api/verified-session?id=${session.sessionId32}` });
  assert.deepEqual([hidden.body.session.displayName, hidden.body.session.avatarUri, hidden.body.session.walletShort], [null, null, `${ALICE.slice(0, 6)}…${ALICE.slice(-4)}`]);
  assert.notEqual(hidden.body.session.cardRev, named.body.session.cardRev, 'hiding changes the card revision');
}));

test('E9 never returns client claims or plausibility flags', async () => withFreshDb(async (db) => {
  const handler = mount(sessionApi, { db });
  const hmh = await seedVerifiedSession(db, {
    wallet: ALICE, gameId: 'lester-blaster', score: 48210, kills: 300, maxCombo: 30, survivalSeconds: 1080, bossId: 'boss-liquidator',
    clientClaim: { score: 99999999 }, plausibility: { flags: ['xp-near-ceiling', 'kills-near-capacity'] },
  });
  const pending = await seedVerifiedSession(db, { wallet: ALICE, status: 'pending' });
  const submitted = await seedVerifiedSession(db, { wallet: BOB, status: 'submitted' });
  const response = await invoke(handler, { url: `/api/verified-session?id=${hmh.sessionId32}` });
  assert.equal(response.status, 200);
  const text = JSON.stringify(response.body);
  for (const secret of ['99999999', 'xp-near-ceiling', 'kills-near-capacity', 'client_claim', 'clientClaim', 'flags']) assert.equal(text.includes(secret), false, secret);
  const { session } = response.body;
  assert.equal('plausibility' in session, false);
  assert.equal(session.verification, 'plausibility', 'the only plausibility on E9 is the verification label');
  assert.deepEqual(Object.keys(session).sort(), [
    'achievements', 'avatarUri', 'cardRev', 'confirmedAt', 'contract', 'displayName', 'explorerUrl', 'gameId', 'gameTitle', 'jackpotChampion', 'runtimeId', 'score',
    'seasonId', 'sessionId32', 'shareId', 'standing', 'stats', 'status', 'txHash', 'blockNumber', 'verification', 'verifiedAt', 'versionLabel', 'wallet', 'walletShort',
  ].sort());
  assert.deepEqual(session.contract, { kills: 300, maxCombo: 30, survivalSeconds: 1080, bossId: 'boss-liquidator' });
  assert.equal(session.verification, 'plausibility');
  assert.deepEqual(session.standing, { weekly: 1, monthly: 1, allTime: 1 });
  assert.equal(session.jackpotChampion, null, 'no jackpot week was won (jackpot-server, design §C.7)');
  const hidden = await invoke(handler, { url: `/api/verified-session?id=${pending.sessionId32}` });
  assert.deepEqual([hidden.status, hidden.headers['cache-control']], [404, 'public, s-maxage=30'], 'a pending run reads as missing');
  const unpublished = await invoke(handler, { url: `/api/verified-session?id=${submitted.sessionId32}` });
  assert.deepEqual([unpublished.status, unpublished.body.session.status, unpublished.headers['cache-control']], [200, 'submitted', 'public, s-maxage=5']);
  for (const id of ['', 'game-session-1', `0x${'ab'.repeat(31)}`, `0x${'zz'.repeat(32)}`]) {
    const bad = await invoke(handler, { url: `/api/verified-session?id=${id}` });
    assert.deepEqual([bad.status, bad.body.error], [400, 'invalid-session-id'], id);
  }
  assert.deepEqual((await invoke(handler, { url: '/api/verified-session' })).body.error, 'invalid-session-id');
  const noDb = await invoke(mount(sessionApi, { db: null }), { url: `/api/verified-session?id=${hmh.sessionId32}` });
  assert.deepEqual([noDb.status, noDb.body.error], [503, 'index-not-configured']);
}));

test('unknown query parameters are rejected', async () => {
  const db = { schemaKey: 'never-queried', async query() { throw new Error('the database must not be reached'); } };
  const cases = [
    [leaderboardApi, { url: '/api/leaderboard?game=chikun&nocache=1' }],
    [profileApi, { url: `/api/profile?wallet=${ALICE}&v=2` }],
    [profileApi, { method: 'PUT', url: '/api/profile?wallet=x', headers: { authorization: bearer(ALICE) }, body: { preferences: {} } }],
    [refreshApi, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}&force=1` }],
    [sessionApi, { url: `/api/verified-session?id=${'ab'.repeat(32)}&shareId=${'ab'.repeat(32)}` }],
    [sessionApi, { url: `/api/verified-session?id=${'ab'.repeat(32)}&id=${'cd'.repeat(32)}` }],
    [indexCronApi, { url: '/api/cron/index-chain?from=1' }],
  ];
  for (const [api, request] of cases) {
    const response = await invoke(mount(api, { db }), request);
    assert.deepEqual([response.status, response.body], [400, { ok: false, error: 'invalid-query' }], request.url);
  }
  const repeated = await invoke(mount(sessionApi, { db: null }), { url: `/api/verified-session?id=${'ab'.repeat(32)}&id=${'ab'.repeat(32)}` });
  assert.equal(repeated.status, 503, 'an identical repeated id (a rewrite that also appends it) is tolerated');
});

// The results-share slice replaced the E10 and E11 stubs (§10.4 rule 5): the
// card answers JSON errors, the page answers HTML with generic tags (their own
// suites are tests/share-card.test.mjs and tests/share-page.test.mjs).
const SHARE_ENDPOINTS = [
  ['share-page', sharePageApi, 'sharePageRequest', 'GET'],
  ['share-card', shareCardApi, 'shareCardRequest', 'GET'],
];
const SHARE_ID = 'ab'.repeat(32);

async function invokeHtml(handler, request) {
  const res = fakeResponse();
  await handler(fakeRequest(request), res);
  return { status: res.statusCode, text: res.text, headers: res.headers };
}

test('every new endpoint fails closed with no env at all and never throws', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    // The production default path: no overrides at all, an empty environment.
    const bare = (api) => api.createHandler(() => api.buildDeps({}));
    const expectations = [
      [leaderboardApi, { url: '/api/leaderboard?game=chikun' }, 503, 'index-not-configured'],
      [profileApi, { url: `/api/profile?wallet=${ALICE}` }, 503, 'index-not-configured'],
      [profileApi, { url: `/api/profile?wallet=${ALICE}&self=1`, headers: { authorization: 'Bearer x' } }, 401, 'invalid-session'],
      [profileApi, { method: 'PUT', url: '/api/profile', headers: { authorization: 'Bearer x' }, body: { preferences: {} } }, 503, 'session-not-configured'],
      [refreshApi, { method: 'POST', url: `/api/profile/refresh?wallet=${ALICE}` }, 503, 'index-not-configured'],
      [sessionApi, { url: `/api/verified-session?id=${'ab'.repeat(32)}` }, 503, 'index-not-configured'],
      [indexCronApi, { url: '/api/cron/index-chain', headers: { authorization: 'Bearer ' } }, 401, 'unauthorized'],
      [shareCardApi, { url: `/api/share-card?id=${SHARE_ID}` }, 503, 'index-not-configured'],
    ];
    for (const [api, request, status, error] of expectations) {
      const response = await invoke(bare(api), request);
      assert.deepEqual([response.status, response.body.error], [status, error], request.url);
      assert.equal(response.headers['cache-control'], response.status === 401 && request.url.includes('self=1') ? 'private, no-store' : 'no-store', request.url);
    }
    const page = await invokeHtml(bare(sharePageApi), { url: `/api/share-page?id=${SHARE_ID}` });
    assert.equal(page.status, 503);
    assert.match(page.headers['content-type'], /^text\/html/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.match(page.text, /<meta name="twitter:site" content="@LestersArcade">/);
    // free-share (E12, E13): the Free page and card need no env at all; the URL is the record.
    const [freeCardApi, freePageApi, { encodeFreeShareToken }] = await Promise.all([import('../api/free-card.mjs'), import('../api/free-share-page.mjs'), import('../apps/portal/src/free-share-token.mjs')]);
    const token = encodeFreeShareToken('stacked', { score: 4200, lines: 40, level: 5, quadClears: 1, maxCombo: 3, survivalSeconds: 300 });
    const freePage = await invokeHtml(bare(freePageApi), { url: `/api/free-share-page?game=stacked&token=${token}` });
    assert.equal(freePage.status, 200, freePage.text);
    assert.match(freePage.text, /<meta name="twitter:site" content="@LestersArcade">/);
    assert.match(freePage.text, /4,200 pts in STACKED · Free Play/);
    const freeCard = await invokeHtml(bare(freeCardApi), { method: 'HEAD', url: `/api/free-card?game=stacked&token=${token}` });
    assert.deepEqual([freeCard.status, freeCard.headers['content-type']], [200, 'image/png']);
  } finally {
    console.error = original;
  }
  assert.deepEqual(logged, [], 'no handler threw');
});

test('legacy env names alone leave settlement unconfigured', async () => {
  const legacyOnly = { VERIFIER_PRIVATE_KEY: `0x${'11'.repeat(32)}`, RELAYER_PRIVATE_KEY: `0x${'22'.repeat(32)}`, SCORE_REGISTRY_ADDRESS: DEPLOYED.addresses.scoreSubmissionRegistry };
  for (const api of [leaderboardApi, profileApi, refreshApi, sessionApi, indexCronApi, ...SHARE_ENDPOINTS.map(([, api]) => api)]) {
    const deps = await api.buildDeps(legacyOnly, { deployment: DEPLOYED });
    assert.equal(deps.config.settlementReady, false);
    assert.deepEqual([...deps.config.legacyEnvPresent], ['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']);
    assert.equal(deps.db, null);
  }
  for (const [path, api, , method] of SHARE_ENDPOINTS) {
    const response = await invokeHtml(api.createHandler(() => api.buildDeps(legacyOnly, { deployment: DEPLOYED })), { method, url: `/api/${path}?id=${SHARE_ID}` });
    assert.equal(response.status, 503, path);
  }
});

test('every handler module exposes the A30 seam and its pure request function', async () => {
  const modules = [
    [leaderboardApi, 'leaderboardRequest'], [profileApi, 'profileRequest'], [refreshApi, 'profileRefreshRequest'],
    [sessionApi, 'verifiedSessionRequest'], [indexCronApi, 'indexChainRequest'],
    ...SHARE_ENDPOINTS.map(([, api, name]) => [api, name]),
  ];
  for (const [api, pure] of modules) {
    assert.equal(typeof api.buildDeps, 'function', pure);
    assert.equal(typeof api.createHandler, 'function', pure);
    assert.equal(typeof api.default, 'function', pure);
    assert.equal(typeof api[pure], 'function', pure);
    const deps = await api.buildDeps({}, { db: null, deployment: DEPLOYED, nowMs: NOW });
    assert.deepEqual(Object.keys(deps).sort(), ['config', 'crypto', 'db', 'deployment', 'fetchImpl', 'nowMs', 'provider'].sort(), pure);
    assert.equal(deps.nowMs(), NOW);
  }
  const noId = await sharePageApi.sharePageRequest({ method: 'GET' }, {});
  assert.equal(noId.status, 400);
  assert.match(noId.body, /^<!doctype html>/);
  const noDb = await shareCardApi.shareCardRequest({ method: 'GET', query: { id: SHARE_ID } }, { db: null });
  assert.deepEqual([noDb.status, noDb.body], [503, { ok: false, error: 'index-not-configured' }]);
});

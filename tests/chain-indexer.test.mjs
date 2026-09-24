import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';

import { EVENT_TOPICS, PROFILE_REGISTRY_ABI, RANKED_ENTRY_ABI, SCORE_REGISTRY_ABI, ACHIEVEMENT_REGISTRY_ABI } from '../server/chain/abis.mjs';
import { INDEXER_STREAM, indexChain } from '../server/indexer/index-chain.mjs';
import { migrate } from '../server/neon/migrations.mjs';
import { INDEX_GAMES } from '../server/neon/rows.mjs';
import { buildDeps, createHandler } from '../api/cron/index-chain.mjs';
import { createPgliteClient, randomHex32, seedAchievementUnlock, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';

/**
 * Contract §4.3.10 (E12): the chain indexer mirrors ScoreSubmitted,
 * AchievementUnlocked and profile events into Neon with explicit address
 * filters, confirms only rows that match the log, skips unknown games without
 * freezing the cursor, and the cron migrates first behind CRON_SECRET.
 */

const scoreIface = new ethers.Interface(SCORE_REGISTRY_ABI);
const entryIface = new ethers.Interface(RANKED_ENTRY_ABI);
const profileIface = new ethers.Interface(PROFILE_REGISTRY_ABI);
const achievementIface = new ethers.Interface(ACHIEVEMENT_REGISTRY_ABI);
const T0 = Date.parse('2026-09-23T10:00:00.000Z') / 1000;
const blockSeconds = (n) => T0 + n * 2;
const CRON_VALUE = `cron-fixture-${'d4'.repeat(16)}`;
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 1,
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55',
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});
const REGISTRY = DEPLOYED.addresses.scoreSubmissionRegistry;
const DECOY = `0x${'de'.repeat(20)}`;
const PLAYER = `0x${'a7'.repeat(20)}`;
const CATALOG = Object.freeze({
  catalogFor: (gameId) => (gameId === 'chikun' ? [{ id: 'chikun-coast-legend', tier: 'platinum' }, { id: 'chikun-first-flight', tier: 'bronze' }] : []),
});
const env = { VERCEL_ENV: 'development', CRON_SECRET: CRON_VALUE, RANKED_SCORE_REGISTRY_ADDRESS: '0xC5c5949a02FAC9a4115DF182672c0F8cEb0eaF55' };

function scoreLog({ address = REGISTRY, sessionId32 = randomHex32(), player = PLAYER, gameId = 'chikun', gameId32, seasonId32, runtimeId32, score = 1000n, kills = 12n, maxCombo = 4n, survivalSeconds = 180n, bossId = ethers.ZeroHash, blockNumber = 10, index = 0 } = {}) {
  const game = INDEX_GAMES[gameId];
  const { topics, data } = scoreIface.encodeEventLog('ScoreSubmitted', [
    sessionId32, player, gameId32 ?? game.gameId32, score, kills, maxCombo, survivalSeconds, bossId, runtimeId32 ?? game.runtimeId32, seasonId32 ?? game.seasonId32,
  ]);
  return { address, topics, data, blockNumber, index, transactionHash: randomHex32(), sessionId32 };
}

function achievementLog({ address = DEPLOYED.addresses.achievementRegistries.chikun, wallet = PLAYER, achievementId, sessionId32, tokenId = 77n, blockNumber = 10, index = 1 }) {
  const { topics, data } = achievementIface.encodeEventLog('AchievementUnlocked', [wallet, ethers.id(achievementId), sessionId32, tokenId]);
  return { address, topics, data, blockNumber, index, transactionHash: randomHex32() };
}

function profileLog({ address = DEPLOYED.addresses.playerProfileRegistry, wallet = PLAYER, kind = 'ProfileUpdated', name = 'Lit Pilot', blockNumber = 10, index = 2 }) {
  const values = kind === 'ProfileCreated' ? [wallet, ethers.id(name.toLowerCase()), name] : [wallet, name, 'lestersarcade:avatar/lester'];
  const { topics, data } = profileIface.encodeEventLog(kind, values);
  return { address, topics, data, blockNumber, index, transactionHash: randomHex32() };
}

function fakeChain({ logs = [], head = 100, paid = new Map(), envelopes = new Map(), profiles = new Map(), failGetLogs = false } = {}) {
  const filters = [];
  const calls = [];
  return {
    filters,
    calls,
    // Deliberately ignores the address filter, like a hostile or sloppy node:
    // the indexer must re-check every log's address itself.
    async getLogs(filter) {
      filters.push(filter);
      if (failGetLogs) throw new Error('could not coalesce error (https://rpc.example/secret-key)');
      const topic0s = [filter.topics[0]].flat();
      return logs.filter((log) => log.blockNumber >= filter.fromBlock && log.blockNumber <= filter.toBlock && topic0s.includes(log.topics[0]));
    },
    async getBlock(tag) {
      const number = tag === 'latest' ? head : Number(tag);
      return { number, timestamp: blockSeconds(number) };
    },
    async call({ to, data }) {
      calls.push({ to, selector: data.slice(0, 10) });
      if (data.startsWith(entryIface.getFunction('getPaidSession').selector)) {
        const [id] = entryIface.decodeFunctionData('getPaidSession', data);
        const entry = paid.get(String(id).toLowerCase());
        return entryIface.encodeFunctionResult('getPaidSession', [entry ? [entry.player, entry.gameId32, entry.amountWei, entry.openedAt, true] : [ethers.ZeroAddress, ethers.ZeroHash, 0n, 0n, false]]);
      }
      if (data.startsWith(scoreIface.getFunction('sessionEnvelopeHash').selector)) {
        const [id] = scoreIface.decodeFunctionData('sessionEnvelopeHash', data);
        return scoreIface.encodeFunctionResult('sessionEnvelopeHash', [envelopes.get(String(id).toLowerCase()) ?? ethers.id(`envelope:${id}`)]);
      }
      if (data.startsWith(profileIface.getFunction('getProfile').selector)) {
        const [wallet] = profileIface.decodeFunctionData('getProfile', data);
        const profile = profiles.get(String(wallet).toLowerCase());
        return profileIface.encodeFunctionResult('getProfile', [profile
          ? [ethers.id(profile.name.toLowerCase()), profile.name, profile.avatarUri ?? '', 1n, BigInt(profile.lastUpdated ?? T0), true]
          : [ethers.ZeroHash, '', '', 0n, 0n, false]]);
      }
      throw new Error(`unexpected call to ${to}`);
    },
  };
}

async function run(db, chain, extra = {}) {
  return indexChain({ db, deployment: DEPLOYED, getLogs: chain.getLogs, getBlock: chain.getBlock, call: chain.call, nowMs: () => Date.parse('2026-09-23T12:00:00.000Z'), catalog: CATALOG, logger: null, ...extra });
}

async function withDb(runTest) {
  const db = createPgliteClient();
  try {
    await migrate(db);
    await runTest(db);
  } finally {
    await db.close();
  }
}

const sessionRow = async (db, id) => (await db.query(
  `SELECT status, source, tx_hash, block_number::text AS block_number, to_char(confirmed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS confirmed_at,
          chain_mismatch, score::text AS score, day_key, week_key, month_key, season_id, runtime_id, stats::text AS stats, envelope_hash,
          boss_id, entry_amount_wei, opened_at IS NOT NULL AS has_opened_at, session_handle, seed::text AS seed
   FROM verified_sessions WHERE session_id32 = $1`, [id]))[0];

test('ScoreSubmitted confirms a pending row', async () => withDb(async (db) => {
  const pending = await seedVerifiedSession(db, { wallet: PLAYER, score: 777, status: 'pending' });
  const row = await seedVerifiedSession(db, { wallet: PLAYER, score: 1000, status: 'submitted' });
  const failed = await seedVerifiedSession(db, { wallet: PLAYER, score: 50, status: 'failed', nextAttemptAt: '2026-09-23T12:10:00.000Z' });
  assert.deepEqual([pending.txHash, (await sessionRow(db, pending.sessionId32)).status], [null, 'pending'], 'the pending row has no transaction yet');
  const pendingLog = scoreLog({ sessionId32: pending.sessionId32, score: 777n, blockNumber: 19 });
  const log = scoreLog({ sessionId32: row.sessionId32, score: 1000n, blockNumber: 20 });
  const chain = fakeChain({ logs: [pendingLog, log, scoreLog({ sessionId32: failed.sessionId32, score: 50n, blockNumber: 21 })] });
  const result = await run(db, chain);
  assert.equal(result.scores, 3);
  const fromPending = await sessionRow(db, pending.sessionId32);
  assert.deepEqual(
    [fromPending.status, fromPending.tx_hash, fromPending.block_number, fromPending.confirmed_at, fromPending.source, fromPending.chain_mismatch],
    ['confirmed', pendingLog.transactionHash, '19', new Date(blockSeconds(19) * 1000).toISOString(), 'settle', false],
    'a pending row the chain already has is confirmed with the log\'s transaction, block and block time',
  );
  const confirmed = await sessionRow(db, row.sessionId32);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.tx_hash, log.transactionHash);
  assert.equal(confirmed.block_number, '20');
  assert.equal(confirmed.confirmed_at, new Date(blockSeconds(20) * 1000).toISOString(), 'confirmed_at is the block time');
  assert.equal(confirmed.source, 'settle');
  assert.equal((await sessionRow(db, failed.sessionId32)).status, 'confirmed', 'a failed row the chain already has is confirmed');
  assert.equal((await db.query('SELECT next_attempt_at IS NULL AS cleared FROM verified_sessions WHERE session_id32 = $1', [failed.sessionId32]))[0].cleared, true);
  const again = await run(db, fakeChain({ logs: [log], head: 100 }), {});
  assert.equal(again.scores, 0, 'the cursor moved on');
}));

test('unknown on-chain sessions are inserted as chain-index rows', async () => withDb(async (db) => {
  const paidId = randomHex32();
  const bareId = randomHex32();
  const openedAt = BigInt(Date.parse('2026-09-15T08:00:00.000Z') / 1000);
  const envelope = randomHex32();
  const chain = fakeChain({
    logs: [
      scoreLog({ sessionId32: paidId, score: 19475n, kills: 88n, maxCombo: 12n, survivalSeconds: 240n, blockNumber: 30 }),
      scoreLog({ sessionId32: bareId, gameId: 'lester-blaster', score: 48210n, bossId: ethers.id('boss-liquidator'), blockNumber: 31 }),
    ],
    paid: new Map([[paidId, { player: PLAYER, gameId32: INDEX_GAMES.chikun.gameId32, amountWei: 100100000000000000n, openedAt }]]),
    envelopes: new Map([[paidId, envelope]]),
  });
  const result = await run(db, chain);
  assert.equal(result.scores, 2);
  const paidRow = await sessionRow(db, paidId);
  assert.equal(paidRow.source, 'chain-index');
  assert.equal(paidRow.status, 'confirmed');
  assert.deepEqual([paidRow.day_key, paidRow.week_key, paidRow.month_key], ['2026-09-15', '2026-W38', '2026-09'], 'period keys come from getPaidSession.openedAt');
  assert.deepEqual(JSON.parse(paidRow.stats), { kills: 88, maxCombo: 12, survivalSeconds: 240 });
  assert.equal(paidRow.envelope_hash, envelope.toLowerCase());
  assert.deepEqual([paidRow.season_id, paidRow.runtime_id], ['chikun-season-preview-1', 'chikun:canvas-runtime-v7']);
  assert.deepEqual([paidRow.entry_amount_wei, paidRow.has_opened_at, paidRow.session_handle, paidRow.seed], ['100100000000000000', true, null, null]);
  const bareRow = await sessionRow(db, bareId);
  assert.deepEqual([bareRow.day_key, bareRow.week_key], ['2026-09-23', '2026-W39'], 'without a paid session the block time decides');
  assert.equal(bareRow.boss_id, 'boss-liquidator');
  assert.deepEqual([bareRow.season_id, bareRow.entry_amount_wei, bareRow.has_opened_at], ['hmh-season-1-2026', null, false]);
}));

test('AchievementUnlocked stamps token ids', async () => withDb(async (db) => {
  const session = await seedVerifiedSession(db, { wallet: PLAYER });
  await seedAchievementUnlock(db, { wallet: PLAYER, achievementId: 'chikun-coast-legend', tier: 'platinum', sessionId32: session.sessionId32 });
  const logs = [
    achievementLog({ achievementId: 'chikun-coast-legend', sessionId32: session.sessionId32, tokenId: 123456789n, blockNumber: 40 }),
    achievementLog({ achievementId: 'chikun-first-flight', sessionId32: session.sessionId32, tokenId: 5n, blockNumber: 41 }),
    achievementLog({ achievementId: 'not-in-any-catalog', sessionId32: session.sessionId32, blockNumber: 42 }),
    achievementLog({ achievementId: 'chikun-first-flight', sessionId32: randomHex32(), wallet: `0x${'b8'.repeat(20)}`, blockNumber: 43 }),
  ];
  const result = await run(db, fakeChain({ logs }));
  assert.equal(result.achievements, 1);
  assert.equal(result.skipped, 3, 'unknown ids and mints without a recorded unlock are skipped');
  const rows = await db.query(`SELECT achievement_id, token_id, mint_tx_hash, minted_at IS NOT NULL AS minted, nft FROM achievement_unlocks ORDER BY wallet, achievement_id`);
  assert.deepEqual(rows.map((row) => [row.achievement_id, row.token_id, row.mint_tx_hash, row.minted]), [
    ['chikun-coast-legend', '123456789', logs[0].transactionHash, true],
  ], 'a mint only stamps the matching row; it never creates achievement history (§4.3.10, §3.3)');
}));

test('profile events re-read getProfile and sanitize', async () => withDb(async (db) => {
  const blockedWallet = `0x${'c9'.repeat(20)}`;
  await seedWalletProfile(db, { wallet: PLAYER, displayName: 'Old Name', hidden: true });
  const chain = fakeChain({
    logs: [
      profileLog({ kind: 'ProfileCreated', wallet: PLAYER, name: 'Lit Pilot', blockNumber: 50 }),
      profileLog({ kind: 'ProfileUpdated', wallet: PLAYER, name: 'Lit Pilot', blockNumber: 51 }),
      profileLog({ kind: 'ProfileUpdated', wallet: blockedWallet, name: 'Official Admin', blockNumber: 52 }),
    ],
    profiles: new Map([
      [PLAYER, { name: 'Lit  Pilot', avatarUri: 'lestersarcade:avatar/lester', lastUpdated: T0 + 100 }],
      [blockedWallet, { name: 'Official Admin', avatarUri: 'https://evil.example/a.png' }],
    ]),
  });
  const result = await run(db, chain);
  assert.equal(result.profiles, 2, 'one getProfile read per wallet per chunk');
  assert.equal(chain.calls.filter((entry) => entry.selector === profileIface.getFunction('getProfile').selector).length, 2);
  const rows = await db.query('SELECT wallet, display_name, name_blocked, avatar_uri, hidden, profile_block::text AS block FROM wallet_profiles ORDER BY wallet');
  assert.deepEqual(rows.map((row) => [row.wallet, row.display_name, row.name_blocked, row.avatar_uri, row.hidden]), [
    [PLAYER, 'Lit Pilot', null, 'lestersarcade:avatar/lester', true],
    [blockedWallet, null, 'impersonation', null, false],
  ], 'names are the chain values after sanitizing and moderation, and hidden is never touched');
}));

test('cursor advances per chunk within the time budget', async () => withDb(async (db) => {
  let now = 0;
  const clock = () => { now += 10; return now; };
  const logs = [scoreLog({ blockNumber: 5 }), scoreLog({ blockNumber: 15 }), scoreLog({ blockNumber: 95 })];
  const chain = fakeChain({ logs, head: 100 });
  const first = await run(db, chain, { nowMs: clock, chunk: 10, budgetMs: 45, startBlock: 1 });
  assert.equal(first.fromBlock, 1);
  assert.ok(first.chunks >= 1 && first.chunks < 10, `stopped by the budget after ${first.chunks} chunks`);
  assert.equal(first.toBlock, first.chunks * 10);
  assert.equal((await db.query('SELECT last_block::int AS n FROM indexer_state WHERE stream = $1', [INDEXER_STREAM]))[0].n, first.toBlock);
  assert.equal(first.lagBlocks, 100 - first.toBlock);
  const rest = await run(db, chain, { chunk: 10, maxChunks: 3 });
  assert.equal(rest.fromBlock, first.toBlock + 1, 'the next run resumes after the saved cursor');
  assert.equal(rest.chunks, 3, 'maxChunks caps one call');
  const tail = await run(db, chain, { chunk: 50 });
  assert.equal(tail.toBlock, 100);
  assert.equal(tail.lagBlocks, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM verified_sessions')).at(0).n, 3);
  for (const filter of chain.filters) {
    assert.ok(filter.toBlock - filter.fromBlock < 50, 'chunks never exceed their size');
  }
}));

test('decoy contracts emitting the same topics are ignored', async () => withDb(async (db) => {
  const real = await seedVerifiedSession(db, { wallet: PLAYER, score: 10, status: 'submitted' });
  const decoyScore = scoreLog({ address: DECOY, sessionId32: real.sessionId32, score: 10n, blockNumber: 12 });
  const decoyOrphan = scoreLog({ address: DECOY, score: 9_999_999n, blockNumber: 13 });
  const decoyAchievement = achievementLog({ address: DECOY, achievementId: 'chikun-coast-legend', sessionId32: real.sessionId32, blockNumber: 14 });
  const decoyProfile = profileLog({ address: DECOY, wallet: PLAYER, name: 'Fake Name', blockNumber: 15 });
  const chain = fakeChain({ logs: [decoyScore, decoyOrphan, decoyAchievement, decoyProfile], profiles: new Map([[PLAYER, { name: 'Fake Name' }]]) });
  const result = await run(db, chain);
  assert.deepEqual([result.scores, result.achievements, result.profiles], [0, 0, 0]);
  assert.equal((await sessionRow(db, real.sessionId32)).status, 'submitted');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM verified_sessions')).at(0).n, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM wallet_profiles')).at(0).n, 0);
  const expected = new Set([REGISTRY, DEPLOYED.addresses.playerProfileRegistry, ...Object.values(DEPLOYED.addresses.achievementRegistries)]);
  assert.ok(chain.filters.length >= 5);
  for (const filter of chain.filters) {
    assert.equal(typeof filter.address, 'string', 'every getLogs call carries an explicit address');
    assert.ok(expected.has(filter.address), filter.address);
  }
  assert.deepEqual(new Set(chain.filters.map((filter) => filter.address)), expected);
  assert.ok(chain.filters.some((filter) => filter.topics[0] === EVENT_TOPICS.ScoreSubmitted));
}));

test('a log that disagrees with the row is flagged, not confirmed', async () => withDb(async (db) => {
  const row = await seedVerifiedSession(db, { wallet: PLAYER, score: 1000, status: 'submitted' });
  const otherPlayer = await seedVerifiedSession(db, { wallet: PLAYER, score: 5, status: 'signed' });
  const otherGame = await seedVerifiedSession(db, { wallet: PLAYER, score: 6, status: 'signed' });
  const chain = fakeChain({
    logs: [
      scoreLog({ sessionId32: row.sessionId32, score: 999_999n, blockNumber: 60 }),
      scoreLog({ sessionId32: otherPlayer.sessionId32, score: 5n, player: `0x${'ee'.repeat(20)}`, blockNumber: 61 }),
      scoreLog({ sessionId32: otherGame.sessionId32, score: 6n, gameId: 'stacked', blockNumber: 62 }),
    ],
  });
  const result = await run(db, chain);
  assert.equal(result.mismatches, 3);
  assert.equal(result.scores, 0);
  for (const seeded of [row, otherPlayer, otherGame]) {
    const stored = await sessionRow(db, seeded.sessionId32);
    assert.equal(stored.chain_mismatch, true);
    assert.equal(stored.status, seeded.status, 'the row is left as is');
    assert.equal(stored.score, String(seeded.score));
  }
}));

test('unknown games are skipped without freezing the cursor', async () => withDb(async (db) => {
  const chain = fakeChain({
    logs: [
      scoreLog({ gameId32: ethers.id('tetris'), blockNumber: 70 }),
      scoreLog({ seasonId32: ethers.id('chikun-season-99'), blockNumber: 71 }),
      scoreLog({ gameId: 'chikun', seasonId32: INDEX_GAMES.stacked.seasonId32, blockNumber: 72 }),
      scoreLog({ score: 10_000_000_001n, blockNumber: 73 }),
      scoreLog({ score: 42n, runtimeId32: ethers.id('chikun:canvas-runtime-v8'), blockNumber: 74 }),
    ],
    head: 80,
  });
  const result = await run(db, chain);
  assert.equal(result.skipped, 3, 'unknown games and seasons are counted, never inserted');
  assert.equal(result.failed, 1, 'a row the CHECK rejects is counted and skipped');
  assert.equal(result.scores, 1, 'an unknown runtime keeps its hex id');
  assert.equal(result.toBlock, 80);
  assert.equal((await db.query('SELECT last_block::int AS n FROM indexer_state')).at(0).n, 80, 'the cursor moves past logs that can never succeed');
  const [row] = await db.query('SELECT game_id, runtime_id FROM verified_sessions');
  assert.deepEqual(row, { game_id: 'chikun', runtime_id: ethers.id('chikun:canvas-runtime-v8') });
}));

test('chain read failures keep the cursor and old nonces and rate windows are cleaned up', async () => withDb(async (db) => {
  await db.query("INSERT INTO auth_nonces (nonce, wallet, expires_at) VALUES ($1, NULL, '2026-09-23T09:00:00Z'), ($2, NULL, '2026-09-23T11:30:00Z')", ['a'.repeat(72), 'b'.repeat(72)]);
  await db.query("INSERT INTO rate_limits (bucket, window_start, hits) VALUES ('old', '2026-09-20T00:00:00Z', 3), ('new', '2026-09-23T11:00:00Z', 1)");
  await assert.rejects(run(db, fakeChain({ failGetLogs: true })), (error) => error.chainIo === true && !String(error.message).includes('secret-key'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM indexer_state')).at(0).n, 0, 'nothing is saved for a failed chunk');
  await run(db, fakeChain({ head: 5 }));
  assert.deepEqual((await db.query('SELECT nonce FROM auth_nonces')).map((row) => row.nonce), ['b'.repeat(72)]);
  assert.deepEqual((await db.query('SELECT bucket FROM rate_limits')).map((row) => row.bucket), ['new']);
}));

function cronHandler({ db, deployment = DEPLOYED, chain, envOverride = env }) {
  return createHandler(() => buildDeps(envOverride, { db, deployment, provider: chain, nowMs: Date.parse('2026-09-23T12:00:00.000Z') }));
}

test('the cron migrates first and reports the schema version', async () => {
  const db = createPgliteClient();
  try {
    const chain = fakeChain({ logs: [scoreLog({ blockNumber: 3 })], head: 10 });
    const response = await invoke(cronHandler({ db, chain }), { url: '/api/cron/index-chain', headers: { Authorization: `Bearer ${CRON_VALUE}` } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body.schemaVersion, 2);
    assert.deepEqual(response.body.appliedMigrations, [1, 2], 'the unmigrated database was migrated by the cron');
    assert.deepEqual(
      [response.body.fromBlock, response.body.toBlock, response.body.scores, response.body.achievements, response.body.profiles, response.body.skipped, response.body.mismatches, response.body.lagBlocks],
      [1, 10, 1, 0, 0, 0, 0, 0],
    );
    const again = await invoke(cronHandler({ db, chain }), { url: '/api/cron/index-chain', headers: { authorization: `Bearer ${CRON_VALUE}` } });
    assert.deepEqual([again.body.schemaVersion, again.body.appliedMigrations], [2, []]);
    const failing = await invoke(cronHandler({ db, chain: fakeChain({ failGetLogs: true, head: 20 }) }), { url: '/api/cron/index-chain', headers: { authorization: `Bearer ${CRON_VALUE}` } });
    assert.deepEqual([failing.status, failing.body.error], [502, 'chain-read-failed']);
  } finally {
    await db.close();
  }
});

test('cron rejects missing or wrong CRON_SECRET', async () => {
  let touched = false;
  const db = { schemaKey: 'never-used', async query() { touched = true; return []; } };
  const chain = fakeChain();
  for (const headers of [{}, { authorization: `Bearer ${CRON_VALUE}x` }, { authorization: CRON_VALUE }, { authorization: `Basic ${CRON_VALUE}` }]) {
    const response = await invoke(cronHandler({ db, chain }), { url: '/api/cron/index-chain', headers });
    assert.deepEqual([response.status, response.body], [401, { ok: false, error: 'unauthorized' }]);
  }
  const unset = await invoke(cronHandler({ db, chain, envOverride: { VERCEL_ENV: 'development' } }), { url: '/api/cron/index-chain', headers: { authorization: 'Bearer ' } });
  assert.equal(unset.status, 401, 'a missing CRON_SECRET rejects every call');
  const short = await invoke(cronHandler({ db, chain, envOverride: { CRON_SECRET: 'short' } }), { url: '/api/cron/index-chain', headers: { authorization: 'Bearer short' } });
  assert.equal(short.status, 401, 'a secret under 32 characters counts as missing');
  assert.equal(touched, false);
  assert.equal(chain.filters.length, 0);
  const post = await invoke(cronHandler({ db, chain }), { method: 'POST', url: '/api/cron/index-chain', headers: { authorization: `Bearer ${CRON_VALUE}` } });
  assert.equal(post.status, 405);
});

test('not-deployed skips cleanly', async () => {
  const db = createPgliteClient();
  try {
    const chain = fakeChain({ logs: [scoreLog({ blockNumber: 3 })] });
    for (const status of ['predicted', 'unavailable']) {
      const response = await invoke(cronHandler({ db, chain, deployment: { ...DEPLOYED, status } }), { url: '/api/cron/index-chain', headers: { authorization: `Bearer ${CRON_VALUE}` } });
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.skipped, 'not-deployed');
      assert.equal(response.body.schemaVersion, 2);
    }
    assert.equal(chain.filters.length, 0, 'no chain reads before deployment');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM verified_sessions')).at(0).n, 0);
    const noDb = await invoke(createHandler(() => buildDeps(env, { deployment: DEPLOYED, provider: chain })), { url: '/api/cron/index-chain', headers: { authorization: `Bearer ${CRON_VALUE}` } });
    assert.deepEqual([noDb.status, noDb.body.error], [503, 'index-not-configured']);
  } finally {
    await db.close();
  }
});

test('the cron needs RANKED_SCORE_REGISTRY_ADDRESS to match the deployment', async () => {
  const db = createPgliteClient();
  try {
    const chain = fakeChain({ logs: [scoreLog({ blockNumber: 3 })], head: 10 });
    const headers = { authorization: `Bearer ${CRON_VALUE}` };
    const { RANKED_SCORE_REGISTRY_ADDRESS: _unused, ...withoutRegistry } = env;
    const absent = await invoke(cronHandler({ db, chain, envOverride: withoutRegistry }), { url: '/api/cron/index-chain', headers });
    assert.deepEqual([absent.status, absent.body.error, absent.body.detail], [503, 'settlement-not-configured', 'RANKED_SCORE_REGISTRY_ADDRESS']);
    assert.deepEqual([absent.body.schemaVersion, absent.body.appliedMigrations], [2, [1, 2]], 'the migration step still runs (§13 step 8b)');
    assert.equal(absent.headers['cache-control'], 'no-store');
    const other = await invoke(cronHandler({ db, chain, envOverride: { ...env, RANKED_SCORE_REGISTRY_ADDRESS: `0x${'9f'.repeat(20)}` } }), { url: '/api/cron/index-chain', headers });
    assert.deepEqual([other.status, other.body.error, other.body.schemaVersion], [503, 'address-mismatch', 2]);
    const malformed = await invoke(cronHandler({ db, chain, envOverride: { ...env, RANKED_SCORE_REGISTRY_ADDRESS: 'not-an-address' } }), { url: '/api/cron/index-chain', headers });
    assert.deepEqual([malformed.status, malformed.body.error], [503, 'settlement-not-configured']);
    assert.equal(chain.filters.length, 0, 'nothing is indexed from a misconfigured environment');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM indexer_state')).at(0).n, 0);
    const skipped = await invoke(cronHandler({ db, chain, envOverride: withoutRegistry, deployment: { ...DEPLOYED, status: 'predicted' } }), { url: '/api/cron/index-chain', headers });
    assert.deepEqual([skipped.status, skipped.body.skipped], [200, 'not-deployed'], 'before deployment the address is not needed');
    const matched = await invoke(cronHandler({ db, chain }), { url: '/api/cron/index-chain', headers });
    assert.deepEqual([matched.status, matched.body.scores], [200, 1], 'a case-insensitive match indexes');
  } finally {
    await db.close();
  }
});

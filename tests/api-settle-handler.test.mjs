import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import { buildSiweChallenge } from '../apps/portal/src/wallet-auth.mjs';
import { RANKED_GAMES, rankedEnvelopeHash } from '../apps/portal/src/ranked-identity.mjs';
import { deriveRankedSeed } from '../apps/portal/src/session-seed.mjs';
import * as achievements from '../apps/portal/src/achievements/index.mjs';
import * as verify from '../server/verify/index.mjs';
import { HMH_FREE_HEROES, HMH_HERO_GATES } from '../server/verify/hmh.mjs';
import { issueSeedTicket } from '../server/verify/seed-ticket.mjs';
import { periodKeysFor } from '../server/neon/period-keys.mjs';
import * as settleApi from '../api/settle.mjs';
import * as statusApi from '../api/settle-status.mjs';
import * as seedApi from '../api/ranked-seed.mjs';
import * as nonceApi from '../api/session-nonce.mjs';
import * as sessionApi from '../api/session.mjs';
import * as retryApi from '../api/cron/settle-retry.mjs';
import { localContracts } from '../scripts/lib/local-chain.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import {
  bootLocalChain, createCatalogDouble, createVerifyDouble, deriveRankedSeedDouble, fixtureEnv, HERO_GATES_DOUBLE, issueSeedTicketDouble,
  openPaidSession, REAL_SETTLEMENT_GAS_RESERVE_WEI, SETTLE_CRON_VALUE, SETTLE_SESSION_VALUE,
} from './helpers/settle-fixtures.mjs';
import {
  buildFixtureBody, FIXTURE_BUILD_HASHES, FIXTURE_UUID, FIXTURE_VERIFY_AT_MS, fixtureVerifyOptions, readFixture,
} from './fixtures/ranked/build-fixtures.mjs';

/**
 * Contract §10.4 rule 6, the settle-wiring proof: the REAL handlers end to end.
 * Every endpoint is mounted exactly as production mounts it,
 * createHandler(() => buildDeps(env, { db, provider, deployment, nowMs })),
 * with nothing swapped after buildDeps: the real verify slice
 * (server/verify/**), the real achievements registry, the real seed tickets,
 * an UNMIGRATED PGlite (the first request must migrate through ensureSchema,
 * A34) and the in-process Hardhat chain (chainId 4441) with its own
 * deployment record. The player signs in through E1 and E2, takes a ticket
 * from E15, plays (verify's evidence generators at the ticket seed), pays
 * openSession on chain, lets chain time pass the run length and settles
 * through E3; E4 then reports the published run.
 */

const IP = '203.0.113.41';
const DOMAIN = 'lestersarcade.io';
let local;
let registry;
let env;
let db;
let clockMs = 0;
const nowMs = () => clockMs;
const tokens = new Map();

before(async () => {
  local = await bootLocalChain();
  registry = local.record.addresses.scoreSubmissionRegistry.toLowerCase();
  env = fixtureEnv({ registry });
  db = createPgliteClient();
  await syncClock();
});

after(async () => {
  await db?.close();
  await local?.chain.close();
});

async function syncClock(offsetMs = 1000) {
  clockMs = (await local.chain.latestTimestamp()) * 1000 + offsetMs;
  return clockMs;
}

async function advanceChain(seconds) {
  await local.chain.increaseTime(seconds);
  await local.chain.mine();
  return syncClock();
}

// The production mount: buildDeps with only the database, chain, deployment
// and clock overridden (A30). Nothing is patched onto the deps afterwards.
function mount(api, { provider = true } = {}) {
  const overrides = { db, deployment: local.deployment, nowMs };
  if (provider) overrides.provider = provider === true ? local.chain.provider : provider;
  return api.createHandler(() => api.buildDeps(env, overrides));
}

// The local provider with some calls replaced (an RPC outage, for example).
function wrapProvider(replaced) {
  const base = local.chain.provider;
  return new Proxy(base, {
    get(target, key) {
      if (Object.hasOwn(replaced, key)) return replaced[key];
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const handlers = {};
function handler(name) {
  handlers[name] ??= {
    nonce: () => mount(nonceApi, { provider: false }),
    session: () => mount(sessionApi, { provider: false }),
    seed: () => mount(seedApi, { provider: false }),
    settle: () => mount(settleApi),
    status: () => mount(statusApi),
  }[name]();
  return handlers[name];
}

// E1 then E2: a real SIWE login on a server nonce, signed by the fixture wallet.
async function login(wallet) {
  const key = wallet.address.toLowerCase();
  if (tokens.has(key)) return tokens.get(key);
  const nonce = await invoke(handler('nonce'), { url: '/api/session-nonce', headers: { 'x-forwarded-for': IP } });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
  const challenge = buildSiweChallenge({ domain: DOMAIN, address: wallet.address, chainId: 4441, nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt });
  const signature = await wallet.signMessage(challenge.message);
  const session = await invoke(handler('session'), { method: 'POST', url: '/api/session', headers: { 'x-forwarded-for': IP }, body: { challenge, signature } });
  assert.equal(session.status, 200, JSON.stringify(session.body));
  assert.equal(session.body.wallet, key);
  tokens.set(key, session.body.token);
  return session.body.token;
}

async function authHeaders(wallet) {
  return { authorization: `Bearer ${await login(wallet)}`, 'x-forwarded-for': IP };
}

// E15: the server seed ticket for a fresh session handle.
async function seedTicketFor(wallet, gameId) {
  const uuid = randomUUID();
  const request = { gameId, sessionId: `game-session-${uuid}`, seasonId: RANKED_GAMES[gameId].seasonId, buildHash: FIXTURE_BUILD_HASHES[gameId] };
  const response = await invoke(handler('seed'), { method: 'POST', url: '/api/ranked-seed', headers: await authHeaders(wallet), body: request });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.seedTicket.issuedAt, Math.floor(clockMs / 1000), 'issuedAt comes from the injected clock');
  return { uuid, ...response.body };
}

// A ticket from E15, then verify's generator plays the run at the ticket seed
// against the LOCAL registry. The generator re-issues the same ticket from
// the salt and issuedAt under the same SESSION_SECRET, so the body carries
// exactly what E15 returned.
const EVIDENCE = Object.freeze({
  chikun: { profile: 'expert', maxMinutes: 1.5 },
  stacked: { topOutAtTick: 3600 },
  'lester-blaster': { plan: 'valid' },
});

async function playRun(wallet, gameId, { evidence = EVIDENCE[gameId] } = {}) {
  const ticket = await seedTicketFor(wallet, gameId);
  const built = await buildFixtureBody({
    gameId, wallet: wallet.address, registry, secret: SETTLE_SESSION_VALUE, uuid: ticket.uuid,
    salt: ticket.seedTicket.salt, issuedAt: ticket.seedTicket.issuedAt, evidence,
  });
  assert.deepEqual(built.body.seedTicket, ticket.seedTicket, 'the body carries the E15 ticket');
  assert.equal(built.seed, ticket.seed, 'evidence is played at the E15 seed');
  return built.body;
}

// The run length the chain must pass before E3 accepts it (A26), from the
// real verifier (no chain, no database: a pure check of the body).
async function verifiedPreview(body, wallet) {
  const run = await verify.verifyRankedRun(body, {
    chainId: 4441, scoreRegistryAddress: registry, wallet: wallet.address.toLowerCase(), nowMs: clockMs, seedSecret: SETTLE_SESSION_VALUE,
  });
  assert.equal(run.ok, true, JSON.stringify(run));
  return run;
}

async function payAndWait(body, wallet, { survivalSeconds }) {
  const paid = await openPaidSession({ chain: local.chain, record: local.record, player: wallet, sessionId32: body.sessionId32, gameId: body.gameId });
  body.entryTxHash = paid.txHash;
  await advanceChain(survivalSeconds + 1);
  return paid;
}

function postSettle(body, headers) {
  return invoke(handler('settle'), { method: 'POST', url: '/api/settle', headers, body });
}

function getStatus(sessionId32, headers = { 'x-forwarded-for': IP }) {
  return invoke(handler('status'), { url: `/api/settle-status?sessionId32=${sessionId32}`, headers });
}

async function rowFor(sessionId32) {
  const rows = await db.query(
    `SELECT status, wallet, game_id, score::text AS score, kills::text AS kills, max_combo::text AS max_combo,
            survival_seconds::text AS survival_seconds, boss_id, stats::text AS stats, envelope_hash, runtime_id, season_id,
            build_hash, seed::text AS seed, entry_amount_wei, client_claim::text AS client_claim, plausibility::text AS plausibility,
            day_key, week_key, month_key, tx_hash, block_number::text AS block_number, attempts, last_error,
            array_to_json(achievements)::text AS achievements, array_to_json(nft_achievements)::text AS nft_achievements,
            to_char(opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS opened_at
       FROM verified_sessions WHERE session_id32 = $1`,
    [sessionId32],
  );
  return rows[0] ?? null;
}

async function evidenceFor(sessionId32) {
  const rows = await db.query('SELECT encoding, evidence, evidence_bytes, evidence_digest, identity::text AS identity FROM session_evidence WHERE session_id32 = $1', [sessionId32]);
  return rows[0] ?? null;
}

async function unlocksFor(sessionId32) {
  const rows = await db.query('SELECT wallet, game_id, achievement_id, tier, nft, token_id FROM achievement_unlocks WHERE session_id32 = $1 ORDER BY achievement_id', [sessionId32]);
  return rows;
}

async function countRows(table) {
  const rows = await db.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

function relayerNonce() {
  return local.chain.provider.getTransactionCount(local.chain.wallets.relayer.address, 'latest');
}

async function onChainSession(sessionId32) {
  return localContracts(local.record, local.chain.provider).scores.getSession(sessionId32);
}

// Every table a rejected settle must leave untouched, plus the relayer nonce.
async function snapshotSideEffects() {
  return {
    sessions: await countRows('verified_sessions'),
    evidence: await countRows('session_evidence'),
    unlocks: await countRows('achievement_unlocks'),
    nonce: await relayerNonce(),
  };
}

// Settles one run and asserts every record the contract names (DoD 1).
async function settleAndAssert(gameId, { wallet = local.chain.wallets.player1, claimScore = null } = {}) {
  const body = await playRun(wallet, gameId);
  if (claimScore !== null) body.claim = { score: claimScore };
  const expected = await verifiedPreview(body, wallet);
  const history = await achievements.emptyHistory(wallet.address.toLowerCase(), gameId);
  const expectedUnlocks = achievements.deriveEarnedAchievements(gameId, expected, history).map((entry) => entry.id).sort();
  assert.ok(expectedUnlocks.length > 0, `a first ${gameId} run earns catalog achievements`);
  const nftIds = new Set(achievements.nftAchievementIds(gameId));
  const paid = await payAndWait(body, wallet, { survivalSeconds: expected.contract.survivalSeconds });
  const nonceBefore = await relayerNonce();

  const response = await postSettle(body, await authHeaders(wallet));
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const view = response.body;
  assert.equal(view.view, 'owner');
  assert.equal(view.status, 'confirmed', JSON.stringify(view));
  assert.equal(view.sessionId32, body.sessionId32);
  assert.equal(view.shareId, body.sessionId32.slice(2));
  assert.equal(view.gameId, gameId);
  assert.equal(view.wallet, wallet.address.toLowerCase());
  assert.equal(view.score, expected.score, 'the server-verified score');
  assert.deepEqual(view.contract, { ...expected.contract });
  assert.deepEqual(view.stats, JSON.parse(JSON.stringify(expected.stats)), 'server-derived stats');
  assert.equal(view.envelopeHash, expected.envelopeHash);
  assert.match(view.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(view.explorerUrl, `https://liteforge.explorer.caldera.xyz/tx/${view.txHash}`);
  assert.equal(view.retryable, false);
  assert.equal(view.attempts, 0);
  assert.equal(view.lastError, null);
  assert.equal(view.pollAfterMs, null);
  assert.deepEqual(view.achievements.map((item) => item.id).sort(), expectedUnlocks, 'achievements recorded by this session');
  for (const item of view.achievements) {
    const entry = achievements.achievementById(gameId, item.id);
    assert.deepEqual([item.gameId, item.title, item.tier, item.image, item.nft, item.tokenId], [gameId, entry.title, entry.tier, entry.image, nftIds.has(item.id), null]);
  }
  assert.equal(await relayerNonce(), nonceBefore + 1, 'one relayed transaction');
  const receipt = await local.chain.provider.getTransactionReceipt(view.txHash);
  assert.equal(receipt.status, 1);
  assert.equal(view.blockNumber, receipt.blockNumber);
  assert.equal(receipt.from.toLowerCase(), local.chain.wallets.relayer.address.toLowerCase(), 'the relayer published it');

  // verified_sessions: the row the pipeline wrote, confirmed after the receipt.
  const row = await rowFor(body.sessionId32);
  assert.equal(row.status, 'confirmed');
  assert.equal(row.wallet, wallet.address.toLowerCase());
  assert.equal(row.game_id, gameId);
  assert.equal(Number(row.score), expected.score);
  assert.deepEqual([Number(row.kills), Number(row.max_combo), Number(row.survival_seconds), row.boss_id], [expected.contract.kills, expected.contract.maxCombo, expected.contract.survivalSeconds, expected.contract.bossId]);
  assert.deepEqual(JSON.parse(row.stats), JSON.parse(JSON.stringify(expected.stats)));
  assert.equal(row.envelope_hash, expected.envelopeHash);
  assert.deepEqual([row.runtime_id, row.season_id, row.build_hash, Number(row.seed)], [RANKED_GAMES[gameId].runtimeId, RANKED_GAMES[gameId].seasonId, FIXTURE_BUILD_HASHES[gameId], body.identity.seed]);
  assert.equal(row.entry_amount_wei, paid.amountWei.toString());
  assert.equal(BigInt(row.entry_amount_wei) >= BigInt('102000000000000000'), true, 'the 0.102 zkLTC entry');
  assert.equal(row.opened_at, new Date(paid.openedAt * 1000).toISOString());
  const keys = periodKeysFor(paid.openedAt * 1000);
  assert.deepEqual([row.day_key, row.week_key, row.month_key], [keys.day, keys.week, keys.month]);
  assert.deepEqual(row.client_claim === null ? null : JSON.parse(row.client_claim), body.claim ?? null, 'the claim is stored, never trusted');
  if (gameId === 'lester-blaster') {
    assert.deepEqual(JSON.parse(row.plausibility), JSON.parse(JSON.stringify(expected.plausibility)), 'the HMH validator verdict is stored');
    assert.notEqual(expected.plausibility, null);
  } else {
    assert.equal(row.plausibility, null);
  }
  assert.equal(row.tx_hash, view.txHash);
  assert.equal(Number(row.block_number), receipt.blockNumber);
  assert.deepEqual(JSON.parse(row.achievements).sort(), expectedUnlocks);
  assert.deepEqual(JSON.parse(row.nft_achievements), expectedUnlocks.filter((id) => nftIds.has(id)));

  // session_evidence: exactly what the verifier stored and hashed (§2.6).
  const stored = await evidenceFor(body.sessionId32);
  assert.deepEqual([stored.encoding, stored.evidence, stored.evidence_bytes, stored.evidence_digest], [expected.evidence.encoding, expected.evidence.text, expected.evidence.bytes, expected.evidence.digest]);
  assert.deepEqual(JSON.parse(stored.identity), { ...expected.identity });
  const digest = await verify.computeEvidenceDigest(body);
  assert.equal(stored.evidence_digest, digest.digest);

  // achievement_unlocks: derived by the server from the verified run and history.
  const unlocks = await unlocksFor(body.sessionId32);
  assert.deepEqual(unlocks.map((unlock) => unlock.achievement_id), expectedUnlocks);
  for (const unlock of unlocks) {
    assert.deepEqual([unlock.wallet, unlock.game_id, unlock.tier, unlock.nft, unlock.token_id], [wallet.address.toLowerCase(), gameId, achievements.achievementById(gameId, unlock.achievement_id).tier, nftIds.has(unlock.achievement_id), null]);
  }

  // On chain: the registry holds the run for this player.
  const session = await onChainSession(body.sessionId32);
  assert.equal(session.exists, true);
  assert.equal(session.verified, true);
  assert.equal(session.player.toLowerCase(), wallet.address.toLowerCase());
  assert.equal(session.gameId, ethers.id(gameId));
  assert.deepEqual([session.score, session.kills, session.maxCombo, session.survivalSeconds], [BigInt(expected.score), BigInt(expected.contract.kills), BigInt(expected.contract.maxCombo), BigInt(expected.contract.survivalSeconds)]);
  assert.equal(session.runtimeId, ethers.id(RANKED_GAMES[gameId].runtimeId));
  assert.equal(session.seasonId, ethers.id(RANKED_GAMES[gameId].seasonId));
  assert.equal(session.bossId, expected.contract.bossId ? ethers.id(expected.contract.bossId) : ethers.ZeroHash);

  // E4: the owner view for the row's wallet, the public view otherwise.
  const owner = await getStatus(body.sessionId32, await authHeaders(wallet));
  assert.equal(owner.status, 200);
  assert.deepEqual(owner.body, view, 'E4 owner view equals the E3 response');
  const publicView = await getStatus(body.sessionId32);
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.view, 'public');
  assert.equal(publicView.body.status, 'confirmed');
  assert.equal(publicView.body.score, expected.score);
  assert.equal(publicView.body.txHash, view.txHash);
  for (const key of ['wallet', 'lastError', 'attempts']) assert.equal(Object.hasOwn(publicView.body, key), false, `no ${key} in the public view`);
  return { body, view, expected };
}

const results = {};

test('the real handler seam loads the real verify, achievements and seed-ticket modules', async () => {
  const deps = await settleApi.buildDeps(env, { db, provider: local.chain.provider, deployment: local.deployment, nowMs });
  for (const name of ['bindRankedIdentity', 'verifyRankedRun', 'computeEvidenceDigest', 'reverifyStoredRun']) assert.equal(deps.verify[name], verify[name], name);
  for (const name of ['deriveEarnedAchievements', 'historyFieldsFor', 'nftAchievementIds', 'achievementById', 'catalogFor']) assert.equal(deps.catalog[name], achievements[name], name);
  const heroes = await deps.heroGates();
  assert.equal(heroes.gates, HMH_HERO_GATES);
  assert.equal(heroes.free, HMH_FREE_HEROES);
  const seedDeps = await seedApi.buildDeps(env, { db, deployment: local.deployment, nowMs });
  assert.equal(seedDeps.issueSeedTicket, issueSeedTicket);
  assert.equal(deps.config.settlementReady, true, JSON.stringify(deps.config));
  // The fee cap uses the deployment's own 0.002 zkLTC reserve, not a test override.
  assert.equal(deps.deployment.settlementGasReserveWei, local.record.settlementGasReserveWei);
  assert.equal(local.record.settlementGasReserveWei, REAL_SETTLEMENT_GAS_RESERVE_WEI);
  // The database is still unmigrated: the first request must migrate it (A34).
  const tables = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'verified_sessions'");
  assert.equal(tables[0].n, 0);
});

test('real handler settles a Chikun, a STACKED and an HMH run end to end on the local chain', async () => {
  const player = local.chain.wallets.player1;
  results.chikun = await settleAndAssert('chikun', { wallet: player, claimScore: 999_999_999 });
  assert.notEqual(results.chikun.view.score, 999_999_999, 'a tampered claim score is ignored (A9)');
  results.stacked = await settleAndAssert('stacked', { wallet: player });
  results.hmh = await settleAndAssert('lester-blaster', { wallet: player });
});

test('a token for another wallet is 403 and writes nothing', async () => {
  const player = local.chain.wallets.player1;
  const body = await playRun(player, 'chikun');
  const expected = await verifiedPreview(body, player);
  await payAndWait(body, player, { survivalSeconds: expected.contract.survivalSeconds });
  const before = await snapshotSideEffects();
  const response = await postSettle(body, await authHeaders(local.chain.wallets.player2));
  assert.deepEqual([response.status, response.body.error], [403, 'wallet-mismatch']);
  assert.deepEqual(await snapshotSideEffects(), before);
  // The owner can still settle it.
  const owned = await postSettle(body, await authHeaders(player));
  assert.deepEqual([owned.status, owned.body.status], [200, 'confirmed'], JSON.stringify(owned.body));
});

test('an unpaid session is 402 before any verification or write', async () => {
  const player = local.chain.wallets.player2;
  const body = await playRun(player, 'stacked');
  await advanceChain(120);
  const before = await snapshotSideEffects();
  const response = await postSettle(body, await authHeaders(player));
  assert.deepEqual([response.status, response.body.error], [402, 'entry-not-paid']);
  assert.deepEqual(await snapshotSideEffects(), before);
  assert.equal((await onChainSession(body.sessionId32)).exists, false);
});

test('tampered evidence is rejected by the real verifiers and writes nothing', async () => {
  const player = local.chain.wallets.player2;
  // Chikun: a flap listed after the run's final tick fails the canonical replay.
  const chikun = await playRun(player, 'chikun');
  const run = await verifiedPreview(chikun, player);
  chikun.evidence.flap.flapDeltas = [...chikun.evidence.flap.flapDeltas, 60_000];
  await payAndWait(chikun, player, { survivalSeconds: run.contract.survivalSeconds });
  let before = await snapshotSideEffects();
  const replay = await postSettle(chikun, await authHeaders(player));
  assert.deepEqual([replay.status, replay.body.error], [422, 'replay-rejected'], JSON.stringify(replay.body));
  assert.deepEqual(await snapshotSideEffects(), before);

  // HMH: an inflated score is above the reboot ceiling (the envelope does not
  // bind the summary totals, the plausibility validator does).
  const hmh = await playRun(player, 'lester-blaster');
  const hmhRun = await verifiedPreview(hmh, player);
  hmh.evidence.runSummary.totals.score *= 1000;
  await payAndWait(hmh, player, { survivalSeconds: hmhRun.contract.survivalSeconds });
  before = await snapshotSideEffects();
  const implausible = await postSettle(hmh, await authHeaders(player));
  assert.deepEqual([implausible.status, implausible.body.error], [422, 'implausible-run'], JSON.stringify(implausible.body));
  assert.ok(implausible.body.flags.length > 0 && implausible.body.flags.every((flag) => Object.keys(flag).sort().join(',') === 'id,severity'), 'flag ids and severities only');
  assert.deepEqual(await snapshotSideEffects(), before);

  // STACKED: evidence played at another seed does not bind to this ticket.
  const stacked = await playRun(player, 'stacked');
  const stackedRun = await verifiedPreview(stacked, player);
  const other = await playRun(player, 'stacked');
  stacked.evidence = other.evidence;
  await payAndWait(stacked, player, { survivalSeconds: stackedRun.contract.survivalSeconds });
  before = await snapshotSideEffects();
  const foreign = await postSettle(stacked, await authHeaders(player));
  assert.deepEqual([foreign.status, foreign.body.error], [400, 'evidence-seed-mismatch'], JSON.stringify(foreign.body));
  assert.deepEqual(await snapshotSideEffects(), before);
});

test('a duplicate settle returns the same confirmed state without a second transaction', async () => {
  const { body, view } = results.chikun;
  const player = local.chain.wallets.player1;
  const before = await snapshotSideEffects();
  const again = await postSettle(body, await authHeaders(player));
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, view, 'the same owner view');
  const retry = await postSettle({ v: body.v, sessionId32: body.sessionId32, retry: true }, await authHeaders(player));
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, view, 'a retry body sees the same state');
  assert.deepEqual(await snapshotSideEffects(), before, 'no new row and no second transaction');
  // The same session with other evidence is a conflict, never a second record.
  const conflicting = structuredClone(body);
  conflicting.evidence.flap.flapDeltas = conflicting.evidence.flap.flapDeltas.slice(0, -1);
  const conflict = await postSettle(conflicting, await authHeaders(player));
  assert.deepEqual([conflict.status, conflict.body.error], [409, 'session-conflict']);
  assert.deepEqual(await snapshotSideEffects(), before);
});

test('the retry cron re-signs from re-verified stored evidence and publishes each game', async () => {
  // E3 records and signs the runs, but the relayer's RPC is down: every row
  // waits as failed with rpc-unavailable and no attempt spent (§3.3).
  const player = local.chain.wallets.player2;
  const outage = wrapProvider({ estimateGas: async () => { throw Object.assign(new Error('rpc down'), { code: 'NETWORK_ERROR' }); } });
  const settleDuringOutage = mount(settleApi, { provider: outage });
  const waiting = [];
  for (const gameId of ['chikun', 'stacked', 'lester-blaster']) {
    const body = await playRun(player, gameId);
    const expected = await verifiedPreview(body, player);
    await payAndWait(body, player, { survivalSeconds: expected.contract.survivalSeconds });
    const response = await invoke(settleDuringOutage, { method: 'POST', url: '/api/settle', headers: await authHeaders(player), body });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual([response.body.status, response.body.lastError, response.body.attempts, response.body.retryable, response.body.pollAfterMs], ['failed', 'rpc-unavailable', 0, true, 3000]);
    const [signed] = await db.query('SELECT attestation::text AS attestation FROM verified_sessions WHERE session_id32 = $1', [body.sessionId32]);
    waiting.push({ body, expected, deadline: Number(JSON.parse(signed.attestation).deadline) });
  }
  // Past the 900 s attestation lifetime: the cron must re-sign each row from
  // its stored evidence through the real reverifyStoredRun before submitting.
  await advanceChain(1_000);
  const nonceBefore = await relayerNonce();
  const unauthorized = await invoke(mount(retryApi), { url: '/api/cron/settle-retry', headers: { authorization: 'Bearer wrong' } });
  assert.equal(unauthorized.status, 401);
  const cron = await invoke(mount(retryApi), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  assert.equal(cron.status, 200, JSON.stringify(cron.body));
  const processed = new Map(cron.body.processed.map((item) => [item.sessionId32, item]));
  assert.equal(await relayerNonce(), nonceBefore + waiting.length, 'one transaction per waiting run');
  for (const { body, expected, deadline } of waiting) {
    assert.deepEqual(processed.get(body.sessionId32), { sessionId32: body.sessionId32, from: 'failed', to: 'confirmed', code: null }, body.gameId);
    const row = await rowFor(body.sessionId32);
    assert.deepEqual([row.status, row.attempts, Number(row.score), row.envelope_hash], ['confirmed', 0, expected.score, expected.envelopeHash]);
    const [signed] = await db.query('SELECT attestation::text AS attestation FROM verified_sessions WHERE session_id32 = $1', [body.sessionId32]);
    assert.ok(Number(JSON.parse(signed.attestation).deadline) >= deadline + 1_000, `${body.gameId} was re-signed with a fresh deadline`);
    const session = await onChainSession(body.sessionId32);
    assert.deepEqual([session.exists, session.player.toLowerCase(), session.score], [true, player.address.toLowerCase(), BigInt(expected.score)]);
    const status = await getStatus(body.sessionId32);
    assert.deepEqual([status.body.view, status.body.status, status.body.txHash], ['public', 'confirmed', row.tx_hash]);
  }
});

// --- The settle doubles against the real verify functions (DoD 2) -------------
//
// tests/server-settle-core, -relayer and -retry keep the contract-shaped
// doubles of tests/helpers/settle-fixtures.mjs, whose toy replay lets a test
// choose a run's score and length. Everything else settle relies on must be
// the real verify slice's behaviour, on the committed fixtures.

const plain = (value) => JSON.parse(JSON.stringify(value));
const flipHex = (hex) => `${hex.slice(0, -1)}${hex.at(-1) === '0' ? '1' : '0'}`;
// §5.2, in the contract's order (as tests/server-verify-identity.test.mjs),
// for a body of `gameId`.
const bindingChecks = (gameId) => [
  ['identity-invalid', (body) => { body.identity.version = 'lesters-canonical-session-v1'; }],
  ['identity-game-unknown', (body) => { body.identity.gameId = 'pong'; }],
  ['identity-invalid', (body) => { body.gameId = gameId === 'chikun' ? 'stacked' : 'chikun'; }],
  ['identity-chain-mismatch', (body) => { body.identity.chainId = 31337; }],
  ['identity-registry-mismatch', (body) => { body.identity.scoreRegistryAddress = `0x${'5'.repeat(40)}`; }],
  ['identity-wallet-mismatch', (body) => { body.identity.wallet = `0x${'3c'.repeat(20)}`; }],
  ['identity-season-mismatch', (body) => { body.identity.seasonId = RANKED_GAMES[gameId === 'chikun' ? 'stacked' : 'chikun'].seasonId; }],
  ['identity-buildhash-invalid', (body) => { body.identity.buildHash = gameId === 'lester-blaster' ? FIXTURE_BUILD_HASHES.chikun : FIXTURE_BUILD_HASHES['lester-blaster']; }],
  ['identity-session-invalid', (body) => { body.identity.sessionId = 'game-session-000000001'; }],
  ['identity-nonce-mismatch', (body) => { body.identity.nonce = '22222222-2222-4222-8222-222222222222'; }],
  ['seed-ticket-invalid', (body) => { body.seedTicket.mac = flipHex(body.seedTicket.mac); }],
  ['identity-seed-mismatch', (body) => { body.identity.seed = (body.identity.seed ^ 1) >>> 0; }],
  ['session-key-mismatch', (body) => { body.sessionId32 = `0x${'9'.repeat(64)}`; }],
];

test('the settle doubles equal the real seed ticket MAC and deriveRankedSeed', async () => {
  const salt = Uint8Array.from({ length: 16 }, (_, index) => (index * 37 + 11) % 256);
  for (const gameId of Object.keys(RANKED_GAMES)) {
    const input = {
      secret: SETTLE_SESSION_VALUE, nowMs: 1_790_000_123_456, randomBytes: () => salt, sessionId: `game-session-${FIXTURE_UUID}`,
      wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', gameId, seasonId: RANKED_GAMES[gameId].seasonId, buildHash: FIXTURE_BUILD_HASHES[gameId],
    };
    const real = await issueSeedTicket(input);
    assert.deepEqual(plain(await issueSeedTicketDouble(input)), plain(real), `${gameId} ticket and seed`);
    const seedInput = { sessionId: input.sessionId, wallet: input.wallet.toLowerCase(), gameId, seasonId: input.seasonId, buildHash: input.buildHash, salt: real.seedTicket.salt };
    assert.equal(await deriveRankedSeedDouble(seedInput), await deriveRankedSeed(seedInput));
    assert.equal(real.seed, await deriveRankedSeed(seedInput));
  }
});

test('the verify double binds, digests, hashes the v2 envelope and shapes the VerifiedRun like the real verifier', async () => {
  const options = fixtureVerifyOptions();
  const double = createVerifyDouble({ nowMs: () => FIXTURE_VERIFY_AT_MS });
  for (const name of ['chikun-valid', 'stacked-valid', 'hmh-valid']) {
    const fixture = readFixture(name);
    const { body } = fixture;
    // §5.2: the same canonical identity, and every error code in the same order.
    const bound = await verify.bindRankedIdentity(body, options);
    assert.equal(bound.ok, true);
    assert.deepEqual(plain(await double.bindRankedIdentity(body, options)), plain(bound), `${name} binding`);
    const checks = bindingChecks(body.gameId);
    for (const [index, [error, mutate]] of checks.entries()) {
      const one = structuredClone(body);
      mutate(one);
      const all = structuredClone(body);
      for (const [, later] of checks.slice(index)) later(all);
      for (const mutated of [one, all]) {
        // eslint-disable-next-line no-await-in-loop
        const real = await verify.bindRankedIdentity(mutated, options);
        assert.deepEqual(plain(real), { ok: false, status: 400, error }, `${name}: real ${error}`);
        // eslint-disable-next-line no-await-in-loop
        assert.deepEqual(plain(await double.bindRankedIdentity(mutated, options)), plain(real), `${name}: double ${error}`);
      }
    }
    // §2.6: the stored evidence text, bytes and digest, without replay.
    const digest = await verify.computeEvidenceDigest(body);
    assert.deepEqual(plain(await double.computeEvidenceDigest(body)), plain(digest), `${name} digest`);
    assert.equal(digest.digest, fixture.expected.evidenceDigest);

    // §5.3: the same VerifiedRun shape; the binding fields, the evidence and
    // the v2 envelope hash are equal (score, contract and stats are the toy's).
    const real = await verify.verifyRankedRun(body, options);
    const toy = await double.verifyRankedRun(body, options);
    assert.equal(real.ok, true);
    assert.equal(toy.ok, true, JSON.stringify(toy));
    assert.deepEqual(Object.keys(toy), Object.keys(real), `${name} VerifiedRun keys`);
    assert.deepEqual(Object.keys(toy.contract), Object.keys(real.contract));
    assert.deepEqual(Object.keys(toy.evidence), Object.keys(real.evidence));
    assert.equal(Object.isFrozen(toy) && Object.isFrozen(toy.contract) && Object.isFrozen(toy.stats) && Object.isFrozen(toy.evidence), true);
    for (const key of ['ok', 'gameId', 'sessionId32', 'sessionHandle', 'wallet', 'seasonId', 'runtimeId', 'buildHash', 'seed', 'envelopeHash', 'verifiedAt']) {
      assert.deepEqual(toy[key], real[key], `${name} ${key}`);
    }
    assert.deepEqual(plain(toy.evidence), plain(real.evidence));
    assert.deepEqual(plain(toy.identity), plain(real.identity));
    const envelopeHash = await rankedEnvelopeHash({ gameId: body.gameId, sessionId32: body.sessionId32, encoding: digest.encoding, evidenceDigest: digest.digest });
    assert.deepEqual([toy.envelopeHash, real.envelopeHash, fixture.expected.envelopeHash], [envelopeHash, envelopeHash, envelopeHash], `${name} v2 envelope hash`);
    assert.equal(typeof toy.score, typeof real.score);
    for (const key of Object.keys(toy.contract)) assert.equal(typeof toy.contract[key], typeof real.contract[key], `${name} contract.${key}`);
    const realKeys = Object.keys(real.stats);
    if (body.gameId === 'lester-blaster') {
      // The toy HMH stats are a subset of the real keys, in the real order.
      const positions = Object.keys(toy.stats).map((key) => realKeys.indexOf(key));
      assert.equal(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), true, `${name} toy stats keys`);
      assert.deepEqual(Object.keys(toy.plausibility).sort(), Object.keys(real.plausibility).sort());
      assert.equal(toy.plausibility.verdict, real.plausibility.verdict);
    } else {
      assert.deepEqual(Object.keys(toy.stats), realKeys, `${name} stats keys`);
      assert.deepEqual([toy.plausibility, real.plausibility], [null, null]);
    }

    // The re-sign rule's reverifyStoredRun on the stored evidence.
    const stored = { gameId: body.gameId, identity: plain(real.identity), evidence: { encoding: real.evidence.encoding, text: real.evidence.text } };
    const again = await verify.reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS });
    const toyAgain = await double.reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS });
    assert.deepEqual(Object.keys(toyAgain), Object.keys(again));
    for (const key of ['sessionId32', 'envelopeHash', 'verifiedAt']) assert.equal(toyAgain[key], again[key], `${name} re-verified ${key}`);
    assert.deepEqual(plain(toyAgain.evidence), plain(again.evidence));
    assert.deepEqual([again.score, again.envelopeHash], [real.score, real.envelopeHash]);
  }
});

test('the achievements and hero-gate doubles expose the real registry API and gates', () => {
  const catalog = createCatalogDouble();
  for (const [name, value] of Object.entries(catalog)) {
    if (name === 'calls') continue;
    assert.equal(Object.hasOwn(achievements, name), true, `the real registry exports ${name}`);
    assert.equal(typeof value, typeof achievements[name], name);
  }
  assert.deepEqual([...catalog.ACHIEVEMENT_GAME_IDS], [...achievements.ACHIEVEMENT_GAME_IDS]);
  assert.equal(catalog.achievementId32(ethers, 'first-blood'), achievements.achievementId32(ethers, 'first-blood'));
  for (const gameId of achievements.ACHIEVEMENT_GAME_IDS) {
    const fields = achievements.historyFieldsFor(gameId);
    assert.deepEqual(Object.keys(fields).sort(), Object.keys(catalog.historyFieldsFor(gameId)).sort());
    assert.equal(Array.isArray(fields.sum) && Array.isArray(fields.max), true);
  }
  assert.deepEqual(plain(HERO_GATES_DOUBLE), plain({ gates: HMH_HERO_GATES, free: HMH_FREE_HEROES }));
});

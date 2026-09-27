// The real settle handlers on the local chain (contract §10.4 rule 6), shared
// by tests/api-settle-handler.test.mjs and
// tests/api-settle-handler-lifecycle.test.mjs.
//
// Every endpoint is mounted exactly as production mounts it,
// createHandler(() => buildDeps(env, { db, provider, deployment, nowMs })),
// with nothing swapped after buildDeps: the real verify slice
// (server/verify/**), the real achievements registry, the real seed tickets,
// an UNMIGRATED PGlite (the first request must migrate through ensureSchema,
// A34) and the in-process Hardhat chain (chainId 4441) with its own
// deployment record. The player signs in through E1 and E2, takes a ticket
// from E15, plays (verify's evidence generators at the ticket seed), pays
// openSession on chain, lets chain time pass the run length and settles
// through E3; E4 then reports the published run.
//
// Keys: Hardhat's public test mnemonic only (scripts/lib/local-chain.mjs).

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';

import { buildSiweChallenge } from '../../apps/portal/src/wallet-auth.mjs';
import { RANKED_GAMES, rankedSessionKey, RANKED_SETTLE_VERSION } from '../../apps/portal/src/ranked-identity.mjs';
import * as achievements from '../../apps/portal/src/achievements/index.mjs';
import * as verify from '../../server/verify/index.mjs';
import { readAchievementHistory } from '../../server/neon/queries.mjs';
import { periodKeysFor } from '../../server/neon/period-keys.mjs';
import * as settleApi from '../../api/settle.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../../server/config.mjs';
import * as statusApi from '../../api/settle-status.mjs';
import * as seedApi from '../../api/ranked-seed.mjs';
import * as nonceApi from '../../api/session-nonce.mjs';
import * as sessionApi from '../../api/session.mjs';
import { localContracts } from '../../scripts/lib/local-chain.mjs';
import { createPgliteClient } from './pglite-client.mjs';
import { invoke } from './fake-http.mjs';
import { bootLocalChain, fixtureEnv, openPaidSession, SETTLE_SESSION_VALUE } from './settle-fixtures.mjs';
import { buildFixtureBody, FIXTURE_BUILD_HASHES } from '../fixtures/ranked/build-fixtures.mjs';

const DOMAIN = 'lestersarcade.io';

// The evidence each game plays by default: the brief's end-to-end runs.
export const E2E_EVIDENCE = Object.freeze({
  chikun: Object.freeze({ profile: 'expert', maxMinutes: 1.5 }),
  stacked: Object.freeze({ topOutAtTick: 3600 }),
  'lester-blaster': Object.freeze({ plan: 'valid' }),
});
// Shorter real runs where the run itself is not under test (building a
// STACKED run is the soak pilot's play, about 20x cheaper at 600 ticks).
export const QUICK_EVIDENCE = Object.freeze({
  chikun: Object.freeze({ profile: 'expert', maxMinutes: 0.5 }),
  stacked: Object.freeze({ topOutAtTick: 600 }),
  'lester-blaster': Object.freeze({ plan: 'valid' }),
});

// The exact E4 view keys (§4.4). Neither view carries the wallet's
// plausibility verdict or its client claim.
export const OWNER_VIEW_KEYS = Object.freeze(['ok', 'view', 'sessionId32', 'shareId', 'gameId', 'wallet', 'status', 'score', 'contract', 'stats', 'envelopeHash', 'txHash', 'blockNumber', 'explorerUrl', 'achievements', 'retryable', 'attempts', 'lastError', 'nextAttemptAt', 'verifiedAt', 'confirmedAt', 'pollAfterMs']);
export const PUBLIC_CONFIRMED_VIEW_KEYS = Object.freeze(['ok', 'view', 'sessionId32', 'shareId', 'gameId', 'status', 'txHash', 'blockNumber', 'explorerUrl', 'retryable', 'nextAttemptAt', 'pollAfterMs', 'confirmedAt', 'score', 'contract', 'stats', 'achievements']);

export function createSettleHarness({ ip }) {
  const h = { local: null, registry: null, env: null, db: null, clockMs: 0 };
  const nowMs = () => h.clockMs;
  const tokens = new Map();
  const handlers = {};

  h.nowMs = nowMs;

  h.start = async () => {
    h.local = await bootLocalChain();
    h.registry = h.local.record.addresses.scoreSubmissionRegistry.toLowerCase();
    h.env = fixtureEnv({ registry: h.registry });
    h.db = createPgliteClient();
    await h.syncClock();
  };

  h.close = async () => {
    await h.db?.close();
    await h.local?.chain.close();
  };

  h.syncClock = async (offsetMs = 1000) => {
    h.clockMs = (await h.local.chain.latestTimestamp()) * 1000 + offsetMs;
    return h.clockMs;
  };

  h.advanceChain = async (seconds) => {
    await h.local.chain.increaseTime(seconds);
    await h.local.chain.mine();
    return h.syncClock();
  };

  // The production mount: buildDeps with only the database, chain, deployment
  // and clock overridden (A30). Nothing is patched onto the deps afterwards.
  h.mount = (api, { provider = true } = {}) => {
    const overrides = { db: h.db, deployment: h.local.deployment, nowMs };
    if (provider) overrides.provider = provider === true ? h.local.chain.provider : provider;
    return api.createHandler(() => api.buildDeps(h.env, overrides));
  };

  // The local provider with some calls replaced (an RPC outage, for example).
  h.wrapProvider = (replaced) => new Proxy(h.local.chain.provider, {
    get(target, key) {
      if (Object.hasOwn(replaced, key)) return replaced[key];
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  h.handler = (name) => {
    handlers[name] ??= {
      nonce: () => h.mount(nonceApi, { provider: false }),
      session: () => h.mount(sessionApi, { provider: false }),
      seed: () => h.mount(seedApi, { provider: false }),
      settle: () => h.mount(settleApi),
      status: () => h.mount(statusApi),
    }[name]();
    return handlers[name];
  };

  // E1 then E2: a real SIWE login on a server nonce, signed by the fixture wallet.
  h.login = async (wallet) => {
    const key = wallet.address.toLowerCase();
    if (tokens.has(key)) return tokens.get(key);
    const nonce = await invoke(h.handler('nonce'), { url: '/api/session-nonce', headers: { 'x-forwarded-for': ip } });
    assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
    const challenge = buildSiweChallenge({ domain: DOMAIN, address: wallet.address, chainId: 4441, nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt });
    const signature = await wallet.signMessage(challenge.message);
    const session = await invoke(h.handler('session'), { method: 'POST', url: '/api/session', headers: { 'x-forwarded-for': ip }, body: { challenge, signature } });
    assert.equal(session.status, 200, JSON.stringify(session.body));
    assert.equal(session.body.wallet, key);
    tokens.set(key, session.body.token);
    return session.body.token;
  };

  h.authHeaders = async (wallet) => ({ authorization: `Bearer ${await h.login(wallet)}`, 'x-forwarded-for': ip });

  // E15: the server seed ticket for a fresh session handle.
  h.seedTicketFor = async (wallet, gameId) => {
    const uuid = randomUUID();
    const request = { gameId, sessionId: `game-session-${uuid}`, seasonId: RANKED_GAMES[gameId].seasonId, buildHash: FIXTURE_BUILD_HASHES[gameId] };
    const response = await invoke(h.handler('seed'), { method: 'POST', url: '/api/ranked-seed', headers: await h.authHeaders(wallet), body: request });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.seedTicket.issuedAt, Math.floor(h.clockMs / 1000), 'issuedAt comes from the injected clock');
    return { uuid, ...response.body };
  };

  // A ticket from E15, then verify's generator plays the run at the ticket
  // seed against the LOCAL registry. The generator re-issues the same ticket
  // from the salt and issuedAt under the same SESSION_SECRET, so the body
  // carries exactly what E15 returned.
  h.playRun = async (wallet, gameId, { evidence = E2E_EVIDENCE[gameId] } = {}) => {
    const ticket = await h.seedTicketFor(wallet, gameId);
    const built = await buildFixtureBody({
      gameId, wallet: wallet.address, registry: h.registry, secret: SETTLE_SESSION_VALUE, uuid: ticket.uuid,
      salt: ticket.seedTicket.salt, issuedAt: ticket.seedTicket.issuedAt, evidence,
    });
    assert.deepEqual(built.body.seedTicket, ticket.seedTicket, 'the body carries the E15 ticket');
    assert.equal(built.seed, ticket.seed, 'evidence is played at the E15 seed');
    return built.body;
  };

  // A §5.1 body on a fresh E15 ticket around evidence that was NOT played at
  // the ticket seed (nothing is generated: a negative that never reaches, or
  // must fail, the replay).
  h.ticketBody = async (wallet, gameId, evidence) => {
    const ticket = await h.seedTicketFor(wallet, gameId);
    const identity = {
      sessionId: `game-session-${ticket.uuid}`, chainId: 4441, scoreRegistryAddress: h.registry, wallet: wallet.address.toLowerCase(),
      gameId, seasonId: RANKED_GAMES[gameId].seasonId, buildHash: FIXTURE_BUILD_HASHES[gameId], seed: ticket.seed, nonce: ticket.uuid,
    };
    return { v: RANKED_SETTLE_VERSION, gameId, sessionId32: await rankedSessionKey(identity), identity, seedTicket: ticket.seedTicket, entryTxHash: null, evidence: structuredClone(evidence) };
  };

  h.verifyOptions = (wallet) => ({ chainId: 4441, scoreRegistryAddress: h.registry, wallet: wallet.address.toLowerCase(), nowMs: h.clockMs, seedSecret: SETTLE_SESSION_VALUE });

  // The run length the chain must pass before E3 accepts it (A26), from the
  // real verifier (no chain, no database: a pure check of the body).
  h.verifiedPreview = async (body, wallet) => {
    const run = await verify.verifyRankedRun(body, h.verifyOptions(wallet));
    assert.equal(run.ok, true, JSON.stringify(run));
    return run;
  };

  h.payAndWait = async (body, wallet, { survivalSeconds }) => {
    const paid = await openPaidSession({ chain: h.local.chain, record: h.local.record, player: wallet, sessionId32: body.sessionId32, gameId: body.gameId });
    body.entryTxHash = paid.txHash;
    await h.advanceChain(survivalSeconds + 1);
    return paid;
  };

  h.postSettle = (body, headers) => invoke(h.handler('settle'), { method: 'POST', url: '/api/settle', headers, body });

  h.getStatus = (sessionId32, headers = { 'x-forwarded-for': ip }) => invoke(h.handler('status'), { url: `/api/settle-status?sessionId32=${sessionId32}`, headers });

  h.rowFor = async (sessionId32) => {
    const rows = await h.db.query(
      `SELECT status, wallet, game_id, score::text AS score, kills::text AS kills, max_combo::text AS max_combo,
              survival_seconds::text AS survival_seconds, boss_id, stats::text AS stats, envelope_hash, runtime_id, season_id,
              build_hash, seed::text AS seed, entry_amount_wei, client_claim::text AS client_claim, plausibility::text AS plausibility,
              day_key, week_key, month_key, tx_hash, block_number::text AS block_number, attempts, last_error,
              attestation::text AS attestation,
              array_to_json(achievements)::text AS achievements, array_to_json(nft_achievements)::text AS nft_achievements,
              to_char(opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS opened_at
         FROM verified_sessions WHERE session_id32 = $1`,
      [sessionId32],
    );
    return rows[0] ?? null;
  };

  h.evidenceFor = async (sessionId32) => {
    const rows = await h.db.query('SELECT encoding, evidence, evidence_bytes, evidence_digest, identity::text AS identity FROM session_evidence WHERE session_id32 = $1', [sessionId32]);
    return rows[0] ?? null;
  };

  h.unlocksFor = (sessionId32) => h.db.query('SELECT wallet, game_id, achievement_id, tier, nft, token_id FROM achievement_unlocks WHERE session_id32 = $1 ORDER BY achievement_id', [sessionId32]);

  h.countRows = async (table) => (await h.db.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n;

  h.relayerNonce = () => h.local.chain.provider.getTransactionCount(h.local.chain.wallets.relayer.address, 'latest');

  h.onChainSession = (sessionId32) => localContracts(h.local.record, h.local.chain.provider).scores.getSession(sessionId32);

  // Every table a rejected settle must leave untouched, plus the relayer nonce.
  h.snapshotSideEffects = async () => ({
    sessions: await h.countRows('verified_sessions'),
    evidence: await h.countRows('session_evidence'),
    unlocks: await h.countRows('achievement_unlocks'),
    nonce: await h.relayerNonce(),
  });

  // The wallet's §6.5 history as E3 reads it (the real readAchievementHistory
  // with the real historyFieldsFor), before `sessionId32` is recorded.
  h.historyFor = (wallet, gameId, sessionId32) => readAchievementHistory(h.db, {
    wallet: wallet.address.toLowerCase(), gameId, fields: achievements.historyFieldsFor(gameId), excludeSessionId32: sessionId32,
  });

  // Plays, pays and settles one run and asserts every record the contract
  // names (DoD 1). The expected achievements come from the real
  // deriveEarnedAchievements on the real stored history, whatever runs the
  // wallet already settled.
  h.settleAndAssert = async (gameId, { wallet = h.local.chain.wallets.player1, claimScore = null, evidence = E2E_EVIDENCE[gameId] } = {}) => {
    const body = await h.playRun(wallet, gameId, { evidence });
    if (claimScore !== null) body.claim = { score: claimScore };
    const expected = await h.verifiedPreview(body, wallet);
    const history = await h.historyFor(wallet, gameId, body.sessionId32);
    const expectedUnlocks = achievements.deriveEarnedAchievements(gameId, expected, history).map((entry) => entry.id).sort();
    if (history.runs === 0) assert.ok(expectedUnlocks.length > 0, `a first ${gameId} run earns catalog achievements`);
    assert.deepEqual(expectedUnlocks.filter((id) => history.unlockedIds.includes(id)), [], 'an achievement is never earned twice');
    const nftIds = new Set(achievements.nftAchievementIds(gameId));
    const paid = await h.payAndWait(body, wallet, { survivalSeconds: expected.contract.survivalSeconds });
    const nonceBefore = await h.relayerNonce();

    const response = await h.postSettle(body, await h.authHeaders(wallet));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const view = response.body;
    assert.deepEqual(Object.keys(view), [...OWNER_VIEW_KEYS], 'the owner view keys (§4.4)');
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
    assert.equal(await h.relayerNonce(), nonceBefore + 1, 'one relayed transaction');
    const receipt = await h.local.chain.provider.getTransactionReceipt(view.txHash);
    assert.equal(receipt.status, 1);
    assert.equal(view.blockNumber, receipt.blockNumber);
    assert.equal(receipt.from.toLowerCase(), h.local.chain.wallets.relayer.address.toLowerCase(), 'the relayer published it');

    // verified_sessions: the row the pipeline wrote, confirmed after the receipt.
    const row = await h.rowFor(body.sessionId32);
    assert.equal(row.status, 'confirmed');
    assert.equal(row.wallet, wallet.address.toLowerCase());
    assert.equal(row.game_id, gameId);
    assert.equal(Number(row.score), expected.score);
    assert.deepEqual([Number(row.kills), Number(row.max_combo), Number(row.survival_seconds), row.boss_id], [expected.contract.kills, expected.contract.maxCombo, expected.contract.survivalSeconds, expected.contract.bossId]);
    assert.deepEqual(JSON.parse(row.stats), JSON.parse(JSON.stringify(expected.stats)));
    assert.equal(row.envelope_hash, expected.envelopeHash);
    assert.deepEqual([row.runtime_id, row.season_id, row.build_hash, Number(row.seed)], [RANKED_GAMES[gameId].runtimeId, RANKED_GAMES[gameId].seasonId, FIXTURE_BUILD_HASHES[gameId], body.identity.seed]);
    assert.equal(row.entry_amount_wei, paid.amountWei.toString());
    assert.equal(BigInt(row.entry_amount_wei) >= BigInt(DEFAULT_MIN_PAID_WEI), true, 'at least the settle floor (fee + reserve)');
    assert.equal(row.opened_at, new Date(paid.openedAt * 1000).toISOString());
    const keys = periodKeysFor(paid.openedAt * 1000);
    assert.deepEqual([row.day_key, row.week_key, row.month_key], [keys.day, keys.week, keys.month]);
    assert.deepEqual(row.client_claim === null ? null : JSON.parse(row.client_claim), body.claim ?? null, 'the claim is stored, never trusted');
    // The HMH validator verdict (flags included) is stored; replayed games store none.
    assert.deepEqual(row.plausibility === null ? null : JSON.parse(row.plausibility), JSON.parse(JSON.stringify(expected.plausibility)));
    if (gameId === 'lester-blaster') assert.notEqual(expected.plausibility, null, 'the HMH validator verdict');
    else assert.equal(expected.plausibility, null);
    assert.equal(row.tx_hash, view.txHash);
    assert.equal(Number(row.block_number), receipt.blockNumber);
    assert.deepEqual(JSON.parse(row.achievements).sort(), expectedUnlocks);
    assert.deepEqual(JSON.parse(row.nft_achievements), expectedUnlocks.filter((id) => nftIds.has(id)));

    // session_evidence: exactly what the verifier stored and hashed (§2.6).
    const stored = await h.evidenceFor(body.sessionId32);
    assert.deepEqual([stored.encoding, stored.evidence, stored.evidence_bytes, stored.evidence_digest], [expected.evidence.encoding, expected.evidence.text, expected.evidence.bytes, expected.evidence.digest]);
    assert.deepEqual(JSON.parse(stored.identity), { ...expected.identity });
    const digest = await verify.computeEvidenceDigest(body);
    assert.equal(stored.evidence_digest, digest.digest);

    // achievement_unlocks: derived by the server from the verified run and history.
    const unlocks = await h.unlocksFor(body.sessionId32);
    assert.deepEqual(unlocks.map((unlock) => unlock.achievement_id), expectedUnlocks);
    for (const unlock of unlocks) {
      assert.deepEqual([unlock.wallet, unlock.game_id, unlock.tier, unlock.nft, unlock.token_id], [wallet.address.toLowerCase(), gameId, achievements.achievementById(gameId, unlock.achievement_id).tier, nftIds.has(unlock.achievement_id), null]);
    }

    // On chain: the registry holds the run for this player.
    const session = await h.onChainSession(body.sessionId32);
    assert.equal(session.exists, true);
    assert.equal(session.verified, true);
    assert.equal(session.player.toLowerCase(), wallet.address.toLowerCase());
    assert.equal(session.gameId, ethers.id(gameId));
    assert.deepEqual([session.score, session.kills, session.maxCombo, session.survivalSeconds], [BigInt(expected.score), BigInt(expected.contract.kills), BigInt(expected.contract.maxCombo), BigInt(expected.contract.survivalSeconds)]);
    assert.equal(session.runtimeId, ethers.id(RANKED_GAMES[gameId].runtimeId));
    assert.equal(session.seasonId, ethers.id(RANKED_GAMES[gameId].seasonId));
    assert.equal(session.bossId, expected.contract.bossId ? ethers.id(expected.contract.bossId) : ethers.ZeroHash);

    // E4: the owner view for the row's wallet, the public view otherwise.
    const owner = await h.getStatus(body.sessionId32, await h.authHeaders(wallet));
    assert.equal(owner.status, 200);
    assert.deepEqual(owner.body, view, 'E4 owner view equals the E3 response');
    const publicView = await h.getStatus(body.sessionId32);
    assert.equal(publicView.status, 200);
    assert.deepEqual(Object.keys(publicView.body), [...PUBLIC_CONFIRMED_VIEW_KEYS], 'the public view keys (§4.4): no wallet, lastError, attempts, plausibility or claim');
    assert.equal(publicView.body.view, 'public');
    assert.equal(publicView.body.status, 'confirmed');
    assert.equal(publicView.body.score, expected.score);
    assert.equal(publicView.body.txHash, view.txHash);
    assert.deepEqual(publicView.body.achievements, view.achievements);
    return { body, view, publicView: publicView.body, expected, history, unlocks: expectedUnlocks, row };
  };

  return h;
}

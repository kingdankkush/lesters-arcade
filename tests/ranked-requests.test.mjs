import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { readFileSync } from 'node:fs';

import { buildChikunSettleRequest, buildHmhSettleRequest, buildStackedSettleRequest, sic1Base64 } from '../apps/portal/src/ranked-requests.mjs';
import { encodeStackedBase64 } from '../apps/portal/src/stacked-evidence-transport.mjs';
import { stackedReplayBase64Url } from '../apps/portal/src/stacked-persistence.mjs';
import { RANKED_GAMES, applySeedTicket, rankedIdentityFor, rankedSessionKey } from '../apps/portal/src/ranked-identity.mjs';
import { deriveRankedSeed } from '../apps/portal/src/session-seed.mjs';
import { CURRENT_RANKED_SEASON_ID, createCanonicalSessionIdentity, finalizeSessionEvidence } from '../apps/portal/src/session-integrity.mjs';
import { startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { LITVM_CONTRACT_ADDRESSES } from '../apps/portal/src/settlement.mjs';
import { computeEvidenceDigest, verifyRankedRun } from '../server/verify/index.mjs';
import { FIXTURE_REGISTRY, FIXTURE_SEED_SECRET } from './fixtures/ranked/build-fixtures.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/ranked/${name}.json`, import.meta.url), 'utf8'));
const FIXTURES = Object.freeze({ chikun: fixture('chikun-valid'), stacked: fixture('stacked-valid'), 'lester-blaster': fixture('hmh-valid') });
const ENTRY_TX = `0x${'AB'.repeat(32)}`;
const REGISTRY = LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry;

// A live Ranked session exactly as startPlaySession + applySeedTicket leave it.
function sessionFromFixture({ body }) {
  const { identity, seedTicket } = body;
  return {
    sessionId: identity.sessionId,
    sessionNonce: identity.nonce,
    gameId: identity.gameId,
    wallet: identity.wallet,
    seasonId: identity.seasonId,
    buildHash: identity.buildHash,
    seed: identity.seed,
    canonicalContext: Object.freeze({ sessionId: identity.sessionId, wallet: identity.wallet, gameId: identity.gameId, buildHash: identity.buildHash, seasonId: identity.seasonId, seed: identity.seed }),
    seedTicket,
    entryReceipt: null,
  };
}

function buildFromFixture(gameId, session, registry = FIXTURE_REGISTRY) {
  const { body } = FIXTURES[gameId];
  const claimScore = body.claim?.score;
  if (gameId === 'chikun') return buildChikunSettleRequest({ session, scoreRegistryAddress: registry, evidence: body.evidence.flap, claimScore });
  if (gameId === 'stacked') return buildStackedSettleRequest({ session, scoreRegistryAddress: registry, sic1Bytes: new Uint8Array(Buffer.from(body.evidence.sic1, 'base64')), claimScore });
  return buildHmhSettleRequest({ session, scoreRegistryAddress: registry, runSummary: body.evidence.runSummary, sessionEnvelope: body.evidence.sessionEnvelope, claimScore });
}

test('builders produce the settle body with per-game season, ticket, entry hash and matching session key', async () => {
  for (const gameId of Object.keys(FIXTURES)) {
    const session = sessionFromFixture(FIXTURES[gameId]);
    session.entryReceipt = { txHash: ENTRY_TX, sessionId32: FIXTURES[gameId].body.sessionId32, amountWei: '102000000000000000', status: 'pending' };
    const body = await buildFromFixture(gameId, session);
    assert.equal(body.v, 'lesters-ranked-settle-v1');
    assert.equal(body.gameId, gameId);
    assert.equal(body.identity.seasonId, RANKED_GAMES[gameId].seasonId, `${gameId} carries its own season`);
    assert.deepEqual(body.seedTicket, session.seedTicket);
    assert.equal(body.entryTxHash, ENTRY_TX.toLowerCase(), 'the entry hash is sent lowercase');
    assert.equal(body.sessionId32, await rankedSessionKey(rankedIdentityFor(session, { scoreRegistryAddress: FIXTURE_REGISTRY })));
    assert.deepEqual(Object.keys(body.identity).sort(), ['buildHash', 'chainId', 'gameId', 'nonce', 'scoreRegistryAddress', 'seasonId', 'seed', 'sessionId', 'wallet']);
    // Exactly the §5.1 body the verify slice's fixtures were built from.
    assert.deepEqual(body, { ...FIXTURES[gameId].body, entryTxHash: ENTRY_TX.toLowerCase() });
  }
  const noReceipt = await buildFromFixture('chikun', sessionFromFixture(FIXTURES.chikun));
  assert.equal(noReceipt.entryTxHash, null, 'absent entry receipt means entryTxHash null');
  const noClaim = await buildChikunSettleRequest({ session: sessionFromFixture(FIXTURES.chikun), scoreRegistryAddress: FIXTURE_REGISTRY, evidence: FIXTURES.chikun.body.evidence.flap, claimScore: 1.5 });
  assert.equal(Object.hasOwn(noClaim, 'claim'), false, 'a non-integer claim is omitted rather than sent');
});

test('entry and settlement keys match for all three games after a seed ticket is applied', async () => {
  const wallet = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  for (const gameId of ['lester-blaster', 'chikun', 'stacked']) {
    // Entry side (signin-entry, A10 + A25): pending session, ticket, then the key.
    const pending = startPlaySession({ wallet, gameId, mode: 'paid' });
    const salt = nodeCrypto.createHash('sha256').update(`ranked-client ${gameId}`).digest('hex').slice(0, 32);
    const seed = await deriveRankedSeed({ sessionId: pending.sessionId, wallet, gameId, seasonId: pending.seasonId, buildHash: pending.buildHash, salt });
    applySeedTicket(pending, { seed, seedTicket: { v: 'lesters-ranked-seed-v1', salt, issuedAt: 1_790_000_000, mac: 'cd'.repeat(32) } });
    const entryKey = await rankedSessionKey(rankedIdentityFor(pending, { scoreRegistryAddress: REGISTRY }));
    pending.entryReceipt = { txHash: ENTRY_TX, sessionId32: entryKey, amountWei: '102000000000000000', status: 'confirmed' };

    // Settlement side: the builder on the same session.
    let body;
    if (gameId === 'chikun') {
      body = await buildChikunSettleRequest({ session: pending, scoreRegistryAddress: REGISTRY, evidence: { version: 'chikun-flap-evidence-v6', seed, fixedStepHz: 60, maxTicks: 600, flapDeltas: [3, 20] } });
    } else if (gameId === 'stacked') {
      body = await buildStackedSettleRequest({ session: pending, scoreRegistryAddress: REGISTRY, sic1Bytes: new Uint8Array([83, 73, 67, 49]) });
    } else {
      const identity = rankedIdentityFor(pending, { scoreRegistryAddress: REGISTRY });
      const sessionEnvelope = await finalizeSessionEvidence({ identity, evidence: pending.evidence, finalState: { hp: 0, score: 10 } });
      body = await buildHmhSettleRequest({ session: pending, scoreRegistryAddress: REGISTRY, runSummary: { identity: { seed, buildHash: pending.buildHash } }, sessionEnvelope });
    }
    assert.equal(body.sessionId32, entryKey, `${gameId}: the settle key is the paid entry key`);
    assert.equal(body.identity.seed, seed, `${gameId}: the ticket seed is in the identity`);
    assert.equal(body.identity.seasonId, RANKED_GAMES[gameId].seasonId);

    // The retired override (CURRENT_RANKED_SEASON_ID for every game) keyed
    // Chikun and STACKED runs under the HMH season.
    const legacy = await createCanonicalSessionIdentity({ ...rankedIdentityFor(pending, { scoreRegistryAddress: REGISTRY }), seasonId: CURRENT_RANKED_SEASON_ID });
    if (gameId === 'lester-blaster') assert.equal(legacy.sessionKey, entryKey);
    else assert.notEqual(legacy.sessionKey, entryKey, `${gameId}: per-game season changes the key`);
  }
});

test('builders refuse a live session without a ticket', async () => {
  for (const gameId of Object.keys(FIXTURES)) {
    const session = sessionFromFixture(FIXTURES[gameId]);
    delete session.seedTicket;
    await assert.rejects(buildFromFixture(gameId, session), /seed ticket/);
  }
  const wrongGame = sessionFromFixture(FIXTURES.stacked);
  await assert.rejects(buildChikunSettleRequest({ session: wrongGame, scoreRegistryAddress: FIXTURE_REGISTRY, evidence: FIXTURES.chikun.body.evidence.flap }), /expected a chikun session/);
  const otherKey = sessionFromFixture(FIXTURES.chikun);
  otherKey.entryReceipt = { txHash: ENTRY_TX, sessionId32: `0x${'11'.repeat(32)}`, status: 'confirmed' };
  await assert.rejects(buildFromFixture('chikun', otherKey), /different session key/);
  const otherSeed = sessionFromFixture(FIXTURES.chikun);
  await assert.rejects(buildChikunSettleRequest({ session: otherSeed, scoreRegistryAddress: FIXTURE_REGISTRY, evidence: { ...FIXTURES.chikun.body.evidence.flap, seed: 7 } }), /another seed/);
  const v5 = sessionFromFixture(FIXTURES.chikun);
  await assert.rejects(buildChikunSettleRequest({ session: v5, scoreRegistryAddress: FIXTURE_REGISTRY, evidence: { version: 'chikun-flap-evidence-v5', flapSteps: [] } }), /v6/);
  const envelope = sessionFromFixture(FIXTURES['lester-blaster']);
  const { runSummary, sessionEnvelope } = FIXTURES['lester-blaster'].body.evidence;
  await assert.rejects(buildHmhSettleRequest({ session: envelope, scoreRegistryAddress: FIXTURE_REGISTRY, runSummary, sessionEnvelope: { ...sessionEnvelope, sessionKey: `0x${'22'.repeat(32)}` } }), /session envelope/);
});

test('chikun, stacked and hmh evidence encodings match the contract', async () => {
  for (const gameId of Object.keys(FIXTURES)) {
    const { body: expectedBody, expected, wallet, chainId, verifyAtMs } = FIXTURES[gameId];
    const body = await buildFromFixture(gameId, sessionFromFixture(FIXTURES[gameId]));
    assert.equal(body.evidence.encoding, RANKED_GAMES[gameId].evidenceEncoding);
    if (gameId === 'chikun') assert.deepEqual(Object.keys(body.evidence.flap).sort(), ['fixedStepHz', 'flapDeltas', 'maxTicks', 'seed', 'version']);
    if (gameId === 'stacked') {
      assert.match(body.evidence.sic1, /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, 'standard base64 with padding');
      assert.equal(body.evidence.startLevel, 1);
    }
    if (gameId === 'lester-blaster') assert.deepEqual(Object.keys(body.evidence).sort(), ['encoding', 'runSummary', 'sessionEnvelope']);
    assert.deepEqual(body.evidence, expectedBody.evidence);
    const digest = await computeEvidenceDigest(body);
    assert.equal(digest.digest ?? digest, expected.evidenceDigest);
    // The server verifier accepts the builder's body as-is.
    const run = await verifyRankedRun(body, { chainId, scoreRegistryAddress: FIXTURE_REGISTRY, wallet, nowMs: verifyAtMs, seedSecret: FIXTURE_SEED_SECRET, crypto: nodeCrypto });
    assert.equal(run.ok, true, `${gameId}: ${JSON.stringify(run)}`);
    assert.equal(run.score, expected.score);
    assert.equal(run.envelopeHash, expected.envelopeHash);
  }
});

test('the local SIC1 encoders match the transport encoder and base64url', () => {
  for (const length of [0, 1, 2, 3, 4, 0x7fff, 0x8000, 0x8001, 70_000]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 131 + length) % 256);
    assert.equal(sic1Base64(bytes), encodeStackedBase64(bytes), `standard base64, ${length} bytes`);
    assert.equal(stackedReplayBase64Url(bytes), Buffer.from(bytes).toString('base64url'), `base64url, ${length} bytes`);
  }
});

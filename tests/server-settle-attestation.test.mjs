import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';

import { readServerConfig } from '../server/config.mjs';
import {
  ATTESTATION_TTL_SECONDS, attestationDeadlineFor, attestationDomain, attestationMatchesRow, attestationRecord, isAttestationRecord,
  needsResign, runFromRow, signVerifiedRun,
} from '../server/settle/attestation.mjs';
import { isAttestationValid, recoverAttestationSigner } from '../apps/portal/src/verifier-attestation.mjs';
import * as attestApi from '../api/attest.mjs';

/**
 * Contract A3, §8.2, §3.3: the signing that /api/attest used to expose now
 * lives only on the settle path. These are the former attestRequest tests,
 * moved to server/settle/attestation.mjs: a server-verified run is signed
 * with the configured verifier, bounded, with a 15-minute deadline, and the
 * retired endpoint answers 410 without signing anything.
 */

const verifierKey = `0x${'11'.repeat(32)}`;
const verifier = new ethers.Wallet(verifierKey);
const player = `0x${'22'.repeat(20)}`;
const registry = `0x${'33'.repeat(20)}`;
const domain = attestationDomain({ chainId: 4441, verifyingContract: registry });
const NOW = 1_700_000_000_000;

function verifiedRun(overrides = {}) {
  return Object.freeze({
    ok: true,
    gameId: 'lester-blaster',
    sessionId32: ethers.id('game-session-000000042'),
    sessionHandle: 'game-session-11111111-1111-4111-8111-111111111111',
    wallet: player,
    seasonId: 'hmh-season-1-2026',
    runtimeId: 'lester-blaster:hmh-run-summary-v6',
    buildHash: 'site-1.7.0:game-1.7.0',
    seed: 12345,
    score: 4_200,
    contract: { kills: 30, maxCombo: 6, survivalSeconds: 240, bossId: 'boss-liquidator' },
    stats: { score: 4_200, kills: 30 },
    evidence: { encoding: 'hmh-run-summary-v6+json', text: '{}', bytes: 2, digest: `0x${'dd'.repeat(32)}` },
    envelopeHash: `0x${'ee'.repeat(32)}`,
    identity: {},
    verifiedAt: new Date(NOW).toISOString(),
    ...overrides,
  });
}

test('a server-verified run is signed by the configured verifier and expires in 15 minutes', async () => {
  // Fail closed: no key, no signer (the config holds no key string, A28).
  const unconfigured = readServerConfig({ VERCEL_ENV: 'development' });
  assert.equal(unconfigured.verifier.configured, false);
  assert.throws(() => unconfigured.verifier.createSigner(ethers), /verifier-not-configured/);
  const config = readServerConfig({ VERCEL_ENV: 'development', RANKED_VERIFIER_PRIVATE_KEY: verifierKey });
  const signer = config.verifier.createSigner(ethers);
  assert.equal(signer.address, verifier.address);
  assert.ok(!JSON.stringify(config).includes(verifierKey.slice(2)));

  const deadline = attestationDeadlineFor(NOW);
  assert.equal(deadline, NOW / 1000 + ATTESTATION_TTL_SECONDS);
  assert.equal(ATTESTATION_TTL_SECONDS, 900);
  const signed = await signVerifiedRun(ethers, { verifiedRun: verifiedRun(), nftAchievementIds: ['two-hundred-ranked-runs'], deadlineSeconds: deadline, domain, signer });
  assert.deepEqual(Object.keys(signed).sort(), ['achievements32', 'deadline', 'digest', 'run', 'signature']);
  assert.equal(signed.deadline, String(deadline));
  assert.equal(signed.run.player, ethers.getAddress(player));
  assert.equal(signed.run.score, 4_200n);
  assert.equal(signed.run.bossId, ethers.id('boss-liquidator'));
  assert.equal(signed.run.runtimeId, ethers.id('lester-blaster:hmh-run-summary-v6'));
  assert.equal(signed.run.seasonId, ethers.id('hmh-season-1-2026'));
  assert.equal(signed.run.envelopeHash, `0x${'ee'.repeat(32)}`, 'the server-computed envelope hash');
  assert.deepEqual([...signed.achievements32], [ethers.id('two-hundred-ranked-runs')]);
  assert.equal(recoverAttestationSigner(ethers, { domain, run: signed.run, signature: signed.signature }), verifier.address);
  assert.equal(isAttestationValid(ethers, { domain, run: signed.run, signature: signed.signature, trustedVerifier: verifier.address, nowSeconds: deadline - 1 }), true);
  assert.equal(isAttestationValid(ethers, { domain, run: signed.run, signature: signed.signature, trustedVerifier: verifier.address, nowSeconds: deadline + 1 }), false);
  const chikun = await signVerifiedRun(ethers, { verifiedRun: verifiedRun({ gameId: 'chikun', contract: { kills: 3, maxCombo: 2, survivalSeconds: 30, bossId: null } }), deadline, domain, signer });
  assert.equal(chikun.run.bossId, ethers.ZeroHash, 'a null bossId is ZERO32');
  assert.equal(chikun.run.achievementsHash, ethers.keccak256('0x'), 'no NFT ids hash the empty packed array');

  // The stored record, and the run rebuilt from a row's own columns.
  const record = attestationRecord(signed);
  assert.deepEqual(Object.keys(record).sort(), ['achievements32', 'deadline', 'digest', 'signature']);
  assert.equal(isAttestationRecord(record), true);
  const row = {
    sessionId32: signed.run.sessionId, gameId: 'lester-blaster', wallet: player, score: 4200, kills: 30, maxCombo: 6, survivalSeconds: 240,
    bossId: 'boss-liquidator', envelopeHash: `0x${'ee'.repeat(32)}`, runtimeId: 'lester-blaster:hmh-run-summary-v6', seasonId: 'hmh-season-1-2026', attestation: record,
  };
  assert.deepEqual(runFromRow(ethers, row).run, signed.run);
  assert.equal(attestationMatchesRow(ethers, row, domain), true);
  assert.equal(attestationMatchesRow(ethers, { ...row, score: 4201 }, domain), false, 'an edited column no longer matches');
  assert.equal(needsResign(row, (deadline - 121) * 1000), false);
  assert.equal(needsResign(row, (deadline - 119) * 1000), true, 'within two minutes of the deadline');
  assert.equal(needsResign({ ...row, attestation: null }, NOW), true);
});

test('signing refuses unbounded or incomplete runs', async () => {
  const signer = verifier;
  const deadline = attestationDeadlineFor(NOW);
  await assert.rejects(signVerifiedRun(ethers, { verifiedRun: verifiedRun({ runtimeId: null }), deadline, domain, signer }), /runtimeId/, 'a null runtimeId would hash ethers.id(\'\')');
  await assert.rejects(signVerifiedRun(ethers, { verifiedRun: verifiedRun({ seasonId: '' }), deadline, domain, signer }), /seasonId/);
  await assert.rejects(signVerifiedRun(ethers, { verifiedRun: verifiedRun({ score: 10_000_000_001 }), deadline, domain, signer }), /score exceeds/);
  await assert.rejects(signVerifiedRun(ethers, { verifiedRun: verifiedRun(), nftAchievementIds: Array.from({ length: 33 }, (_, index) => `nft-${index}`), deadline, domain, signer }), /at most 32/);
  await assert.rejects(signVerifiedRun(ethers, { verifiedRun: { ok: false, status: 422, error: 'replay-rejected' }, deadline, domain, signer }), /VerifiedRun/);
  await assert.rejects(signVerifiedRun(ethers, { verifiedRun: verifiedRun(), domain, signer }), /deadline/);
});

test('the retired attest endpoint signs nothing', async () => {
  const result = await attestApi.attestRequest({ method: 'POST', body: { gameId: 'lester-blaster', score: 1 } }, {});
  assert.deepEqual([result.status, result.body], [410, { ok: false, error: 'endpoint-retired', use: '/api/settle' }]);
  assert.equal(Object.hasOwn(attestApi, 'readVerifierConfig'), false, 'the legacy VERIFIER_PRIVATE_KEY reader is gone');
});

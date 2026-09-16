import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';

import {
  ATTESTATION_DOMAIN_NAME,
  ATTESTATION_DOMAIN_VERSION,
  ATTESTATION_TTL_SECONDS,
  VERIFIED_RUN_TYPES,
  achievementsHash,
  attestationDigest,
  attestationDomain,
  buildVerifiedRun,
  deserializeVerifiedRun,
  isAttestationValid,
  recoverAttestationSigner,
  serializeVerifiedRun,
  signAttestation,
} from '../apps/portal/src/verifier-attestation.mjs';
import { attestRequest, readVerifierConfig } from '../api/attest.mjs';

/**
 * Owner direction 2026-09-16: Ranked settlement is attested by a trusted
 * verifier (EIP-712), the browser checks the signature before spending gas,
 * and the server fails closed without a key.
 */

const verifier = new ethers.Wallet(`0x${'11'.repeat(32)}`);
const player = `0x${'22'.repeat(20)}`;
const registry = `0x${'33'.repeat(20)}`;
const sessionId32 = ethers.id('game-session-000000042');
const envelopeHash = `0x${'ab'.repeat(32)}`;
const domain = attestationDomain({ chainId: 4441, verifyingContract: registry });

const baseRun = {
  sessionId32, gameId: 'lester-blaster', player, score: 12_345, kills: 44, maxCombo: 12, survivalSeconds: 252,
  bossId: 'boss-liquidator', envelopeHash, runtimeId: 'lester-blaster:1.5.1', seasonId: 'hmh-season-1-2026',
  deadline: 1_800_000_000, achievements: ['first-blood', 'ten-enemy-cleanup'],
};

test('the EIP-712 domain and VerifiedRun type match the hardened contract', () => {
  assert.equal(ATTESTATION_DOMAIN_NAME, "Lester's Arcade Ranked Settlement");
  assert.equal(ATTESTATION_DOMAIN_VERSION, '2');
  assert.deepEqual(domain, { name: ATTESTATION_DOMAIN_NAME, version: '2', chainId: 4441, verifyingContract: registry });
  const encoded = ethers.TypedDataEncoder.from(VERIFIED_RUN_TYPES).encodeType('VerifiedRun');
  assert.equal(encoded, 'VerifiedRun(bytes32 sessionId,bytes32 gameId,address player,uint256 score,uint64 kills,uint64 maxCombo,uint64 survivalSeconds,bytes32 bossId,bytes32 envelopeHash,bytes32 runtimeId,bytes32 seasonId,uint64 deadline,bytes32 achievementsHash)');
  assert.throws(() => attestationDomain({ chainId: 0, verifyingContract: registry }), /chainId/);
  assert.throws(() => attestationDomain({ chainId: 4441, verifyingContract: 'nope' }), /address/);
});

test('buildVerifiedRun normalises ids, bounds every field and hashes achievements like abi.encodePacked', () => {
  const { run, achievements32 } = buildVerifiedRun(ethers, baseRun);
  assert.equal(run.sessionId, sessionId32);
  assert.equal(run.gameId, ethers.id('lester-blaster'));
  assert.equal(run.player, ethers.getAddress(player));
  assert.equal(run.score, 12_345n);
  assert.equal(run.bossId, ethers.id('boss-liquidator'));
  assert.equal(run.runtimeId, ethers.id('lester-blaster:1.5.1'));
  assert.equal(run.seasonId, ethers.id('hmh-season-1-2026'));
  assert.deepEqual([...achievements32], [ethers.id('first-blood'), ethers.id('ten-enemy-cleanup')]);
  assert.equal(run.achievementsHash, ethers.solidityPackedKeccak256(['bytes32[]'], [achievements32]));
  assert.equal(achievementsHash(ethers, []), ethers.keccak256('0x'), 'no achievements hashes the empty packed array');
  assert.throws(() => buildVerifiedRun(ethers, { ...baseRun, score: 10_000_000_001 }), /score exceeds/);
  assert.throws(() => buildVerifiedRun(ethers, { ...baseRun, kills: 100_001 }), /kills exceed/);
  assert.throws(() => buildVerifiedRun(ethers, { ...baseRun, envelopeHash: `0x${'0'.repeat(64)}` }), /envelopeHash/);
  assert.throws(() => buildVerifiedRun(ethers, { ...baseRun, achievements: Array.from({ length: 33 }, (_, i) => `a${i}`) }), /too many achievements/);
  assert.throws(() => buildVerifiedRun(ethers, { ...baseRun, player: 'not-an-address' }), /player/);
  const wire = serializeVerifiedRun(run);
  assert.equal(wire.score, '12345');
  assert.deepEqual(deserializeVerifiedRun(wire), run);
});

test('a verifier signature recovers to the verifier and is rejected when tampered, expired or from another key', async () => {
  const { run } = buildVerifiedRun(ethers, baseRun);
  const attestation = await signAttestation(ethers, { signer: verifier, domain, run });
  assert.equal(attestation.digest, attestationDigest(ethers, { domain, run }));
  assert.equal(attestation.deadline, '1800000000');
  assert.equal(recoverAttestationSigner(ethers, { domain, run, signature: attestation.signature }), verifier.address);
  const check = (overrides = {}, nowSeconds = 1_700_000_000) => isAttestationValid(ethers, { domain, run, signature: attestation.signature, trustedVerifier: verifier.address, ...overrides, nowSeconds });
  assert.equal(check(), true);
  assert.equal(check({ run: { ...run, score: 12_346n } }), false, 'a changed score breaks the signature');
  assert.equal(check({ trustedVerifier: player }), false, 'another trusted address does not match');
  assert.equal(check({}, 1_800_000_001), false, 'past the deadline');
  assert.equal(check({ domain: attestationDomain({ chainId: 1, verifyingContract: registry }) }), false, 'wrong chain domain');
  const impostor = await signAttestation(ethers, { signer: new ethers.Wallet(`0x${'44'.repeat(32)}`), domain, run });
  assert.equal(check({ signature: impostor.signature }), false);
});

test('the attest endpoint fails closed without a key and signs a bounded plausible run with one', async () => {
  const body = {
    gameId: 'lester-blaster', sessionId32, player, score: 4_200, kills: 30, maxCombo: 6, survivalSeconds: 240, bossId: null,
    envelope: { version: 'lesters-session-envelope-v1', inputHash: 'a'.repeat(64), eventHash: 'b'.repeat(64), finalStateHash: 'c'.repeat(64), envelopeHash: 'd'.repeat(64), identity: { sessionId: 'game-session-000000042', wallet: player } },
    runtimeId: 'lester-blaster:1.5.1', seasonId: 'hmh-season-1-2026', achievements: ['first-blood'], level: 2,
  };
  assert.equal(readVerifierConfig({}).configured, false);
  const unconfigured = await attestRequest(body, { env: {} });
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.body.error, 'verifier-not-configured');
  const env = { VERIFIER_PRIVATE_KEY: verifier.privateKey, SCORE_REGISTRY_ADDRESS: registry };
  const now = () => 1_700_000_000;
  const signed = await attestRequest(body, { env, now });
  assert.equal(signed.status, 200, JSON.stringify(signed.body));
  assert.equal(signed.body.verifier, verifier.address);
  assert.equal(signed.body.deadline, String(1_700_000_000 + ATTESTATION_TTL_SECONDS));
  const run = deserializeVerifiedRun(signed.body.run);
  assert.equal(run.envelopeHash, `0x${'d'.repeat(64)}`);
  assert.equal(isAttestationValid(ethers, { domain: signed.body.domain, run, signature: signed.body.signature, trustedVerifier: verifier.address, nowSeconds: 1_700_000_001 }), true);
  assert.equal((await attestRequest({ ...body, gameId: 'unknown' }, { env, now })).body.error, 'unknown-game');
  assert.equal((await attestRequest({ ...body, envelope: { ...body.envelope, version: 'v0' } }, { env, now })).body.error, 'unsupported-envelope-version');
  assert.equal((await attestRequest({ ...body, envelope: { ...body.envelope, identity: { wallet: registry } } }, { env, now })).body.error, 'envelope-wallet-mismatch');
  const implausible = await attestRequest({ ...body, score: 9_000_000_000, survivalSeconds: 3 }, { env, now });
  assert.equal(implausible.status, 422);
  assert.equal(implausible.body.error, 'implausible-run');
  assert.equal((await attestRequest(null, { env, now })).status, 400);
});

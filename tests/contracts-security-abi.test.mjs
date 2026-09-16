import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function loadArtifact(name) {
  return JSON.parse(readFileSync(join(root, 'contracts', 'artifacts', `${name}.json`), 'utf8'));
}

function fn(artifact, name) {
  return artifact.abi.find((entry) => entry.type === 'function' && entry.name === name);
}

test('WO-118 ArcadeRankedEntry openSession ABI has no caller-controlled token, amount or split config', () => {
  const artifact = loadArtifact('ArcadeRankedEntry');
  const open = fn(artifact, 'openSession');
  assert.ok(open, 'openSession function is present');
  assert.equal(open.stateMutability, 'payable', 'entry fee is paid in the native token via msg.value');
  const inputNames = open.inputs.map((input) => input.name);
  const inputTypes = open.inputs.map((input) => input.type);

  assert.deepEqual(inputNames, ['sessionId', 'gameId']);
  assert.equal(inputNames.includes('paymentToken'), false);
  assert.equal(inputNames.includes('amount'), false, 'amount comes from GameRegistry.entryFeeWei, never the caller');
  assert.equal(inputNames.includes('split'), false);
  assert.equal(inputTypes.some((type) => type.includes('tuple')), false);
  assert.equal(fn(artifact, 'startPaidSession'), undefined, 'legacy ERC-20 entry point must not exist');
  assert.equal(artifact.abi.some((entry) => entry.type === 'function' && /token/i.test(entry.name)), false, 'no ERC-20 token surface');
});

test('ArcadeRankedEntry exposes isPaid(sessionId, player, gameId) for the score registry', () => {
  const artifact = loadArtifact('ArcadeRankedEntry');
  const isPaid = fn(artifact, 'isPaid');
  assert.ok(isPaid);
  assert.deepEqual(isPaid.inputs.map((i) => `${i.type} ${i.name}`), ['bytes32 sessionId', 'address player', 'bytes32 gameId']);
  assert.equal(isPaid.stateMutability, 'view');
});

test('ScoreSubmissionRegistry has no unverified submission path and pins the EIP-712 VerifiedRun shape', () => {
  const artifact = loadArtifact('ScoreSubmissionRegistry');
  assert.equal(fn(artifact, 'submitSession'), undefined, 'unverified submitSession must be removed');
  const submit = fn(artifact, 'submitVerifiedSession');
  assert.ok(submit, 'submitVerifiedSession present');
  assert.deepEqual(submit.inputs.map((i) => i.name), ['run', 'achievements', 'signature']);
  assert.equal(submit.inputs[2].type, 'bytes', 'signature is a 65-byte ECDSA blob (ECDSA.recover)');
  assert.deepEqual(
    submit.inputs[0].components.map((c) => `${c.type} ${c.name}`),
    [
      'bytes32 sessionId',
      'bytes32 gameId',
      'address player',
      'uint256 score',
      'uint64 kills',
      'uint64 maxCombo',
      'uint64 survivalSeconds',
      'bytes32 bossId',
      'bytes32 envelopeHash',
      'bytes32 runtimeId',
      'bytes32 seasonId',
      'uint64 deadline',
      'bytes32 achievementsHash',
    ],
  );
  assert.ok(fn(artifact, 'VERIFIED_RUN_TYPEHASH'), 'typehash exposed for off-chain signers');
  assert.ok(fn(artifact, 'attestationDigest'), 'attestationDigest exposed for off-chain signers');
  assert.ok(fn(artifact, 'bestScore') && fn(artifact, 'bestSeasonScore'), 'best-score indexes exposed');
  assert.ok(fn(artifact, 'setRelayer'), 'relayer allow-list is operator controlled');
  assert.equal(fn(artifact, 'trustedVerifier').stateMutability, 'view');
});

test('AchievementRegistry is a soulbound ERC-721 with operator-gated minters', () => {
  const artifact = loadArtifact('AchievementRegistry');
  const mintFor = fn(artifact, 'mintFor');
  assert.ok(mintFor);
  assert.deepEqual(mintFor.inputs.map((i) => `${i.type} ${i.name}`), ['address player', 'bytes32 achievementId', 'bytes32 sessionId']);
  assert.deepEqual(mintFor.outputs.map((o) => o.type), ['bool']);
  assert.ok(artifact.abi.some((entry) => entry.type === 'error' && entry.name === 'Soulbound'), 'Soulbound() custom error present');
  for (const name of ['transferFrom', 'safeTransferFrom', 'ownerOf', 'tokenURI', 'locked', 'supportsInterface', 'burn', 'revoke', 'setMinter', 'tokenIdFor', 'hasUnlocked']) {
    assert.ok(fn(artifact, name), `${name} present`);
  }
  assert.ok(artifact.abi.some((entry) => entry.type === 'event' && entry.name === 'Locked'), 'ERC-5192 Locked event');
  assert.equal(fn(artifact, 'unlockFor'), undefined, 'legacy unlockFor removed');
});

test('GameRegistry entry fee is denominated in native wei and operator-settable', () => {
  const artifact = loadArtifact('GameRegistry');
  const register = fn(artifact, 'registerGame');
  assert.ok(register.inputs.some((i) => i.name === 'entryFeeWei' && i.type === 'uint256'));
  assert.equal(register.inputs.some((i) => /usdc/i.test(i.name)), false);
  const setFee = fn(artifact, 'setEntryFee');
  assert.deepEqual(setFee.inputs.map((i) => `${i.type} ${i.name}`), ['bytes32 gameId', 'uint256 entryFeeWei']);
  const getGame = fn(artifact, 'getGame');
  assert.ok(getGame.outputs[0].components.some((c) => c.name === 'entryFeeWei'));
});

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
  assert.equal(submit.stateMutability, 'nonpayable', 'relayer settlement needs nothing but the attestation: no msg.value');
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

// ---------------------------------------------------------------------------------------------------
// Owner decisions 2026-09-16
// ---------------------------------------------------------------------------------------------------

test('ArcadeRankedEntry fee = flat entry fee + operator-set settlement gas reserve forwarded to relayerVault', () => {
  const artifact = loadArtifact('ArcadeRankedEntry');
  const quote = fn(artifact, 'quoteEntry');
  assert.ok(quote, 'quoteEntry(bytes32 gameId) present');
  assert.equal(quote.stateMutability, 'view');
  assert.deepEqual(quote.inputs.map((i) => `${i.type} ${i.name}`), ['bytes32 gameId']);
  assert.deepEqual(quote.outputs.map((o) => o.type), ['uint256', 'uint256', 'uint256'], 'entryFeeWei, settlementGasReserveWei, totalWei');
  assert.equal(quote.outputs[0].name, 'entryFeeWei');
  assert.equal(quote.outputs[2].name, 'totalWei');

  const setReserve = fn(artifact, 'setSettlementGasReserve');
  assert.deepEqual(setReserve.inputs.map((i) => i.type), ['uint256']);
  assert.equal(fn(artifact, 'settlementGasReserveWei').stateMutability, 'view');
  assert.deepEqual(fn(artifact, 'settlementGasReserveWei').outputs.map((o) => o.type), ['uint256']);

  const setVault = fn(artifact, 'setRelayerVault');
  assert.deepEqual(setVault.inputs.map((i) => i.type), ['address']);
  assert.equal(fn(artifact, 'relayerVault').stateMutability, 'view');

  for (const name of ['SettlementGasReserveUpdated', 'RelayerVaultUpdated', 'SettlementReserveForwarded']) {
    assert.ok(artifact.abi.some((entry) => entry.type === 'event' && entry.name === name), `${name} event present for indexing`);
  }
  // The caller still controls nothing but the session id and game id.
  assert.deepEqual(fn(artifact, 'openSession').inputs.map((i) => i.name), ['sessionId', 'gameId']);
});

test('ScoreSubmissionRegistry routes achievements per game and exposes the relayer allow-list', () => {
  const artifact = loadArtifact('ScoreSubmissionRegistry');
  const ctor = artifact.abi.find((entry) => entry.type === 'constructor');
  assert.deepEqual(ctor.inputs.map((i) => i.type), ['address', 'address', 'address', 'address'], 'gameRegistry, rankedEntry, trustedVerifier, operator (no single achievement registry)');
  assert.equal(fn(artifact, 'achievementRegistry'), undefined, 'single achievementRegistry() retired');

  const byGame = fn(artifact, 'achievementRegistryByGame');
  assert.ok(byGame, 'achievementRegistryByGame(bytes32) getter present');
  assert.deepEqual(byGame.inputs.map((i) => i.type), ['bytes32']);
  assert.deepEqual(byGame.outputs.map((o) => o.type), ['address']);

  const setRegistry = fn(artifact, 'setAchievementRegistry');
  assert.deepEqual(setRegistry.inputs.map((i) => `${i.type} ${i.name}`), ['bytes32 gameId', 'address _achievementRegistry']);

  const relayers = fn(artifact, 'relayers');
  assert.ok(relayers, 'relayers(address) view present');
  assert.equal(relayers.stateMutability, 'view');
  assert.deepEqual(relayers.inputs.map((i) => i.type), ['address']);
  assert.deepEqual(relayers.outputs.map((o) => o.type), ['bool']);

  const updated = artifact.abi.find((entry) => entry.type === 'event' && entry.name === 'AchievementRegistryUpdated');
  assert.deepEqual(updated.inputs.map((i) => i.type), ['bytes32', 'address']);
  assert.ok(artifact.abi.some((entry) => entry.type === 'event' && entry.name === 'ScoreSubmitted'), 'ScoreSubmitted indexed for relayer-settled scores');
});

test('AchievementRegistry is one ERC-721 collection per game with constructor name/symbol/baseTokenUri', () => {
  const artifact = loadArtifact('AchievementRegistry');
  const ctor = artifact.abi.find((entry) => entry.type === 'constructor');
  assert.deepEqual(ctor.inputs.map((i) => `${i.type} ${i.name}`), ['address _operator', 'string name_', 'string symbol_', 'string _baseTokenUri']);
  for (const name of ['name', 'symbol', 'baseTokenUri']) assert.equal(fn(artifact, name).stateMutability, 'view');
});

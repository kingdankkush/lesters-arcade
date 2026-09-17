import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SCORE_REGISTRY_ABI } from '../apps/portal/src/litvm-chain-client.mjs';

const artifact = JSON.parse(readFileSync(new URL('../contracts/artifacts/ScoreSubmissionRegistry.json', import.meta.url), 'utf8'));
const ethers = await import('../apps/portal/vendor/ethers.min.js');

test('browser verified-session calldata is byte-equal to the compiled Solidity ABI', () => {
  const browser = new ethers.Interface(SCORE_REGISTRY_ABI);
  const compiled = new ethers.Interface(artifact.abi);
  // Hardened 2026-09-16 shape: thirteen-field VerifiedRun plus a bytes
  // signature (EIP-712 by the trusted verifier), no v/r/s split.
  const run = {
    sessionId: `0x${'11'.repeat(32)}`,
    gameId: `0x${'22'.repeat(32)}`,
    player: `0x${'ab'.repeat(20)}`,
    score: 12345n,
    kills: 12n,
    maxCombo: 7n,
    survivalSeconds: 90n,
    bossId: `0x${'33'.repeat(32)}`,
    envelopeHash: `0x${'44'.repeat(32)}`,
    runtimeId: `0x${'88'.repeat(32)}`,
    seasonId: `0x${'99'.repeat(32)}`,
    deadline: 2_000_000_000n,
    achievementsHash: `0x${'aa'.repeat(32)}`,
  };
  const achievements = [`0x${'55'.repeat(32)}`];
  const args = [run, achievements, `0x${'66'.repeat(32)}${'77'.repeat(32)}1b`];

  assert.equal(
    browser.encodeFunctionData('submitVerifiedSession', args),
    compiled.encodeFunctionData('submitVerifiedSession', args),
  );
});

test('browser score-record tuple matches compiled verified and exists fields', () => {
  const browser = new ethers.Interface(SCORE_REGISTRY_ABI);
  const compiled = new ethers.Interface(artifact.abi);
  assert.equal(browser.getFunction('getSession').format('sighash'), compiled.getFunction('getSession').format('sighash'));
  const result = compiled.getFunction('getSession').outputs[0].components.map((component) => component.name);
  assert.deepEqual(result.slice(-2), ['verified', 'exists']);
});

test('compiled score registry settles relayer submissions without value and routes achievements per game', () => {
  const compiled = new ethers.Interface(artifact.abi);
  const submit = compiled.getFunction('submitVerifiedSession');
  assert.equal(submit.payable, false, 'relayer path needs nothing but the attestation');
  assert.equal(compiled.getFunction('relayers').inputs.length, 1, 'relayers(address) view is public');
  assert.equal(compiled.getFunction('achievementRegistryByGame').inputs[0].type, 'bytes32');
  assert.equal(compiled.getFunction('setAchievementRegistry').format('sighash'), 'setAchievementRegistry(bytes32,address)');
  assert.equal(artifact.abi.some((entry) => entry.type === 'function' && entry.name === 'achievementRegistry'), false);
});

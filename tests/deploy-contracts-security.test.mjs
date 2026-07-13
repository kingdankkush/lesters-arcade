import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const deployScript = readFileSync('scripts/deploy-contracts.mjs', 'utf8');

test('contract deploy script never logs private-key substrings', () => {
  assert.equal(deployScript.includes('DEPLOYER_PRIVATE_KEY.slice'), false, 'must not print a private-key prefix or suffix');
  assert.doesNotMatch(deployScript, /console\.(?:log|error)\([^\n]*(?:PRIVATE_KEY|DEPLOYER_PRIVATE_KEY)/, 'deploy logs must never interpolate credential material');
  assert.match(deployScript, /deployer: config\.deployer/, 'manifest must publish only the configured public deployer address');
  assert.match(deployScript, /signer\.address\.toLowerCase\(\) !== config\.deployer\.toLowerCase\(\)/, 'broadcast wallet must match the approved deployer');
});

test('contract deploy script excludes the deprecated LestersArcadeCore wrapper', () => {
  assert.equal(deployScript.includes("'LestersArcadeCore.json'"), false, 'wrapper artifact must not be required for deploy');
  assert.equal(deployScript.includes("loadArtifact('LestersArcadeCore')"), false, 'wrapper artifact must not be loaded');
  assert.equal(deployScript.includes('LestersArcadeCore...'), false, 'wrapper must not be sent as a deployment transaction');
  assert.equal(deployScript.includes('lestersArcadeCore'), false, 'runtime address patch must not publish wrapper address as canonical');
});

test('contract deploy script is restricted to the hardened three-contract free-ranked suite', () => {
  for (const artifact of [
    'GameRegistry',
    'PlayerProfileRegistry',
    'ScoreSubmissionRegistry',
  ]) {
    assert.equal(deployScript.includes(`loadArtifact('${artifact}')`), true, `${artifact} should remain required`);
  }
  for (const excluded of ['PaymentRouter', 'ArcadePaymentRouter', 'SessionLedger', 'AchievementRegistry', 'TournamentPool', 'LestersArcadeCore']) {
    assert.equal(deployScript.includes(`loadArtifact('${excluded}')`), false, `${excluded} must not be deployed`);
  }
  assert.match(deployScript, /LITVM_DEPLOY_CONFIRM/);
  assert.match(deployScript, /DEPLOY_HARDENED_FREE_RANKED_4441/);
  assert.match(deployScript, /litvm-score-registry-2026-06-22-legacy-13\.json/);
});

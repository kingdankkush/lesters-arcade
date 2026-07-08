import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const deployScript = readFileSync('scripts/deploy-contracts.mjs', 'utf8');

test('contract deploy script excludes the deprecated LestersArcadeCore wrapper', () => {
  assert.equal(deployScript.includes("'LestersArcadeCore.json'"), false, 'wrapper artifact must not be required for deploy');
  assert.equal(deployScript.includes("loadArtifact('LestersArcadeCore')"), false, 'wrapper artifact must not be loaded');
  assert.equal(deployScript.includes('LestersArcadeCore...'), false, 'wrapper must not be sent as a deployment transaction');
  assert.equal(deployScript.includes('lestersArcadeCore'), false, 'runtime address patch must not publish wrapper address as canonical');
});

test('contract deploy script still deploys the canonical seven-module suite', () => {
  for (const artifact of [
    'PlayerProfileRegistry.json',
    'GameRegistry.json',
    'ArcadePaymentRouter.json',
    'ScoreSubmissionRegistry.json',
    'SessionLedger.json',
    'AchievementRegistry.json',
    'TournamentPool.json',
  ]) {
    assert.equal(deployScript.includes(`'${artifact}'`), true, `${artifact} should remain required`);
  }
  assert.equal(deployScript.includes("console.log('7/7: TournamentPool...')"), true);
});

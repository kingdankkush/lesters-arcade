import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const deployScript = readFileSync('scripts/deploy-contracts.mjs', 'utf8');
const deployConfig = JSON.parse(readFileSync('contracts/deploy-config.testnet.json', 'utf8'));

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

test('contract deploy script is restricted to the hardened five-contract native-fee ranked suite', () => {
  for (const artifact of [
    'GameRegistry',
    'PlayerProfileRegistry',
    'AchievementRegistry',
    'ArcadeRankedEntry',
    'ScoreSubmissionRegistry',
  ]) {
    assert.equal(deployScript.includes(`loadArtifact('${artifact}')`), true, `${artifact} should remain required`);
  }
  for (const excluded of ['PaymentRouter', 'ArcadePaymentRouter', 'SessionLedger', 'TournamentPool', 'LestersArcadeCore']) {
    assert.equal(deployScript.includes(`loadArtifact('${excluded}')`), false, `${excluded} must not be deployed`);
  }
  assert.match(deployScript, /LITVM_DEPLOY_CONFIRM/);
  assert.match(deployScript, /DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441/);
  assert.match(deployScript, /litvm-score-registry-2026-06-22-legacy-13\.json/);
});

test('contract deploy script keeps the two-phase dry-run / broadcast safety properties', () => {
  assert.match(deployScript, /process\.argv\.includes\('--broadcast'\)/, 'dry-run must be the default');
  assert.match(deployScript, /ethers\.getCreateAddress\(\{ from: config\.deployer, nonce: pendingNonce \+ 4 \}\)/, 'all five addresses are predicted from the pending nonce');
  assert.match(deployScript, /getTransactionCount\(config\.deployer, 'pending'\) !== manifest\.observedPendingNonce/, 'pending nonce must still match the approved manifest before broadcast');
  assert.match(deployScript, /hardened-ranked-deployment-manifest\.json/, 'dry-run manifest path');
  assert.match(deployScript, /deployment-record\.hardened\.json/, 'real-mode record path');
  assert.match(deployScript, /deployed at an unpredicted address/, 'read-back must compare deployed addresses to the manifest');
  assert.match(deployScript, /achievements\.minters\(await scores\.getAddress\(\)\)/, 'read-back must confirm the score registry is the achievement minter');
  assert.match(deployScript, /scores\.rankedEntry\(\)/, 'read-back must confirm ranked-entry wiring');
  assert.match(deployScript, /setMinter\(await scores\.getAddress\(\), true\)/, 'post-deploy wires ScoreSubmissionRegistry as minter');
  assert.match(deployScript, /setPlatformVaults\(config\.platformVault, config\.liquidityVault, config\.treasuryVault\)/, 'post-deploy sets vaults from config only');
});

test('deploy config describes the native 0.1 zkLTC fee for three games and is not a deployment', () => {
  assert.match(deployConfig._note, /explicit approval/);
  assert.equal(deployConfig.chainId, 4441);
  assert.deepEqual(deployConfig.games.map((g) => g.slug), ['lester-blaster', 'chikun', 'stacked']);
  for (const game of deployConfig.games) {
    assert.equal(game.entryFeeWei, '100000000000000000', `${game.slug} charges exactly 0.1 zkLTC`);
    assert.equal(game.devBps + game.platformBps + game.liquidityBps + game.treasuryBps, 10_000);
    assert.equal('entryFeeMicroUsdc' in game, false);
  }
  assert.equal(deployConfig.game, undefined, 'single-game shape retired');
  assert.equal(deployConfig.oldDeployment.disposition, 'archive-read-only; never import as verified');
  for (const key of ['platformVault', 'liquidityVault', 'treasuryVault']) assert.match(deployConfig[key], /^0x[0-9a-fA-F]{40}$/);
});

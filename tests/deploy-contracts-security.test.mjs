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
  assert.match(deployScript, /ethers\.getCreateAddress\(\{ from: config\.deployer, nonce: pendingNonce \+ 3 \}\)/, 'the four shared contracts are predicted from the pending nonce');
  assert.match(deployScript, /achievementNonce: pendingNonce \+ 4 \+ index/, 'one AchievementRegistry per game is predicted after the shared four');
  assert.match(deployScript, /ethers\.getCreateAddress\(\{ from: config\.deployer, nonce: game\.achievementNonce \}\)/, 'per-game achievement registry addresses are predicted');
  assert.match(deployScript, /getTransactionCount\(config\.deployer, 'pending'\) !== manifest\.observedPendingNonce/, 'pending nonce must still match the approved manifest before broadcast');
  assert.match(deployScript, /hardened-ranked-deployment-manifest\.json/, 'dry-run manifest path');
  assert.match(deployScript, /deployment-record\.hardened\.json/, 'real-mode record path');
  assert.match(deployScript, /deployed at an unpredicted address/, 'read-back must compare deployed addresses to the manifest');
  assert.match(deployScript, /registry\.minters\(await scores\.getAddress\(\)\)/, 'read-back must confirm the score registry is the minter of every per-game collection');
  assert.match(deployScript, /scores\.achievementRegistryByGame\(game\.gameId\)/, 'read-back must confirm per-game achievement routing');
  assert.match(deployScript, /scores\.rankedEntry\(\)/, 'read-back must confirm ranked-entry wiring');
  assert.match(deployScript, /registry\.setMinter\(await scores\.getAddress\(\), true\)/, 'post-deploy wires ScoreSubmissionRegistry as minter of each collection');
  assert.match(deployScript, /scores\.setAchievementRegistry\(game\.gameId, await registry\.getAddress\(\)\)/, 'post-deploy routes each game to its own collection');
  assert.match(deployScript, /setPlatformVaults\(config\.platformVault, config\.liquidityVault, config\.treasuryVault\)/, 'post-deploy sets vaults from config only');
});

test('contract deploy script applies the 2026-09-16 owner decisions (reserve, relayer vault, per-game collections, epoch)', () => {
  assert.match(deployScript, /rankedEntry\.setRelayerVault\(relayerVault\)/, 'relayer vault set from config (default operator)');
  assert.match(deployScript, /rankedEntry\.setSettlementGasReserve\(settlementGasReserveWei\)/, 'settlement gas reserve set from config');
  assert.match(deployScript, /DEFAULT_SETTLEMENT_GAS_RESERVE_WEI = '20000000000000000'/, '0.02 zkLTC placeholder default the owner tunes');
  assert.match(deployScript, /config\.settlementGasReserveWei \?\? DEFAULT_SETTLEMENT_GAS_RESERVE_WEI/);
  assert.match(deployScript, /const relayer = config\.relayer \?\? config\.operator/, 'relayer defaults to the operator');
  assert.match(deployScript, /const relayerVault = config\.relayerVault \?\? relayer/, 'relayer vault defaults to the relayer');
  assert.match(deployScript, /scores\.setRelayer\(relayer, true\)/, 'relayer is allow-listed for relayer-settled scores');
  assert.match(deployScript, /scores\.relayers\(relayer\)/, 'read-back confirms the relayer allow-list');
  assert.match(deployScript, /rankedEntry\.relayerVault\(\)/, 'read-back confirms relayer vault');
  assert.match(deployScript, /rankedEntry\.settlementGasReserveWei\(\)/, 'read-back confirms the reserve');
  assert.match(deployScript, /rankedEntry\.quoteEntry\(game\.gameId\)/, 'read-back confirms quoteEntry total = fee + reserve');
  assert.match(deployScript, /deploy\('AchievementRegistry', \[config\.operator, game\.achievements\.name, game\.achievements\.symbol, game\.achievements\.baseTokenUri\]\)/, 'one collection per game with its own name/symbol/baseTokenUri');
  assert.match(deployScript, /deploy\('ScoreSubmissionRegistry', \[\s*await gameRegistry\.getAddress\(\),\s*await rankedEntry\.getAddress\(\),\s*config\.verifier,\s*config\.operator,\s*\]\)/, 'score registry constructor no longer takes a single achievement registry');
  assert.match(deployScript, /epoch: 'testnet'/, 'manifest marks the testnet epoch');
  assert.match(deployScript, /achievementRegistries: Object\.fromEntries/, 'deployment record lists the per-game collections');
  assert.equal(deployScript.includes("achievementRegistry: await achievements.getAddress()"), false, 'single achievementRegistry address retired from the record');
});

test('deploy config describes the native 0.1 zkLTC fee for three games and is not a deployment', () => {
  assert.match(deployConfig._note, /explicit approval/);
  assert.equal(deployConfig.chainId, 4441);
  assert.deepEqual(deployConfig.games.map((g) => g.slug), ['lester-blaster', 'chikun', 'stacked']);
  const OWNER_WALLET = '0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26';
  const symbols = new Set();
  for (const game of deployConfig.games) {
    assert.equal(game.entryFeeWei, '100000000000000000', `${game.slug} charges exactly 0.1 zkLTC flat`);
    assert.equal(game.devBps + game.platformBps + game.liquidityBps + game.treasuryBps, 10_000);
    // Owner decision 2026-09-16: 15% treasury, 85% developer, for every game.
    assert.deepEqual([game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps], [8500, 0, 0, 1500], `${game.slug} splits 85/15`);
    assert.equal(game.devWallet, OWNER_WALLET, `${game.slug} developer is the owner wallet`);
    assert.equal('entryFeeMicroUsdc' in game, false);
    // One soulbound collection per game.
    assert.match(game.achievements.name, /Achievements$/);
    assert.match(game.achievements.symbol, /^[A-Z]{6}$/);
    assert.equal(symbols.has(game.achievements.symbol), false, 'collection symbols are unique');
    symbols.add(game.achievements.symbol);
    assert.equal(game.achievements.baseTokenUri, `https://lestersarcade.io/achievements/${game.slug}/`);
  }
  assert.equal(deployConfig.developerWallet, OWNER_WALLET);
  assert.equal(deployConfig.treasuryVault, OWNER_WALLET);
  assert.equal(deployConfig.settlementGasReserveWei, '2000000000000000', '0.002 zkLTC reserve (owner decision 2026-09-23, LiteForge fees near 1.5 gwei)');
  assert.equal(deployConfig.deployer, deployConfig.operator, 'the operator service key deploys and administers');
  assert.notEqual(deployConfig.verifier.toLowerCase(), deployConfig.operator.toLowerCase(), 'the verifier is its own key');
  assert.notEqual(deployConfig.relayer.toLowerCase(), deployConfig.operator.toLowerCase(), 'the relayer is its own key');
  assert.equal(deployConfig.relayerVault, deployConfig.relayer, 'the reserve funds the relayer');
  assert.match(deployConfig.relayerVault, /^0x[0-9a-fA-F]{40}$/);
  assert.match(deployConfig.relayer, /^0x[0-9a-fA-F]{40}$/);
  assert.match(deployConfig._epoch, /TESTNET EPOCH/);
  assert.equal(deployConfig.game, undefined, 'single-game shape retired');
  assert.equal(deployConfig.oldDeployment.disposition, 'archive-read-only; never import as verified');
  for (const key of ['platformVault', 'liquidityVault', 'treasuryVault']) assert.match(deployConfig[key], /^0x[0-9a-fA-F]{40}$/);
});

test('deploy record gains blocks, startBlock and deployTxHashes and regenerates the portal address module', () => {
  // Contract §8.1: read from each contract's deploymentTransaction() receipt.
  assert.match(deployScript, /summarizeDeployReceipts\(\{/);
  for (const name of ['gameRegistry', 'profiles', 'rankedEntry', 'scores']) {
    assert.ok(deployScript.includes(`await ${name}.deploymentTransaction().wait()`), `${name} deploy receipt is read`);
  }
  assert.ok(deployScript.includes('await achievementRegistries[game.slug].deploymentTransaction().wait()'), 'each collection deploy receipt is read');
  assert.match(deployScript, /blocks: deployFacts\.blocks,\n  startBlock: deployFacts\.startBlock,\n  deployTxHashes: deployFacts\.deployTxHashes,/);
  // A broadcast regenerates apps/portal/src/generated/litvm-addresses.mjs (status 'deployed') right after the record.
  assert.match(deployScript, /import \{ summarizeDeployReceipts, writeLitvmAddressModule \} from '\.\/generate-litvm-addresses\.mjs';/);
  const recordWrite = deployScript.indexOf("writeFileSync(join(root, 'contracts', 'deployment-record.hardened.json')");
  const moduleWrite = deployScript.indexOf("writeLitvmAddressModule({ root, mode: 'deployed', record })");
  assert.ok(recordWrite > 0 && moduleWrite > recordWrite, 'the module is regenerated after the record is written');
  // The dry run exits before any of this: the generator only runs on the broadcast path.
  assert.ok(deployScript.indexOf("if (!broadcast) {") < moduleWrite);
});

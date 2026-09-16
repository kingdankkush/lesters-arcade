// Hardened native-fee ranked LitVM testnet deployment (2026-09-16 contract set).
// Dry-run is the default. Broadcasting requires BOTH --broadcast and the exact
// LITVM_DEPLOY_CONFIRM value below. Never logs credential material.
//
// Deploy order (one nonce each):
//   0 GameRegistry(operator)
//   1 PlayerProfileRegistry()
//   2 AchievementRegistry(operator, achievementBaseTokenUri)
//   3 ArcadeRankedEntry(gameRegistry, operator)
//   4 ScoreSubmissionRegistry(gameRegistry, rankedEntry, achievementRegistry, verifier, operator)
// Post-deploy:
//   5 AchievementRegistry.setMinter(scoreSubmissionRegistry, true)
//   6 ArcadeRankedEntry.setPlatformVaults(platformVault, liquidityVault, treasuryVault)
//   7.. per game: GameRegistry.registerGame(...) / confirmDevWallet(gameId) / setPlayable(gameId, true)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const BROADCAST_CONFIRM = 'DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441';
const broadcast = process.argv.includes('--broadcast');
const archivePath = join(root, 'docs', 'web3', 'archives', 'litvm-score-registry-2026-06-22-legacy-13.json');
const manifestPath = join(root, 'docs', 'web3', 'hardened-ranked-deployment-manifest.json');

function loadArtifact(name) {
  const artifactPath = join(root, 'contracts', 'artifacts', `${name}.json`);
  if (!existsSync(artifactPath)) throw new Error(`${name} artifact missing; run npm run contracts:compile`);
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const object = artifact.bytecode || artifact.evm?.bytecode?.object;
  const runtimeObject = artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object;
  if (!object) throw new Error(`${name} bytecode missing`);
  const bytecode = object.startsWith('0x') ? object : `0x${object}`;
  const deployedBytecode = runtimeObject ? (runtimeObject.startsWith('0x') ? runtimeObject : `0x${runtimeObject}`) : null;
  return {
    abi: artifact.abi,
    bytecode,
    deployedBytecode,
    sha256: createHash('sha256').update(bytecode).digest('hex'),
  };
}

if (!existsSync(archivePath)) throw new Error('Legacy score archive missing; run npm run contracts:archive-legacy first.');
const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
if (archive.recordCount !== config.oldDeployment.expectedScoreRows) {
  throw new Error(`Legacy archive count ${archive.recordCount} does not match expected ${config.oldDeployment.expectedScoreRows}.`);
}
if (!Array.isArray(config.games) || config.games.length === 0) throw new Error('deploy-config.testnet.json must list at least one game.');
for (const game of config.games) {
  if (typeof game.entryFeeWei !== 'string' || !/^\d+$/.test(game.entryFeeWei)) throw new Error(`Game ${game.slug} entryFeeWei must be a decimal wei string.`);
  if (game.devBps + game.platformBps + game.liquidityBps + game.treasuryBps !== 10_000) throw new Error(`Game ${game.slug} split must total 10000 bps.`);
}
for (const key of ['platformVault', 'liquidityVault', 'treasuryVault', 'achievementBaseTokenUri']) {
  if (!config[key]) throw new Error(`deploy-config.testnet.json missing ${key}.`);
}

const artifacts = Object.freeze({
  GameRegistry: loadArtifact('GameRegistry'),
  PlayerProfileRegistry: loadArtifact('PlayerProfileRegistry'),
  AchievementRegistry: loadArtifact('AchievementRegistry'),
  ArcadeRankedEntry: loadArtifact('ArcadeRankedEntry'),
  ScoreSubmissionRegistry: loadArtifact('ScoreSubmissionRegistry'),
});
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || config.rpcUrl, config.chainId);
const network = await provider.getNetwork();
if (Number(network.chainId) !== config.chainId) throw new Error(`Wrong chain ${network.chainId}; expected ${config.chainId}`);
const pendingNonce = await provider.getTransactionCount(config.deployer, 'pending');
const predicted = Object.freeze({
  gameRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce }),
  playerProfileRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 1 }),
  achievementRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 2 }),
  arcadeRankedEntry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 3 }),
  scoreSubmissionRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 4 }),
});

const unsignedFactories = Object.fromEntries(
  Object.entries(artifacts).map(([name, artifact]) => [name, new ethers.ContractFactory(artifact.abi, artifact.bytecode)]),
);
const deployTransactions = [
  { name: 'GameRegistry', nonce: pendingNonce, predictedAddress: predicted.gameRegistry, transaction: await unsignedFactories.GameRegistry.getDeployTransaction(config.operator) },
  { name: 'PlayerProfileRegistry', nonce: pendingNonce + 1, predictedAddress: predicted.playerProfileRegistry, transaction: await unsignedFactories.PlayerProfileRegistry.getDeployTransaction() },
  { name: 'AchievementRegistry', nonce: pendingNonce + 2, predictedAddress: predicted.achievementRegistry, transaction: await unsignedFactories.AchievementRegistry.getDeployTransaction(config.operator, config.achievementBaseTokenUri) },
  { name: 'ArcadeRankedEntry', nonce: pendingNonce + 3, predictedAddress: predicted.arcadeRankedEntry, transaction: await unsignedFactories.ArcadeRankedEntry.getDeployTransaction(predicted.gameRegistry, config.operator) },
  { name: 'ScoreSubmissionRegistry', nonce: pendingNonce + 4, predictedAddress: predicted.scoreSubmissionRegistry, transaction: await unsignedFactories.ScoreSubmissionRegistry.getDeployTransaction(predicted.gameRegistry, predicted.arcadeRankedEntry, predicted.achievementRegistry, config.verifier, config.operator) },
];
const contractRows = [];
for (const row of deployTransactions) {
  let gasEstimate = null;
  try { gasEstimate = (await provider.estimateGas({ from: config.deployer, data: row.transaction.data })).toString(); } catch {}
  contractRows.push({
    name: row.name,
    nonce: row.nonce,
    predictedAddress: row.predictedAddress,
    initCodeHash: ethers.keccak256(row.transaction.data),
    runtimeCodeHash: artifacts[row.name].deployedBytecode ? ethers.keccak256(artifacts[row.name].deployedBytecode) : null,
    artifactBytecodeSha256: artifacts[row.name].sha256,
    gasEstimate,
  });
}

const registryInterface = new ethers.Interface(artifacts.GameRegistry.abi);
const achievementInterface = new ethers.Interface(artifacts.AchievementRegistry.abi);
const rankedEntryInterface = new ethers.Interface(artifacts.ArcadeRankedEntry.abi);
const games = config.games.map((game) => ({ ...game, gameId: ethers.id(game.slug) }));

const postDeployPlan = [
  { contract: 'AchievementRegistry', to: predicted.achievementRegistry, iface: achievementInterface, method: 'setMinter', args: [predicted.scoreSubmissionRegistry, true] },
  { contract: 'ArcadeRankedEntry', to: predicted.arcadeRankedEntry, iface: rankedEntryInterface, method: 'setPlatformVaults', args: [config.platformVault, config.liquidityVault, config.treasuryVault] },
];
for (const game of games) {
  postDeployPlan.push(
    { contract: 'GameRegistry', to: predicted.gameRegistry, iface: registryInterface, method: 'registerGame', gameSlug: game.slug, args: [game.slug, game.title, config.developerWallet, game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps, game.entryFeeWei] },
    { contract: 'GameRegistry', to: predicted.gameRegistry, iface: registryInterface, method: 'confirmDevWallet', gameSlug: game.slug, args: [game.gameId] },
    { contract: 'GameRegistry', to: predicted.gameRegistry, iface: registryInterface, method: 'setPlayable', gameSlug: game.slug, args: [game.gameId, true] },
  );
}
const postDeployTransactions = postDeployPlan.map((row, index) => {
  const data = row.iface.encodeFunctionData(row.method, row.args);
  const { iface, ...rest } = row;
  return { nonce: pendingNonce + deployTransactions.length + index, ...rest, data, calldataHash: ethers.keccak256(data) };
});

const manifest = {
  schemaVersion: 2,
  status: 'UNSIGNED_DRY_RUN',
  design: 'native-fee-ranked-eip712-soulbound-2026-09-16',
  network: config.network,
  chainId: config.chainId,
  nativeToken: config.nativeToken,
  deployer: config.deployer,
  observedPendingNonce: pendingNonce,
  operator: config.operator,
  trustedVerifier: config.verifier,
  vaults: { platformVault: config.platformVault, liquidityVault: config.liquidityVault, treasuryVault: config.treasuryVault },
  achievementBaseTokenUri: config.achievementBaseTokenUri,
  games: games.map((game) => ({ slug: game.slug, title: game.title, gameId: game.gameId, entryFeeWei: game.entryFeeWei, devBps: game.devBps, platformBps: game.platformBps, liquidityBps: game.liquidityBps, treasuryBps: game.treasuryBps })),
  contracts: contractRows,
  postDeployTransactions,
  excluded: ['PaymentRouter', 'ArcadePaymentRouter', 'SessionLedger', 'TournamentPool', 'LestersArcadeCore'],
  legacyArchive: { path: 'docs/web3/archives/litvm-score-registry-2026-06-22-legacy-13.json', totalSessions: archive.recordCount, checksum: archive.sha256 },
  broadcastGuard: BROADCAST_CONFIRM,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));

if (!broadcast) {
  console.log(`\nDRY RUN ONLY. Manifest written to ${manifestPath}. No transaction was signed or broadcast.`);
  process.exit(0);
}
if (process.env.LITVM_DEPLOY_CONFIRM !== BROADCAST_CONFIRM) {
  throw new Error(`Broadcast blocked. Set LITVM_DEPLOY_CONFIRM=${BROADCAST_CONFIRM} after manifest approval.`);
}
if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error('DEPLOYER_PRIVATE_KEY is required for broadcast.');
const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
if (signer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error('Configured deployer does not match signing wallet.');
if (await provider.getTransactionCount(config.deployer, 'pending') !== manifest.observedPendingNonce) throw new Error('Deployer nonce changed after manifest generation; regenerate and re-approve.');
if (config.operator.toLowerCase() !== signer.address.toLowerCase() || config.developerWallet.toLowerCase() !== signer.address.toLowerCase()) {
  throw new Error('Atomic deployment requires deployer=operator=developerWallet for registration confirmation.');
}

async function deploy(name, args) {
  const factory = new ethers.ContractFactory(artifacts[name].abi, artifacts[name].bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

const gameRegistry = await deploy('GameRegistry', [config.operator]);
const profiles = await deploy('PlayerProfileRegistry', []);
const achievements = await deploy('AchievementRegistry', [config.operator, config.achievementBaseTokenUri]);
const rankedEntry = await deploy('ArcadeRankedEntry', [await gameRegistry.getAddress(), config.operator]);
const scores = await deploy('ScoreSubmissionRegistry', [
  await gameRegistry.getAddress(),
  await rankedEntry.getAddress(),
  await achievements.getAddress(),
  config.verifier,
  config.operator,
]);

await (await achievements.setMinter(await scores.getAddress(), true)).wait();
await (await rankedEntry.setPlatformVaults(config.platformVault, config.liquidityVault, config.treasuryVault)).wait();
for (const game of games) {
  await (await gameRegistry.registerGame(game.slug, game.title, config.developerWallet, game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps, game.entryFeeWei)).wait();
  await (await gameRegistry.confirmDevWallet(game.gameId)).wait();
  await (await gameRegistry.setPlayable(game.gameId, true)).wait();
}

// Read-back verification: every predicted address and wiring must match before a record is written.
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
for (const [key, contract] of Object.entries({ gameRegistry, playerProfileRegistry: profiles, achievementRegistry: achievements, arcadeRankedEntry: rankedEntry, scoreSubmissionRegistry: scores })) {
  if (!same(await contract.getAddress(), predicted[key])) throw new Error(`${key} deployed at an unpredicted address; manifest invalid.`);
}
for (const game of games) {
  const registered = await gameRegistry.getGame(game.gameId);
  if (!registered.exists || !registered.playable || !registered.devWalletConfirmed || !same(registered.devWallet, config.developerWallet)) throw new Error(`Post-deploy GameRegistry read-back failed for ${game.slug}.`);
  if (registered.entryFeeWei.toString() !== game.entryFeeWei) throw new Error(`Entry fee mismatch for ${game.slug}.`);
}
if (!same(await scores.gameRegistry(), await gameRegistry.getAddress())) throw new Error('Score registry wiring mismatch.');
if (!same(await scores.rankedEntry(), await rankedEntry.getAddress())) throw new Error('Ranked entry wiring mismatch.');
if (!same(await scores.achievementRegistry(), await achievements.getAddress())) throw new Error('Achievement registry wiring mismatch.');
if (!same(await scores.trustedVerifier(), config.verifier)) throw new Error('Verifier wiring mismatch.');
if (!(await achievements.minters(await scores.getAddress()))) throw new Error('Score registry is not an achievement minter.');
if (!same(await rankedEntry.gameRegistry(), await gameRegistry.getAddress())) throw new Error('Ranked entry registry wiring mismatch.');
if (!same(await rankedEntry.platformVault(), config.platformVault)) throw new Error('Platform vault wiring mismatch.');
if (!(await rankedEntry.entryFeeEnabled())) throw new Error('Entry fee must be enabled after deploy.');

const record = {
  schemaVersion: 3,
  network: config.network,
  chainId: config.chainId,
  nativeToken: config.nativeToken,
  deployedAt: new Date().toISOString(),
  deployer: signer.address,
  mode: 'native-fee-ranked-verified',
  addresses: {
    gameRegistry: await gameRegistry.getAddress(),
    playerProfileRegistry: await profiles.getAddress(),
    achievementRegistry: await achievements.getAddress(),
    arcadeRankedEntry: await rankedEntry.getAddress(),
    scoreSubmissionRegistry: await scores.getAddress(),
  },
  trustedVerifier: config.verifier,
  vaults: manifest.vaults,
  games: manifest.games,
  oldDeployment: config.oldDeployment,
};
writeFileSync(join(root, 'contracts', 'deployment-record.hardened.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));

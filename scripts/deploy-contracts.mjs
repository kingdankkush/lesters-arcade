// Hardened native-fee ranked LitVM testnet deployment (2026-09-16 contract set, owner decisions applied).
// Dry-run is the default. Broadcasting requires BOTH --broadcast and the exact
// LITVM_DEPLOY_CONFIRM value below. Never logs credential material.
//
// TESTNET EPOCH: this deployment lives on LiteForge testnet until mainnet, where everything is wiped and
// a fresh deployment set is created. Nothing deployed from this script carries over.
//
// Deploy order (one deployer nonce each):
//   0 GameRegistry(operator)
//   1 PlayerProfileRegistry()
//   2 ArcadeRankedEntry(gameRegistry, operator)
//   3 ScoreSubmissionRegistry(gameRegistry, rankedEntry, verifier, operator)
//   4.. one AchievementRegistry(operator, name, symbol, baseTokenUri) per configured game (three)
// Post-deploy (deployer == operator):
//   ArcadeRankedEntry.setPlatformVaults(platformVault, liquidityVault, treasuryVault)
//   ArcadeRankedEntry.setRelayerVault(relayerVault)
//   ArcadeRankedEntry.setSettlementGasReserve(settlementGasReserveWei)
//   ScoreSubmissionRegistry.setRelayer(relayer, true)
//   per game: AchievementRegistry[slug].setMinter(scoreSubmissionRegistry, true)
//             ScoreSubmissionRegistry.setAchievementRegistry(gameId, achievementRegistry[slug])
//             GameRegistry.registerGame(...)
// Activation (only atomic when the signer is also the developer wallet):
//   per game: GameRegistry.confirmDevWallet(gameId)   <- signed by developerWallet
//             GameRegistry.setPlayable(gameId, true)   <- signed by operator
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { summarizeDeployReceipts, writeLitvmAddressModule } from './generate-litvm-addresses.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const BROADCAST_CONFIRM = 'DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441';
const DEFAULT_SETTLEMENT_GAS_RESERVE_WEI = '20000000000000000'; // 0.02 zkLTC placeholder; the owner tunes it.
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

const isAddress = (value) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
const isWei = (value) => typeof value === 'string' && /^\d+$/.test(value);

if (!existsSync(archivePath)) throw new Error('Legacy score archive missing; run npm run contracts:archive-legacy first.');
const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
if (archive.recordCount !== config.oldDeployment.expectedScoreRows) {
  throw new Error(`Legacy archive count ${archive.recordCount} does not match expected ${config.oldDeployment.expectedScoreRows}.`);
}
if (!Array.isArray(config.games) || config.games.length === 0) throw new Error('deploy-config.testnet.json must list at least one game.');
for (const key of ['deployer', 'operator', 'verifier', 'developerWallet', 'platformVault', 'liquidityVault', 'treasuryVault']) {
  if (!isAddress(config[key])) throw new Error(`deploy-config.testnet.json ${key} must be a 0x address.`);
}
if (!config.achievementBaseTokenUri) throw new Error('deploy-config.testnet.json missing achievementBaseTokenUri.');

// Relayer-settled scores: the relayer is allow-listed on the score registry and the settlement gas reserve
// collected at entry is forwarded to relayerVault. Both default to the operator so a one-key testnet works.
const relayer = config.relayer ?? config.operator;
const relayerVault = config.relayerVault ?? relayer;
const settlementGasReserveWei = config.settlementGasReserveWei ?? DEFAULT_SETTLEMENT_GAS_RESERVE_WEI;
if (!isAddress(relayer)) throw new Error('deploy-config.testnet.json relayer must be a 0x address.');
if (!isAddress(relayerVault)) throw new Error('deploy-config.testnet.json relayerVault must be a 0x address.');
if (!isWei(settlementGasReserveWei)) throw new Error('deploy-config.testnet.json settlementGasReserveWei must be a decimal wei string.');

const seenSymbols = new Set();
for (const game of config.games) {
  if (!isWei(game.entryFeeWei)) throw new Error(`Game ${game.slug} entryFeeWei must be a decimal wei string.`);
  if (game.devBps + game.platformBps + game.liquidityBps + game.treasuryBps !== 10_000) throw new Error(`Game ${game.slug} split must total 10000 bps.`);
  if (!game.achievements?.name || !game.achievements?.symbol) throw new Error(`Game ${game.slug} needs achievements.name and achievements.symbol (one soulbound collection per game).`);
  if (seenSymbols.has(game.achievements.symbol)) throw new Error(`Duplicate achievement collection symbol ${game.achievements.symbol}.`);
  seenSymbols.add(game.achievements.symbol);
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

const games = config.games.map((game, index) => ({
  ...game,
  gameId: ethers.id(game.slug),
  achievements: {
    name: game.achievements.name,
    symbol: game.achievements.symbol,
    baseTokenUri: game.achievements.baseTokenUri ?? `${config.achievementBaseTokenUri}${game.slug}/`,
  },
  achievementNonce: pendingNonce + 4 + index,
}));

const predicted = Object.freeze({
  gameRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce }),
  playerProfileRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 1 }),
  arcadeRankedEntry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 2 }),
  scoreSubmissionRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 3 }),
  achievementRegistries: Object.fromEntries(
    games.map((game) => [game.slug, ethers.getCreateAddress({ from: config.deployer, nonce: game.achievementNonce })]),
  ),
});

const unsignedFactories = Object.fromEntries(
  Object.entries(artifacts).map(([name, artifact]) => [name, new ethers.ContractFactory(artifact.abi, artifact.bytecode)]),
);
const deployTransactions = [
  { name: 'GameRegistry', nonce: pendingNonce, predictedAddress: predicted.gameRegistry, transaction: await unsignedFactories.GameRegistry.getDeployTransaction(config.operator) },
  { name: 'PlayerProfileRegistry', nonce: pendingNonce + 1, predictedAddress: predicted.playerProfileRegistry, transaction: await unsignedFactories.PlayerProfileRegistry.getDeployTransaction() },
  { name: 'ArcadeRankedEntry', nonce: pendingNonce + 2, predictedAddress: predicted.arcadeRankedEntry, transaction: await unsignedFactories.ArcadeRankedEntry.getDeployTransaction(predicted.gameRegistry, config.operator) },
  { name: 'ScoreSubmissionRegistry', nonce: pendingNonce + 3, predictedAddress: predicted.scoreSubmissionRegistry, transaction: await unsignedFactories.ScoreSubmissionRegistry.getDeployTransaction(predicted.gameRegistry, predicted.arcadeRankedEntry, config.verifier, config.operator) },
];
for (const game of games) {
  deployTransactions.push({
    name: 'AchievementRegistry',
    gameSlug: game.slug,
    nonce: game.achievementNonce,
    predictedAddress: predicted.achievementRegistries[game.slug],
    transaction: await unsignedFactories.AchievementRegistry.getDeployTransaction(config.operator, game.achievements.name, game.achievements.symbol, game.achievements.baseTokenUri),
  });
}
const contractRows = [];
for (const row of deployTransactions) {
  let gasEstimate = null;
  try { gasEstimate = (await provider.estimateGas({ from: config.deployer, data: row.transaction.data })).toString(); } catch {}
  contractRows.push({
    name: row.name,
    ...(row.gameSlug ? { gameSlug: row.gameSlug } : {}),
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
const scoresInterface = new ethers.Interface(artifacts.ScoreSubmissionRegistry.abi);

// Everything in postDeployPlan is signed by the deployer (which must equal the operator).
const postDeployPlan = [
  { contract: 'ArcadeRankedEntry', to: predicted.arcadeRankedEntry, iface: rankedEntryInterface, method: 'setPlatformVaults', args: [config.platformVault, config.liquidityVault, config.treasuryVault] },
  { contract: 'ArcadeRankedEntry', to: predicted.arcadeRankedEntry, iface: rankedEntryInterface, method: 'setRelayerVault', args: [relayerVault] },
  { contract: 'ArcadeRankedEntry', to: predicted.arcadeRankedEntry, iface: rankedEntryInterface, method: 'setSettlementGasReserve', args: [settlementGasReserveWei] },
  { contract: 'ScoreSubmissionRegistry', to: predicted.scoreSubmissionRegistry, iface: scoresInterface, method: 'setRelayer', args: [relayer, true] },
];
for (const game of games) {
  postDeployPlan.push(
    { contract: 'AchievementRegistry', to: predicted.achievementRegistries[game.slug], iface: achievementInterface, method: 'setMinter', gameSlug: game.slug, args: [predicted.scoreSubmissionRegistry, true] },
    { contract: 'ScoreSubmissionRegistry', to: predicted.scoreSubmissionRegistry, iface: scoresInterface, method: 'setAchievementRegistry', gameSlug: game.slug, args: [game.gameId, predicted.achievementRegistries[game.slug]] },
    { contract: 'GameRegistry', to: predicted.gameRegistry, iface: registryInterface, method: 'registerGame', gameSlug: game.slug, args: [game.slug, game.title, config.developerWallet, game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps, game.entryFeeWei] },
  );
}
const postDeployTransactions = postDeployPlan.map((row, index) => {
  const data = row.iface.encodeFunctionData(row.method, row.args);
  const { iface, ...rest } = row;
  return { nonce: pendingNonce + deployTransactions.length + index, signer: 'deployer', ...rest, data, calldataHash: ethers.keccak256(data) };
});

// Activation needs the developer wallet's signature for confirmDevWallet. When the deployer IS the
// developer wallet the whole run is atomic; otherwise these are listed for the owner to send afterwards.
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const atomicActivation = same(config.deployer, config.developerWallet);
let activationNonce = pendingNonce + deployTransactions.length + postDeployTransactions.length;
const activationTransactions = [];
for (const game of games) {
  const confirmData = registryInterface.encodeFunctionData('confirmDevWallet', [game.gameId]);
  const playableData = registryInterface.encodeFunctionData('setPlayable', [game.gameId, true]);
  activationTransactions.push(
    { nonce: atomicActivation ? activationNonce++ : null, signer: 'developerWallet', contract: 'GameRegistry', to: predicted.gameRegistry, method: 'confirmDevWallet', gameSlug: game.slug, args: [game.gameId], data: confirmData, calldataHash: ethers.keccak256(confirmData) },
    { nonce: atomicActivation ? activationNonce++ : null, signer: 'operator', contract: 'GameRegistry', to: predicted.gameRegistry, method: 'setPlayable', gameSlug: game.slug, args: [game.gameId, true], data: playableData, calldataHash: ethers.keccak256(playableData) },
  );
}

const manifest = {
  schemaVersion: 3,
  status: 'UNSIGNED_DRY_RUN',
  design: 'native-fee-ranked-eip712-soulbound-2026-09-16',
  epoch: 'testnet',
  epochNote: 'Testnet epoch until mainnet; mainnet is a fresh deployment set and nothing here carries over.',
  network: config.network,
  chainId: config.chainId,
  nativeToken: config.nativeToken,
  deployer: config.deployer,
  observedPendingNonce: pendingNonce,
  operator: config.operator,
  trustedVerifier: config.verifier,
  relayer,
  relayerVault,
  settlementGasReserveWei,
  vaults: { platformVault: config.platformVault, liquidityVault: config.liquidityVault, treasuryVault: config.treasuryVault },
  developerWallet: config.developerWallet,
  achievementBaseTokenUri: config.achievementBaseTokenUri,
  games: games.map((game) => ({
    slug: game.slug,
    title: game.title,
    gameId: game.gameId,
    entryFeeWei: game.entryFeeWei,
    settlementGasReserveWei,
    totalEntryWei: (BigInt(game.entryFeeWei) + BigInt(settlementGasReserveWei)).toString(),
    devBps: game.devBps,
    platformBps: game.platformBps,
    liquidityBps: game.liquidityBps,
    treasuryBps: game.treasuryBps,
    achievements: { ...game.achievements, predictedAddress: predicted.achievementRegistries[game.slug] },
  })),
  contracts: contractRows,
  postDeployTransactions,
  activation: { atomic: atomicActivation, transactions: activationTransactions },
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
if (!same(config.operator, signer.address)) {
  throw new Error('Deployment requires deployer=operator so vault, relayer, minter and registration wiring can be sent atomically.');
}

async function deploy(name, args) {
  const factory = new ethers.ContractFactory(artifacts[name].abi, artifacts[name].bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

const gameRegistry = await deploy('GameRegistry', [config.operator]);
const profiles = await deploy('PlayerProfileRegistry', []);
const rankedEntry = await deploy('ArcadeRankedEntry', [await gameRegistry.getAddress(), config.operator]);
const scores = await deploy('ScoreSubmissionRegistry', [
  await gameRegistry.getAddress(),
  await rankedEntry.getAddress(),
  config.verifier,
  config.operator,
]);
const achievementRegistries = {};
for (const game of games) {
  achievementRegistries[game.slug] = await deploy('AchievementRegistry', [config.operator, game.achievements.name, game.achievements.symbol, game.achievements.baseTokenUri]);
}

await (await rankedEntry.setPlatformVaults(config.platformVault, config.liquidityVault, config.treasuryVault)).wait();
await (await rankedEntry.setRelayerVault(relayerVault)).wait();
await (await rankedEntry.setSettlementGasReserve(settlementGasReserveWei)).wait();
await (await scores.setRelayer(relayer, true)).wait();
for (const game of games) {
  const registry = achievementRegistries[game.slug];
  await (await registry.setMinter(await scores.getAddress(), true)).wait();
  await (await scores.setAchievementRegistry(game.gameId, await registry.getAddress())).wait();
  await (await gameRegistry.registerGame(game.slug, game.title, config.developerWallet, game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps, game.entryFeeWei)).wait();
}
if (atomicActivation) {
  for (const game of games) {
    await (await gameRegistry.confirmDevWallet(game.gameId)).wait();
    await (await gameRegistry.setPlayable(game.gameId, true)).wait();
  }
} else {
  console.log(`Games registered but NOT playable: developerWallet ${config.developerWallet} must call GameRegistry.confirmDevWallet(gameId) for each game, then the operator calls setPlayable(gameId, true). See manifest.activation.transactions.`);
}

// Read-back verification: every predicted address and wiring must match before a record is written.
for (const [key, contract] of Object.entries({ gameRegistry, playerProfileRegistry: profiles, arcadeRankedEntry: rankedEntry, scoreSubmissionRegistry: scores })) {
  if (!same(await contract.getAddress(), predicted[key])) throw new Error(`${key} deployed at an unpredicted address; manifest invalid.`);
}
for (const game of games) {
  const registry = achievementRegistries[game.slug];
  if (!same(await registry.getAddress(), predicted.achievementRegistries[game.slug])) throw new Error(`AchievementRegistry[${game.slug}] deployed at an unpredicted address; manifest invalid.`);
  if ((await registry.name()) !== game.achievements.name || (await registry.symbol()) !== game.achievements.symbol) throw new Error(`AchievementRegistry[${game.slug}] name/symbol read-back mismatch.`);
  if ((await registry.baseTokenUri()) !== game.achievements.baseTokenUri) throw new Error(`AchievementRegistry[${game.slug}] baseTokenUri read-back mismatch.`);
  if (!(await registry.minters(await scores.getAddress()))) throw new Error(`Score registry is not the minter of AchievementRegistry[${game.slug}].`);
  if (!same(await scores.achievementRegistryByGame(game.gameId), await registry.getAddress())) throw new Error(`Score registry achievement routing mismatch for ${game.slug}.`);

  const registered = await gameRegistry.getGame(game.gameId);
  if (!registered.exists || !same(registered.devWallet, config.developerWallet)) throw new Error(`Post-deploy GameRegistry read-back failed for ${game.slug}.`);
  if (atomicActivation && (!registered.playable || !registered.devWalletConfirmed)) throw new Error(`Activation read-back failed for ${game.slug}.`);
  if (registered.entryFeeWei.toString() !== game.entryFeeWei) throw new Error(`Entry fee mismatch for ${game.slug}.`);
  if (Number(registered.devBps) !== game.devBps || Number(registered.platformBps) !== game.platformBps || Number(registered.liquidityBps) !== game.liquidityBps || Number(registered.treasuryBps) !== game.treasuryBps) {
    throw new Error(`Fee split mismatch for ${game.slug}.`);
  }
  const quote = await rankedEntry.quoteEntry(game.gameId);
  if (quote.totalWei.toString() !== (BigInt(game.entryFeeWei) + BigInt(settlementGasReserveWei)).toString()) throw new Error(`quoteEntry total mismatch for ${game.slug}.`);
}
if (!same(await scores.gameRegistry(), await gameRegistry.getAddress())) throw new Error('Score registry wiring mismatch.');
if (!same(await scores.rankedEntry(), await rankedEntry.getAddress())) throw new Error('Ranked entry wiring mismatch.');
if (!same(await scores.trustedVerifier(), config.verifier)) throw new Error('Verifier wiring mismatch.');
if (!(await scores.relayers(relayer))) throw new Error('Relayer is not allow-listed on the score registry.');
if (!same(await rankedEntry.gameRegistry(), await gameRegistry.getAddress())) throw new Error('Ranked entry registry wiring mismatch.');
if (!same(await rankedEntry.platformVault(), config.platformVault)) throw new Error('Platform vault wiring mismatch.');
if (!same(await rankedEntry.treasuryVault(), config.treasuryVault)) throw new Error('Treasury vault wiring mismatch.');
if (!same(await rankedEntry.relayerVault(), relayerVault)) throw new Error('Relayer vault wiring mismatch.');
if ((await rankedEntry.settlementGasReserveWei()).toString() !== settlementGasReserveWei) throw new Error('Settlement gas reserve mismatch.');
if (!(await rankedEntry.entryFeeEnabled())) throw new Error('Entry fee must be enabled after deploy.');

// Deployment blocks and transaction hashes (contract §8.1): the indexer starts at startBlock.
const deployFacts = summarizeDeployReceipts({
  core: {
    gameRegistry: await gameRegistry.deploymentTransaction().wait(),
    playerProfileRegistry: await profiles.deploymentTransaction().wait(),
    arcadeRankedEntry: await rankedEntry.deploymentTransaction().wait(),
    scoreSubmissionRegistry: await scores.deploymentTransaction().wait(),
  },
  achievementRegistries: Object.fromEntries(await Promise.all(games.map(async (game) => [game.slug, await achievementRegistries[game.slug].deploymentTransaction().wait()]))),
});

const record = {
  schemaVersion: 4,
  epoch: manifest.epoch,
  epochNote: manifest.epochNote,
  network: config.network,
  chainId: config.chainId,
  nativeToken: config.nativeToken,
  deployedAt: new Date().toISOString(),
  deployer: signer.address,
  mode: 'native-fee-ranked-verified',
  addresses: {
    gameRegistry: await gameRegistry.getAddress(),
    playerProfileRegistry: await profiles.getAddress(),
    arcadeRankedEntry: await rankedEntry.getAddress(),
    scoreSubmissionRegistry: await scores.getAddress(),
    achievementRegistries: Object.fromEntries(await Promise.all(games.map(async (game) => [game.slug, await achievementRegistries[game.slug].getAddress()]))),
  },
  blocks: deployFacts.blocks,
  startBlock: deployFacts.startBlock,
  deployTxHashes: deployFacts.deployTxHashes,
  trustedVerifier: config.verifier,
  relayer,
  relayerVault,
  settlementGasReserveWei,
  vaults: manifest.vaults,
  developerWallet: config.developerWallet,
  activation: atomicActivation ? 'atomic' : 'deferred-dev-wallet-confirmation',
  games: manifest.games,
  oldDeployment: config.oldDeployment,
};
writeFileSync(join(root, 'contracts', 'deployment-record.hardened.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));

// Regenerate the portal address module from the record just written (contract A19): status 'deployed'.
const addressModule = writeLitvmAddressModule({ root, mode: 'deployed', record });
console.log(`Portal address module regenerated: ${addressModule.relativePath} (status ${addressModule.status}). Commit it with the record.`);

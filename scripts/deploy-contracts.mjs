// Hardened free-ranked LitVM testnet deployment.
// Dry-run is the default. Broadcasting requires BOTH --broadcast and the exact
// LITVM_DEPLOY_CONFIRM value below. Never logs credential material.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const BROADCAST_CONFIRM = 'DEPLOY_HARDENED_FREE_RANKED_4441';
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

const artifacts = Object.freeze({
  GameRegistry: loadArtifact('GameRegistry'),
  PlayerProfileRegistry: loadArtifact('PlayerProfileRegistry'),
  ScoreSubmissionRegistry: loadArtifact('ScoreSubmissionRegistry'),
});
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || config.rpcUrl, config.chainId);
const network = await provider.getNetwork();
if (Number(network.chainId) !== config.chainId) throw new Error(`Wrong chain ${network.chainId}; expected ${config.chainId}`);
const pendingNonce = await provider.getTransactionCount(config.deployer, 'pending');
const predicted = Object.freeze({
  gameRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce }),
  playerProfileRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 1 }),
  scoreSubmissionRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 2 }),
});

const unsignedFactories = {
  GameRegistry: new ethers.ContractFactory(artifacts.GameRegistry.abi, artifacts.GameRegistry.bytecode),
  PlayerProfileRegistry: new ethers.ContractFactory(artifacts.PlayerProfileRegistry.abi, artifacts.PlayerProfileRegistry.bytecode),
  ScoreSubmissionRegistry: new ethers.ContractFactory(artifacts.ScoreSubmissionRegistry.abi, artifacts.ScoreSubmissionRegistry.bytecode),
};
const deployTransactions = [
  { name: 'GameRegistry', nonce: pendingNonce, predictedAddress: predicted.gameRegistry, transaction: await unsignedFactories.GameRegistry.getDeployTransaction(config.operator) },
  { name: 'PlayerProfileRegistry', nonce: pendingNonce + 1, predictedAddress: predicted.playerProfileRegistry, transaction: await unsignedFactories.PlayerProfileRegistry.getDeployTransaction() },
  { name: 'ScoreSubmissionRegistry', nonce: pendingNonce + 2, predictedAddress: predicted.scoreSubmissionRegistry, transaction: await unsignedFactories.ScoreSubmissionRegistry.getDeployTransaction(predicted.gameRegistry, config.verifier) },
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
const gameId = ethers.id(config.game.slug);
const postDeployTransactions = [
  { nonce: pendingNonce + 3, method: 'registerGame', args: [config.game.slug, config.game.title, config.developerWallet, config.game.devBps, config.game.platformBps, config.game.liquidityBps, config.game.treasuryBps, config.game.entryFeeMicroUsdc] },
  { nonce: pendingNonce + 4, method: 'confirmDevWallet', args: [gameId] },
  { nonce: pendingNonce + 5, method: 'setPlayable', args: [gameId, true] },
].map((row) => {
  const data = registryInterface.encodeFunctionData(row.method, row.args);
  return { ...row, to: predicted.gameRegistry, data, calldataHash: ethers.keccak256(data) };
});
const manifest = {
  schemaVersion: 1,
  status: 'UNSIGNED_DRY_RUN',
  network: config.network,
  chainId: config.chainId,
  deployer: config.deployer,
  observedPendingNonce: pendingNonce,
  trustedVerifier: config.verifier,
  contracts: contractRows,
  postDeployTransactions,
  excluded: ['PaymentRouter', 'ArcadePaymentRouter', 'SessionLedger', 'AchievementRegistry', 'TournamentPool', 'LestersArcadeCore'],
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
const scores = await deploy('ScoreSubmissionRegistry', [await gameRegistry.getAddress(), config.verifier]);
await (await gameRegistry.registerGame(config.game.slug, config.game.title, config.developerWallet, config.game.devBps, config.game.platformBps, config.game.liquidityBps, config.game.treasuryBps, config.game.entryFeeMicroUsdc)).wait();
await (await gameRegistry.confirmDevWallet(gameId)).wait();
await (await gameRegistry.setPlayable(gameId, true)).wait();

const registered = await gameRegistry.getGame(gameId);
if (!registered.exists || !registered.playable || registered.devWallet.toLowerCase() !== config.developerWallet.toLowerCase()) throw new Error('Post-deploy GameRegistry read-back failed.');
if ((await scores.gameRegistry()).toLowerCase() !== (await gameRegistry.getAddress()).toLowerCase()) throw new Error('Score registry wiring mismatch.');
if ((await scores.trustedVerifier()).toLowerCase() !== config.verifier.toLowerCase()) throw new Error('Verifier wiring mismatch.');

const record = {
  schemaVersion: 2,
  network: config.network,
  chainId: config.chainId,
  deployedAt: new Date().toISOString(),
  deployer: signer.address,
  mode: 'free-ranked-verified',
  addresses: {
    gameRegistry: await gameRegistry.getAddress(),
    playerProfileRegistry: await profiles.getAddress(),
    scoreSubmissionRegistry: await scores.getAddress(),
  },
  gameId,
  oldDeployment: config.oldDeployment,
};
writeFileSync(join(root, 'contracts', 'deployment-record.hardened.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));

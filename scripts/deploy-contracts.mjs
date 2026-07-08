// Lester's Arcade — Smart Contract Deploy Script for LitVM LiteForge Testnet
//
// Deploys the Lester's Arcade contract suite to LitVM LiteForge testnet (chain ID 4441).
// Requires:
//   - DEPLOYER_PRIVATE_KEY env var (the wallet that deploys + becomes contract owner)
//   - RPC_URL env var (defaults to LitVM LiteForge testnet RPC)
//   - Compiled contract ABIs + bytecodes (run `npm run contracts:compile` first)
//
// After deploy, this script prints the contract addresses. Paste them into
// settlement.mjs LITVM_CONTRACT_ADDRESSES and flip SETTLEMENT_LIVE = true.
//
// Usage:
//   DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy
//
// IMPORTANT: This script sends real testnet transactions. It requires zkLTC
// in the deployer wallet (free from the LitVM faucet). All actions are testnet-only.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://liteforge.rpc.caldera.xyz/http';
const CHAIN_ID = 4441;

if (!DEPLOYER_PRIVATE_KEY) {
  console.error('ERROR: DEPLOYER_PRIVATE_KEY env var is required.');
  console.error('Set it to the private key of the wallet that will deploy + own the contracts.');
  console.error('Example: DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy');
  process.exit(1);
}

// Check if compiled contract artifacts exist
const compiledDir = join(root, 'contracts', 'artifacts');
const requiredContracts = [
  'PlayerProfileRegistry.json',
  'GameRegistry.json',
  'ArcadePaymentRouter.json',
  'ScoreSubmissionRegistry.json',
  'SessionLedger.json',
  'AchievementRegistry.json',
  'TournamentPool.json',
  'LestersArcadeCore.json',
];

for (const file of requiredContracts) {
  if (!existsSync(join(compiledDir, file))) {
    console.error(`ERROR: ${file} not found in contracts/compiled/. Run 'npm run contracts:compile' first.`);
    process.exit(1);
  }
}

console.log('=== Lester\'s Arcade Contract Deployment ===');
console.log(`Network: LitVM LiteForge Testnet (chain ID ${CHAIN_ID})`);
console.log(`RPC: ${RPC_URL}`);
console.log('Deployer: resolved after wallet initialization');
console.log('');

// Load compiled contract artifacts
function loadArtifact(name) {
  const path = join(compiledDir, `${name}.json`);
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  // Artifacts store bytecode under evm.bytecode.object (solc output)
  const bytecode = raw.bytecode || raw.evm?.bytecode?.object;
  if (!bytecode) throw new Error(`No bytecode found in ${name}.json`);
  // Ensure bytecode has 0x prefix
  return { abi: raw.abi, bytecode: bytecode.startsWith('0x') ? bytecode : '0x' + bytecode };
}

const artifacts = {
  PlayerProfileRegistry: loadArtifact('PlayerProfileRegistry'),
  GameRegistry: loadArtifact('GameRegistry'),
  ArcadePaymentRouter: loadArtifact('ArcadePaymentRouter'),
  ScoreSubmissionRegistry: loadArtifact('ScoreSubmissionRegistry'),
  AchievementRegistry: loadArtifact('AchievementRegistry'),
  TournamentPool: loadArtifact('TournamentPool'),
  LestersArcadeCore: loadArtifact('LestersArcadeCore'),
  SessionLedger: loadArtifact('SessionLedger'),
};

console.log('All contract artifacts loaded successfully.');
console.log('');

// The actual deployment requires an EVM provider (ethers.js or viem).
// Since this is a Node.js script, we use a dynamic import of ethers if available.
// If ethers is not installed, we print the deployment plan for manual execution.

async function deploy() {
  let ethers;
  try {
    ethers = await import('ethers');
  } catch {
    console.error('ethers.js is not installed. Install it with: npm install ethers');
    console.error('');
    console.error('=== Manual Deployment Plan ===');
    console.error('Deploy the following contracts in order on LitVM LiteForge testnet:');
    console.error('');
    let i = 1;
    for (const [name, artifact] of Object.entries(artifacts)) {
      console.error(`${i}. ${name}`);
      console.error(`   ABI: contracts/compiled/${name}.json`);
      console.error(`   Bytecode: ${artifact.bytecode?.slice(0, 20) || artifact.evm?.bytecode?.object?.slice(0, 20)}...`);
      i += 1;
    }
    console.error('');
    console.error('After deployment, paste the addresses into apps/portal/src/settlement.mjs:');
    console.error('  LITVM_CONTRACT_ADDRESSES = {');
    console.error('    playerProfileRegistry: "0x...",');
    console.error('    scoreSubmissionRegistry: "0x...",');
    console.error('    achievementRegistry: "0x...",');
    console.error('    arcadePaymentRouter: "0x...",');
    console.error('  };');
    console.error('Then set SETTLEMENT_LIVE = true.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  console.log(`Deployer address: ${deployer.address}`);
  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} zkLTC`);

  if (balance === 0n) {
    console.error('ERROR: Deployer wallet has 0 zkLTC. Get testnet funds from the LitVM faucet.');
    process.exit(1);
  }

  console.log('');
  console.log('Deploying contracts...');

  const addresses = {};

  // 1. Deploy PlayerProfileRegistry
  console.log('1/8: PlayerProfileRegistry...');
  const playerProfileFactory = new ethers.ContractFactory(
    artifacts.PlayerProfileRegistry.abi,
    artifacts.PlayerProfileRegistry.bytecode,
    deployer,
  );
  const playerProfiles = await playerProfileFactory.deploy();
  await playerProfiles.waitForDeployment();
  addresses.playerProfileRegistry = await playerProfiles.getAddress();
  console.log(`   Deployed at: ${addresses.playerProfileRegistry}`);

  // 2. Deploy GameRegistry
  console.log('2/8: GameRegistry...');
  const gameRegistryFactory = new ethers.ContractFactory(
    artifacts.GameRegistry.abi,
    artifacts.GameRegistry.bytecode,
    deployer,
  );
  const gameRegistry = await gameRegistryFactory.deploy(deployer.address);
  await gameRegistry.waitForDeployment();
  addresses.gameRegistry = await gameRegistry.getAddress();
  console.log(`   Deployed at: ${addresses.gameRegistry}`);

  // 3. Deploy ArcadePaymentRouter (registry-derived routing; entry fees disabled by default)
  console.log('3/8: ArcadePaymentRouter...');
  const paymentRouterFactory = new ethers.ContractFactory(
    artifacts.ArcadePaymentRouter.abi,
    artifacts.ArcadePaymentRouter.bytecode,
    deployer,
  );
  const paymentRouter = await paymentRouterFactory.deploy(
    addresses.gameRegistry,
    deployer.address,
    deployer.address, // placeholder allowed payment token; WO-131 config replaces before approved deploy
  );
  await paymentRouter.waitForDeployment();
  addresses.arcadePaymentRouter = await paymentRouter.getAddress();
  console.log(`   Deployed at: ${addresses.arcadePaymentRouter}`);

  // 4. Deploy ScoreSubmissionRegistry (needs deployer as trustedVerifier)
  console.log('4/8: ScoreSubmissionRegistry...');
  const scoreSubmissionFactory = new ethers.ContractFactory(
    artifacts.ScoreSubmissionRegistry.abi,
    artifacts.ScoreSubmissionRegistry.bytecode,
    deployer,
  );
  const scoreSubmissions = await scoreSubmissionFactory.deploy(addresses.gameRegistry);
  await scoreSubmissions.waitForDeployment();
  addresses.scoreSubmissionRegistry = await scoreSubmissions.getAddress();
  console.log(`   Deployed at: ${addresses.scoreSubmissionRegistry}`);

  // 5. Deploy SessionLedger (needs gameRegistry + paymentRouter + entryToken)
  console.log('5/8: SessionLedger...');
  const sessionLedgerFactory = new ethers.ContractFactory(
    artifacts.SessionLedger.abi,
    artifacts.SessionLedger.bytecode,
    deployer,
  );
  const sessionLedger = await sessionLedgerFactory.deploy(
    addresses.gameRegistry,
    addresses.arcadePaymentRouter,
    deployer.address, // placeholder entry token (no real ERC-20 on testnet yet)
  );
  await sessionLedger.waitForDeployment();
  addresses.sessionLedger = await sessionLedger.getAddress();
  console.log(`   Deployed at: ${addresses.sessionLedger}`);

  // 6. Deploy AchievementRegistry (needs sessionLedger)
  console.log('6/8: AchievementRegistry...');
  const achievementFactory = new ethers.ContractFactory(
    artifacts.AchievementRegistry.abi,
    artifacts.AchievementRegistry.bytecode,
    deployer,
  );
  const achievements = await achievementFactory.deploy(addresses.sessionLedger);
  await achievements.waitForDeployment();
  addresses.achievementRegistry = await achievements.getAddress();
  console.log(`   Deployed at: ${addresses.achievementRegistry}`);

  // 7. Deploy TournamentPool
  console.log('7/8: TournamentPool...');
  const tournamentFactory = new ethers.ContractFactory(
    artifacts.TournamentPool.abi,
    artifacts.TournamentPool.bytecode,
    deployer,
  );
  const tournaments = await tournamentFactory.deploy();
  await tournaments.waitForDeployment();
  addresses.tournamentPool = await tournaments.getAddress();
  console.log(`   Deployed at: ${addresses.tournamentPool}`);

  // 7. Deploy LestersArcadeCore (composition wrapper)
  console.log('8/8: LestersArcadeCore...');
  const coreFactory = new ethers.ContractFactory(
    artifacts.LestersArcadeCore.abi,
    artifacts.LestersArcadeCore.bytecode,
    deployer,
  );
  const core = await coreFactory.deploy(deployer.address);
  await core.waitForDeployment();
  addresses.lestersArcadeCore = await core.getAddress();
  console.log(`   Deployed at: ${addresses.lestersArcadeCore}`);

  console.log('');
  console.log('=== DEPLOYMENT COMPLETE ===');
  console.log('');
  console.log('Paste these addresses into apps/portal/src/settlement.mjs:');
  console.log('');
  console.log('export const LITVM_CONTRACT_ADDRESSES = Object.freeze({');
  console.log(`  playerProfileRegistry: '${addresses.playerProfileRegistry}',`);
  console.log(`  scoreSubmissionRegistry: '${addresses.scoreSubmissionRegistry}',`);
  console.log(`  achievementRegistry: '${addresses.achievementRegistry}',`);
  console.log(`  arcadePaymentRouter: '${addresses.arcadePaymentRouter}',`);
  console.log(`});`);
  console.log('');
  console.log('Then set SETTLEMENT_LIVE = true.');
  console.log('');

  // Save deployment record
  const deploymentRecord = {
    network: 'LitVM LiteForge Testnet',
    chainId: CHAIN_ID,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    addresses,
  };
  const recordPath = join(root, 'contracts', 'deployment-record.json');
  writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`Deployment record saved to: contracts/deployment-record.json`);

  // Auto-patch settlement.mjs LITVM_CONTRACT_ADDRESSES so the runtime points at
  // the freshly deployed contracts without a manual copy/paste step.
  try {
    const settlementPath = join(root, 'apps', 'portal', 'src', 'settlement.mjs');
    let settlementSrc = readFileSync(settlementPath, 'utf8');
    const block = `export const LITVM_CONTRACT_ADDRESSES = Object.freeze({\n` +
      `  playerProfileRegistry: '${addresses.playerProfileRegistry}',\n` +
      `  scoreSubmissionRegistry: '${addresses.scoreSubmissionRegistry}',\n` +
      `  achievementRegistry: '${addresses.achievementRegistry}',\n` +
      `  arcadePaymentRouter: '${addresses.arcadePaymentRouter}',\n` +
      `  lestersArcadeCore: '${addresses.lestersArcadeCore}',\n` +
      `});`;
    settlementSrc = settlementSrc.replace(
      /export const LITVM_CONTRACT_ADDRESSES = Object\.freeze\(\{[\s\S]*?\}\);/,
      block,
    );
    writeFileSync(settlementPath, settlementSrc);
    console.log('Patched apps/portal/src/settlement.mjs with new addresses.');
  } catch (err) {
    console.warn('Could not auto-patch settlement.mjs:', err.message);
  }
}

deploy().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

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

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://rpc.litvm.com';
const CHAIN_ID = 4441;

if (!DEPLOYER_PRIVATE_KEY) {
  console.error('ERROR: DEPLOYER_PRIVATE_KEY env var is required.');
  console.error('Set it to the private key of the wallet that will deploy + own the contracts.');
  console.error('Example: DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy');
  process.exit(1);
}

// Check if compiled contracts exist
const compiledDir = join(root, 'contracts', 'compiled');
const requiredContracts = [
  'PlayerProfileRegistry.json',
  'GameRegistry.json',
  'ArcadePaymentRouter.json',
  'ScoreSubmissionRegistry.json',
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
console.log(`Deployer: ${DEPLOYER_PRIVATE_KEY.slice(0, 6)}...${DEPLOYER_PRIVATE_KEY.slice(-4)}`);
console.log('');

// Load compiled contract artifacts
function loadArtifact(name) {
  const path = join(compiledDir, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const artifacts = {
  PlayerProfileRegistry: loadArtifact('PlayerProfileRegistry'),
  GameRegistry: loadArtifact('GameRegistry'),
  ArcadePaymentRouter: loadArtifact('ArcadePaymentRouter'),
  ScoreSubmissionRegistry: loadArtifact('ScoreSubmissionRegistry'),
  AchievementRegistry: loadArtifact('AchievementRegistry'),
  TournamentPool: loadArtifact('TournamentPool'),
  LestersArcadeCore: loadArtifact('LestersArcadeCore'),
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
  console.log('1/7: PlayerProfileRegistry...');
  const playerProfileFactory = new ethers.ContractFactory(
    artifacts.PlayerProfileRegistry.abi,
    artifacts.PlayerProfileRegistry.bytecode || artifacts.PlayerProfileRegistry.evm?.bytecode?.object,
    deployer,
  );
  const playerProfiles = await playerProfileFactory.deploy();
  await playerProfiles.waitForDeployment();
  addresses.playerProfileRegistry = await playerProfiles.getAddress();
  console.log(`   Deployed at: ${addresses.playerProfileRegistry}`);

  // 2. Deploy GameRegistry
  console.log('2/7: GameRegistry...');
  const gameRegistryFactory = new ethers.ContractFactory(
    artifacts.GameRegistry.abi,
    artifacts.GameRegistry.bytecode || artifacts.GameRegistry.evm?.bytecode?.object,
    deployer,
  );
  const gameRegistry = await gameRegistryFactory.deploy();
  await gameRegistry.waitForDeployment();
  addresses.gameRegistry = await gameRegistry.getAddress();
  console.log(`   Deployed at: ${addresses.gameRegistry}`);

  // 3. Deploy ScoreSubmissionRegistry
  console.log('3/7: ScoreSubmissionRegistry...');
  const scoreSubmissionFactory = new ethers.ContractFactory(
    artifacts.ScoreSubmissionRegistry.abi,
    artifacts.ScoreSubmissionRegistry.bytecode || artifacts.ScoreSubmissionRegistry.evm?.bytecode?.object,
    deployer,
  );
  const scoreSubmissions = await scoreSubmissionFactory.deploy(deployer.address);
  await scoreSubmissions.waitForDeployment();
  addresses.scoreSubmissionRegistry = await scoreSubmissions.getAddress();
  console.log(`   Deployed at: ${addresses.scoreSubmissionRegistry}`);

  // 4. Deploy AchievementRegistry
  console.log('4/7: AchievementRegistry...');
  const achievementFactory = new ethers.ContractFactory(
    artifacts.AchievementRegistry.abi,
    artifacts.AchievementRegistry.bytecode || artifacts.AchievementRegistry.evm?.bytecode?.object,
    deployer,
  );
  const achievements = await achievementFactory.deploy();
  await achievements.waitForDeployment();
  addresses.achievementRegistry = await achievements.getAddress();
  console.log(`   Deployed at: ${addresses.achievementRegistry}`);

  // 5. Deploy ArcadePaymentRouter
  console.log('5/7: ArcadePaymentRouter...');
  const paymentRouterFactory = new ethers.ContractFactory(
    artifacts.ArcadePaymentRouter.abi,
    artifacts.ArcadePaymentRouter.bytecode || artifacts.ArcadePaymentRouter.evm?.bytecode?.object,
    deployer,
  );
  const paymentRouter = await paymentRouterFactory.deploy();
  await paymentRouter.waitForDeployment();
  addresses.arcadePaymentRouter = await paymentRouter.getAddress();
  console.log(`   Deployed at: ${addresses.arcadePaymentRouter}`);

  // 6. Deploy TournamentPool
  console.log('6/7: TournamentPool...');
  const tournamentFactory = new ethers.ContractFactory(
    artifacts.TournamentPool.abi,
    artifacts.TournamentPool.bytecode || artifacts.TournamentPool.evm?.bytecode?.object,
    deployer,
  );
  const tournaments = await tournamentFactory.deploy();
  await tournaments.waitForDeployment();
  addresses.tournamentPool = await tournaments.getAddress();
  console.log(`   Deployed at: ${addresses.tournamentPool}`);

  // 7. Deploy LestersArcadeCore (composition wrapper)
  console.log('7/7: LestersArcadeCore...');
  const coreFactory = new ethers.ContractFactory(
    artifacts.LestersArcadeCore.abi,
    artifacts.LestersArcadeCore.bytecode || artifacts.LestersArcadeCore.evm?.bytecode?.object,
    deployer,
  );
  const core = await coreFactory.deploy(
    addresses.playerProfileRegistry,
    addresses.gameRegistry,
    addresses.arcadePaymentRouter,
    addresses.scoreSubmissionRegistry,
    addresses.achievementRegistry,
    addresses.tournamentPool,
  );
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
}

deploy().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

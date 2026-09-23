// In-process local LitVM chain for tests and the rehearsal (contract A21; contracts slice).
//
// startLocalChain() boots Hardhat 3's EDR network from the repo's hardhat.config.js (chainId 4441,
// offline, nothing compiled) and returns an ethers provider, the named fixture wallets and the
// cheat-code helpers. deployLocalSuite() deploys the committed contracts/artifacts bytecode in the
// same order and with the same wiring as scripts/deploy-contracts.mjs (the parity test in
// tests/local-deploy-harness.test.mjs text-scans both files), and returns a record with the shape
// of contracts/deployment-record.hardened.json. Collections deploy empty: no defineAchievement (D15).
//
// Never import scripts/deploy-contracts.mjs from here or from a test: it has top-level side
// effects (it reads the live RPC). This module mirrors it instead.
//
// Keys: every wallet derives from the PUBLIC Hardhat test mnemonic. They are fixtures, never real.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { summarizeDeployReceipts } from '../generate-litvm-addresses.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

export const LOCAL_CHAIN_ID = 4441;
export const HARDHAT_TEST_MNEMONIC = 'test test test test test test test test test test test junk';
export const LOCAL_WALLET_ROLES = Object.freeze(['operator', 'verifier', 'relayer', 'developer', 'platformVault', 'player1', 'player2', 'attacker']);
export const LOCAL_WALLET_BALANCE_WEI = 10_000n * 10n ** 18n;
export const LOCAL_ARTIFACT_NAMES = Object.freeze(['GameRegistry', 'PlayerProfileRegistry', 'AchievementRegistry', 'ArcadeRankedEntry', 'ScoreSubmissionRegistry']);

let fixtureKeys = null;
// Private keys of the named fixture wallets (Hardhat test mnemonic, m/44'/60'/0'/0/<index>). Public.
export function localWalletKeys() {
  if (!fixtureKeys) {
    const mnemonic = ethers.Mnemonic.fromPhrase(HARDHAT_TEST_MNEMONIC);
    fixtureKeys = Object.freeze(Object.fromEntries(LOCAL_WALLET_ROLES.map((role, index) => [
      role,
      ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`).privateKey,
    ])));
  }
  return fixtureKeys;
}

let artifactCache = null;
// Same bytecode handling as scripts/deploy-contracts.mjs loadArtifact().
export function loadArtifact(name) {
  artifactCache ??= new Map();
  if (!artifactCache.has(name)) {
    const artifact = JSON.parse(readFileSync(join(root, 'contracts', 'artifacts', `${name}.json`), 'utf8'));
    const object = artifact.bytecode || artifact.evm?.bytecode?.object;
    if (!object) throw new Error(`${name} bytecode missing`);
    artifactCache.set(name, Object.freeze({ abi: artifact.abi, bytecode: object.startsWith('0x') ? object : `0x${object}` }));
  }
  return artifactCache.get(name);
}

let hrePromise = null;
// One Hardhat runtime per process, created from the repo config whatever the working directory.
async function localHardhatRuntime() {
  if (!hrePromise) {
    hrePromise = (async () => {
      const { createHardhatRuntimeEnvironment, importUserConfig } = await import('hardhat/hre');
      const configPath = join(root, 'hardhat.config.js');
      const userConfig = await importUserConfig(configPath);
      return createHardhatRuntimeEnvironment(userConfig, { config: configPath }, configPath);
    })();
    hrePromise.catch(() => { hrePromise = null; });
  }
  return hrePromise;
}

// Boots a fresh in-process chain. Each call is an independent chain (its own EDR instance).
export async function startLocalChain({ balanceWei = LOCAL_WALLET_BALANCE_WEI } = {}) {
  const hre = await localHardhatRuntime();
  const connection = await hre.network.connect();
  const eip1193 = connection.provider;
  const chainIdHex = await eip1193.request({ method: 'eth_chainId' });
  if (Number.parseInt(chainIdHex, 16) !== LOCAL_CHAIN_ID) {
    await connection.close();
    throw new Error(`local chain reports chain ${chainIdHex}; hardhat.config.js must set chainId ${LOCAL_CHAIN_ID}`);
  }
  // cacheTimeout -1: ethers would otherwise answer identical reads within 250 ms from a cache,
  // which hides state changes between two transactions in a test.
  const provider = new ethers.BrowserProvider(eip1193, LOCAL_CHAIN_ID, { staticNetwork: true, cacheTimeout: -1, pollingInterval: 50 });
  const request = (method, params = []) => eip1193.request({ method, params });

  const setBalance = async (address, wei = balanceWei) => {
    await request('hardhat_setBalance', [ethers.getAddress(address), ethers.toQuantity(BigInt(wei))]);
  };
  const keys = localWalletKeys();
  const wallets = {};
  for (const role of LOCAL_WALLET_ROLES) {
    wallets[role] = new ethers.Wallet(keys[role], provider);
    // eslint-disable-next-line no-await-in-loop
    await setBalance(wallets[role].address);
  }

  return {
    eip1193,
    provider,
    wallets: Object.freeze(wallets),
    request,
    setBalance,
    // Impersonates any address (no key needed) and returns a signer for it. Funds it when asked.
    async impersonate(address, { fund = true } = {}) {
      const checksummed = ethers.getAddress(address);
      await request('hardhat_impersonateAccount', [checksummed]);
      if (fund) await setBalance(checksummed);
      return new ethers.JsonRpcSigner(provider, checksummed);
    },
    async increaseTime(seconds) {
      return request('evm_increaseTime', [Number(seconds)]);
    },
    async mine(blocks = 1) {
      for (let index = 0; index < blocks; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await request('evm_mine', []);
      }
    },
    async latestTimestamp() {
      const block = await provider.getBlock('latest');
      return block.timestamp;
    },
    async snapshot() {
      return request('evm_snapshot', []);
    },
    async revert(id) {
      const ok = await request('evm_revert', [id]);
      if (ok !== true) throw new Error(`evm_revert(${id}) failed`);
      return ok;
    },
    async close() {
      provider.destroy();
      await connection.close();
    },
  };
}

// Serves an EIP-1193 provider over plain HTTP JSON-RPC (single and batch requests) on 127.0.0.1,
// so CLI scripts that take --rpc <url> can run against the in-process chain.
export async function serveJsonRpc(eip1193, { port = 0, host = '127.0.0.1' } = {}) {
  const answer = async (payload) => {
    const id = payload?.id ?? null;
    try {
      const result = await eip1193.request({ method: payload.method, params: payload.params ?? [] });
      return { jsonrpc: '2.0', id, result: result === undefined ? null : result };
    } catch (error) {
      return { jsonrpc: '2.0', id, error: { code: error?.code ?? -32000, message: String(error?.message ?? error), data: error?.data } };
    }
  };
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }));
        return;
      }
      const reply = Array.isArray(body) ? await Promise.all(body.map(answer)) : await answer(body);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
    });
  });
  await new Promise((resolveListen) => server.listen(port, host, resolveListen));
  const address = server.address();
  return {
    url: `http://${host}:${address.port}`,
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  };
}

const TESTNET_CONFIG_PATH = join(root, 'contracts', 'deploy-config.testnet.json');

// The deploy config the local suite uses by default: contracts/deploy-config.testnet.json (games,
// fees, splits, collection names, reserve) with every role replaced by a local fixture wallet.
export async function localDeployConfig(wallets, overrides = {}) {
  const base = JSON.parse(readFileSync(TESTNET_CONFIG_PATH, 'utf8'));
  const operator = await wallets.operator.getAddress();
  const developer = await wallets.developer.getAddress();
  const vault = await wallets.platformVault.getAddress();
  const relayer = await wallets.relayer.getAddress();
  return {
    ...base,
    deployer: operator,
    operator,
    verifier: await wallets.verifier.getAddress(),
    relayer,
    relayerVault: relayer,
    developerWallet: developer,
    platformVault: vault,
    liquidityVault: vault,
    treasuryVault: vault,
    games: base.games.map((game) => ({ ...game, devWallet: developer })),
    ...overrides,
  };
}

// Deploys the five-contract suite and the per-game collections exactly like
// scripts/deploy-contracts.mjs (same order, same wiring calls), signed by wallets.operator, and
// returns a deployment-record.hardened.json-shaped record. Games are registered but not playable
// (activateLocalGames does that), and the collections are empty.
export async function deployLocalSuite({ provider, wallets, config = null } = {}) {
  if (!provider || !wallets?.operator) throw new Error('deployLocalSuite needs { provider, wallets.operator }');
  config ??= await localDeployConfig(wallets);
  const signer = wallets.operator.provider ? wallets.operator : wallets.operator.connect(provider);
  const signerAddress = await signer.getAddress();
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  if (!same(config.deployer, signerAddress)) throw new Error('Configured deployer does not match signing wallet.');
  if (!same(config.operator, signerAddress)) throw new Error('Deployment requires deployer=operator so vault, relayer, minter and registration wiring can be sent atomically.');
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) throw new Error(`Wrong chain ${network.chainId}; expected ${config.chainId}`);

  const relayer = config.relayer ?? config.operator;
  const relayerVault = config.relayerVault ?? relayer;
  const settlementGasReserveWei = String(config.settlementGasReserveWei ?? '20000000000000000');
  const pendingNonce = await provider.getTransactionCount(signerAddress, 'pending');
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
  const predicted = {
    gameRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce }),
    playerProfileRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 1 }),
    arcadeRankedEntry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 2 }),
    scoreSubmissionRegistry: ethers.getCreateAddress({ from: config.deployer, nonce: pendingNonce + 3 }),
    achievementRegistries: Object.fromEntries(games.map((game) => [game.slug, ethers.getCreateAddress({ from: config.deployer, nonce: game.achievementNonce })])),
  };
  const artifacts = Object.fromEntries(LOCAL_ARTIFACT_NAMES.map((name) => [name, loadArtifact(name)]));

  async function deploy(name, args) {
    const factory = new ethers.ContractFactory(artifacts[name].abi, artifacts[name].bytecode, signer);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
  }

  // --- Mirrors scripts/deploy-contracts.mjs from here (parity-tested literals). ---
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
  // --- End of the mirrored wiring. Activation is activateLocalGames() (deferred, like LiteForge). ---

  for (const [name, contract] of Object.entries({ gameRegistry, playerProfileRegistry: profiles, arcadeRankedEntry: rankedEntry, scoreSubmissionRegistry: scores })) {
    if (!same(await contract.getAddress(), predicted[name])) throw new Error(`${name} deployed at an unpredicted address.`);
  }
  for (const game of games) {
    if (!same(await achievementRegistries[game.slug].getAddress(), predicted.achievementRegistries[game.slug])) throw new Error(`AchievementRegistry[${game.slug}] deployed at an unpredicted address.`);
  }

  const deployFacts = summarizeDeployReceipts({
    core: {
      gameRegistry: await gameRegistry.deploymentTransaction().wait(),
      playerProfileRegistry: await profiles.deploymentTransaction().wait(),
      arcadeRankedEntry: await rankedEntry.deploymentTransaction().wait(),
      scoreSubmissionRegistry: await scores.deploymentTransaction().wait(),
    },
    achievementRegistries: Object.fromEntries(await Promise.all(games.map(async (game) => [game.slug, await achievementRegistries[game.slug].deploymentTransaction().wait()]))),
  });
  const atomicActivation = same(config.deployer, config.developerWallet);
  const manifestGames = games.map((game) => ({
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
  }));
  return {
    schemaVersion: 4,
    epoch: 'testnet',
    epochNote: 'Testnet epoch until mainnet; mainnet is a fresh deployment set and nothing here carries over.',
    network: config.network,
    chainId: config.chainId,
    nativeToken: config.nativeToken,
    deployedAt: new Date().toISOString(),
    deployer: signerAddress,
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
    vaults: { platformVault: config.platformVault, liquidityVault: config.liquidityVault, treasuryVault: config.treasuryVault },
    developerWallet: config.developerWallet,
    activation: atomicActivation ? 'atomic' : 'deferred-dev-wallet-confirmation',
    games: manifestGames,
    oldDeployment: config.oldDeployment,
  };
}

// ethers Contract instances for a record, connected to `runner` (a signer or the provider).
export function localContracts(record, runner) {
  const contract = (address, name) => new ethers.Contract(address, loadArtifact(name).abi, runner);
  return {
    gameRegistry: contract(record.addresses.gameRegistry, 'GameRegistry'),
    profiles: contract(record.addresses.playerProfileRegistry, 'PlayerProfileRegistry'),
    rankedEntry: contract(record.addresses.arcadeRankedEntry, 'ArcadeRankedEntry'),
    scores: contract(record.addresses.scoreSubmissionRegistry, 'ScoreSubmissionRegistry'),
    achievementRegistries: Object.fromEntries(Object.entries(record.addresses.achievementRegistries).map(([slug, address]) => [slug, contract(address, 'AchievementRegistry')])),
  };
}

// Runbook steps 4 and 5 on the local chain: the developer wallet sends confirmDevWallet(gameId32)
// for every game, then the operator sends setPlayable(gameId32, true) for every game.
export async function activateLocalGames({ provider, record, developer, operator } = {}) {
  if (!record?.games?.length) throw new Error('activateLocalGames needs a deployment record');
  const runner = (signer) => (signer.provider ? signer : signer.connect(provider));
  const asDeveloper = localContracts(record, runner(developer)).gameRegistry;
  const asOperator = localContracts(record, runner(operator)).gameRegistry;
  const receipts = [];
  for (const game of record.games) {
    const registered = await asDeveloper.getGame(game.gameId);
    if (!registered.devWalletConfirmed) receipts.push(await (await asDeveloper.confirmDevWallet(game.gameId)).wait());
  }
  for (const game of record.games) {
    const registered = await asOperator.getGame(game.gameId);
    if (!registered.playable) receipts.push(await (await asOperator.setPlayable(game.gameId, true)).wait());
  }
  return receipts;
}

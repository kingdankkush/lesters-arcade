// The in-process local chain (hardhat.config.js, contract A21) and the local deploy harness
// (scripts/lib/local-chain.mjs) that the rehearsal and the settle handler test build on.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ethers } from 'ethers';
import {
  HARDHAT_TEST_MNEMONIC,
  LOCAL_WALLET_ROLES,
  activateLocalGames,
  deployLocalSuite,
  localContracts,
  localDeployConfig,
  serveJsonRpc,
  startLocalChain,
} from '../scripts/lib/local-chain.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const deployScript = readFileSync(join(root, 'scripts', 'deploy-contracts.mjs'), 'utf8');
const harnessSource = readFileSync(join(root, 'scripts', 'lib', 'local-chain.mjs'), 'utf8');
const testnetConfig = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));

// Blocks every network primitive and records child processes, then boots the Hardhat network
// exactly as the acceptance criterion states, from the repo root.
const OFFLINE_PRELOAD = String.raw`
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const attempts = [];
globalThis.__offlineAttempts = attempts;
const block = (label) => function blockedByOfflineTest() { attempts.push(label); throw new Error('network blocked by the offline test: ' + label); };
net.Socket.prototype.connect = block('net.Socket.connect');
net.connect = block('net.connect');
net.createConnection = block('net.createConnection');
tls.connect = block('tls.connect');
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny']) dns[name] = block('dns.' + name);
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny']) dns.promises[name] = block('dns.promises.' + name);
http.request = block('http.request');
http.get = block('http.get');
https.request = block('https.request');
https.get = block('https.get');
globalThis.fetch = async () => { attempts.push('fetch'); throw new Error('network blocked by the offline test: fetch'); };
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  const original = childProcess[name];
  childProcess[name] = function recordedChildProcess(...args) { attempts.push('child_process.' + name + ':' + String(args[0])); return original.apply(this, args); };
}
syncBuiltinESMExports();
`;

const OFFLINE_PROBE = String.raw`
const hardhat = (await import('hardhat')).default;
const connection = await hardhat.network.connect();
const { provider } = connection;
const chainId = await provider.request({ method: 'eth_chainId' });
const accounts = await provider.request({ method: 'eth_accounts' });
const attempts = [...globalThis.__offlineAttempts];
await connection.close();
// The path every Hardhat test file and Vercel's test:release run take: hardhat/hre's
// createHardhatRuntimeEnvironment + importUserConfig inside scripts/lib/local-chain.mjs, then a full
// local deploy and activation.
const harness = await import(process.env.LOCAL_CHAIN_MODULE_URL);
const local = await harness.startLocalChain();
const record = await harness.deployLocalSuite({ provider: local.provider, wallets: local.wallets });
await harness.activateLocalGames({ provider: local.provider, record, developer: local.wallets.developer, operator: local.wallets.operator });
const harnessChainId = await local.eip1193.request({ method: 'eth_chainId' });
const playable = (await harness.localContracts(record, local.provider).gameRegistry.getGame(record.games[0].gameId)).playable;
const harnessAttempts = globalThis.__offlineAttempts.slice(attempts.length);
await local.close();
// Prove the blocker is live: a real fetch and a raw socket from this process are both recorded.
const beforeProof = globalThis.__offlineAttempts.length;
await fetch('http://127.0.0.1:9/').catch(() => {});
const net = await import('node:net');
try { net.connect(9, '127.0.0.1'); } catch {}
const blockerLive = globalThis.__offlineAttempts.length >= beforeProof + 2;
process.stdout.write(JSON.stringify({ chainId, accounts: accounts.length, type: connection.networkConfig.type, forking: connection.networkConfig.forking ?? null, attempts, harnessChainId, harnessGames: record.games.length, playable, harnessAttempts, blockerLive }));
`;

// Wiring calls of scripts/deploy-contracts.mjs, in broadcast order (documentation, and a check that the
// extractor below sees them). Parity itself compares the full extracted call sequences of both files.
const WIRING_LITERALS = [
  "deploy('GameRegistry', [config.operator])",
  "deploy('PlayerProfileRegistry', [])",
  "deploy('ArcadeRankedEntry', [await gameRegistry.getAddress(), config.operator])",
  "deploy('ScoreSubmissionRegistry', [ await gameRegistry.getAddress(), await rankedEntry.getAddress(), config.verifier, config.operator, ])",
  "deploy('AchievementRegistry', [config.operator, game.achievements.name, game.achievements.symbol, game.achievements.baseTokenUri])",
  'rankedEntry.setPlatformVaults(config.platformVault, config.liquidityVault, config.treasuryVault)',
  'rankedEntry.setRelayerVault(relayerVault)',
  'rankedEntry.setSettlementGasReserve(settlementGasReserveWei)',
  'scores.setRelayer(relayer, true)',
  'registry.setMinter(await scores.getAddress(), true)',
  'scores.setAchievementRegistry(game.gameId, await registry.getAddress())',
  'gameRegistry.registerGame(game.slug, game.title, config.developerWallet, game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps, game.entryFeeWei)',
];
const normalize = (source) => source.replace(/\s+/g, ' ');

// The broadcast wiring region of each file: the deploy script from the first deploy( call up to the
// activation branch, and the harness between its Mirrors and End markers.
function between(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${label}: markers ${JSON.stringify(startMarker)} … ${JSON.stringify(endMarker)} not found`);
  return source.slice(start, end);
}
const scriptWiringRegion = (source) => between(source, 'const gameRegistry = await deploy(', 'if (atomicActivation)', 'scripts/deploy-contracts.mjs');
const harnessWiringRegion = (source) => between(source, '// --- Mirrors scripts/deploy-contracts.mjs', '// --- End of the mirrored wiring', 'scripts/lib/local-chain.mjs');

// Every deploy('…', […]) call, every `await (await X.method(…)).wait()` call and every loop head, in
// order and whitespace-normalized: an extra, missing, reordered or re-argued call in either file shows.
function wiringCalls(region) {
  return [...normalize(region).matchAll(/for \(const \w+ of \w+\)|deploy\('\w+', \[.*?\]\)|await \(await (.+?)\)\.wait\(\)/g)].map((match) => match[1] ?? match[0]);
}

let chain;
let record;

before(async () => {
  chain = await startLocalChain();
  record = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets });
});

after(async () => {
  await chain?.close();
});

test('in-process chain runs offline on chain 4441', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hardhat-offline-'));
  const preload = join(dir, 'offline-preload.mjs');
  writeFileSync(preload, OFFLINE_PRELOAD);
  const artifactsBefore = existsSync(join(root, 'artifacts'));
  const cacheBefore = existsSync(join(root, 'cache'));
  try {
    const env = { ...process.env, LOCAL_CHAIN_MODULE_URL: pathToFileURL(join(root, 'scripts', 'lib', 'local-chain.mjs')).href };
    const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, '--input-type=module', '-e', OFFLINE_PROBE], { cwd: root, encoding: 'utf8', timeout: 60_000, env });
    assert.equal(child.status, 0, child.stderr);
    const probe = JSON.parse(child.stdout);
    assert.equal(probe.chainId, '0x1159', 'eth_chainId from the repo-root Hardhat network');
    assert.equal(probe.type, 'edr-simulated', 'in-process EDR network, not an HTTP network');
    assert.equal(probe.forking, null, 'no fork: nothing is fetched from a remote chain');
    assert.deepEqual(probe.attempts, [], 'no socket, DNS, HTTP, fetch or child process (no compiler download or solc run)');
    assert.ok(probe.accounts > 0);
    // The hardhat/hre path of scripts/lib/local-chain.mjs, through a full deploy and activation.
    assert.equal(probe.harnessChainId, '0x1159');
    assert.equal(probe.harnessGames, 3);
    assert.equal(probe.playable, true);
    assert.deepEqual(probe.harnessAttempts, [], 'startLocalChain, deployLocalSuite and activateLocalGames stay offline too');
    assert.equal(probe.blockerLive, true, 'the network blocker itself works');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(existsSync(join(root, 'artifacts')), artifactsBefore, 'connecting compiles nothing (no Hardhat artifacts directory)');
  assert.equal(existsSync(join(root, 'cache')), cacheBefore, 'connecting writes no Hardhat cache');
  const config = readFileSync(join(root, 'hardhat.config.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.match(config, /chainId: 4441/);
  assert.doesNotMatch(config, /solidity\s*:/, 'no Solidity compile configuration');
  assert.doesNotMatch(config, /forking|url\s*:/, 'no remote network');
  // `vercel deploy` uploads omit .gitignore (Vercel builds from uploaded files, not a clone), so the
  // ignore rule is checked wherever the file exists: every git checkout and the Git-triggered builds.
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) assert.match(readFileSync(gitignorePath, 'utf8'), /^\/artifacts\/$/m, 'a Hardhat build directory would never be committed');
  else t.diagnostic('.gitignore is absent (a vercel deploy upload); the /artifacts/ ignore rule is checked in git checkouts');
});

test('local chain exposes named fixture wallets from the public Hardhat mnemonic', async () => {
  assert.deepEqual(Object.keys(chain.wallets), LOCAL_WALLET_ROLES);
  const mnemonic = ethers.Mnemonic.fromPhrase(HARDHAT_TEST_MNEMONIC);
  for (const [index, role] of LOCAL_WALLET_ROLES.entries()) {
    const expected = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`).address;
    assert.equal(chain.wallets[role].address, expected, role);
    assert.ok(await chain.provider.getBalance(expected) >= ethers.parseEther('1000'), `${role} is funded`);
  }
  assert.equal((await chain.provider.getNetwork()).chainId, 4441n);

  const snapshot = await chain.snapshot();
  const stranger = '0x00000000000000000000000000000000000000aa';
  await chain.setBalance(stranger, 123n);
  assert.equal(await chain.provider.getBalance(stranger), 123n);
  const before = await chain.latestTimestamp();
  await chain.increaseTime(3600);
  await chain.mine();
  assert.ok(await chain.latestTimestamp() >= before + 3600);
  const impersonated = await chain.impersonate(stranger);
  await (await impersonated.sendTransaction({ to: chain.wallets.attacker.address, value: 1n })).wait();
  await chain.revert(snapshot);
  assert.equal(await chain.provider.getBalance(stranger), 0n, 'evm_revert restores state');

  const bridge = await serveJsonRpc(chain.eip1193);
  try {
    const single = await (await fetch(bridge.url, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) })).json();
    assert.equal(single.result, '0x1159');
    const batch = await (await fetch(bridge.url, { method: 'POST', body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'eth_chainId' }, { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber' }]) })).json();
    assert.equal(batch.length, 2);
    const rpc = new ethers.JsonRpcProvider(bridge.url, 4441, { staticNetwork: true });
    assert.equal(await rpc.getBlockNumber(), await chain.provider.getBlockNumber());
    rpc.destroy();
  } finally {
    await bridge.close();
  }
});

test('local suite wires registries, relayer, reserve and collections exactly like the deploy script', async () => {
  // Parity: the harness makes exactly the deploy script's calls, in the same order and loop structure
  // (text scan of both broadcast regions, never an import of the deploy script).
  const scriptCalls = wiringCalls(scriptWiringRegion(deployScript));
  const harnessCalls = wiringCalls(harnessWiringRegion(harnessSource));
  assert.deepEqual(harnessCalls, scriptCalls, 'local-chain.mjs mirrors scripts/deploy-contracts.mjs call for call');
  // And the whole region, statement for statement (catches a call written in any other form, such as
  // a transaction sent without .wait()). The harness region's first line is its marker comment.
  const harnessRegion = harnessWiringRegion(harnessSource);
  assert.equal(normalize(harnessRegion.slice(harnessRegion.indexOf('\n'))).trim(), normalize(scriptWiringRegion(deployScript)).trim(), 'the mirrored region equals the deploy script region');
  assert.equal(scriptCalls.filter((call) => !call.startsWith('for (')).length, WIRING_LITERALS.length, 'twelve wiring calls');
  let last = -1;
  for (const literal of WIRING_LITERALS) {
    const index = scriptCalls.indexOf(literal);
    assert.ok(index > last, `the extracted sequence has, in order: ${literal}`);
    last = index;
  }
  // The comparison catches a one-sided change: an extra call in either file, a dropped call, or a
  // changed argument.
  const extraCall = 'await (await scores.setRelayer(relayer, true)).wait();';
  const mutatedScript = deployScript.replace(extraCall, `${extraCall}\nawait (await rankedEntry.setEntryFeeEnabled(false)).wait();`);
  assert.notEqual(mutatedScript, deployScript);
  assert.notDeepEqual(wiringCalls(scriptWiringRegion(mutatedScript)), harnessCalls, 'an extra deploy-script call fails parity');
  const mutatedHarness = harnessSource.replace('await (await rankedEntry.setRelayerVault(relayerVault)).wait();', '');
  assert.notDeepEqual(wiringCalls(harnessWiringRegion(mutatedHarness)), scriptCalls, 'a dropped harness call fails parity');
  const reargued = harnessSource.replace('scores.setRelayer(relayer, true)', 'scores.setRelayer(relayer, false)');
  assert.notDeepEqual(wiringCalls(harnessWiringRegion(reargued)), scriptCalls, 'a changed argument fails parity');
  assert.equal(normalize(harnessSource).includes('.defineAchievement('), false, 'collections deploy empty (D15)');

  // Record shape: every key of the deploy script's record literal, plus the §8.1 block fields.
  const recordLiteral = deployScript.slice(deployScript.indexOf('const record = {'), deployScript.indexOf('};', deployScript.indexOf('const record = {')));
  const scriptKeys = [...recordLiteral.matchAll(/^ {2}([A-Za-z]+)[,:]/gm)].map((match) => match[1]);
  assert.ok(scriptKeys.length >= 20, 'record literal parsed');
  assert.deepEqual(Object.keys(record), scriptKeys, 'same keys, same order as contracts/deployment-record.hardened.json');
  for (const key of ['blocks', 'startBlock', 'deployTxHashes']) assert.ok(scriptKeys.includes(key), `deploy record gains ${key}`);
  const addressKeys = ['gameRegistry', 'playerProfileRegistry', 'arcadeRankedEntry', 'scoreSubmissionRegistry', 'achievementRegistries'];
  for (const field of ['addresses', 'blocks', 'deployTxHashes']) {
    assert.deepEqual(Object.keys(record[field]), addressKeys, `${field} shape`);
    assert.deepEqual(Object.keys(record[field].achievementRegistries), ['lester-blaster', 'chikun', 'stacked']);
  }
  const allBlocks = [...addressKeys.slice(0, 4).map((key) => record.blocks[key]), ...Object.values(record.blocks.achievementRegistries)];
  assert.equal(record.startBlock, Math.min(...allBlocks));
  for (const hash of [...addressKeys.slice(0, 4).map((key) => record.deployTxHashes[key]), ...Object.values(record.deployTxHashes.achievementRegistries)]) {
    const receipt = await chain.provider.getTransactionReceipt(hash);
    assert.ok(receipt?.contractAddress, 'each hash is a contract creation');
  }
  assert.equal((await chain.provider.getTransactionReceipt(record.deployTxHashes.gameRegistry)).contractAddress, record.addresses.gameRegistry);
  assert.equal(record.activation, 'deferred-dev-wallet-confirmation');
  assert.equal(record.chainId, 4441);

  // On-chain read-backs, the same the deploy script performs before writing its record.
  const config = await localDeployConfig(chain.wallets);
  const { gameRegistry, rankedEntry, scores, achievementRegistries } = localContracts(record, chain.provider);
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  assert.ok(same(await scores.gameRegistry(), record.addresses.gameRegistry));
  assert.ok(same(await scores.rankedEntry(), record.addresses.arcadeRankedEntry));
  assert.ok(same(await scores.trustedVerifier(), chain.wallets.verifier.address));
  assert.equal(await scores.relayers(chain.wallets.relayer.address), true);
  assert.ok(same(await rankedEntry.gameRegistry(), record.addresses.gameRegistry));
  assert.ok(same(await rankedEntry.platformVault(), config.platformVault));
  assert.ok(same(await rankedEntry.treasuryVault(), config.treasuryVault));
  assert.ok(same(await rankedEntry.relayerVault(), chain.wallets.relayer.address));
  assert.equal((await rankedEntry.settlementGasReserveWei()).toString(), testnetConfig.settlementGasReserveWei);
  assert.equal(await rankedEntry.entryFeeEnabled(), true);
  for (const game of testnetConfig.games) {
    const registry = achievementRegistries[game.slug];
    assert.equal(await registry.name(), game.achievements.name);
    assert.equal(await registry.symbol(), game.achievements.symbol);
    assert.equal(await registry.baseTokenUri(), game.achievements.baseTokenUri);
    assert.equal(await registry.minters(record.addresses.scoreSubmissionRegistry), true);
    assert.ok(same(await scores.achievementRegistryByGame(ethers.id(game.slug)), record.addresses.achievementRegistries[game.slug]));
    const registered = await gameRegistry.getGame(ethers.id(game.slug));
    assert.equal(registered.exists, true);
    assert.ok(same(registered.devWallet, chain.wallets.developer.address));
    assert.equal(registered.entryFeeWei.toString(), game.entryFeeWei);
    assert.deepEqual([registered.devBps, registered.platformBps, registered.liquidityBps, registered.treasuryBps].map(Number), [game.devBps, game.platformBps, game.liquidityBps, game.treasuryBps]);
    assert.equal(registered.devWalletConfirmed, false, 'deployer is not the developer: activation is deferred');
    assert.equal(registered.playable, false);
  }
});

test('collections deploy empty and mintFor returns false for undefined ids', async () => {
  const snapshot = await chain.snapshot();
  try {
    const { achievementRegistries } = localContracts(record, chain.provider);
    const minter = await chain.impersonate(record.addresses.scoreSubmissionRegistry);
    for (const [slug, registry] of Object.entries(achievementRegistries)) {
      assert.equal(await registry.achievementCount(), 0n, `${slug} has no definitions (D15)`);
      assert.deepEqual([...(await registry.achievementIds())], []);
      assert.equal(await registry.minters(chain.wallets.relayer.address), false, 'the relayer becomes a minter only in phase 2');
      const asMinter = registry.connect(minter);
      assert.equal(await asMinter.mintFor.staticCall(chain.wallets.player1.address, ethers.id('first-blood'), ethers.id('s1')), false);
      await (await asMinter.mintFor(chain.wallets.player1.address, ethers.id('first-blood'), ethers.id('s1'))).wait();
      assert.equal(await registry.balanceOf(chain.wallets.player1.address), 0n);
    }
  } finally {
    await chain.revert(snapshot);
  }
});

test('activation confirms dev wallets then sets games playable', async () => {
  const snapshot = await chain.snapshot();
  try {
    const { gameRegistry } = localContracts(record, chain.provider);
    // The operator cannot activate before the developer confirms (the runbook order).
    await assert.rejects(gameRegistry.connect(chain.wallets.operator).setPlayable(record.games[0].gameId, true), (error) => error.reason === 'Dev wallet unconfirmed');
    const receipts = await activateLocalGames({ provider: chain.provider, record, developer: chain.wallets.developer, operator: chain.wallets.operator });
    assert.equal(receipts.length, 6);
    const registryInterface = gameRegistry.interface;
    const events = receipts.map((receipt) => registryInterface.parseLog(receipt.logs[0])?.name);
    assert.deepEqual(events, ['DevWalletConfirmed', 'DevWalletConfirmed', 'DevWalletConfirmed', 'GameStatusChanged', 'GameStatusChanged', 'GameStatusChanged']);
    assert.deepEqual(receipts.map((receipt) => receipt.from), [...Array(3).fill(chain.wallets.developer.address), ...Array(3).fill(chain.wallets.operator.address)]);
    for (const game of record.games) {
      const registered = await gameRegistry.getGame(game.gameId);
      assert.equal(registered.devWalletConfirmed, true, game.slug);
      assert.equal(registered.playable, true, game.slug);
    }
    assert.deepEqual(await activateLocalGames({ provider: chain.provider, record, developer: chain.wallets.developer, operator: chain.wallets.operator }), [], 'idempotent');
  } finally {
    await chain.revert(snapshot);
  }
});

test('quoteEntry returns fee plus reserve after activation', async () => {
  const snapshot = await chain.snapshot();
  try {
    await activateLocalGames({ provider: chain.provider, record, developer: chain.wallets.developer, operator: chain.wallets.operator });
    const { rankedEntry } = localContracts(record, chain.provider);
    for (const game of record.games) {
      const [fee, reserve, total] = await rankedEntry.quoteEntry(game.gameId);
      assert.equal(fee, 100_000_000_000_000_000n, `${game.slug} flat 0.1 zkLTC`);
      assert.equal(reserve, 2_000_000_000_000_000n, `${game.slug} 0.002 zkLTC reserve`);
      assert.equal(total, 102_000_000_000_000_000n);
      assert.equal(total.toString(), game.totalEntryWei);
    }
    // A paid entry lands on the local chain with the quoted total.
    const sessionId32 = ethers.id('local-harness-session');
    await (await rankedEntry.connect(chain.wallets.player1).openSession(sessionId32, record.games[1].gameId, { value: 102_000_000_000_000_000n })).wait();
    const paid = await rankedEntry.getPaidSession(sessionId32);
    assert.equal(paid.exists, true);
    assert.equal(paid.amountWei, 102_000_000_000_000_000n);
  } finally {
    await chain.revert(snapshot);
  }
});

test('the harness deploys at the real predicted addresses when the operator is impersonated', async () => {
  // The owner page and the rehearsal can exercise the committed predicted module: an impersonated
  // operator at nonce 0 on a fresh chain lands every contract at the §8.1 addresses.
  const snapshot = await chain.snapshot();
  try {
    const operator = await chain.impersonate(testnetConfig.operator);
    const predictedRecord = await deployLocalSuite({ provider: chain.provider, wallets: { operator }, config: testnetConfig });
    const { LITVM_DEPLOYMENT } = await import('../apps/portal/src/generated/litvm-addresses.mjs');
    if (LITVM_DEPLOYMENT.status === 'predicted') {
      assert.equal(predictedRecord.addresses.gameRegistry.toLowerCase(), LITVM_DEPLOYMENT.addresses.gameRegistry);
      assert.equal(predictedRecord.addresses.scoreSubmissionRegistry.toLowerCase(), LITVM_DEPLOYMENT.addresses.scoreSubmissionRegistry);
      for (const slug of ['lester-blaster', 'chikun', 'stacked']) {
        assert.equal(predictedRecord.addresses.achievementRegistries[slug].toLowerCase(), LITVM_DEPLOYMENT.addresses.achievementRegistries[slug]);
      }
    }
    assert.equal(predictedRecord.addresses.gameRegistry, ethers.getCreateAddress({ from: testnetConfig.deployer, nonce: 0 }));
    await assert.rejects(deployLocalSuite({ provider: chain.provider, wallets: { operator: chain.wallets.attacker }, config: testnetConfig }), /does not match signing wallet/);
  } finally {
    await chain.revert(snapshot);
  }
});

// The generated address module (contract A19, §8.1), the portal address source built from it, the
// §9.1 flag invariant, and the address consumers (chain client reads, audit gate, live readiness).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';
import { HOSTED_PROFILE_SYNC, LITVM_CONTRACT_ADDRESSES, SETTLEMENT_LIVE } from '../apps/portal/src/settlement.mjs';
import { ACHIEVEMENT_REGISTRY_ABI, SCORE_REGISTRY_ABI, fetchGlobalLeaderboard, fetchPlayerAchievements, fetchPlayerSessions, fetchProfile, loadEthers } from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';
import {
  ADDRESS_MODULE_BANNER,
  ADDRESS_MODULE_RELATIVE_PATH,
  deployedDeploymentInput,
  predictedDeploymentInput,
  renderLitvmAddressModule,
  summarizeDeployReceipts,
  writeLitvmAddressModule,
} from '../scripts/generate-litvm-addresses.mjs';
import { rankedLiveGatePasses } from '../scripts/hmh-web3-settlement-audit.mjs';
import { registryEconomyFromDeployment } from '../scripts/hmh-web3-live-readiness.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const committedSource = readFileSync(join(root, ADDRESS_MODULE_RELATIVE_PATH), 'utf8');
const hardenedRecordPath = join(root, 'contracts', 'deployment-record.hardened.json');

// Contract §8.1 table: getCreateAddress({ from: 0x6Ac08Bed…6bfF, nonce }).
const SECTION_8_1_PREDICTED = Object.freeze({
  gameRegistry: '0xCB0B695eBEE650aFcCe93F566259cb477B19bf23',
  playerProfileRegistry: '0x3EB9e9F2620940496A2b8Ed6f7384e6687587c94',
  arcadeRankedEntry: '0x10cd09e694e2B2Cd70d37f8CDdDcdA3Ef1208190',
  scoreSubmissionRegistry: '0xc5c5949a02fAC9a4115df182672C0f8cEB0Eaf55',
  achievementRegistries: {
    'lester-blaster': '0xc1A383cB7521978f429424443fdD69Bdd71Ff737',
    chikun: '0xf6Cd1cf7e1acCAeA93ACcdFB911034b3e8EB6f93',
    stacked: '0x5430f8c142Ca7ec8971a447Cc09ae63f8860A8A7',
  },
});
const lowerTree = (value) => (typeof value === 'string' ? value.toLowerCase() : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, lowerTree(v)])));
const KEY_SET = ['gameRegistry', 'playerProfileRegistry', 'arcadeRankedEntry', 'scoreSubmissionRegistry', 'achievementRegistries'];

function fixtureRecord(overrides = {}) {
  return {
    chainId: 4441,
    deployedAt: '2026-09-24T12:00:00.000Z',
    deployer: config.deployer,
    trustedVerifier: config.verifier,
    relayer: config.relayer,
    settlementGasReserveWei: config.settlementGasReserveWei,
    startBlock: 1234,
    addresses: { ...SECTION_8_1_PREDICTED, achievementRegistries: { ...SECTION_8_1_PREDICTED.achievementRegistries } },
    ...overrides,
  };
}

test('committed address module is generated and matches either the §8.1 prediction or the hardened record', () => {
  assert.equal(committedSource.split('\n')[0], ADDRESS_MODULE_BANNER, 'banner: generated, never hand-edited');
  assert.ok(Object.isFrozen(LITVM_DEPLOYMENT) && Object.isFrozen(LITVM_DEPLOYMENT.addresses) && Object.isFrozen(LITVM_DEPLOYMENT.addresses.achievementRegistries));
  assert.equal(LITVM_DEPLOYMENT.chainId, 4441);
  assert.deepEqual(Object.keys(LITVM_DEPLOYMENT.addresses), KEY_SET);
  assert.deepEqual(Object.keys(LITVM_DEPLOYMENT.addresses.achievementRegistries), ['lester-blaster', 'chikun', 'stacked']);
  if (LITVM_DEPLOYMENT.status === 'predicted') {
    // Before runbook step 3: predicted from the operator's nonce 0 and equal to the §8.1 table.
    assert.deepEqual(JSON.parse(JSON.stringify(LITVM_DEPLOYMENT.addresses)), lowerTree(SECTION_8_1_PREDICTED));
    assert.equal(LITVM_DEPLOYMENT.source, 'predicted-from-operator-nonce-0');
    assert.equal(LITVM_DEPLOYMENT.startBlock, null);
    assert.equal(LITVM_DEPLOYMENT.deployedAt, null);
    assert.equal(committedSource, renderLitvmAddressModule(predictedDeploymentInput(config)));
  } else {
    // After runbook step 3: regenerated from the record the broadcast wrote.
    assert.equal(LITVM_DEPLOYMENT.status, 'deployed');
    assert.ok(existsSync(hardenedRecordPath), 'a deployed module needs contracts/deployment-record.hardened.json');
    const record = JSON.parse(readFileSync(hardenedRecordPath, 'utf8'));
    assert.equal(committedSource, renderLitvmAddressModule(deployedDeploymentInput(record)));
    assert.equal(LITVM_DEPLOYMENT.startBlock, record.startBlock);
    assert.equal(LITVM_DEPLOYMENT.source, 'contracts/deployment-record.hardened.json');
  }
  assert.equal(LITVM_DEPLOYMENT.deployer, config.deployer.toLowerCase());
  assert.equal(LITVM_DEPLOYMENT.trustedVerifier, config.verifier.toLowerCase());
  assert.equal(LITVM_DEPLOYMENT.relayer, config.relayer.toLowerCase());
  assert.equal(LITVM_DEPLOYMENT.settlementGasReserveWei, '100000000000000');
});

test('the generator CLI check agrees with the committed module', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'generate-litvm-addresses.mjs'), '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /is current/);
});

test('renderLitvmAddressModule is deterministic, lowercase and validates its input', () => {
  const input = predictedDeploymentInput(config);
  const first = renderLitvmAddressModule(input);
  assert.equal(renderLitvmAddressModule(structuredClone(input)), first);
  assert.doesNotMatch(first.replace(ADDRESS_MODULE_BANNER, ''), /0x[0-9a-f]*[A-F][0-9a-fA-F]*/, 'every address lowercase');
  assert.ok(first.endsWith('});\n'));
  const deployed = renderLitvmAddressModule(deployedDeploymentInput(fixtureRecord()));
  assert.match(deployed, /status: 'deployed',/);
  assert.match(deployed, /startBlock: 1234,/);
  assert.match(deployed, /deployedAt: '2026-09-24T12:00:00.000Z',/);
  // Key order is fixed whatever the input order.
  const reordered = fixtureRecord({ addresses: { achievementRegistries: { stacked: SECTION_8_1_PREDICTED.achievementRegistries.stacked, chikun: SECTION_8_1_PREDICTED.achievementRegistries.chikun, 'lester-blaster': SECTION_8_1_PREDICTED.achievementRegistries['lester-blaster'] }, scoreSubmissionRegistry: SECTION_8_1_PREDICTED.scoreSubmissionRegistry, arcadeRankedEntry: SECTION_8_1_PREDICTED.arcadeRankedEntry, playerProfileRegistry: SECTION_8_1_PREDICTED.playerProfileRegistry, gameRegistry: SECTION_8_1_PREDICTED.gameRegistry } });
  assert.equal(renderLitvmAddressModule(deployedDeploymentInput(reordered)), deployed);

  const bad = [
    ['wrong chain', { ...input, chainId: 1 }],
    ['unknown status', { ...input, status: 'live' }],
    ['predicted with a start block', { ...input, startBlock: 5 }],
    ['bad address', { ...input, addresses: { ...input.addresses, gameRegistry: '0x1234' } }],
    ['missing game collection', { ...input, addresses: { ...input.addresses, achievementRegistries: { chikun: input.addresses.achievementRegistries.chikun, stacked: input.addresses.achievementRegistries.stacked } } }],
    ['duplicate addresses', { ...input, addresses: { ...input.addresses, playerProfileRegistry: input.addresses.gameRegistry } }],
    ['non-decimal reserve', { ...input, settlementGasReserveWei: '0x10' }],
  ];
  for (const [label, value] of bad) assert.throws(() => renderLitvmAddressModule(value), /litvm address module/, label);
  assert.throws(() => renderLitvmAddressModule(deployedDeploymentInput(fixtureRecord({ startBlock: null }))), /startBlock/);
  assert.throws(() => renderLitvmAddressModule(deployedDeploymentInput(fixtureRecord({ deployedAt: 'yesterday' }))), /deployedAt/);
});

test('writeLitvmAddressModule picks deployed when a record exists and predicted otherwise', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'litvm-addresses-'));
  try {
    mkdirSync(join(dir, 'contracts'), { recursive: true });
    writeFileSync(join(dir, 'contracts', 'deploy-config.testnet.json'), JSON.stringify(config));
    const predicted = writeLitvmAddressModule({ root: dir });
    assert.equal(predicted.status, 'predicted');
    assert.equal(predicted.changed, true);
    assert.equal(readFileSync(predicted.path, 'utf8'), committedSource.includes("status: 'predicted'") ? committedSource : predicted.content);
    assert.equal(writeLitvmAddressModule({ root: dir }).changed, false, 'idempotent');

    writeFileSync(join(dir, 'contracts', 'deployment-record.hardened.json'), JSON.stringify(fixtureRecord()));
    const deployed = writeLitvmAddressModule({ root: dir });
    assert.equal(deployed.status, 'deployed');
    const imported = await import(`${pathToFileURL(deployed.path).href}?v=${Date.now()}`);
    assert.equal(imported.LITVM_DEPLOYMENT.status, 'deployed');
    assert.equal(imported.LITVM_DEPLOYMENT.startBlock, 1234);
    assert.equal(imported.LITVM_DEPLOYMENT.addresses.gameRegistry, SECTION_8_1_PREDICTED.gameRegistry.toLowerCase());
    assert.equal(writeLitvmAddressModule({ root: dir, mode: 'predicted' }).status, 'predicted', '--predicted overrides the record');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('summarizeDeployReceipts derives blocks, startBlock and deploy tx hashes', () => {
  const receipt = (blockNumber, n) => ({ blockNumber, hash: `0x${n.toString(16).padStart(64, '0')}` });
  const facts = summarizeDeployReceipts({
    core: { gameRegistry: receipt(10, 1), playerProfileRegistry: receipt(11, 2), arcadeRankedEntry: receipt(12, 3), scoreSubmissionRegistry: receipt(13, 4) },
    achievementRegistries: { 'lester-blaster': receipt(14, 5), chikun: receipt(15, 6), stacked: receipt(9, 7) },
  });
  assert.deepEqual(facts.blocks, { gameRegistry: 10, playerProfileRegistry: 11, arcadeRankedEntry: 12, scoreSubmissionRegistry: 13, achievementRegistries: { 'lester-blaster': 14, chikun: 15, stacked: 9 } });
  assert.equal(facts.startBlock, 9);
  assert.equal(facts.deployTxHashes.stacked, undefined);
  assert.equal(facts.deployTxHashes.achievementRegistries.stacked, receipt(9, 7).hash);
  assert.throws(() => summarizeDeployReceipts({ core: {}, achievementRegistries: {} }), /missing deploy receipt/);
});

test('SETTLEMENT_LIVE implies HOSTED_PROFILE_SYNC and a deployed address module', () => {
  // Contract §9.1. While both flags are false (today) this holds trivially; the runbook step-7 commit
  // that flips them must also carry the deployed module, or this test fails the build.
  assert.ok(!SETTLEMENT_LIVE || (HOSTED_PROFILE_SYNC && LITVM_DEPLOYMENT.status === 'deployed'), 'SETTLEMENT_LIVE needs HOSTED_PROFILE_SYNC and a deployed LITVM_DEPLOYMENT');
  const settlementSource = readFileSync(join(root, 'apps', 'portal', 'src', 'settlement.mjs'), 'utf8');
  assert.match(settlementSource, /^export const SETTLEMENT_LIVE = (true|false);$/m, 'literal flag export (hmh-release-facts parses it)');
  assert.match(settlementSource, /^export const HOSTED_PROFILE_SYNC = (true|false);$/m);
  assert.match(settlementSource, /SETTLEMENT_LIVE implies HOSTED_PROFILE_SYNC && LITVM_DEPLOYMENT\.status === 'deployed'/, 'invariant comment');
});

test('LITVM_CONTRACT_ADDRESSES is built from LITVM_DEPLOYMENT with exactly the §8.1 key set', () => {
  assert.deepEqual(Object.keys(LITVM_CONTRACT_ADDRESSES), ['gameRegistry', 'playerProfileRegistry', 'arcadeRankedEntry', 'scoreSubmissionRegistry', 'achievementRegistries']);
  assert.deepEqual(Object.keys(LITVM_CONTRACT_ADDRESSES.achievementRegistries), ['lester-blaster', 'chikun', 'stacked']);
  assert.deepEqual(JSON.parse(JSON.stringify(LITVM_CONTRACT_ADDRESSES)), JSON.parse(JSON.stringify(LITVM_DEPLOYMENT.addresses)));
  for (const legacy of ['achievementRegistry', 'arcadePaymentRouter', 'lestersArcadeCore']) assert.equal(legacy in LITVM_CONTRACT_ADDRESSES, false, `${legacy} retired`);
  assert.ok(Object.isFrozen(LITVM_CONTRACT_ADDRESSES) && Object.isFrozen(LITVM_CONTRACT_ADDRESSES.achievementRegistries));
  const settlementSource = readFileSync(join(root, 'apps', 'portal', 'src', 'settlement.mjs'), 'utf8');
  assert.doesNotMatch(settlementSource, /0x[0-9a-fA-F]{40}/, 'no hand-written address in settlement.mjs');
});

test('chain-client reads always use the public LiteForge RPC, never the wallet provider', () => {
  const source = readFileSync(join(root, 'apps', 'portal', 'src', 'litvm-chain-client.mjs'), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const fn = ast.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'pickReadProvider');
  assert.ok(fn, 'pickReadProvider exists');
  const created = [];
  class JsonRpcProvider { constructor(...args) { created.push(['JsonRpcProvider', ...args]); } }
  class BrowserProvider { constructor(...args) { created.push(['BrowserProvider', ...args]); } }
  const walletCalls = [];
  const wallet = { request: async (req) => { walletCalls.push(req); throw new Error('wallet must not be used for reads'); } };
  const pick = runInNewContext(`${source.slice(fn.start, fn.end)}\npickReadProvider`, {
    LITVM_LITEFORGE_NETWORK: { chainId: 4441, rpcUrls: { http: 'https://liteforge.rpc.caldera.xyz/http' } },
  });
  const provider = pick({ JsonRpcProvider, BrowserProvider }, wallet);
  assert.ok(provider instanceof JsonRpcProvider);
  // (url, 4441, { staticNetwork: true }): the options object comes from the vm context, so compare it as JSON.
  assert.deepEqual(created.map((args) => JSON.parse(JSON.stringify(args))), [['JsonRpcProvider', 'https://liteforge.rpc.caldera.xyz/http', 4441, { staticNetwork: true }]]);
  pick({ JsonRpcProvider, BrowserProvider }, null);
  assert.equal(created.every(([kind]) => kind === 'JsonRpcProvider'), true);
  assert.deepEqual(walletCalls, []);
  // Every read goes through withPublicRead (chain check + destroy); none builds its own provider.
  assert.equal((source.match(/pickReadProvider\(/g) ?? []).length, 2, 'the definition and the one call in withPublicRead');
  assert.match(source, /provider\.destroy\(\)/);
  // Write paths keep the wallet provider.
  assert.match(source, /export async function openRankedSession[\s\S]*?new ethers\.BrowserProvider\(walletProvider\)/);
  assert.match(source, /export async function submitProfile[\s\S]*?new ethers\.BrowserProvider\(walletProvider\)/);
});

// The vendored ethers transport uses global fetch, so a fixture answers JSON-RPC there (single and
// batch payloads) and nothing leaves the process. `answer(request)` returns the result or throws.
async function withRpcFetch(answer, run) {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    const payload = JSON.parse(new TextDecoder().decode(init.body));
    const reply = async (request) => {
      seen.push({ url: String(url), method: request.method, params: request.params });
      try {
        return { jsonrpc: '2.0', id: request.id, result: await answer(request) };
      } catch (error) {
        return { jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error.message } };
      }
    };
    const body = Array.isArray(payload) ? await Promise.all(payload.map(reply)) : await reply(payload);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    return { result: await run(), seen };
  } finally {
    globalThis.fetch = original;
  }
}

const untouchableWallet = () => {
  const calls = [];
  return { calls, request: async ({ method }) => { calls.push(method); throw new Error('the wallet must not be used for reads'); } };
};

test('fetchPlayerAchievements reads only the game\'s own collection (no legacy fallback)', async () => {
  const source = readFileSync(join(root, 'apps', 'portal', 'src', 'litvm-chain-client.mjs'), 'utf8');
  assert.doesNotMatch(source, /LITVM_CONTRACT_ADDRESSES\.achievementRegistry\b/, 'the single June registry is never consulted');
  const wallet = { request: async () => { throw new Error('must not be contacted'); } };
  for (const gameId of [null, undefined, '', 'unknown-game', 'toString', '__proto__']) {
    const result = await fetchPlayerAchievements(`0x${'12'.repeat(20)}`, ['first-blood'], { walletProvider: wallet, gameId });
    assert.equal(result.ok, false, String(gameId));
    assert.equal(result.error, 'achievement registry unavailable');
  }

  // A known game reads its own collection over the public RPC.
  const ethers = await loadEthers();
  const iface = new ethers.Interface(ACHIEVEMENT_REGISTRY_ABI);
  const player = `0x${'12'.repeat(20)}`;
  const walletProvider = untouchableWallet();
  const { result, seen } = await withRpcFetch(async ({ method, params }) => {
    if (method === 'eth_chainId') return LITVM_LITEFORGE_NETWORK.chainIdHex;
    if (method === 'eth_call') {
      const call = iface.parseTransaction({ data: params[0].data });
      return iface.encodeFunctionResult('hasUnlocked', [call.args[1] === ethers.id('sky-legend')]);
    }
    throw new Error(`Unexpected fixture RPC method: ${method}`);
  }, () => fetchPlayerAchievements(player, ['sky-legend', 'coin-hoarder'], { walletProvider, gameId: 'chikun' }));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.unlocked, ['sky-legend']);
  const calls = seen.filter((entry) => entry.method === 'eth_call');
  assert.equal(calls.length, 2);
  for (const call of calls) assert.equal(call.params[0].to.toLowerCase(), LITVM_CONTRACT_ADDRESSES.achievementRegistries.chikun, 'the chikun collection only');
  assert.ok(seen.every((entry) => entry.url === LITVM_LITEFORGE_NETWORK.rpcUrls.http), 'the public RPC only');
  assert.ok(seen.some((entry) => entry.method === 'eth_chainId'), 'the node reports its chain');
  assert.deepEqual(walletProvider.calls, []);
});

test('public reads refuse an RPC that reports another chain', async () => {
  const ethers = await loadEthers();
  const scoreIface = new ethers.Interface(SCORE_REGISTRY_ABI);
  const tuple = [ethers.id('s'), `0x${'12'.repeat(20)}`, ethers.id('chikun'), 1200n, 10n, 4n, 120n, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, 1788955200n, true, true];
  const walletProvider = untouchableWallet();
  const { result, seen } = await withRpcFetch(async ({ method, params }) => {
    if (method === 'eth_chainId') return '0x1';
    const call = scoreIface.parseTransaction({ data: params[0].data });
    if (call.name === 'playerSessionCount' || call.name === 'totalSessions') return scoreIface.encodeFunctionResult(call.name, [1n]);
    return scoreIface.encodeFunctionResult(call.name, [[tuple]]);
  }, async () => ({
    sessions: await fetchPlayerSessions(`0x${'12'.repeat(20)}`, { walletProvider }),
    board: await fetchGlobalLeaderboard({ walletProvider }),
    profile: await fetchProfile(`0x${'12'.repeat(20)}`, { walletProvider }),
  }));
  assert.equal(result.sessions.ok, false);
  assert.deepEqual(result.sessions.records, []);
  assert.match(result.sessions.error, /the public RPC is on chain 1, expected 4441/);
  assert.equal(result.board.ok, false);
  assert.deepEqual(result.board.records, []);
  assert.equal(result.profile, null);
  assert.ok(seen.some((entry) => entry.method === 'eth_chainId'));
  assert.deepEqual(walletProvider.calls, []);
});

test('an unreachable public RPC fails the read once and leaves nothing retrying', async () => {
  const original = globalThis.fetch;
  const originalLog = console.log;
  let fetchCalls = 0;
  const logged = [];
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new TypeError('Failed to fetch');
  };
  console.log = (...args) => { logged.push(args.join(' ')); };
  try {
    const sessions = await fetchPlayerSessions(`0x${'12'.repeat(20)}`, { walletProvider: untouchableWallet() });
    const board = await fetchGlobalLeaderboard();
    assert.equal(sessions.ok, false);
    assert.equal(board.ok, false);
    const afterReads = fetchCalls;
    assert.ok(afterReads >= 2 && afterReads <= 4, `one request (batch) per read, got ${afterReads}`);
    // ethers retries network detection every 1 s when the network is not static; wait past two retries.
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_200));
    assert.equal(fetchCalls, afterReads, 'no background request after the reads returned');
    assert.deepEqual(logged.filter((line) => /failed to detect network/i.test(line)), []);
  } finally {
    globalThis.fetch = original;
    console.log = originalLog;
  }
});

test('the settlement audit live gate requires a deployed module with all seven addresses', () => {
  const chainClient = 'trusted verifier attestation is required';
  const deployed = { status: 'deployed', addresses: LITVM_DEPLOYMENT.addresses };
  const predicted = { status: 'predicted', addresses: LITVM_DEPLOYMENT.addresses };
  assert.equal(rankedLiveGatePasses({ settlementLive: false, deployment: predicted, addresses: LITVM_CONTRACT_ADDRESSES, chainClient }), true, 'preview passes');
  assert.equal(rankedLiveGatePasses({ settlementLive: true, deployment: predicted, addresses: LITVM_CONTRACT_ADDRESSES, chainClient }), false, 'live with a predicted module fails');
  assert.equal(rankedLiveGatePasses({ settlementLive: true, deployment: deployed, addresses: LITVM_CONTRACT_ADDRESSES, chainClient }), true, 'live with a deployed module passes');
  const missing = { ...LITVM_CONTRACT_ADDRESSES, achievementRegistries: { ...LITVM_CONTRACT_ADDRESSES.achievementRegistries, stacked: null } };
  assert.equal(rankedLiveGatePasses({ settlementLive: true, deployment: deployed, addresses: missing, chainClient }), false, 'every §8.1 address must be non-null');
  assert.equal(rankedLiveGatePasses({ settlementLive: true, deployment: { status: 'deployed', addresses: { ...LITVM_DEPLOYMENT.addresses, gameRegistry: null } }, addresses: LITVM_CONTRACT_ADDRESSES, chainClient }), false);
  assert.equal(rankedLiveGatePasses({ settlementLive: false, deployment: predicted, addresses: { ...LITVM_CONTRACT_ADDRESSES, gameRegistry: 'nope' }, chainClient }), false, 'malformed addresses always fail');
});

test('live readiness reads registry facts from the generated module', () => {
  assert.deepEqual(registryEconomyFromDeployment({ status: 'predicted', addresses: LITVM_DEPLOYMENT.addresses }), { gameRegistry: false, splitConfig: false, legalApproved: false });
  assert.deepEqual(registryEconomyFromDeployment({ status: 'deployed', addresses: LITVM_DEPLOYMENT.addresses }), { gameRegistry: true, splitConfig: true, legalApproved: false });
  const script = readFileSync(join(root, 'scripts', 'hmh-web3-live-readiness.mjs'), 'utf8');
  assert.doesNotMatch(script, /\.splitConfig\)/, 'no read of a nonexistent address key');
  assert.match(script, /generated\/litvm-addresses\.mjs/);
});

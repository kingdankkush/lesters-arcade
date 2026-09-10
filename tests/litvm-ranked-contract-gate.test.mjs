import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { checkRankedReadiness, submitRankedSession, loadEthers, SCORE_REGISTRY_ABI } from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_CONTRACT_ADDRESSES, SETTLEMENT_LIVE } from '../apps/portal/src/settlement.mjs';

// Deterministic encoded EIP-1193 fixtures, never live-wallet acceptance evidence.
const ethers = await loadEthers();
const wallet = `0x${'12'.repeat(20)}`;
const verifier = `0x${'34'.repeat(20)}`;
const deployment = JSON.parse(readFileSync(new URL('../contracts/deployment-record.json', import.meta.url)));
const registryAddress = deployment.addresses.gameRegistry;
const gameId = 'lester-blaster';
const gameId32 = ethers.id(gameId);
const gameAbi = new ethers.Interface(['function getGame(bytes32) view returns ((bytes32 gameId,string title,address devWallet,uint16 devBps,uint16 platformBps,uint16 liquidityBps,uint16 treasuryBps,uint256 entryFeeMicroUsdc,bool devWalletConfirmed,bool playable,bool exists,uint256 registeredAt))']);
const wiringAbi = new ethers.Interface(['function gameRegistry() view returns(address)', 'function trustedVerifier() view returns(address)']);
const scoreAbi = new ethers.Interface(SCORE_REGISTRY_ABI);
const legacyAbi = new ethers.Interface(['function getSession(bytes32) view returns ((bytes32 sessionId,address player,bytes32 gameId,uint256 score,uint64 kills,uint64 maxCombo,uint64 survivalSeconds,bytes32 bossId,uint64 submittedAt,bool exists))']);
const session = [ethers.ZeroHash, ethers.ZeroAddress, ethers.ZeroHash, 0n, 0n, 0n, 0n, ethers.ZeroHash, 0n, false, false];
function fixture(options = {}) {
  const calls = [];
  const game = [gameId32, 'Hard Money Heroes', wallet, 7500, 2500, 0, 0, 0n, true, true, true, 1n];
  if (options.gameIndex !== undefined) game[options.gameIndex] = options.gameValue;
  const provider = { async request({ method, params = [] }) {
    calls.push({ method, params });
    if (method === 'eth_chainId') return options.chain ?? '0x1159';
    if (method === 'eth_accounts') return options.accounts ?? [wallet];
    if (method === 'eth_blockNumber') return '0x123';
    if (method === 'eth_getBalance') return options.balance ?? '0xde0b6b3a7640000';
    if (method === 'eth_getCode') return options.noCode ? '0x' : '0x6000';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_call') {
      if (options.rpcError) throw new Error('fixture read unavailable');
      const [tx] = params;
      const gameCall = gameAbi.parseTransaction({ data: tx.data });
      if (gameCall) {
        assert.equal(tx.to.toLowerCase(), registryAddress.toLowerCase());
        assert.equal(gameCall.args[0], ethers.id(options.requestedGame ?? gameId));
        return gameAbi.encodeFunctionResult('getGame', [game]);
      }
      const wiring = wiringAbi.parseTransaction({ data: tx.data });
      if (wiring) return wiringAbi.encodeFunctionResult(wiring.name, [wiring.name === 'gameRegistry' ? (options.wiredRegistry ?? registryAddress) : (options.verifier ?? verifier)]);
      const call = scoreAbi.parseTransaction({ data: tx.data });
      if (call?.name === 'getSession') return options.legacy ? legacyAbi.encodeFunctionResult('getSession', [session.filter((_, i) => i !== 9)]) : scoreAbi.encodeFunctionResult('getSession', [session]);
    }
    throw new Error(`Unexpected fixture RPC method: ${method}`);
  } };
  return { provider, calls };
}
async function check(options = {}, request = {}) {
  const f = fixture(options);
  const result = await checkRankedReadiness(f.provider, { gameId, minGasWei: 1n, ...request });
  return { ...f, result };
}

test('configured read-only GameRegistry address exactly matches the recorded deployment', () => {
  assert.equal(LITVM_CONTRACT_ADDRESSES.gameRegistry, registryAddress);
  assert.equal(SETTLEMENT_LIVE, false);
});

for (const [label, options, reason] of [
  ['absent bytecode', { noCode: true }, 'missing-contract-code'],
  ['unregistered game', { gameIndex: 10, gameValue: false }, 'game-not-registered'],
  ['unconfirmed developer', { gameIndex: 8, gameValue: false }, 'developer-unconfirmed'],
  ['unplayable game', { gameIndex: 9, gameValue: false }, 'game-not-playable'],
  ['wrong game identity', { gameIndex: 0, gameValue: ethers.id('different-game') }, 'game-identity-mismatch'],
  ['empty developer', { gameIndex: 2, gameValue: ethers.ZeroAddress }, 'invalid-developer'],
  ['wrong score registry wiring', { wiredRegistry: wallet }, 'score-registry-mismatch'],
  ['missing verifier', { verifier: ethers.ZeroAddress }, 'missing-verifier'],
  ['legacy ten-field tuple', { legacy: true }, 'incompatible-score-abi'],
  ['RPC read failure', { rpcError: true }, 'contract-read-failed'],
]) test(`a funded wallet cannot bypass ${label}`, async () => {
  const { result, calls } = await check(options);
  assert.equal(result.ok, false);
  assert.equal(result.onChain, true);
  assert.equal(result.errorKind, 'contract-gate');
  assert.equal(result.contractGate?.reason, reason);
  assert.equal(calls.some(c => /send|sign|requestAccounts/.test(c.method)), false);
});

test('approved current-ABI fixture passes only contract/funds preflight at one pinned block', async () => {
  const { result, calls } = await check();
  assert.equal(result.ok, true, result.error);
  assert.equal(result.contractGate?.ok, true);
  assert.equal(result.contractGate?.blockNumber, 291);
  const pinned = calls.filter(c => ['eth_call', 'eth_getCode'].includes(c.method));
  assert.ok(pinned.length >= 6, 'must actually inspect code, approval, wiring, verifier and tuple');
  assert.ok(pinned.every(c => c.params[1] === '0x123'));
  assert.ok(calls.every(c => ['eth_chainId', 'eth_accounts', 'eth_blockNumber', 'eth_getBalance', 'eth_call', 'eth_getCode'].includes(c.method)));
  assert.equal(SETTLEMENT_LIVE, false, 'fixture preflight does not enable real settlement');
});

test('wrong chain stops before contract, account and funding reads', async () => {
  const { result, calls } = await check({ chain: '0x1' });
  assert.equal(result.ok, false);
  assert.equal(result.onChain, false);
  assert.ok(calls.every(c => c.method === 'eth_chainId'));
});

test('unconnected wallet preflight never requests account access or creates a signer', async () => {
  const { result, calls } = await check({ accounts: [] });
  assert.equal(result.ok, false);
  assert.equal(result.errorKind, 'no-account');
  assert.equal(calls.some(c => c.method === 'eth_requestAccounts'), false);
});

test('missing or noncanonical game IDs fail closed instead of silently assuming HMH', async () => {
  for (const bad of [undefined, '', ' lester-blaster ', 123, null]) {
    const { result, calls } = await check({}, { gameId: bad });
    assert.equal(result.ok, false);
    assert.equal(result.contractGate?.reason, 'invalid-game-id');
    assert.equal(calls.some(c => c.method === 'eth_call'), false);
  }
});

test('invalid explicit gas estimates fail before RPC rather than bypassing the funds check', async () => {
  for (const minGasWei of [-1n, 0n, '1', 1, NaN, Infinity]) {
    const { result, calls } = await check({}, { minGasWei });
    assert.equal(result.ok, false);
    assert.equal(result.errorKind, 'invalid-gas-estimate');
    assert.deepEqual(calls, []);
  }
});

test('insufficient funds still deny an approved contract fixture', async () => {
  const { result } = await check({ balance: '0x0' });
  assert.equal(result.contractGate?.ok, true);
  assert.equal(result.hasFunds, false);
  assert.equal(result.ok, false);
});

test('the direct ranked writer refuses disabled settlement before any provider access', async () => {
  const calls = [];
  const provider = { async request(request) { calls.push(request); throw new Error('provider must not be contacted'); } };
  await assert.rejects(submitRankedSession(provider, { sessionId: 'fixture-run', gameId, envelopeHash: `0x${'ab'.repeat(32)}`, attestation: { signature: 'fixture-not-a-real-signature', deadline: 1 } }), /settlement is disabled/i);
  assert.deepEqual(calls, []);
});

test('a source-isolated live writer rechecks approval before creating any signer', async () => {
  const source = readFileSync(new URL('../apps/portal/src/litvm-chain-client.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declarations = ast.body.map(n => n.declaration ?? n);
  const names = ['scoreContractAddress', 'readRankedContractGate', 'submitRankedSession', 'isBytes32Hex', 'toBytes32Id'];
  const code = declarations.filter(n => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map(n => source.slice(n.start, n.end)).join('\n');
  const f = fixture({ gameIndex: 10, gameValue: false });
  const isolatedWriter = runInNewContext(`${code}\nsubmitRankedSession`, {
    SETTLEMENT_LIVE: true, loadEthers, SCORE_REGISTRY_ABI,
    GAME_REGISTRY_ABI: gameAbi.fragments, LITVM_CONTRACT_ADDRESSES,
    LITVM_LITEFORGE_NETWORK: { chainId: 4441, name: 'Fixture LiteForge' },
  });
  await assert.rejects(isolatedWriter(f.provider, { sessionId: 'fixture-run', gameId, envelopeHash: `0x${'ab'.repeat(32)}`, attestation: { signature: 'fixture-not-a-real-signature', deadline: 1 } }), /not registered/i);
  assert.equal(f.calls.some(c => /accounts|send|sign/i.test(c.method)), false);
  assert.equal(SETTLEMENT_LIVE, false, 'the real exported gate is never toggled by this fixture');
});

test('new preflight behavioral suites are registered in the explicit syntax gate', () => {
  const source = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("'tests/litvm-ranked-contract-gate.test.mjs'"));
  assert.ok(source.includes("'tests/ranked-entry-preflight.test.mjs'"));
});

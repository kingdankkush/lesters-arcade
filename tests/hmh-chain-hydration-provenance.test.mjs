import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { recordCadenceScore, getLeaderboard } from '../apps/portal/src/leaderboard-engine.mjs';
import { leaderboardEntryProvenance } from '../apps/portal/src/leaderboard-seed.mjs';
import { fetchPlayerSessions, SCORE_REGISTRY_ABI, loadEthers } from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';

// Encoded, deterministic EIP-1193 fixtures only. These are not live chain results.
const hash = (byte) => `0x${byte.repeat(32)}`;
const wallet = `0x${'12'.repeat(20)}`;
const record = (overrides = {}) => ({
  sessionId32: hash('ab'), gameId32: hash('cd'), paymentSessionId32: hash('ef'),
  player: wallet, score: 1200, kills: 10, maxCombo: 4, survivalSeconds: 120,
  scoreHash32: hash('11'), runSeedHash32: hash('22'), buildHash32: hash('33'),
  submittedAt: 1788955200, verified: true, onChain: true, ...overrides,
});
const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });
const merger = ast.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'mergeChainRecordIntoState');
assert.ok(merger, 'exercise the actual parent merger, not a rewritten model');
function subject(state = {}) {
  const merge = vm.runInNewContext(`(${main.slice(merger.start, merger.end)})`, { state, recordCadenceScore });
  return { state, merge };
}

test('unverified chain sessions cannot mutate any official parent store', () => {
  const { state, merge } = subject();
  assert.equal(merge(record({ verified: false }), 'hard-money-heroes'), false);
  assert.deepEqual(state, {});
});

test('missing or malformed chain identity fails closed before parent mutation', () => {
  for (const bad of [null, record({ verified: 'true' }), record({ onChain: false }), record({ sessionId32: '0xabc' }), record({ player: '0xabc' }), record({ score: Infinity }), record({ submittedAt: NaN })]) {
    const { state, merge } = subject();
    assert.equal(merge(bad, 'hard-money-heroes'), false);
    assert.deepEqual(state, {});
  }
});

test('an unknown cabinet hash cannot fall back into Lester Blaster boards', () => {
  const { state, merge } = subject();
  assert.equal(merge(record(), undefined), false);
  assert.deepEqual(state, {});
  for (const name of ['hydrateLeaderboardFromChain', 'hydrateProfileFromChain']) {
    const node = ast.body.find((row) => row.type === 'FunctionDeclaration' && row.id.name === name);
    assert.ok(node);
    assert.doesNotMatch(main.slice(node.start, node.end), /\?\?\s*['"]lester-blaster['"]/);
  }
});

test('a verified registry session retains its identity without inventing a transaction hash', () => {
  const { state, merge } = subject();
  const rec = record();
  assert.equal(merge(rec, 'hard-money-heroes'), true);
  const board = getLeaderboard(state, 'hard-money-heroes', 'all-time', { filterToCurrentVersion: false });
  const row = board.topEntries[0];
  assert.equal(row.settlementTxHash, null);
  assert.equal(row.onChainSessionId32, rec.sessionId32);
  assert.equal(row.onChain, true);
  assert.equal(row.chainVerified, true);
  assert.equal(leaderboardEntryProvenance(row).official, true);
  assert.equal(merge(rec, 'hard-money-heroes'), false);
  assert.equal(state.officialSessions.length, 1);
  assert.equal(state.leaderboards['hard-money-heroes'].length, 1);
});

test('distinct sessions sharing a hash prefix remain distinct in cadence storage', () => {
  const { state, merge } = subject();
  const first = record();
  const second = record({ sessionId32: `${first.sessionId32.slice(0, -2)}cd`, score: 1400 });
  assert.equal(merge(first, 'hard-money-heroes'), true);
  assert.equal(merge(second, 'hard-money-heroes'), true);
  const stored = state.cadenceLeaderboards['hard-money-heroes']['all-time']['all-time'];
  assert.equal(stored.length, 2);
  assert.notEqual(stored[0].sessionId, stored[1].sessionId);
});

test('synthetic and malformed receipts never acquire official leaderboard provenance', () => {
  for (const settlementTxHash of ['sim:abc', '0xabc', 'chain:abc', true, 123]) {
    assert.equal(leaderboardEntryProvenance({ wallet, settlementTxHash }).official, false);
  }
  assert.equal(leaderboardEntryProvenance({ wallet, onChain: true, chainVerified: false, onChainSessionId32: hash('ab') }).official, false);
  assert.equal(leaderboardEntryProvenance({ wallet, seed: true, onChain: true, chainVerified: true, onChainSessionId32: hash('ab') }).official, false);
});

test('legacy hydrated caches do not turn a session ID into transaction proof', () => {
  assert.equal(leaderboardEntryProvenance({ wallet, sessionId: 'chain:0xabababababababab', settlementTxHash: hash('ab') }).official, false);
  assert.equal(leaderboardEntryProvenance({ wallet, onChain: true, chainVerified: false, settlementTxHash: hash('ab') }).official, false);
});

test('the reader rejects a wallet provider on the wrong chain', async () => {
  const ethers = await loadEthers();
  const iface = new ethers.Interface(SCORE_REGISTRY_ABI);
  const tuple = [hash('ab'), wallet, hash('cd'), 1200n, 10n, 4n, 120n, hash('11'), 1788955200n, true, true];
  const walletProvider = { async request({ method, params }) {
    if (method === 'eth_chainId') return '0x1';
    if (method === 'eth_call') {
      const call = iface.parseTransaction({ data: params[0].data });
      if (call.name === 'playerSessionCount') return iface.encodeFunctionResult(call.name, [1n]);
      if (call.name === 'getPlayerSessions') return iface.encodeFunctionResult(call.name, [[tuple]]);
    }
    throw new Error(`Unexpected fixture RPC method: ${method}`);
  } };
  const result = await fetchPlayerSessions(wallet, { walletProvider });
  assert.equal(result.ok, false);
  assert.deepEqual(result.records, []);
});

test('the real player-session reader excludes unverified decoded tuples', async () => {
  const ethers = await loadEthers();
  const iface = new ethers.Interface(SCORE_REGISTRY_ABI);
  const tuple = (verified) => [hash('ab'), wallet, hash('cd'), 1200n, 10n, 4n, 120n, hash('11'), 1788955200n, verified, true];
  const encoded = iface.encodeFunctionResult('getPlayerSessions', [[tuple(false), tuple(true)]]);
  const calls = [];
  const walletProvider = { async request({ method, params }) {
    calls.push(method);
    if (method === 'eth_chainId') return LITVM_LITEFORGE_NETWORK.chainIdHex;
    if (method === 'eth_call') {
      const call = iface.parseTransaction({ data: params[0].data });
      if (call.name === 'playerSessionCount') return iface.encodeFunctionResult(call.name, [2n]);
      if (call.name === 'getPlayerSessions') return encoded;
    }
    throw new Error(`Unexpected fixture RPC method: ${method}`);
  } };
  const result = await fetchPlayerSessions(wallet, { walletProvider });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].verified, true);
  assert.ok(calls.includes('eth_call'));
  assert.ok(calls.every((method) => ['eth_call', 'eth_chainId'].includes(method)));
});

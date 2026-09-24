import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { leaderboardEntryProvenance } from '../apps/portal/src/leaderboard-seed.mjs';
import { fetchPlayerSessions, SCORE_REGISTRY_ABI, loadEthers } from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';

// Encoded, deterministic EIP-1193 fixtures only. These are not live chain results.
const hash = (byte) => `0x${byte.repeat(32)}`;
const wallet = `0x${'12'.repeat(20)}`;
const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });

test('the chain-record merge is retired: no chain row can be written into the local boards', () => {
  // The 200-session chain scan (guide §5.8, profile-boards) and the parent
  // merge that filed its records into local state (integration-glue B9) are
  // gone; the verified boards and profiles come from the server index.
  const declared = new Set(ast.body.flatMap((row) => {
    if (row.type === 'FunctionDeclaration') return [row.id.name];
    if (row.type === 'VariableDeclaration') return row.declarations.map((entry) => entry.id?.name).filter(Boolean);
    return [];
  }));
  for (const retired of ['mergeChainRecordIntoState', 'ensureGameIdHashes', '_hydratingLeaderboard', '_gameIdByHash', 'hydrateLeaderboardFromChain', 'hydrateProfileFromChain']) {
    assert.equal(declared.has(retired), false, retired);
    assert.doesNotMatch(main, new RegExp(`\\b${retired}\\b`), `${retired} is not referenced`);
  }
  // The index-backed fills that replace it never fall back to Lester Blaster.
  for (const name of ['hydrateLeaderboardFromIndex', 'hydrateProfileFromIndex']) {
    const node = ast.body.find((row) => row.type === 'FunctionDeclaration' && row.id.name === name);
    assert.ok(node);
    assert.doesNotMatch(main.slice(node.start, node.end), /\?\?\s*['"]lester-blaster['"]/);
  }
});

test('a verified registry row is official without an invented transaction hash', () => {
  const row = { wallet, settlementTxHash: null, onChainSessionId32: hash('ab'), onChain: true, chainVerified: true };
  assert.equal(leaderboardEntryProvenance(row).official, true);
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

// Reads go over the public LiteForge RPC only (guide §5.2 item 6, contracts slice): the vendored ethers
// transport uses global fetch, so the fixture answers JSON-RPC there and nothing leaves the process.
async function withPublicRpcFixture(answer, run) {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    const payload = JSON.parse(new TextDecoder().decode(init.body));
    const reply = async (request) => {
      seen.push({ url: String(url), method: request.method });
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

test('the reader ignores a wallet provider on the wrong chain and reads the public LiteForge RPC', async () => {
  const ethers = await loadEthers();
  const iface = new ethers.Interface(SCORE_REGISTRY_ABI);
  // Hardened thirteen-field ScoreRecord (2026-09-16): runtimeId and seasonId precede submittedAt.
  const tuple = [hash('ab'), wallet, hash('cd'), 1200n, 10n, 4n, 120n, hash('11'), hash('77'), hash('88'), 1788955200n, true, true];
  const walletCalls = [];
  const walletProvider = { async request({ method }) {
    walletCalls.push(method);
    if (method === 'eth_chainId') return '0x1';
    throw new Error(`Unexpected wallet RPC method: ${method}`);
  } };
  const { result, seen } = await withPublicRpcFixture(async ({ method, params }) => {
    if (method === 'eth_chainId') return LITVM_LITEFORGE_NETWORK.chainIdHex;
    if (method === 'eth_call') {
      const call = iface.parseTransaction({ data: params[0].data });
      if (call.name === 'playerSessionCount') return iface.encodeFunctionResult(call.name, [1n]);
      if (call.name === 'getPlayerSessions') return iface.encodeFunctionResult(call.name, [[tuple]]);
    }
    throw new Error(`Unexpected fixture RPC method: ${method}`);
  }, () => fetchPlayerSessions(wallet, { walletProvider }));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.records.length, 1);
  assert.deepEqual(walletCalls, [], 'the wallet provider is never used for reads');
  assert.ok(seen.length > 0 && seen.every((call) => call.url === LITVM_LITEFORGE_NETWORK.rpcUrls.http));
});

test('the real player-session reader excludes unverified decoded tuples', async () => {
  const ethers = await loadEthers();
  const iface = new ethers.Interface(SCORE_REGISTRY_ABI);
  const tuple = (verified) => [hash('ab'), wallet, hash('cd'), 1200n, 10n, 4n, 120n, hash('11'), hash('77'), hash('88'), 1788955200n, verified, true];
  const encoded = iface.encodeFunctionResult('getPlayerSessions', [[tuple(false), tuple(true)]]);
  const walletProvider = { async request() { throw new Error('the wallet provider must not be used for reads'); } };
  const { result, seen } = await withPublicRpcFixture(async ({ method, params }) => {
    if (method === 'eth_chainId') return LITVM_LITEFORGE_NETWORK.chainIdHex;
    if (method === 'eth_call') {
      const call = iface.parseTransaction({ data: params[0].data });
      if (call.name === 'playerSessionCount') return iface.encodeFunctionResult(call.name, [2n]);
      if (call.name === 'getPlayerSessions') return encoded;
    }
    throw new Error(`Unexpected fixture RPC method: ${method}`);
  }, () => fetchPlayerSessions(wallet, { walletProvider }));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].verified, true);
  const calls = seen.map((call) => call.method);
  assert.ok(calls.includes('eth_call'));
  assert.ok(calls.every((method) => ['eth_call', 'eth_chainId'].includes(method)));
});

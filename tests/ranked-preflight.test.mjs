import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

import { createRankedPreflight, preflightFromReadiness, RANKED_PREFLIGHT_TTL_MS } from '../apps/portal/src/ranked-preflight.mjs';
import {
  checkRankedReadiness, openRankedSession, sendRankedEntry, loadEthers,
  SCORE_REGISTRY_ABI, RANKED_ENTRY_ABI, GAME_REGISTRY_ABI, RANKED_ENTRY_GAS_UNITS,
  RANKED_ENTRY_CONFIRM_DEADLINE_MS, RANKED_ENTRY_POLL_INTERVAL_MS, RANKED_ENTRY_CLOSED_ERROR, RANKED_ENTRY_ACCOUNT_CHANGED_ERROR,
} from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_CONTRACT_ADDRESSES, SETTLEMENT_LIVE } from '../apps/portal/src/settlement.mjs';
import { liteForgeFeeOverrides, liteForgeMaxFeePerGas } from '../apps/portal/src/liteforge-fees.mjs';

const ethers = await loadEthers();
const WALLET = `0x${'12'.repeat(20)}`;
const GAME = 'lester-blaster';
const FEE = 100_000_000_000_000_000n;     // 0.1 zkLTC
const RESERVE = 2_000_000_000_000_000n;   // 0.002 zkLTC
const TOTAL = FEE + RESERVE;              // 0.102 zkLTC

const gameAbi = new ethers.Interface(GAME_REGISTRY_ABI);
const scoreAbi = new ethers.Interface(SCORE_REGISTRY_ABI);
const entryAbi = new ethers.Interface(RANKED_ENTRY_ABI);
const emptySession = [ethers.ZeroHash, ethers.ZeroAddress, ethers.ZeroHash, 0n, 0n, 0n, 0n, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, 0n, false, false];

// The public LiteForge RPC, as an EIP-1193 fixture: a registered, playable
// game with the 0.1 zkLTC fee and the 0.002 zkLTC reserve.
function publicRpc({ balance = 10n ** 18n, gasPrice = 1_500_000_000n } = {}) {
  const calls = [];
  const game = [ethers.id(GAME), 'Hard Money Heroes', WALLET, 8500, 1500, 0, 0, FEE, true, true, true, 1n];
  return {
    calls,
    async request({ method, params = [] }) {
      calls.push(method);
      if (method === 'eth_chainId') return '0x1159';
      if (method === 'eth_blockNumber') return '0x10';
      if (method === 'eth_getCode') return '0x6000';
      if (method === 'eth_getBalance') return ethers.toQuantity(balance);
      if (method === 'eth_gasPrice') return ethers.toQuantity(gasPrice);
      if (method === 'eth_maxPriorityFeePerGas') return '0x0';
      if (method === 'eth_getBlockByNumber') return { number: '0x10', hash: `0x${'aa'.repeat(32)}`, parentHash: `0x${'bb'.repeat(32)}`, timestamp: '0x1', nonce: '0x0000000000000000', difficulty: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x0', miner: ethers.ZeroAddress, extraData: '0x', baseFeePerGas: ethers.toQuantity(gasPrice), transactions: [] };
      if (method === 'eth_call') {
        const [tx] = params;
        const to = tx.to.toLowerCase();
        if (to === LITVM_CONTRACT_ADDRESSES.gameRegistry) return gameAbi.encodeFunctionResult('getGame', [game]);
        if (to === LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry) {
          const call = entryAbi.parseTransaction({ data: tx.data });
          assert.equal(call.name, 'quoteEntry');
          return entryAbi.encodeFunctionResult('quoteEntry', [FEE, RESERVE, TOTAL]);
        }
        const call = scoreAbi.parseTransaction({ data: tx.data });
        if (call.name === 'gameRegistry') return scoreAbi.encodeFunctionResult('gameRegistry', [LITVM_CONTRACT_ADDRESSES.gameRegistry]);
        if (call.name === 'trustedVerifier') return scoreAbi.encodeFunctionResult('trustedVerifier', [`0x${'34'.repeat(20)}`]);
        if (call.name === 'getSession') return scoreAbi.encodeFunctionResult('getSession', [emptySession]);
        if (call.name === 'rankedEntry') return scoreAbi.encodeFunctionResult('rankedEntry', [LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry]);
      }
      throw new Error(`public RPC fixture does not implement ${method}`);
    },
  };
}

// The player's wallet: it may be asked which chain it is on, nothing else.
function walletOnlyChain(chain = '0x1159') {
  const calls = [];
  return { calls, async request({ method }) { calls.push(method); if (method === 'eth_chainId') return chain; throw new Error(`the wallet must not be asked for ${method}`); } };
}

test('preflight caches per game and wallet for sixty seconds', async () => {
  let clock = 1_000_000;
  const checks = [];
  const preflight = createRankedPreflight({
    live: true, now: () => clock,
    checkReadiness: async (walletProvider, options) => {
      checks.push(options);
      return { ok: true, onChain: true, chainId: 4441, wallet: options.wallet, hasFunds: true, balanceWei: 5n, balanceEth: '0.000000000000000005', needWei: 3n, gasWei: 1n, contractGate: { ok: true, entryFeeWei: FEE, settlementGasReserveWei: RESERVE, entryTotalWei: TOTAL, rankedEntryAddress: LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry } };
    },
  });
  const walletProvider = walletOnlyChain();
  assert.equal(preflight.peek({ gameId: GAME, wallet: WALLET }), null);
  const first = await preflight.start({ gameId: GAME, wallet: WALLET, walletProvider });
  assert.equal(first.ok, true);
  assert.equal(first.entryTotalWei, TOTAL);
  assert.equal(first.checkedAt, clock);
  // The same game and wallet within 60 s: cached, and concurrent starts share one read.
  clock += RANKED_PREFLIGHT_TTL_MS - 1;
  const [again, alsoAgain] = await Promise.all([
    preflight.start({ gameId: GAME, wallet: WALLET.toUpperCase().replace('0X', '0x'), walletProvider }),
    preflight.start({ gameId: GAME, wallet: WALLET, walletProvider }),
  ]);
  assert.equal(again, first);
  assert.equal(alsoAgain, first);
  assert.equal(checks.length, 1);
  assert.equal(preflight.peek({ gameId: GAME, wallet: WALLET }), first);
  // Another game, or another wallet, is its own entry.
  await preflight.start({ gameId: 'chikun', wallet: WALLET, walletProvider });
  await preflight.start({ gameId: GAME, wallet: `0x${'56'.repeat(20)}`, walletProvider });
  assert.equal(checks.length, 3);
  assert.deepEqual(checks.map((options) => options.gameId), [GAME, 'chikun', GAME]);
  // After 60 s the cache is stale: peek forgets it and start reads again.
  clock += 2;
  assert.equal(preflight.peek({ gameId: GAME, wallet: WALLET }), null);
  await preflight.start({ gameId: GAME, wallet: WALLET, walletProvider });
  assert.equal(checks.length, 4);
  // force bypasses the cache.
  await preflight.start({ gameId: GAME, wallet: WALLET, walletProvider, force: true });
  assert.equal(checks.length, 5);

  // Preview (the flag off): nothing is read, nothing is cached.
  let previewChecks = 0;
  const preview = createRankedPreflight({ live: false, checkReadiness: async () => { previewChecks += 1; return {}; } });
  assert.equal(await preview.start({ gameId: GAME, wallet: WALLET, walletProvider }), null);
  assert.equal(preview.peek({ gameId: GAME, wallet: WALLET }), null);
  assert.equal(previewChecks, 0);
  // A WalletConnect session whose provider is not created yet is never touched.
  const pending = await preflight.start({ gameId: 'stacked', wallet: WALLET, walletProvider: null });
  assert.equal(pending.errorKind, 'provider-pending');
  assert.equal(preflight.peek({ gameId: 'stacked', wallet: WALLET }), null);
});

test('funds check includes the entry total', async () => {
  const explicitGas = 400_000_000_000_000n; // 0.0004 zkLTC
  // One wei short of the entry total plus gas: not funded.
  const short = await checkRankedReadiness(walletOnlyChain(), { gameId: GAME, wallet: WALLET, minGasWei: explicitGas, readProvider: publicRpc({ balance: TOTAL + explicitGas - 1n }) });
  assert.equal(short.contractGate.ok, true);
  assert.equal(short.entryTotalWei, TOTAL);
  assert.equal(short.needWei, TOTAL + explicitGas, 'the 0.102 zkLTC entry total plus gas, not gas alone');
  assert.equal(short.hasFunds, false);
  assert.equal(short.ok, false);
  assert.equal(short.errorKind, 'insufficient-funds');
  // Gas alone would have passed the old check: the entry total is what fails it.
  assert.ok(TOTAL + explicitGas - 1n > explicitGas);
  const exact = await checkRankedReadiness(walletOnlyChain(), { gameId: GAME, wallet: WALLET, minGasWei: explicitGas, readProvider: publicRpc({ balance: TOTAL + explicitGas }) });
  assert.equal(exact.ok, true);
  assert.equal(exact.hasFunds, true);

  // Without an override, the gas is openSession's padded units at the fee cap the
  // entry is sent with (liteforge-fees.mjs: 10 x the latest base fee, at least
  // 5 gwei), because the wallet refuses a transaction it cannot cover at its cap.
  const estimated = await checkRankedReadiness(walletOnlyChain(), { gameId: GAME, wallet: WALLET, readProvider: publicRpc({ gasPrice: 2_000_000_000n }) });
  assert.equal(estimated.gasWei, RANKED_ENTRY_GAS_UNITS * 20_000_000_000n);
  assert.equal(estimated.needWei, TOTAL + RANKED_ENTRY_GAS_UNITS * 20_000_000_000n);
  const lowBase = await checkRankedReadiness(walletOnlyChain(), { gameId: GAME, wallet: WALLET, readProvider: publicRpc({ gasPrice: 100_000_000n }) });
  assert.equal(lowBase.gasWei, RANKED_ENTRY_GAS_UNITS * 5_000_000_000n, 'a 0.1 gwei base fee still budgets the 5 gwei floor');

  // The preflight carries the same numbers.
  const preflight = preflightFromReadiness(short, { gameId: GAME, now: 5 });
  assert.equal(preflight.entryFeeWei, FEE);
  assert.equal(preflight.settlementGasReserveWei, RESERVE);
  assert.equal(preflight.entryTotalWei, TOTAL);
  assert.equal(preflight.needWei, TOTAL + explicitGas);
  assert.equal(preflight.hasFunds, false);
  assert.equal(preflight.rankedEntryAddress, LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry);
});

test('reads go through the public RPC, not the wallet', async () => {
  const wallet = walletOnlyChain();
  const rpc = publicRpc();
  const preflight = createRankedPreflight({ live: true, readProvider: rpc });
  const result = await preflight.start({ gameId: GAME, wallet: WALLET, walletProvider: wallet });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(wallet.calls, ['eth_chainId'], 'the only wallet call is eth_chainId');
  for (const method of ['eth_call', 'eth_getCode', 'eth_getBalance']) assert.ok(rpc.calls.includes(method), `${method} goes to the public RPC`);
  assert.equal(result.entryTotalWei, TOTAL, 'quoteEntry was read');
  // A wallet on another chain is reported without any read at all.
  const elsewhere = walletOnlyChain('0x1');
  const offChain = await checkRankedReadiness(elsewhere, { gameId: GAME, wallet: WALLET, readProvider: publicRpc() });
  assert.equal(offChain.onChain, false);
  assert.equal(offChain.chainId, 1);
  assert.deepEqual(elsewhere.calls, ['eth_chainId']);
  // Without an injected read provider, the reads use the module's public
  // provider (withPublicRead), never the wallet's.
  const source = readFileSync(new URL('../apps/portal/src/litvm-chain-client.mjs', import.meta.url), 'utf8');
  assert.match(source, /async function withReadProvider\(ethers, readProvider, read\) \{\n  if \(!readProvider\) return withPublicRead\(ethers, null, read\);/);
  assert.match(source, /export async function checkRankedReadiness[\s\S]*?withReadProvider\(ethers, readProvider,/);
  assert.equal(SETTLEMENT_LIVE, true, 'the live build runs these reads, always over the public RPC');
});

// sendRankedEntry runs source-isolated with the live flag on and a fake ethers,
// so nothing touches a real chain and the committed flag stays false.
// `publicWait(hash)` and `walletWait()` script the two receipt sources (return
// a receipt, or throw); `paid()` answers the entry contract's isPaid.
function timeoutError() { return Object.assign(new Error('timeout'), { code: 'TIMEOUT' }); }
function isolatedEntry({ receipt, publicReadFails = false, publicWait = null, walletWait = null, paid = () => false, signer = WALLET, live = true } = {}) {
  const source = readFileSync(new URL('../apps/portal/src/litvm-chain-client.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const names = ['sendRankedEntry', 'openRankedSession', 'withReadProvider', 'isBytes32Hex', 'toBytes32Id', 'readRankedContractGate', 'scoreContractAddress'];
  const code = ast.body.map((node) => node.declaration ?? node)
    .filter((node) => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map((node) => source.slice(node.start, node.end)).join('\n');
  const log = [];
  let settle;
  const confirmation = new Promise((resolve) => { settle = resolve; });
  const fakeEthers = {
    id: (value) => ethers.id(value),
    BrowserProvider: class {
      constructor(eip) { this.eip = eip; }
      async getNetwork() { log.push('wallet:eth_chainId'); return { chainId: BigInt(await this.eip.request({ method: 'eth_chainId' })) }; }
      async getSigner() { log.push('wallet:signer'); return { address: signer, async getAddress() { return signer; } }; }
    },
    Contract: class {
      constructor(address, abi, runner) { this.address = address; this.runner = runner; }
      async openSession(sessionId32, gameId32, overrides) {
        log.push(`wallet:openSession:${sessionId32}:${gameId32}:${overrides.value}`);
        // Priced by the arcade (liteforge-fees.mjs), never left to the wallet's own fee guess.
        assert.equal(overrides.maxFeePerGas, 5_000_000_000n, 'no block read in this fixture: the 5 gwei floor');
        assert.equal(overrides.maxPriorityFeePerGas, 0n);
        return {
          hash: `0x${'77'.repeat(32)}`,
          wait: async () => {
            log.push('wallet:wait');
            if (walletWait) return walletWait();
            return receipt ?? { status: 1, blockNumber: 9 };
          },
        };
      }
      async isPaid(sessionId32, player, gameId32) {
        log.push(`public:isPaid:${player}`);
        return paid({ sessionId32, player, gameId32 });
      }
    },
  };
  const readProvider = {
    getBlockNumber: async () => 1,
    waitForTransaction: async (hash) => {
      log.push(`public:wait:${hash.slice(0, 6)}`);
      if (publicReadFails) throw new Error('public RPC down');
      if (publicWait) return publicWait(hash);
      return confirmation;
    },
  };
  const context = {
    SETTLEMENT_LIVE: live,
    loadEthers: async () => fakeEthers,
    LITVM_CONTRACT_ADDRESSES,
    LITVM_LITEFORGE_NETWORK: { chainId: 4441, name: 'Fixture LiteForge' },
    RANKED_ENTRY_ABI, GAME_REGISTRY_ABI, SCORE_REGISTRY_ABI,
    RANKED_ENTRY_WAIT_TIMEOUT_MS: 1000,
    RANKED_ENTRY_CONFIRM_DEADLINE_MS, RANKED_ENTRY_POLL_INTERVAL_MS, RANKED_ENTRY_CLOSED_ERROR, RANKED_ENTRY_ACCOUNT_CHANGED_ERROR,
    setTimeout,
    withPublicRead: async () => { throw new Error('tests inject the read provider'); },
    liteForgeFeeOverrides, liteForgeMaxFeePerGas,
  };
  const api = runInNewContext(`${code}\n({ sendRankedEntry, openRankedSession })`, context);
  const wallet = { async request({ method }) { if (method === 'eth_chainId') return '0x1159'; throw new Error(`unexpected wallet call ${method}`); } };
  return { api, log, settle, readProvider, wallet };
}

const QUOTE = Object.freeze({ ok: true, gameId: GAME, rankedEntryAddress: LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry, entryFeeWei: FEE, settlementGasReserveWei: RESERVE, entryTotalWei: TOTAL });

test('sendRankedEntry resolves on broadcast and reports confirmation later', async () => {
  const sessionKey = `0x${'AB'.repeat(32)}`;
  const preflight = { ...QUOTE };
  const { api, log, settle, readProvider, wallet } = isolatedEntry();
  const sent = await api.sendRankedEntry(wallet, { sessionKey, gameId: GAME, preflight, readProvider, expectedWallet: WALLET });
  // Resolved right after the broadcast, before any confirmation exists.
  assert.equal(sent.txHash, `0x${'77'.repeat(32)}`);
  assert.equal(sent.sessionId32, sessionKey.toLowerCase());
  assert.equal(sent.amountWei, TOTAL, 'the exact quote: 0.1 entry + 0.002 reserve');
  assert.deepEqual(log, ['wallet:eth_chainId', 'wallet:signer', `wallet:openSession:${sessionKey.toLowerCase()}:${ethers.id(GAME)}:${TOTAL}`]);
  let status = null;
  const waiting = sent.wait().then((result) => { status = result.status; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(status, null, 'still confirming');
  assert.equal(sent.wait(), sent.wait(), 'wait() is memoized');
  settle({ status: 1, blockNumber: 12 });
  assert.deepEqual({ ...(await waiting) }, { status: 'confirmed', blockNumber: 12 });

  // A reverted entry reports failed, and a public RPC outage falls back to the wallet's receipt.
  const reverted = isolatedEntry();
  const sentReverted = await reverted.api.sendRankedEntry(reverted.wallet, { sessionKey, gameId: GAME, preflight, readProvider: reverted.readProvider });
  reverted.settle({ status: 0, blockNumber: 13 });
  assert.equal((await sentReverted.wait()).status, 'failed');
  const outage = isolatedEntry({ publicReadFails: true, receipt: { status: 1, blockNumber: 14 } });
  const sentOutage = await outage.api.sendRankedEntry(outage.wallet, { sessionKey, gameId: GAME, preflight, readProvider: outage.readProvider });
  assert.deepEqual({ ...(await sentOutage.wait()) }, { status: 'confirmed', blockNumber: 14 });
  assert.ok(outage.log.includes('wallet:wait'));

  // A build with settlement off (every build before runbook step 7) refuses before touching the wallet.
  const untouched = { request() { throw new Error('must not be contacted'); } };
  const disabled = isolatedEntry({ live: false }).api;
  await assert.rejects(disabled.sendRankedEntry(untouched, { sessionKey, gameId: GAME, preflight }), /settlement is disabled/i);
  await assert.rejects(disabled.openRankedSession(untouched, { sessionId: 'game-session-x', gameId: GAME }), /settlement is disabled/i);
});

test('the entry is refused before openSession from another account or on a zero quote', async () => {
  const sessionKey = `0x${'cd'.repeat(32)}`;
  // The key is bound to WALLET; the wallet now signs as another account.
  const switched = isolatedEntry({ signer: `0x${'34'.repeat(20)}` });
  await assert.rejects(
    switched.api.sendRankedEntry(switched.wallet, { sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: switched.readProvider, expectedWallet: WALLET }),
    (error) => error.code === 'ACCOUNT_MISMATCH' && error.message === RANKED_ENTRY_ACCOUNT_CHANGED_ERROR,
  );
  assert.equal(switched.log.some((entry) => entry.startsWith('wallet:openSession')), false, 'no transaction from the other account');
  // The same account in another case passes.
  const sameAccount = isolatedEntry({ signer: WALLET.toUpperCase().replace('0X', '0x') });
  const sent = await sameAccount.api.sendRankedEntry(sameAccount.wallet, { sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: sameAccount.readProvider, expectedWallet: WALLET });
  assert.equal(sent.amountWei, TOTAL);

  // A27: a zero quote (fees switched off) is closed, not free: nothing is sent
  // and no signer is asked for.
  const free = isolatedEntry();
  await assert.rejects(
    free.api.sendRankedEntry(free.wallet, { sessionKey, gameId: GAME, preflight: { ...QUOTE, entryTotalWei: 0n }, readProvider: free.readProvider }),
    (error) => error.code === 'RANKED_ENTRY_CLOSED' && error.message === RANKED_ENTRY_CLOSED_ERROR,
  );
  assert.deepEqual(free.log, ['wallet:eth_chainId']);
});

test('a slow entry stays pending until a receipt or the entry contract says paid', async () => {
  const sessionKey = `0x${'ef'.repeat(32)}`;
  const fast = { waitTimeoutMs: 5, pollIntervalMs: 1 };
  // Both receipt waits time out once, then the receipt arrives: confirmed, never failed.
  let publicCalls = 0;
  const late = isolatedEntry({
    publicWait: async () => { publicCalls += 1; if (publicCalls === 1) throw timeoutError(); return { status: 1, blockNumber: 21 }; },
    walletWait: async () => { throw timeoutError(); },
  });
  const sentLate = await late.api.sendRankedEntry(late.wallet, { sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: late.readProvider, ...fast });
  assert.deepEqual({ ...(await sentLate.wait()) }, { status: 'confirmed', blockNumber: 21 });
  assert.deepEqual(late.log.slice(3), ['public:wait:0x7777', 'wallet:wait', `public:isPaid:${WALLET}`, 'public:wait:0x7777']);

  // A sped-up (replaced) entry: this hash never gets a receipt, but the entry
  // contract records the session as paid by this player.
  let paidReads = 0;
  const replaced = isolatedEntry({
    publicWait: async () => { throw timeoutError(); },
    walletWait: async () => { throw timeoutError(); },
    paid: ({ sessionId32, player, gameId32 }) => {
      paidReads += 1;
      assert.equal(sessionId32, sessionKey.toLowerCase());
      assert.equal(player, WALLET);
      assert.equal(gameId32, ethers.id(GAME));
      return paidReads >= 2;
    },
  });
  const sentReplaced = await replaced.api.sendRankedEntry(replaced.wallet, { sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: replaced.readProvider, ...fast });
  assert.deepEqual({ ...(await sentReplaced.wait()) }, { status: 'confirmed', blockNumber: null });
  assert.equal(paidReads, 2);

  // No receipt and no payment until the deadline (A26: the ticket is stale
  // after 30 minutes, so the run can no longer be ranked): failed.
  let clock = 0;
  const lost = isolatedEntry({ publicWait: async () => { clock += 10; throw timeoutError(); }, walletWait: async () => { throw timeoutError(); } });
  const sentLost = await lost.api.sendRankedEntry(lost.wallet, { sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: lost.readProvider, ...fast, confirmDeadlineMs: 35, now: () => clock });
  assert.deepEqual({ ...(await sentLost.wait()) }, { status: 'failed', blockNumber: null });
  assert.equal(lost.log.filter((entry) => entry.startsWith('public:wait')).length, 4, 'polled until the deadline, then failed');
  assert.equal(RANKED_ENTRY_CONFIRM_DEADLINE_MS, 30 * 60 * 1000);
});

test('openRankedSession waits for the confirmation and throws on a revert', async () => {
  const sessionKey = `0x${'AB'.repeat(32)}`;
  const wrapped = isolatedEntry();
  let settledValue = null;
  const paying = wrapped.api.openRankedSession(wrapped.wallet, { sessionId: 'game-session-x', sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: wrapped.readProvider, expectedWallet: WALLET })
    .then((value) => { settledValue = value; return value; });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(wrapped.log.some((entry) => entry.startsWith('wallet:openSession')), 'broadcast');
  assert.equal(settledValue, null, 'still waiting for the receipt');
  wrapped.settle({ status: 1, blockNumber: 30 });
  const result = await paying;
  assert.equal(result.txHash, `0x${'77'.repeat(32)}`);
  assert.equal(result.amountWei, TOTAL);
  assert.equal(result.sessionId32, sessionKey.toLowerCase());
  assert.equal(result.paid, true);
  assert.deepEqual({ ...result.receipt }, { status: 'confirmed', blockNumber: 30 });

  const reverted = isolatedEntry();
  const failing = reverted.api.openRankedSession(reverted.wallet, { sessionId: 'game-session-x', sessionKey, gameId: GAME, preflight: { ...QUOTE }, readProvider: reverted.readProvider });
  await new Promise((resolve) => setTimeout(resolve, 5));
  reverted.settle({ status: 0, blockNumber: 31 });
  await assert.rejects(failing, /did not confirm/);

  // Without a pre-flight quote it reads the gate over the read provider.
  const gateRead = isolatedEntry();
  await assert.rejects(gateRead.api.openRankedSession(gateRead.wallet, { sessionId: 'game-session-x', sessionKey, gameId: GAME }), /tests inject the read provider/);
  assert.equal(gateRead.log.includes('wallet:signer'), false, 'the gate is read before any signer');
});

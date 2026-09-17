import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });
const fn = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'requestRankedEntry');
assert.ok(fn, 'exercise the real parent modal function, not an alternate implementation');
const tick = () => new Promise(resolve => setImmediate(resolve));
function element() {
  const listeners = new Map();
  return { hidden: true, disabled: false, textContent: '', dataset: {}, children: [],
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    click() { if (!this.disabled) listeners.get('click')?.(); },
  };
}
function subject({ status = {}, live = true, missingModal = false, pending = null, session = null } = {}) {
  const dom = Object.fromEntries(['rankedEntryModal', 'rankedEntryWallet', 'rankedEntryNetwork', 'rankedEntryStatus', 'rankedEntryBalance', 'rankedEntryChainGuard', 'rankedEntryApprove', 'rankedEntryCancel', 'rankedEntryFee', 'rankedEntryReserve', 'rankedEntryTotal'].map(k => [k, element()]));
  if (missingModal) dom.rankedEntryModal = null;
  const calls = [];
  const context = {
    dom, SETTLEMENT_LIVE: live, selectedGameId: 'lester-blaster', connectedWallet: `0x${'12'.repeat(20)}`,
    LITVM_LITEFORGE_NETWORK: { name: 'Fixture LiteForge', chainId: 4441, faucetUrl: 'https://example.invalid/faucet' },
    detectEthereumProvider: () => ({ request() { throw new Error('No real wallet in modal tests'); } }),
    checkRankedReadiness: async (provider, options) => { calls.push({ provider, options }); return pending ? pending : { ok: true, onChain: true, hasFunds: true, balanceEth: '1', error: null, ...status }; },
    playSfxCue() {}, requestLiteForgeNetwork: async () => false,
    // 2026-09-16 native entry fee wiring (disclosed in the modal; paid only when live).
    RANKED_ENTRY_FEE_ZKLTC: '0.1', formatZkLtcWei: (wei) => `${Number(BigInt(wei) / 1_000_000_000_000_000n) / 1000} zkLTC`,
    // Fee + settlement gas reserve rows (owner decision 2026-09-16).
    RANKED_SETTLEMENT_GAS_RESERVE_WEI: '20000000000000000', rankedEntryTotalWei: (fee, reserve = '20000000000000000') => (BigInt(fee) + BigInt(reserve)).toString(),
    LITVM_CONTRACT_ADDRESSES: { scoreSubmissionRegistry: `0x${'ab'.repeat(20)}` }, CURRENT_RANKED_SEASON_ID: 'fixture-season',
    createCanonicalSessionIdentity: async () => ({ sessionKey: `0x${'cd'.repeat(32)}` }),
    openRankedSession: async () => { throw new Error('No entry payment in modal tests'); }, explorerTxUrl: (hash) => `https://example.invalid/tx/${hash}`,
    classifyWalletError: (error) => ({ userCancelled: false, message: String(error?.message ?? error) }),
    el: (tag, options = {}) => Object.assign(element(), { tag }, options),
    appendText: (parent, tag, text) => { const child = Object.assign(element(), { tag, textContent: text }); parent.append(child); return child; },
  };
  const request = runInNewContext(`(${main.slice(fn.start, fn.end)})`, context);
  return { dom, calls, context, promise: request(session) };
}

test('live preflight binds the selected cabinet rather than assuming a default', async () => {
  const s = subject(); await tick();
  assert.equal(s.calls[0]?.options?.gameId, 'lester-blaster');
  s.dom.rankedEntryCancel.click(); assert.equal(await s.promise, false);
});

test('a funded but contract-blocked preflight cannot enable approval or ask for faucet funds', async () => {
  const s = subject({ status: { ok: false, hasFunds: true, errorKind: 'contract-gate', error: 'Ranked contract approval is missing.' } });
  await tick();
  assert.equal(s.dom.rankedEntryApprove.disabled, true);
  assert.match(s.dom.rankedEntryStatus.textContent, /approval is missing/i);
  assert.equal(s.dom.rankedEntryChainGuard.children.some(c => c.href), false);
  s.dom.rankedEntryCancel.click(); assert.equal(await s.promise, false);
});

test('an unexplained not-ok result cannot pass on chain and funds booleans alone', async () => {
  const s = subject({ status: { ok: false, onChain: true, hasFunds: true } }); await tick();
  assert.equal(s.dom.rankedEntryApprove.disabled, true);
  s.dom.rankedEntryCancel.click(); assert.equal(await s.promise, false);
});

test('the live path fails closed if its approval modal is missing', async () => {
  const s = subject({ missingModal: true });
  assert.equal(await s.promise, false);
  assert.deepEqual(s.calls, []);
});

test('local preview preserves no-network behavior and its truthful local wording', async () => {
  const s = subject({ live: false }); await tick();
  assert.deepEqual(s.calls, []);
  assert.equal(s.dom.rankedEntryApprove.disabled, false);
  assert.match(s.dom.rankedEntryStatus.textContent, /local ranked testnet preview/i);
  s.dom.rankedEntryApprove.click(); assert.equal(await s.promise, true);
});

test('a delayed readiness result cannot re-enable an already cancelled modal', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const s = subject({ pending });
  s.dom.rankedEntryCancel.click(); assert.equal(await s.promise, false);
  release({ ok: true, onChain: true, hasFunds: true, balanceEth: '1' }); await tick();
  assert.equal(s.dom.rankedEntryApprove.disabled, true);
});

test('approval cannot admit a different cabinet selected while its read was pending', async () => {
  const s = subject(); await tick();
  s.context.selectedGameId = 'chikun';
  s.dom.rankedEntryApprove.click();
  assert.equal(await s.promise, false);
});

test('the modal quotes fee, settlement reserve and total, then follows the contract quote once the live check passes', async () => {
  const session = { sessionId: 'game-session-000000042', entryFeeWei: '100000000000000000', canonicalContext: {}, seed: 1, sessionNonce: 1 };
  const preview = subject({ live: false, session });
  assert.deepEqual([preview.dom.rankedEntryFee.textContent, preview.dom.rankedEntryReserve.textContent, preview.dom.rankedEntryTotal.textContent], ['0.1 zkLTC', '0.02 zkLTC', '0.12 zkLTC']);
  preview.dom.rankedEntryCancel.click();
  await preview.promise;
  const live = subject({ session, status: { contractGate: { ok: true, entryFeeWei: 100000000000000000n, settlementGasReserveWei: 35000000000000000n, entryTotalWei: 135000000000000000n } } });
  await tick(); await tick();
  assert.deepEqual([live.dom.rankedEntryReserve.textContent, live.dom.rankedEntryTotal.textContent], ['0.035 zkLTC', '0.135 zkLTC'], 'the on-chain quote replaces the placeholder');
  assert.equal(live.dom.rankedEntryApprove.disabled, false);
  live.dom.rankedEntryCancel.click();
  await live.promise;
});

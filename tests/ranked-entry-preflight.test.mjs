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
function subject({ status = {}, live = true, missingModal = false, pending = null } = {}) {
  const dom = Object.fromEntries(['rankedEntryModal', 'rankedEntryWallet', 'rankedEntryNetwork', 'rankedEntryStatus', 'rankedEntryBalance', 'rankedEntryChainGuard', 'rankedEntryApprove', 'rankedEntryCancel'].map(k => [k, element()]));
  if (missingModal) dom.rankedEntryModal = null;
  const calls = [];
  const context = {
    dom, SETTLEMENT_LIVE: live, selectedGameId: 'lester-blaster', connectedWallet: `0x${'12'.repeat(20)}`,
    LITVM_LITEFORGE_NETWORK: { name: 'Fixture LiteForge', chainId: 4441, faucetUrl: 'https://example.invalid/faucet' },
    detectEthereumProvider: () => ({ request() { throw new Error('No real wallet in modal tests'); } }),
    checkRankedReadiness: async (provider, options) => { calls.push({ provider, options }); return pending ? pending : { ok: true, onChain: true, hasFunds: true, balanceEth: '1', error: null, ...status }; },
    playSfxCue() {}, requestLiteForgeNetwork: async () => false,
    el: (tag, options = {}) => Object.assign(element(), { tag }, options),
    appendText: (parent, tag, text) => { const child = Object.assign(element(), { tag, textContent: text }); parent.append(child); return child; },
  };
  const request = runInNewContext(`(${main.slice(fn.start, fn.end)})`, context);
  return { dom, calls, context, promise: request() };
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

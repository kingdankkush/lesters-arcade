import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

import { classifyWalletError, walletErrorAction } from '../apps/portal/src/wallet-auth.mjs';
import {
  ensureLiteForgeAtSignIn, fetchSeedTicket, formatZkLtc4, isRankedPaused, recordEntryBroadcast, seedTicketUsable,
  RANKED_CLOSED_MESSAGE, RANKED_ENTRY_EVENT, RANKED_PAUSED_MESSAGE, SEED_TICKET_MAX_AGE_MS,
} from '../apps/portal/src/ranked-entry-flow.mjs';
import { entryChipModel, mountEntryChip, balanceChipModel } from '../apps/portal/src/wallet-chips.mjs';
import * as rankedIdentity from '../apps/portal/src/ranked-identity.mjs';

const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });
const functionSource = (name) => {
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name);
  assert.ok(node, `main.js declares ${name}`);
  return main.slice(node.start, node.end);
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
// Waits for async work (WebCrypto hashing included) instead of counting ticks.
async function until(predicate, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}
const WALLET = `0x${'12'.repeat(20)}`;
const REGISTRY = '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55';

test('each wallet error kind maps to one message and one action', () => {
  const table = [
    [{ code: 4001, message: 'User rejected the request.' }, 'user-cancelled', 'You cancelled in your wallet. Nothing was charged.', ['Try again']],
    [new Error('Wrong network: wallet is on chain 1, expected 4441'), 'wrong-network', 'Your wallet is on another network.', ['Switch to LiteForge']],
    [{ code: 'INSUFFICIENT_FUNDS', shortMessage: 'insufficient funds for intrinsic transaction cost' }, 'insufficient-funds', 'You need about 0.0125 zkLTC. Balance 0.0100 zkLTC.', ['Get zkLTC', 'Re-check']],
    [new Error('A connected wallet is required to pay the Ranked entry.'), 'missing-wallet', null, ['Sign in']],
    [{ shortMessage: 'could not coalesce error', message: 'could not coalesce error (error={ "code": -32603 }, payload=…, code=UNKNOWN_ERROR, version=6.13.4)' }, 'wallet-error', 'could not coalesce error', ['Try again']],
  ];
  for (const [error, kind, message, labels] of table) {
    const action = walletErrorAction(classifyWalletError(error), { totalZkLtc: '0.0125', balanceZkLtc: '0.0100 zkLTC' });
    assert.equal(action.kind, kind);
    assert.equal(action.message, message, kind);
    assert.deepEqual(action.actions.map((entry) => entry.label), labels, kind);
  }
  assert.deepEqual(walletErrorAction(classifyWalletError({ code: 4001 })).actions.map((entry) => entry.id), ['retry']);
  assert.deepEqual(walletErrorAction({ kind: 'wrong-network' }).actions.map((entry) => entry.id), ['switch-network']);
  assert.deepEqual(walletErrorAction({ kind: 'insufficient-funds' }).actions.map((entry) => entry.id), ['faucet', 'recheck']);
  assert.deepEqual(walletErrorAction({ kind: 'missing-wallet' }).actions.map((entry) => entry.id), ['pick-wallet']);
  // An unknown kind is a wallet error with a short message, never a raw dump.
  const long = walletErrorAction({ kind: 'mystery', message: 'x'.repeat(400) });
  assert.equal(long.kind, 'wallet-error');
  assert.ok(long.message.length <= 140);
  // The amounts owed round up and balances round down.
  assert.equal(formatZkLtc4(102_000_000_000_000_001n, { roundUp: true }), '0.1021');
  assert.equal(formatZkLtc4(99_999_999_999_999_999n), '0.0999');
});

test('sign-in switches to 4441 once, with the explainer', async () => {
  // Pure step: already on LiteForge, no explainer and no switch.
  let explained = 0;
  let switched = 0;
  const onChain = await ensureLiteForgeAtSignIn({ readChainId: async () => '0x1159', explain: async () => { explained += 1; return true; }, requestNetwork: async () => { switched += 1; return true; } });
  assert.deepEqual({ ...onChain }, { onChain: true, explained: false, switched: false, declined: false, chainId: 4441 });
  assert.equal(explained + switched, 0);
  // Another chain: one explainer, then one switch request.
  const moved = await ensureLiteForgeAtSignIn({ readChainId: async () => '0x1', explain: async () => { explained += 1; return true; }, requestNetwork: async () => { switched += 1; return true; } });
  assert.deepEqual([moved.onChain, moved.switched, explained, switched], [true, true, 1, 1]);
  // The player says "Not now": no wallet prompt at all.
  const refused = await ensureLiteForgeAtSignIn({ readChainId: async () => '0x1', explain: async () => false, requestNetwork: async () => { throw new Error('must not be asked'); } });
  assert.deepEqual([refused.onChain, refused.declined, refused.explained], [false, true, true]);

  // The real main.js sign-in glue, VM-executed: accounts, the explainer, the
  // switch (falling back to add on 4902, via requestLiteForgeNetwork), then
  // SIWE. A refusal keeps the player signed in for Free play.
  const run = async ({ chain = '0x1', explainerAnswer = true, switchError = null } = {}) => {
    const order = [];
    let currentChain = chain;
    const provider = {
      async request({ method }) {
        order.push(method);
        if (method === 'eth_requestAccounts') return ['0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A'];
        if (method === 'eth_chainId') return currentChain;
        if (method === 'wallet_switchEthereumChain') {
          if (switchError) throw switchError;
          currentChain = '0x1159';
          return null;
        }
        if (method === 'wallet_addEthereumChain') { currentChain = '0x1159'; return null; }
        throw new Error(`unexpected ${method}`);
      },
    };
    const notices = [];
    const context = {
      connectedWallet: null, connectedAddress: null, connectedProvider: null, walletProviderPending: true, walletPickKind: null, walletPickRdns: null,
      walletConnector: 'none', walletAuthenticated: false, walletAuthChallenge: null, connectedChainId: null,
      LITVM_LITEFORGE_NETWORK: { name: 'LitVM LiteForge', chainId: 4441, chainIdHex: '0x1159', nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 }, rpcUrls: { http: 'https://liteforge.rpc.caldera.xyz/http' }, explorerUrl: 'https://liteforge.explorer.caldera.xyz' },
      ensureLiteForgeAtSignIn, classifyWalletError, walletErrorAction,
      loadWalletPicker: async () => ({ openChainExplainer: async () => { order.push('explainer'); return explainerAnswer; } }),
      authenticateWalletSiwe: async (walletProvider, address) => { order.push(`siwe:${address}`); context.walletAuthenticated = true; return true; },
      walletSession: { remember: (value) => order.push(`remember:${value.kind}:${value.rdns}`) },
      loadWalletSession: async () => context.walletSession,
      showWalletNotice: (message) => notices.push(message),
      bindWalletProviderEvents() {}, debugRuntimeLog() {}, connectPlayerAccount() {}, persistArcadeStateSoon() {}, render() {},
      pullProfileFromCloud: async () => {}, state: {}, document: {}, console,
    };
    const signIn = runInNewContext(`${functionSource('refreshInjectedChainId')}\n${functionSource('requestLiteForgeNetwork')}\n${functionSource('rememberPickedWallet')}\n${functionSource('signInWithWalletProvider')}\nsignInWithWalletProvider`, context);
    const wallet = await signIn(provider, { kind: 'eip6963', rdns: 'io.metamask' });
    return { wallet, order, notices, context };
  };
  const accepted = await run();
  assert.deepEqual(accepted.order, ['eth_requestAccounts', 'remember:eip6963:io.metamask', 'eth_chainId', 'explainer', 'wallet_switchEthereumChain', 'eth_chainId', 'siwe:0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A']);
  assert.equal(accepted.context.connectedChainId, '0x1159');
  assert.equal(accepted.context.walletProviderPending, false);
  assert.equal(accepted.context.connectedAddress, '0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A', 'SIWE gets the checksummed address');

  const added = await run({ switchError: Object.assign(new Error('Unrecognized chain'), { code: 4902 }) });
  assert.deepEqual(added.order.slice(0, 7), ['eth_requestAccounts', 'remember:eip6963:io.metamask', 'eth_chainId', 'explainer', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_chainId']);
  assert.equal(added.order.filter((method) => method === 'explainer').length, 1, 'one explainer');

  const refusedInApp = await run({ explainerAnswer: false });
  assert.deepEqual(refusedInApp.order, ['eth_requestAccounts', 'remember:eip6963:io.metamask', 'eth_chainId', 'explainer', 'siwe:0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A']);
  assert.equal(refusedInApp.wallet, '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a', 'still signed in for Free play');
  assert.equal(refusedInApp.context.walletConnector, 'injected-evm');
  assert.match(refusedInApp.notices.join(' '), /Free Mode works on any network/);

  const onLiteForge = await run({ chain: '0x1159' });
  assert.equal(onLiteForge.order.includes('explainer'), false, 'no explainer when the wallet is already on 4441');

  // A declined account request stays signed out with a clear message: no
  // simulated wallet takes over.
  const declinedContext = { ...(await run()).context, connectedWallet: null, walletConnector: 'none' };
  const notices = [];
  declinedContext.showWalletNotice = (message) => notices.push(message);
  const declinedSignIn = runInNewContext(`${functionSource('rememberPickedWallet')}\n${functionSource('signInWithWalletProvider')}\nsignInWithWalletProvider`, declinedContext);
  const result = await declinedSignIn({ request: async () => { throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); } }, { kind: 'legacy' });
  assert.equal(result, null);
  assert.equal(declinedContext.connectedWallet, null);
  assert.match(notices[0], /You cancelled in your wallet, so you are still signed out/);
  assert.doesNotMatch(functionSource('signInWithWalletProvider'), /connectMockWallet/);
  assert.match(functionSource('signInFromPicker'), /choice\?\.kind === 'simulated'\) \{\n\s*if \(allowSimulated\) return connectMockWallet\(\);/, 'the simulated identity only when no wallet exists');
  assert.match(functionSource('connectWallet'), /return signInFromPicker\(\);/);
});

test('the entry chip goes pending, then confirmed or failed', async () => {
  assert.deepEqual({ ...entryChipModel('broadcast') }, { status: 'broadcast', tone: 'pending', text: 'Entry confirming…', dismissable: false, autoHideMs: 0 });
  assert.equal(entryChipModel('confirmed').tone, 'ok');
  assert.equal(entryChipModel('failed').text, 'Entry didn’t go through. This run is practice and won’t be ranked.');

  // recordEntryBroadcast writes the §7.6 fields and announces broadcast, then the outcome.
  for (const [outcome, expected] of [[() => ({ status: 'confirmed', blockNumber: 5 }), 'confirmed'], [() => ({ status: 'failed', blockNumber: 5 }), 'failed'], [() => Promise.reject(new Error('rpc down')), 'failed']]) {
    const events = [];
    const target = new EventTarget();
    target.addEventListener(RANKED_ENTRY_EVENT, (event) => events.push(event.detail));
    // The chip, on a minimal DOM, follows the same events.
    const doc = chipDocument();
    const session = { sessionId: 'game-session-1', canonicalContext: { gameId: 'chikun' } };
    let release;
    const confirmation = new Promise((resolve) => { release = resolve; });
    recordEntryBroadcast(session, { txHash: '0xabc', sessionId32: `0x${'cd'.repeat(32)}`, amountWei: 12_000_000_000_000_000n, wait: () => confirmation }, { eventTarget: target });
    const chip = mountEntryChip({ documentRef: doc, eventTarget: target, sessionId: 'game-session-1', status: 'broadcast' });
    assert.deepEqual(session.entryReceipt, { txHash: '0xabc', sessionId32: `0x${'cd'.repeat(32)}`, amountWei: '12000000000000000', status: 'pending' });
    assert.deepEqual(events, [{ sessionId: 'game-session-1', gameId: 'chikun', status: 'broadcast', txHash: '0xabc' }]);
    assert.equal(chip.element.dataset.state, 'pending');
    assert.equal(chip.element.children[0].textContent, 'Entry confirming…');
    release(outcome());
    assert.equal(await session.entryConfirmed, expected);
    assert.equal(session.entryReceipt.status, expected);
    assert.deepEqual(events.map((detail) => detail.status), ['broadcast', expected]);
    assert.equal(chip.element.dataset.state, expected === 'confirmed' ? 'ok' : 'error');
    chip.remove();
  }
  // Another session's events do not move this chip.
  const target = new EventTarget();
  const chip = mountEntryChip({ documentRef: chipDocument(), eventTarget: target, sessionId: 'mine' });
  target.dispatchEvent(Object.assign(new Event(RANKED_ENTRY_EVENT), { detail: { sessionId: 'other', status: 'failed' } }));
  assert.equal(chip.element.dataset.status, 'broadcast');
  chip.remove();

  // The balance chip offers the faucet below one entry plus gas.
  assert.deepEqual({ ...balanceChipModel({ balanceWei: 50_000_000_000_000_000n, needWei: 102_500_000_000_000_000n }) }, { text: '0.0500 zkLTC', low: true, faucetUrl: 'https://liteforge.hub.caldera.xyz' });
  assert.equal(balanceChipModel({ balanceWei: 10n ** 18n, needWei: 102_500_000_000_000_000n }).faucetUrl, null);
});

function chipDocument() {
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.parent = null; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener() {}
    querySelector(selector) { return selector === 'button' ? this.children.find((child) => child.tagName === 'button') ?? null : null; }
  }
  const head = new Node('head');
  return { head, body: new Node('body'), createElement: (tag) => new Node(tag), getElementById: (id) => head.children.find((child) => child.id === id) ?? null, querySelector: () => null };
}

// requestRankedEntry, VM-executed with the live flag on and fakes for the
// network, the wallet and the DOM (the committed flag stays false).
function element() {
  const listeners = new Map();
  return { hidden: true, disabled: false, textContent: '', dataset: {}, children: [],
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    click() { if (!this.disabled) return listeners.get('click')?.(); return undefined; },
  };
}

function pendingRankedSession() {
  const uuid = '3f2b8c1e-9d4a-4b7e-8c21-5a6f7e8d9c0b';
  const sessionId = `game-session-${uuid}`;
  return {
    sessionId, sessionNonce: uuid, seasonId: 'hmh-season-1-2026', seed: 12345, entryFeeWei: '10000000000000000',
    canonicalContext: Object.freeze({ sessionId, wallet: WALLET, gameId: 'lester-blaster', buildHash: 'site-1.7.0:game-1.7.0', seasonId: 'hmh-season-1-2026', seed: 12345 }),
  };
}

const TICKET = Object.freeze({ v: 'lesters-ranked-seed-v1', salt: 'ab'.repeat(16), issuedAt: 1_790_000_000, mac: 'cd'.repeat(32) });

const FUNDED = Object.freeze({
  ok: true, onChain: true, chainId: 4441, hasFunds: true, balanceWei: 10n ** 18n, balanceEth: '1', needWei: 12_500_000_000_000_000n, error: null,
  contractGate: Object.freeze({ ok: true, entryFeeWei: 10_000_000_000_000_000n, settlementGasReserveWei: 2_000_000_000_000_000n, entryTotalWei: 12_000_000_000_000_000n, rankedEntryAddress: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190' }),
});
const FAUCET = 'https://liteforge.hub.caldera.xyz';

// `readiness` is one checkRankedReadiness result, or a list answered in turn
// (the last one repeats). `send` replaces the broadcast fake.
function liveModal({ seedResponses = [], session = pendingRankedSession(), signInOk = true, live = true, authenticated = true, readiness = FUNDED, send = null, peek = null } = {}) {
  const dom = Object.fromEntries(['rankedEntryModal', 'rankedEntryWallet', 'rankedEntryNetwork', 'rankedEntryStatus', 'rankedEntryBalance', 'rankedEntryChainGuard', 'rankedEntryApprove', 'rankedEntryCancel', 'rankedEntryFee', 'rankedEntryReserve', 'rankedEntryTotal'].map((key) => [key, element()]));
  const freeLink = element();
  dom.rankedEntryModal.querySelector = (selector) => (selector === '#rankedEntryFreeLink' ? freeLink : null);
  const order = [];
  const walletCalls = [];
  const events = [];
  const starts = [];
  const notices = [];
  const pickers = [];
  const switches = [];
  const checks = [];
  const tokenWallets = [];
  const eventTarget = new EventTarget();
  eventTarget.addEventListener(RANKED_ENTRY_EVENT, (event) => events.push(event.detail));
  let confirm;
  const confirmation = new Promise((resolve) => { confirm = resolve; });
  const responses = [...seedResponses];
  const readinessQueue = Array.isArray(readiness) ? [...readiness] : [readiness];
  const provider = { request: async (request) => { walletCalls.push(request.method); throw new Error('no wallet call expected'); } };
  const context = {
    dom, SETTLEMENT_LIVE: live, selectedGameId: 'lester-blaster', connectedWallet: WALLET, connectedAddress: WALLET, walletAuthenticated: authenticated,
    LITVM_LITEFORGE_NETWORK: { name: 'Fixture LiteForge', chainId: 4441, faucetUrl: FAUCET },
    LITVM_CONTRACT_ADDRESSES: { scoreSubmissionRegistry: REGISTRY },
    detectEthereumProvider: () => provider,
    checkRankedReadiness: async (walletProvider, options) => {
      checks.push(options);
      const next = readinessQueue.length > 1 ? readinessQueue.shift() : readinessQueue[0];
      return typeof next === 'function' ? next() : next;
    },
    playSfxCue() {}, requestLiteForgeNetwork: async (walletProvider) => { switches.push(walletProvider); return context.switchResult ?? true; },
    RANKED_ENTRY_FEE_ZKLTC: '0.01', formatZkLtcWei: (wei) => `${Number(BigInt(wei) / 1_000_000_000_000_000n) / 1000} zkLTC`,
    RANKED_SETTLEMENT_GAS_RESERVE_WEI: '2000000000000000', rankedEntryTotalWei: (fee) => (BigInt(fee) + 2_000_000_000_000_000n).toString(),
    ensureWalletStylesheet() {}, peekRankedPreflight: () => peek,
    formatZkLtc4, walletErrorAction, classifyWalletError, RANKED_PAUSED_MESSAGE, RANKED_CLOSED_MESSAGE, isRankedPaused, seedTicketUsable,
    fetchSeedTicket: async ({ token, session: pending }) => {
      order.push(`seed:${token}:${pending.sessionId === session.sessionId}`);
      return responses.shift() ?? { ok: false, status: 0, error: 'network' };
    },
    walletSession: {
      token: (wallet) => { tokenWallets.push(wallet); return context.currentToken; },
      invalidate: () => { order.push('invalidate'); context.currentToken = null; },
    },
    loadWalletSession: async () => context.walletSession,
    currentToken: 'token-1',
    authenticateWalletSiwe: async () => { order.push('siwe'); if (signInOk) context.currentToken = 'token-2'; context.walletAuthenticated = signInOk; return signInOk; },
    loadRankedIdentity: async () => ({
      applySeedTicket: (pending, ticket) => { order.push(`apply:${ticket.seed}`); return rankedIdentity.applySeedTicket(pending, ticket); },
      rankedIdentityFor: (pending, options) => { order.push(`identity:${pending.seed}`); return rankedIdentity.rankedIdentityFor(pending, options); },
      rankedSessionKey: async (identity) => { const key = await rankedIdentity.rankedSessionKey(identity); order.push('key'); return key; },
    }),
    sendRankedEntry: async (walletProvider, options) => {
      order.push('send');
      context.sentWith = options;
      if (send) return send(options);
      return { txHash: '0xfeed', sessionId32: options.sessionKey, amountWei: 12_000_000_000_000_000n, paid: true, wait: () => confirmation };
    },
    recordEntryBroadcast, showEntryChip: (pending) => order.push(`chip:${pending.entryReceipt.status}`), refreshWalletBalanceChip() {},
    startOfficialMode: async (mode) => { starts.push(mode); }, signInFromPicker: async (options) => { pickers.push(options); return null; },
    showWalletNotice: (message) => notices.push(message), window: eventTarget,
    // integration-glue B11: closing the modal lets the cabinet View results button return.
    syncCabinetResultsButton: () => { context.cabinetSyncs = (context.cabinetSyncs ?? 0) + 1; },
    el: (tag, options = {}) => Object.assign(element(), { tag }, options),
    appendText: (parent, tag, text) => { const child = Object.assign(element(), { tag, textContent: text }); parent.append(child); return child; },
  };
  const request = runInNewContext(`(${functionSource('requestRankedEntry')})`, context);
  const promise = request(session);
  let resolved;
  promise.then((value) => { resolved = value; });
  return {
    dom, order, walletCalls, events, context, session, confirm, promise, starts, notices, pickers, switches, checks, tokenWallets, freeLink, provider,
    get resolved() { return resolved; },
  };
}

test('live entry fetches and applies a seed ticket before computing the key', async () => {
  const modal = liveModal({ seedResponses: [{ ok: true, status: 200, seed: 987654321, seedTicket: TICKET, fetchedAt: Date.now(), sessionId: pendingRankedSession().sessionId }] });
  await until(() => !modal.dom.rankedEntryApprove.disabled, 'the live check');
  assert.equal(modal.dom.rankedEntryApprove.disabled, false, 'the live check passed');
  assert.deepEqual(modal.order, ['seed:token-1:true'], 'the ticket is prefetched when the modal opens, with the Bearer token');
  assert.equal(modal.dom.rankedEntryTotal.textContent, '0.012 zkLTC');
  modal.dom.rankedEntryApprove.click();
  let resolved = null;
  modal.promise.then((value) => { resolved = value; });
  await until(() => resolved !== null, 'the entry broadcast');
  // The prefetched ticket is reused (fresh), applied before the identity and the key.
  assert.deepEqual(modal.order, ['seed:token-1:true', 'apply:987654321', 'identity:987654321', 'key', 'send', 'chip:pending']);
  assert.equal(modal.session.seed, 987654321);
  assert.equal(modal.session.canonicalContext.seed, 987654321);
  assert.deepEqual({ ...modal.session.seedTicket }, { ...TICKET });
  const expectedKey = await rankedIdentity.rankedSessionKey(rankedIdentity.rankedIdentityFor(modal.session, { scoreRegistryAddress: REGISTRY }));
  assert.equal(modal.context.sentWith.sessionKey, expectedKey, 'the paid key binds the ticket seed');
  assert.equal(modal.context.sentWith.preflight.entryTotalWei, 12_000_000_000_000_000n, 'the fresh quote goes with the entry');
  assert.equal(modal.context.sentWith.expectedWallet, WALLET, 'the entry may only be paid by the wallet the key binds');
  assert.deepEqual(modal.tokenWallets, [WALLET], 'the Bearer token of the bound wallet');
  // The run starts on broadcast, before the confirmation.
  assert.equal(resolved, true);
  assert.equal(modal.dom.rankedEntryModal.hidden, true);
  assert.deepEqual(modal.session.entryReceipt, { txHash: '0xfeed', sessionId32: expectedKey, amountWei: '12000000000000000', status: 'pending' });
  assert.deepEqual(modal.events.map((detail) => detail.status), ['broadcast']);
  modal.confirm({ status: 'confirmed', blockNumber: 3 });
  assert.equal(await modal.session.entryConfirmed, 'confirmed');
  assert.deepEqual(modal.events.map((detail) => detail.status), ['broadcast', 'confirmed']);
  assert.deepEqual(modal.walletCalls, [], 'the fakes stand in for every wallet call');

  // A stale prefetched ticket (older than 10 minutes) is fetched again at approval.
  const stale = liveModal({ seedResponses: [
    { ok: true, status: 200, seed: 1, seedTicket: TICKET, fetchedAt: Date.now() - SEED_TICKET_MAX_AGE_MS - 1, sessionId: pendingRankedSession().sessionId },
    { ok: true, status: 200, seed: 2, seedTicket: TICKET, fetchedAt: Date.now(), sessionId: pendingRankedSession().sessionId },
  ] });
  await until(() => !stale.dom.rankedEntryApprove.disabled && stale.order.length === 1, 'the stale modal check');
  stale.dom.rankedEntryApprove.click();
  await until(() => stale.order.includes('send'), 'the stale entry send');
  assert.deepEqual(stale.order.slice(0, 3), ['seed:token-1:true', 'seed:token-1:true', 'apply:2']);
  assert.equal(await stale.promise, true);

  // A 401 re-runs sign-in once (from this click), then the ticket is fetched with the new token.
  const expired = liveModal({ seedResponses: [
    { ok: false, status: 401, error: 'invalid-session' },
    { ok: false, status: 401, error: 'invalid-session' },
    { ok: true, status: 200, seed: 3, seedTicket: TICKET, fetchedAt: Date.now(), sessionId: pendingRankedSession().sessionId },
  ] });
  await until(() => !expired.dom.rankedEntryApprove.disabled && expired.order.length === 1, 'the expired modal check');
  expired.dom.rankedEntryApprove.click();
  await until(() => expired.order.includes('send'), 'the re-signed entry send');
  assert.deepEqual(expired.order.slice(0, 5), ['seed:token-1:true', 'seed:token-1:true', 'invalidate', 'siwe', 'seed:token-2:true']);
  assert.equal(expired.order.filter((step) => step === 'siwe').length, 1, 'sign-in runs once');
  assert.equal(await expired.promise, true);

  // The seed endpoint contract: POST, Bearer, no-store, the pending session's identity fields.
  const seen = [];
  const ticket = await fetchSeedTicket({
    token: 'abc', session: pendingRankedSession(), now: () => 42,
    fetchImpl: async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify({ ok: true, seed: 7, seedTicket: TICKET }), { status: 200 }); },
  });
  assert.equal(seen[0].url, '/api/ranked/seed');
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(seen[0].init.cache, 'no-store');
  assert.equal(seen[0].init.headers.authorization, 'Bearer abc');
  assert.deepEqual(JSON.parse(seen[0].init.body), { gameId: 'lester-blaster', sessionId: pendingRankedSession().sessionId, seasonId: 'hmh-season-1-2026', buildHash: 'site-1.7.0:game-1.7.0' });
  assert.deepEqual([ticket.ok, ticket.seed, ticket.fetchedAt], [true, 7, 42]);
});

test('a paused seed service stops the entry before any wallet prompt', async () => {
  for (const error of ['settlement-paused', 'settlement-not-configured']) {
    // Detected by the prefetch when the modal opens.
    const early = liveModal({ seedResponses: [{ ok: false, status: 503, error }] });
    assert.equal(await early.promise, false);
    await tick(); await tick(); await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(early.dom.rankedEntryStatus.textContent, 'Ranked is paused right now. Free Mode is open.');
    assert.equal(early.dom.rankedEntryApprove.disabled, true, 'the readiness check cannot re-enable a paused entry');
    early.dom.rankedEntryApprove.click();
    await tick();
    assert.equal(early.order.includes('send'), false);
    assert.deepEqual(early.walletCalls, []);

    // Detected at approval (the prefetch failed on the network).
    const late = liveModal({ seedResponses: [{ ok: false, status: 0, error: 'network' }, { ok: false, status: 503, error }] });
    await until(() => !late.dom.rankedEntryApprove.disabled, 'the late modal check');
    late.dom.rankedEntryApprove.click();
    assert.equal(await late.promise, false);
    assert.equal(late.dom.rankedEntryStatus.textContent, RANKED_PAUSED_MESSAGE);
    assert.deepEqual(late.order, ['seed:token-1:true', 'seed:token-1:true'], 'no key, no send, no wallet prompt');
    assert.deepEqual(late.walletCalls, []);
  }
  assert.equal(isRankedPaused({ status: 503 }), true);
  assert.equal(isRankedPaused({ status: 401, error: 'invalid-session' }), false);
});

const OTHER = `0x${'34'.repeat(20)}`;
const freshTicket = (seed = 42) => ({ ok: true, status: 200, seed, seedTicket: TICKET, fetchedAt: Date.now(), sessionId: pendingRankedSession().sessionId });
const approveEnabled = (modal) => !modal.dom.rankedEntryApprove.disabled;

test('a wallet that switched accounts never pays the key bound to the old account', async () => {
  // Switched while the modal was open (accountsChanged moved connectedWallet).
  const modal = liveModal({ seedResponses: [freshTicket()] });
  await until(() => approveEnabled(modal), 'the live check');
  modal.context.connectedWallet = OTHER;
  modal.dom.rankedEntryApprove.click();
  assert.equal(await modal.promise, false);
  assert.deepEqual(modal.order, ['seed:token-1:true'], 'no identity, no key, no send');
  assert.deepEqual(modal.starts, ['ranked'], 'Ranked starts again with a session for the new account');
  assert.match(modal.notices[0], /switched accounts/);
  assert.equal(modal.dom.rankedEntryModal.hidden, true);
  assert.deepEqual(modal.walletCalls, []);

  // Switched while the approval was fetching the seed ticket.
  let release;
  const slow = liveModal({ seedResponses: [{ ok: false, status: 0, error: 'network' }, new Promise((resolve) => { release = resolve; })] });
  await until(() => approveEnabled(slow) && slow.order.length === 1, 'the slow modal check');
  slow.dom.rankedEntryApprove.click();
  await until(() => slow.order.length === 2, 'the approval seed fetch');
  slow.context.connectedWallet = OTHER;
  release(freshTicket());
  assert.equal(await slow.promise, false);
  assert.equal(slow.order.some((step) => step === 'send' || step === 'key' || step.startsWith('identity')), false);
  assert.deepEqual(slow.starts, ['ranked']);
  assert.ok(slow.tokenWallets.length > 0 && slow.tokenWallets.every((wallet) => wallet === WALLET), 'the Bearer token is always the bound wallet one');

  // The wallet locked (signed out): the modal closes without a restart.
  const locked = liveModal({ seedResponses: [freshTicket()] });
  await until(() => approveEnabled(locked), 'the locked modal check');
  locked.context.connectedWallet = null;
  locked.dom.rankedEntryApprove.click();
  assert.equal(await locked.promise, false);
  assert.deepEqual(locked.starts, []);

  // The key is sent with the bound wallet; a signer on another account is
  // refused by sendRankedEntry. Before the page has seen the switch that is a
  // wallet error with Try again; once it has, Ranked starts again.
  const mismatch = () => { throw Object.assign(new Error('Your wallet switched accounts. The entry was not sent.'), { code: 'ACCOUNT_MISMATCH' }); };
  const atSend = liveModal({ seedResponses: [freshTicket()], send: mismatch });
  await until(() => approveEnabled(atSend), 'the send modal check');
  atSend.dom.rankedEntryApprove.click();
  await until(() => atSend.dom.rankedEntryStatus.textContent === 'Your wallet switched accounts. The entry was not sent.', 'the mismatch message');
  assert.equal(atSend.context.sentWith.expectedWallet, WALLET);
  assert.equal(atSend.dom.rankedEntryApprove.textContent, 'Try again');
  assert.deepEqual(atSend.starts, []);
  atSend.context.connectedWallet = OTHER;
  atSend.dom.rankedEntryApprove.click();
  assert.equal(await atSend.promise, false);
  assert.deepEqual(atSend.starts, ['ranked']);
});

test('a paused answer to the prefetch stops an approval already in progress', async () => {
  let release;
  const modal = liveModal({ seedResponses: [new Promise((resolve) => { release = resolve; })] });
  await until(() => approveEnabled(modal), 'the live check');
  modal.dom.rankedEntryApprove.click(); // the prefetch is still in flight
  await tick();
  assert.equal(modal.dom.rankedEntryStatus.textContent, 'Preparing your Ranked session…');
  release({ ok: false, status: 503, error: 'settlement-paused' });
  assert.equal(await modal.promise, false);
  await until(() => modal.dom.rankedEntryStatus.textContent === RANKED_PAUSED_MESSAGE, 'the paused message');
  await tick(); await tick();
  assert.deepEqual(modal.order, ['seed:token-1:true'], 'the approval waited for the prefetch: no second fetch, no key, no send');
  assert.deepEqual(modal.walletCalls, []);
  assert.equal(modal.dom.rankedEntryApprove.disabled, true);

  // A slow prefetch that succeeds is the ticket the waiting approval uses.
  let ready;
  const reused = liveModal({ seedResponses: [new Promise((resolve) => { ready = resolve; })] });
  await until(() => approveEnabled(reused), 'the reused modal check');
  reused.dom.rankedEntryApprove.click();
  await tick();
  ready(freshTicket(7));
  assert.equal(await reused.promise, true);
  assert.deepEqual(reused.order.slice(0, 2), ['seed:token-1:true', 'apply:7']);
});

test('a funds error at send shows the balance and total the check read, rounded honestly', async () => {
  const insufficient = () => { throw Object.assign(new Error('insufficient funds for intrinsic transaction cost'), { code: 'INSUFFICIENT_FUNDS' }); };
  const modal = liveModal({ seedResponses: [freshTicket()], readiness: { ...FUNDED, balanceWei: 500_000_000_000_000_000n, needWei: 12_500_000_000_000_001n }, send: insufficient });
  await until(() => approveEnabled(modal), 'the live check');
  assert.equal(modal.dom.rankedEntryBalance.textContent, '0.5000 zkLTC');
  modal.dom.rankedEntryApprove.click();
  await until(() => !modal.dom.rankedEntryChainGuard.hidden, 'the funds guard');
  assert.equal(modal.dom.rankedEntryChainGuard.children[0].textContent, 'You need about 0.0126 zkLTC. Balance 0.5000 zkLTC.', 'not "Balance unknown"');

  // Unfunded at the check: the balance rounds down and the amount owed up, so
  // a small shortfall never reads as enough. Get zkLTC links the faucet and
  // Re-check reads again.
  const short = liveModal({ readiness: [{ ...FUNDED, ok: false, hasFunds: false, errorKind: 'insufficient-funds', balanceWei: 12_499_999_999_999_999n, needWei: 12_500_000_000_000_000n }, FUNDED] });
  await until(() => !short.dom.rankedEntryChainGuard.hidden, 'the unfunded guard');
  const [message, actions] = short.dom.rankedEntryChainGuard.children;
  assert.equal(message.textContent, 'You need about 0.0125 zkLTC. Balance 0.0124 zkLTC.');
  assert.equal(short.dom.rankedEntryBalance.textContent, '0.0124 zkLTC');
  const [faucet, recheck] = actions.children;
  assert.deepEqual([faucet.tag, faucet.textContent, faucet.href, faucet.target, faucet.rel], ['a', 'Get zkLTC', FAUCET, '_blank', 'noopener noreferrer']);
  assert.equal(recheck.textContent, 'Re-check');
  assert.equal(short.dom.rankedEntryApprove.disabled, true);
  recheck.click();
  await until(() => approveEnabled(short), 'the re-check');
  assert.equal(short.checks.length, 2);
  short.dom.rankedEntryCancel.click();
  assert.equal(await short.promise, false);
});

test('the wrong-network guard switches to LiteForge from its button, then checks again', async () => {
  const modal = liveModal({ readiness: [{ ok: false, onChain: false, chainId: 1, hasFunds: false, error: null }, FUNDED] });
  await until(() => !modal.dom.rankedEntryChainGuard.hidden, 'the network guard');
  const [message, detail, switchButton] = modal.dom.rankedEntryChainGuard.children;
  assert.equal(message.textContent, 'Your wallet is on another network.');
  assert.match(detail.textContent, /Ranked runs on Fixture LiteForge \(4441\)\. Your wallet is on chain 1\./);
  assert.equal(switchButton.textContent, 'Switch to LiteForge');
  assert.equal(modal.dom.rankedEntryApprove.disabled, true);
  // A refused switch keeps the button.
  modal.context.switchResult = false;
  await switchButton.click();
  assert.equal(switchButton.textContent, 'Switch to LiteForge');
  assert.equal(modal.checks.length, 1);
  modal.context.switchResult = true;
  await switchButton.click();
  await until(() => approveEnabled(modal), 'the re-check after the switch');
  assert.equal(modal.switches.length, 2);
  assert.ok(modal.switches.every((walletProvider) => walletProvider === modal.provider), 'requestLiteForgeNetwork on the modal wallet');
  assert.equal(modal.checks.length, 2);
  modal.dom.rankedEntryCancel.click();
  assert.equal(await modal.promise, false);
});

test('a readiness read that fails offers Try again', async () => {
  const modal = liveModal({ readiness: [{ ...FUNDED, ok: false, error: 'could not coalesce error', errorKind: 'wallet-error' }, { ...FUNDED, ok: false }, FUNDED] });
  await until(() => !modal.dom.rankedEntryChainGuard.hidden, 'the retry guard');
  assert.equal(modal.dom.rankedEntryStatus.textContent, 'could not coalesce error');
  assert.equal(modal.dom.rankedEntryChainGuard.children[0].textContent, 'Try again');
  assert.equal(modal.dom.rankedEntryApprove.disabled, true);
  modal.dom.rankedEntryChainGuard.children[0].click();
  await until(() => modal.dom.rankedEntryStatus.textContent === 'Ranked prerequisites could not be verified.', 'the second read');
  assert.equal(modal.dom.rankedEntryChainGuard.children[0].textContent, 'Try again');
  modal.dom.rankedEntryChainGuard.children[0].click();
  await until(() => approveEnabled(modal), 'the third read');
  assert.equal(modal.checks.length, 3);
  modal.dom.rankedEntryCancel.click();
  assert.equal(await modal.promise, false);
});

test('a zero quote or a fee-less live session closes Ranked before any wallet prompt', async () => {
  const zeroGate = { ...FUNDED.contractGate, entryFeeWei: 0n, settlementGasReserveWei: 0n, entryTotalWei: 0n };
  const zero = liveModal({ seedResponses: [freshTicket()], readiness: { ...FUNDED, contractGate: zeroGate } });
  assert.equal(await zero.promise, false);
  await until(() => zero.dom.rankedEntryStatus.textContent === RANKED_CLOSED_MESSAGE, 'the closed message');
  assert.equal(zero.dom.rankedEntryApprove.disabled, true);
  zero.dom.rankedEntryApprove.click();
  await tick();
  assert.equal(zero.order.includes('send'), false);

  // A live session without a fee: closed at approval, no ticket, no wallet.
  const feeless = liveModal({ session: { ...pendingRankedSession(), entryFeeWei: '0' } });
  await until(() => approveEnabled(feeless), 'the fee-less check');
  feeless.dom.rankedEntryApprove.click();
  assert.equal(await feeless.promise, false);
  assert.equal(feeless.dom.rankedEntryStatus.textContent, RANKED_CLOSED_MESSAGE);
  assert.deepEqual(feeless.order, []);

  // The fee went off between the check and the click: sendRankedEntry refuses.
  const refused = liveModal({ seedResponses: [freshTicket()], send: () => { throw Object.assign(new Error('closed'), { code: 'RANKED_ENTRY_CLOSED' }); } });
  await until(() => approveEnabled(refused), 'the refused check');
  refused.dom.rankedEntryApprove.click();
  assert.equal(await refused.promise, false);
  await until(() => refused.dom.rankedEntryStatus.textContent === RANKED_CLOSED_MESSAGE, 'closed after send refused');
});

test('a vanished wallet provider opens the picker instead of just closing', async () => {
  const modal = liveModal({ seedResponses: [freshTicket()], send: () => { throw new Error('A connected wallet is required to pay the Ranked entry.'); } });
  await until(() => approveEnabled(modal), 'the live check');
  modal.dom.rankedEntryApprove.click();
  assert.equal(await modal.promise, false);
  assert.equal(modal.dom.rankedEntryModal.hidden, true);
  assert.deepEqual(JSON.parse(JSON.stringify(modal.pickers)), [{ allowSimulated: false }], 'the picker, never the simulated identity');
});

test('the cached pre-flight quote shows at once, then the fresh check replaces it', async () => {
  let release;
  const modal = liveModal({
    seedResponses: [freshTicket()],
    readiness: () => new Promise((resolve) => { release = resolve; }),
    peek: { entryTotalWei: 135_000_000_000_000_000n, settlementGasReserveWei: 35_000_000_000_000_000n, balanceWei: 50_000_000_000_000_000n },
  });
  // Synchronously, before any read answers.
  assert.deepEqual([modal.dom.rankedEntryReserve.textContent, modal.dom.rankedEntryTotal.textContent, modal.dom.rankedEntryBalance.textContent], ['0.035 zkLTC', '0.135 zkLTC', '0.0500 zkLTC']);
  assert.equal(modal.dom.rankedEntryApprove.disabled, true, 'a cached quote alone never enables payment');
  await until(() => typeof release === 'function', 'the fresh check');
  release(FUNDED);
  await until(() => approveEnabled(modal), 'the fresh check result');
  assert.deepEqual([modal.dom.rankedEntryTotal.textContent, modal.dom.rankedEntryBalance.textContent], ['0.012 zkLTC', '1.0000 zkLTC']);
  modal.dom.rankedEntryCancel.click();
  assert.equal(await modal.promise, false);
});

test('a player who has not signed in signs from the modal button, then plays', async () => {
  // Live: no seed ticket before the login; the first click signs, the second pays.
  const live = liveModal({ authenticated: false, seedResponses: [freshTicket()] });
  await until(() => live.checks.length === 1 && approveEnabled(live), 'the live check');
  assert.equal(live.dom.rankedEntryApprove.textContent, 'Sign in');
  assert.match(live.dom.rankedEntryStatus.textContent, /Sign in with your wallet to play Ranked\. The signature is free/);
  assert.deepEqual(live.order, [], 'no seed ticket before the login');
  live.dom.rankedEntryApprove.click();
  await until(() => live.order.includes('seed:token-2:true'), 'the prefetch after sign-in');
  assert.deepEqual(live.order.slice(0, 2), ['siwe', 'seed:token-2:true']);
  assert.equal(live.dom.rankedEntryStatus.textContent, '✓ Signed in.');
  assert.equal(live.dom.rankedEntryApprove.textContent, 'Confirm entry');
  live.dom.rankedEntryApprove.click();
  assert.equal(await live.promise, true);
  assert.ok(live.order.includes('send'));

  // Declined: still signed out, no ticket, still "Sign in".
  const declined = liveModal({ authenticated: false, signInOk: false });
  await until(() => declined.checks.length === 1 && approveEnabled(declined), 'the declined check');
  declined.dom.rankedEntryApprove.click();
  await until(() => declined.order.includes('siwe') && approveEnabled(declined), 'the declined sign-in');
  assert.deepEqual(declined.order, ['siwe']);
  assert.equal(declined.dom.rankedEntryApprove.textContent, 'Sign in');
  assert.match(declined.dom.rankedEntryStatus.textContent, /The signature is free and sends no transaction/);
  assert.equal(declined.resolved, undefined, 'the modal stays open');
  declined.dom.rankedEntryCancel.click();
  assert.equal(await declined.promise, false);

  // Preview: sign in, then start the local run, with no network at all.
  const preview = liveModal({ live: false, authenticated: false });
  assert.equal(preview.dom.rankedEntryApprove.textContent, 'Sign in');
  assert.match(preview.dom.rankedEntryStatus.textContent, /Local Ranked Testnet preview\. The signature is free/);
  preview.dom.rankedEntryApprove.click();
  await until(() => preview.dom.rankedEntryApprove.textContent === 'Start Ranked Run' && approveEnabled(preview), 'the preview sign-in');
  assert.equal(preview.dom.rankedEntryStatus.textContent, '✓ Signed in. Start your Ranked preview run.');
  preview.dom.rankedEntryApprove.click();
  assert.equal(await preview.promise, true);
  assert.deepEqual(preview.order, ['siwe']);
  assert.deepEqual(preview.checks, [], 'preview reads nothing');

  const previewDeclined = liveModal({ live: false, authenticated: false, signInOk: false });
  previewDeclined.dom.rankedEntryApprove.click();
  await until(() => previewDeclined.order.includes('siwe') && approveEnabled(previewDeclined), 'the declined preview sign-in');
  assert.equal(previewDeclined.dom.rankedEntryApprove.textContent, 'Sign in');
  assert.equal(previewDeclined.resolved, undefined);
});

test('the "Free Mode is always free" link closes the modal and starts Free', async () => {
  const modal = liveModal({ seedResponses: [freshTicket()] });
  modal.freeLink.click();
  assert.equal(await modal.promise, false);
  assert.deepEqual(modal.starts, ['free']);
  assert.equal(modal.dom.rankedEntryModal.hidden, true);
  await tick();
  assert.equal(modal.order.includes('send'), false);
});

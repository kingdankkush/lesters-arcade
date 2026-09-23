import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

import { classifyWalletError, walletErrorAction } from '../apps/portal/src/wallet-auth.mjs';
import {
  ensureLiteForgeAtSignIn, fetchSeedTicket, formatZkLtc4, isRankedPaused, recordEntryBroadcast, seedTicketUsable,
  RANKED_ENTRY_EVENT, RANKED_PAUSED_MESSAGE, SEED_TICKET_MAX_AGE_MS,
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
    [{ code: 'INSUFFICIENT_FUNDS', shortMessage: 'insufficient funds for intrinsic transaction cost' }, 'insufficient-funds', 'You need about 0.1025 zkLTC. Balance 0.0100 zkLTC.', ['Get zkLTC', 'Re-check']],
    [new Error('A connected wallet is required to pay the Ranked entry.'), 'missing-wallet', null, ['Sign in']],
    [{ shortMessage: 'could not coalesce error', message: 'could not coalesce error (error={ "code": -32603 }, payload=…, code=UNKNOWN_ERROR, version=6.13.4)' }, 'wallet-error', 'could not coalesce error', ['Try again']],
  ];
  for (const [error, kind, message, labels] of table) {
    const action = walletErrorAction(classifyWalletError(error), { totalZkLtc: '0.1025', balanceZkLtc: '0.0100 zkLTC' });
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
      connectedWallet: null, connectedAddress: null, connectedProvider: null, walletProviderPending: true, walletPickKind: null,
      walletConnector: 'none', walletAuthenticated: false, walletAuthChallenge: null, connectedChainId: null,
      LITVM_LITEFORGE_NETWORK: { name: 'LitVM LiteForge', chainId: 4441, chainIdHex: '0x1159', nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 }, rpcUrls: { http: 'https://liteforge.rpc.caldera.xyz/http' }, explorerUrl: 'https://liteforge.explorer.caldera.xyz' },
      ensureLiteForgeAtSignIn, classifyWalletError, walletErrorAction,
      loadWalletPicker: async () => ({ openChainExplainer: async () => { order.push('explainer'); return explainerAnswer; } }),
      authenticateWalletSiwe: async (walletProvider, address) => { order.push(`siwe:${address}`); context.walletAuthenticated = true; return true; },
      walletSession: { remember: (value) => order.push(`remember:${value.kind}`) },
      showWalletNotice: (message) => notices.push(message),
      bindWalletProviderEvents() {}, debugRuntimeLog() {}, connectPlayerAccount() {}, persistArcadeStateSoon() {}, render() {},
      pullProfileFromCloud: async () => {}, state: {}, document: {}, console,
    };
    const signIn = runInNewContext(`${functionSource('refreshInjectedChainId')}\n${functionSource('requestLiteForgeNetwork')}\n${functionSource('signInWithWalletProvider')}\nsignInWithWalletProvider`, context);
    const wallet = await signIn(provider, { kind: 'eip6963', rdns: 'io.metamask' });
    return { wallet, order, notices, context };
  };
  const accepted = await run();
  assert.deepEqual(accepted.order, ['eth_requestAccounts', 'remember:eip6963', 'eth_chainId', 'explainer', 'wallet_switchEthereumChain', 'eth_chainId', 'siwe:0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A']);
  assert.equal(accepted.context.connectedChainId, '0x1159');
  assert.equal(accepted.context.walletProviderPending, false);
  assert.equal(accepted.context.connectedAddress, '0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A', 'SIWE gets the checksummed address');

  const added = await run({ switchError: Object.assign(new Error('Unrecognized chain'), { code: 4902 }) });
  assert.deepEqual(added.order.slice(0, 7), ['eth_requestAccounts', 'remember:eip6963', 'eth_chainId', 'explainer', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_chainId']);
  assert.equal(added.order.filter((method) => method === 'explainer').length, 1, 'one explainer');

  const refusedInApp = await run({ explainerAnswer: false });
  assert.deepEqual(refusedInApp.order, ['eth_requestAccounts', 'remember:eip6963', 'eth_chainId', 'explainer', 'siwe:0x19E7E376E7C213B7E7E7E46Cc70A5dD086DAff2A']);
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
  const declinedSignIn = runInNewContext(`${functionSource('signInWithWalletProvider')}\nsignInWithWalletProvider`, declinedContext);
  const result = await declinedSignIn({ request: async () => { throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); } }, { kind: 'legacy' });
  assert.equal(result, null);
  assert.equal(declinedContext.connectedWallet, null);
  assert.match(notices[0], /You cancelled in your wallet, so you are still signed out/);
  assert.doesNotMatch(functionSource('signInWithWalletProvider'), /connectMockWallet/);
  assert.match(functionSource('connectWallet'), /choice\?\.kind === 'simulated'\) return connectMockWallet\(\)/, 'the simulated identity only when no wallet exists');
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
    recordEntryBroadcast(session, { txHash: '0xabc', sessionId32: `0x${'cd'.repeat(32)}`, amountWei: 102_000_000_000_000_000n, wait: () => confirmation }, { eventTarget: target });
    const chip = mountEntryChip({ documentRef: doc, eventTarget: target, sessionId: 'game-session-1', status: 'broadcast' });
    assert.deepEqual(session.entryReceipt, { txHash: '0xabc', sessionId32: `0x${'cd'.repeat(32)}`, amountWei: '102000000000000000', status: 'pending' });
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
    sessionId, sessionNonce: uuid, seasonId: 'hmh-season-1-2026', seed: 12345, entryFeeWei: '100000000000000000',
    canonicalContext: Object.freeze({ sessionId, wallet: WALLET, gameId: 'lester-blaster', buildHash: 'site-1.7.0:game-1.7.0', seasonId: 'hmh-season-1-2026', seed: 12345 }),
  };
}

const TICKET = Object.freeze({ v: 'lesters-ranked-seed-v1', salt: 'ab'.repeat(16), issuedAt: 1_790_000_000, mac: 'cd'.repeat(32) });

function liveModal({ seedResponses, session = pendingRankedSession(), signInOk = true } = {}) {
  const dom = Object.fromEntries(['rankedEntryModal', 'rankedEntryWallet', 'rankedEntryNetwork', 'rankedEntryStatus', 'rankedEntryBalance', 'rankedEntryChainGuard', 'rankedEntryApprove', 'rankedEntryCancel', 'rankedEntryFee', 'rankedEntryReserve', 'rankedEntryTotal'].map((key) => [key, element()]));
  const order = [];
  const walletCalls = [];
  const events = [];
  const eventTarget = new EventTarget();
  eventTarget.addEventListener(RANKED_ENTRY_EVENT, (event) => events.push(event.detail));
  let confirm;
  const confirmation = new Promise((resolve) => { confirm = resolve; });
  const responses = [...seedResponses];
  const context = {
    dom, SETTLEMENT_LIVE: true, selectedGameId: 'lester-blaster', connectedWallet: WALLET, connectedAddress: WALLET, walletAuthenticated: true,
    LITVM_LITEFORGE_NETWORK: { name: 'Fixture LiteForge', chainId: 4441 },
    LITVM_CONTRACT_ADDRESSES: { scoreSubmissionRegistry: REGISTRY },
    detectEthereumProvider: () => ({ request: async (request) => { walletCalls.push(request.method); throw new Error('no wallet call expected'); } }),
    checkRankedReadiness: async () => ({ ok: true, onChain: true, chainId: 4441, hasFunds: true, balanceEth: '1', needWei: 102_500_000_000_000_000n, error: null, contractGate: { ok: true, entryFeeWei: 100_000_000_000_000_000n, settlementGasReserveWei: 2_000_000_000_000_000n, entryTotalWei: 102_000_000_000_000_000n, rankedEntryAddress: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190' } }),
    playSfxCue() {}, requestLiteForgeNetwork: async () => false,
    RANKED_ENTRY_FEE_ZKLTC: '0.1', formatZkLtcWei: (wei) => `${Number(BigInt(wei) / 1_000_000_000_000_000n) / 1000} zkLTC`,
    RANKED_SETTLEMENT_GAS_RESERVE_WEI: '2000000000000000', rankedEntryTotalWei: (fee) => (BigInt(fee) + 2_000_000_000_000_000n).toString(),
    ensureWalletStylesheet() {}, peekRankedPreflight: () => null,
    formatZkLtc4, walletErrorAction, classifyWalletError, LITEFORGE_FAUCET_URL: 'https://example.invalid/faucet', RANKED_PAUSED_MESSAGE, isRankedPaused, seedTicketUsable,
    fetchSeedTicket: async ({ token, session: pending }) => {
      order.push(`seed:${token}:${pending.sessionId === session.sessionId}`);
      return responses.shift() ?? { ok: false, status: 0, error: 'network' };
    },
    walletSession: { token: () => context.currentToken, invalidate: () => { order.push('invalidate'); context.currentToken = null; } },
    currentToken: 'token-1',
    authenticateWalletSiwe: async () => { order.push('siwe'); if (signInOk) context.currentToken = 'token-2'; context.walletAuthenticated = signInOk; return signInOk; },
    loadRankedIdentity: async () => ({
      applySeedTicket: (pending, ticket) => { order.push(`apply:${ticket.seed}`); return rankedIdentity.applySeedTicket(pending, ticket); },
      rankedIdentityFor: (pending, options) => { order.push(`identity:${pending.seed}`); return rankedIdentity.rankedIdentityFor(pending, options); },
      rankedSessionKey: async (identity) => { const key = await rankedIdentity.rankedSessionKey(identity); order.push('key'); return key; },
    }),
    sendRankedEntry: async (provider, options) => {
      order.push('send');
      context.sentWith = options;
      return { txHash: '0xfeed', sessionId32: options.sessionKey, amountWei: 102_000_000_000_000_000n, paid: true, wait: () => confirmation };
    },
    recordEntryBroadcast, showEntryChip: (pending) => order.push(`chip:${pending.entryReceipt.status}`), refreshWalletBalanceChip() {},
    startOfficialMode: async () => {}, connectWallet: async () => null, window: eventTarget,
    el: (tag, options = {}) => Object.assign(element(), { tag }, options),
    appendText: (parent, tag, text) => { const child = Object.assign(element(), { tag, textContent: text }); parent.append(child); return child; },
  };
  const request = runInNewContext(`(${functionSource('requestRankedEntry')})`, context);
  return { dom, order, walletCalls, events, context, session, confirm, promise: request(session) };
}

test('live entry fetches and applies a seed ticket before computing the key', async () => {
  const modal = liveModal({ seedResponses: [{ ok: true, status: 200, seed: 987654321, seedTicket: TICKET, fetchedAt: Date.now(), sessionId: pendingRankedSession().sessionId }] });
  await until(() => !modal.dom.rankedEntryApprove.disabled, 'the live check');
  assert.equal(modal.dom.rankedEntryApprove.disabled, false, 'the live check passed');
  assert.deepEqual(modal.order, ['seed:token-1:true'], 'the ticket is prefetched when the modal opens, with the Bearer token');
  assert.equal(modal.dom.rankedEntryTotal.textContent, '0.102 zkLTC');
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
  assert.equal(modal.context.sentWith.preflight.entryTotalWei, 102_000_000_000_000_000n, 'the fresh quote goes with the entry');
  // The run starts on broadcast, before the confirmation.
  assert.equal(resolved, true);
  assert.equal(modal.dom.rankedEntryModal.hidden, true);
  assert.deepEqual(modal.session.entryReceipt, { txHash: '0xfeed', sessionId32: expectedKey, amountWei: '102000000000000000', status: 'pending' });
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

// integration-glue, items B7 and B8: the ranked-client half of the D10 retry
// and saved-run seams with profile-boards, run from the shipped main.js code.
//
// The settlement block of main.js (its retry-request, wallet-session and boot
// pending-count wiring, with rankedSettlementClient()) and the profile-boards
// listeners are sliced out of the portal source and evaluated in one VM, in
// file order, with the real settlement client and the real holdings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import * as rankedSettlementModule from '../apps/portal/src/ranked-settlement.mjs';
import { createRankedRunHoldings } from '../apps/portal/src/index-api-client.mjs';
import { PORTAL_AST, PORTAL_MAIN, portalFunctionSource, memoryStorage, until } from './helpers/ranked-client-vm.mjs';

const CHIKUN = JSON.parse(readFileSync(new URL('./fixtures/ranked/chikun-valid.json', import.meta.url), 'utf8'));
const WALLET = CHIKUN.body.identity.wallet.toLowerCase();
const idFor = (byte) => `0x${byte.repeat(32)}`;
const stored = (byte) => ({ sessionId32: idFor(byte), gameId: 'chikun', wallet: WALLET, localScore: 5, entry: { status: 'confirmed', txHash: null }, savedAt: 0, body: { ...CHIKUN.body, sessionId32: idFor(byte) } });

const statementIndex = (predicate) => {
  const index = PORTAL_AST.body.findIndex(predicate);
  assert.ok(index >= 0);
  return index;
};
const sourceOf = (node) => PORTAL_MAIN.slice(node.start, node.end);
const SETTLEMENT_BLOCK = statementIndex((node) => node.type === 'IfStatement' && sourceOf(node).includes("'lesters:ranked-retry-request'"));
const topLevelListener = (event) => statementIndex((node) => node.type === 'ExpressionStatement' && sourceOf(node).startsWith(`window.addEventListener('${event}'`));

// A page: the settlement block, then (as main.js evaluates further down) the
// profile-boards listener of lesters:ranked-pending.
function page({ live, pending = [], fetchImpl = async () => { throw new TypeError('offline'); } }) {
  const storage = memoryStorage();
  if (pending.length) storage.setItem(rankedSettlementModule.RANKED_PENDING_KEY, JSON.stringify(pending));
  const received = [];
  const fetches = [];
  const window = new EventTarget();
  const context = vm.createContext({
    SETTLEMENT_LIVE: live,
    HOSTED_PROFILE_SYNC: live,
    ARCADE_STORAGE: storage,
    rankedSettlementClientPromise: null,
    walletSession: { token: (address) => (address === WALLET ? 'owner-token' : null), invalidate() {} },
    walletAuthenticated: true,
    profileSync: { logout() {} },
    applyRankedPublication: () => {},
    console: { error: (...args) => { throw new Error(`unexpected error ${args.join(' ')}`); }, warn() {} },
    setTimeout, clearTimeout,
    CustomEvent: class CustomEvent extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } },
    Event,
    window,
    connectedWallet: WALLET,
    officialProfileRoute: { setPendingSavedRuns: (count) => { received.push(count); return true; }, markStale() {} },
    officialLeaderboardRoute: { markStale() {} },
    rankedRunHoldings: createRankedRunHoldings({ live, storage }),
    __import: async (path) => {
      assert.equal(path, './src/ranked-settlement.mjs');
      return {
        ...rankedSettlementModule,
        createRankedSettlementClient: (options) => {
          const client = rankedSettlementModule.createRankedSettlementClient({
            ...options,
            fetchImpl: async (url, init) => { fetches.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null }); return fetchImpl(url, init); },
            setTimeoutImpl: () => 0,
            clearTimeoutImpl: () => {},
          });
          context.client = client;
          return client;
        },
      };
    },
  });
  const helpers = ['rankedSettlementClient', 'walletSessionToken', 'invalidateWalletSession'].map(portalFunctionSource).join('\n');
  vm.runInContext(`${helpers}\n${sourceOf(PORTAL_AST.body[SETTLEMENT_BLOCK])}`.replaceAll('import(', '__import('), context);
  const dispatchedDuringEvaluation = received.length;
  vm.runInContext(sourceOf(PORTAL_AST.body[topLevelListener('lesters:ranked-pending')]), context);
  return { context, storage, received, fetches, window, dispatchedDuringEvaluation };
}

test('B8: the profile listener is registered later in main.js than the boot pending dispatch', () => {
  assert.ok(topLevelListener('lesters:ranked-pending') > SETTLEMENT_BLOCK, 'the profile listener comes after the settlement block');
  // Both boot paths dispatch asynchronously, after main.js finished evaluating.
  const block = sourceOf(PORTAL_AST.body[SETTLEMENT_BLOCK]);
  assert.match(block, /if \(SETTLEMENT_LIVE\) void rankedSettlementClient\(\)/, 'live: the lazily imported client reports its stored count');
  assert.match(block, /else setTimeout\(\(\) => window\.dispatchEvent\(new CustomEvent\('lesters:ranked-pending', \{ detail: \{ count: 0 \} \}\)\), 0\);/, 'preview: zero, from a timer');
});

test('B8: live, the profile receives the boot count of runs stored on this device', async () => {
  const boot = page({ live: true, pending: [stored('01'), stored('02')] });
  assert.equal(boot.dispatchedDuringEvaluation, 0, 'nothing is dispatched while main.js evaluates');
  await until(() => boot.received.length === 1);
  assert.deepEqual(boot.received, [2], 'the profile shows "2 runs saved on this device"');
});

test('B8: preview, the profile receives a boot count of zero', async () => {
  const boot = page({ live: false, pending: [stored('01')] });
  assert.equal(boot.dispatchedDuringEvaluation, 0);
  await until(() => boot.received.length === 1);
  assert.deepEqual(boot.received, [0], 'preview never stores a body');
});

test('B7: a Retry for a run the ranked client holds is its only request; any other run is left to E3', async () => {
  // Runs this device holds: one stored after a reload, one live in this page.
  const boot = page({ live: true, pending: [stored('0a')] });
  await until(() => boot.received.length === 1);
  const live = boot.context.client.settle({ ...CHIKUN.body, sessionId32: idFor('0b') }, { localScore: 5 });
  await until(() => live.state === 'saved-locally');
  boot.context.rankedRunHoldings.track({ handle: live, context: { sessionId32: live.sessionId32, gameId: 'chikun' } });

  const requestsFor = (id) => boot.fetches.filter((call) => call.body?.sessionId32 === id).length;
  const cases = [['stored', idFor('0a')], ['live', idFor('0b')], ['elsewhere', idFor('0c')]];
  for (const [label, id] of cases) {
    const holds = boot.context.rankedRunHoldings.holds(id);
    const before = requestsFor(id);
    boot.window.dispatchEvent(new boot.context.CustomEvent('lesters:ranked-retry-request', { detail: { sessionId32: id } }));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    const sent = requestsFor(id) - before;
    // The profile (hosted-profile-view retrySession) dispatches this event
    // only when holds() is true and otherwise POSTs E3's retry body itself,
    // so each Retry click is exactly one request either way.
    if (holds) assert.equal(sent, 1, `${label}: the ranked client sends the one request`);
    else assert.equal(sent, 0, `${label}: the ranked client sends nothing, so the profile's retrySettle is the only request`);
    assert.equal(holds, label !== 'elsewhere', `${label}: holdings agree with what the client holds`);
  }
  // The profile side of the same seam: the view asks the same holdings.
  const main = PORTAL_MAIN.replace(/\r\n/g, '\n');
  assert.match(main, /rankedClientHolds: \(sessionId32\) => rankedRunHoldings\.holds\(sessionId32\),/);
  const view = readFileSync(new URL('../apps/portal/src/routes/hosted-profile-view.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(view, /try \{ held = Boolean\(rankedClientHolds\(id\)\); \} catch \{ held = false; \}\n\s+if \(held\) \{\n\s+dispatchEvent\('lesters:ranked-retry-request', \{ sessionId32: id \}\);/);
  assert.match(view, /\} else \{\n\s+let answer;\n\s+try \{ answer = await indexApi\?\.retrySettle\?\.\(id\); \}/);
});

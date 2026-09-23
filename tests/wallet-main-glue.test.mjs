// The main.js halves of sign-in (brief acceptance 3, 5, 6, 8): provider
// detection, silent restore, the lazy WalletConnect provider, wallet events,
// one sign-in at a time, the entry chip and the background pre-flight.
// The real main.js functions run in a VM with fakes for the wallet, the DOM
// and the lazy modules; import() specifiers are routed to test doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

import { createProviderRegistry } from '../apps/portal/src/wallet-auth.mjs';
import { createWalletSession, LOCAL_WALLET_SESSION_STORAGE_KEY, WALLET_CONNECTOR_STORAGE_KEY } from '../apps/portal/src/wallet-session.mjs';
import { loadEthers } from '../apps/portal/src/litvm-chain-client.mjs';

const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });
function functionSource(name) {
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name);
  assert.ok(node, `main.js declares ${name}`);
  return main.slice(node.start, node.end);
}
// import('x') becomes __import('x') so the VM can answer it with a double.
const program = (names, result) => `${names.map(functionSource).join('\n').replace(/\bimport\((['"][^'"]+['"])\)/g, '__import($1)')}\n${result}`;
const tick = () => new Promise((resolve) => setImmediate(resolve));
// Objects built inside the VM have its prototypes: compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

const WALLET = `0x${'12'.repeat(20)}`;
const OTHER = `0x${'34'.repeat(20)}`;

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
}
// A returning player: the remembered connector plus a live preview session flag.
function seededStorage({ kind, rdns = null, wallet = WALLET } = {}) {
  const storage = memoryStorage();
  storage.setItem(WALLET_CONNECTOR_STORAGE_KEY, JSON.stringify({ kind, rdns, wallet }));
  storage.setItem(LOCAL_WALLET_SESSION_STORAGE_KEY, JSON.stringify({ wallet, expiresAt: Date.now() + 60 * 60 * 1000 }));
  return storage;
}
function recorder() {
  const events = [];
  return { events, dispatchEvent(event) { events.push(event.detail); return true; } };
}
function previewSession(storage, eventTarget = null) {
  return createWalletSession({ hosted: false, storage, loadEthers, domain: 'localhost', eventTarget });
}
// An EIP-1193 wallet that answers eth_accounts and eth_chainId only.
function fakeWallet({ accounts = [WALLET], chainId = '0x1159' } = {}) {
  const calls = [];
  const listeners = {};
  return {
    calls,
    async request({ method }) {
      calls.push(method);
      if (method === 'eth_accounts') return accounts;
      if (method === 'eth_chainId') return chainId;
      throw new Error(`unexpected wallet call ${method}`);
    },
    on(event, fn) { (listeners[event] ??= []).push(fn); },
    emit(event, value) { for (const fn of listeners[event] ?? []) fn(value); },
  };
}

function glue({ storage = memoryStorage(), session = null, imports = {} } = {}) {
  const log = [];
  const context = {
    connectedWallet: null, connectedAddress: null, connectedProvider: null, walletProviderPending: false,
    walletPickKind: null, walletPickRdns: null, walletConnector: 'none', walletAuthenticated: false,
    walletAuthChallenge: null, connectedChainId: null, profileSyncPulledFor: null, profileSyncLastPushed: null,
    walletSession: null, walletSignInInFlight: null, boundWalletProviders: new WeakSet(),
    WALLET_CONNECTOR_STORAGE_KEY, ARCADE_STORAGE: storage, eip6963Registry: createProviderRegistry(),
    window: new EventTarget(), Event, setTimeout, clearTimeout, console, state: { profiles: {} },
    connectPlayerAccount: (_state, wallet) => log.push(`account:${wallet}`),
    persistArcadeStateSoon() {}, render() { log.push('render'); }, pullProfileFromCloud: async () => {},
    refreshWalletBalanceChip() { log.push('balance'); }, debugRuntimeLog() {}, showWalletNotice: (message) => log.push(`notice:${message}`),
    __import: async (specifier) => {
      log.push(`import:${specifier}`);
      if (!imports[specifier]) throw new Error(`unexpected import ${specifier}`);
      return imports[specifier];
    },
  };
  context.loadWalletSession = async () => {
    log.push('load-session');
    context.walletSession ??= session;
    return context.walletSession;
  };
  return { context, log };
}

test('detectEthereumProvider returns the picked provider first and nothing while WalletConnect is pending', () => {
  const { context } = glue();
  const detect = runInNewContext(program(['detectEthereumProvider'], 'detectEthereumProvider'), context);
  const legacy = fakeWallet();
  const announced = fakeWallet();
  context.ethereum = legacy;
  assert.equal(detect(), legacy, 'the legacy slot when nothing announced itself');
  context.eip6963Registry.add({ info: { uuid: 'mm', name: 'MetaMask', rdns: 'io.metamask' }, provider: announced });
  assert.equal(detect(), announced, 'an announced wallet before the legacy slot');
  const picked = fakeWallet();
  context.connectedProvider = picked;
  assert.equal(detect(), picked, 'the provider the player picked wins (§7.6)');
  context.connectedProvider = null;
  context.walletProviderPending = true;
  assert.equal(detect(), null, 'no installed wallet stands in for a restored WalletConnect session');
  context.walletProviderPending = false;
  context.eip6963Registry = createProviderRegistry();
  Object.defineProperty(context, 'ethereum', { configurable: true, get() { throw new Error('two wallets raced for window.ethereum'); } });
  assert.equal(detect(), null, 'a throwing ethereum getter never escapes detection');
});

const RESTORE = ['hasRememberedWalletConnector', 'waitForAnnouncedWallet', 'legacyInjectedProvider', 'refreshInjectedChainId', 'restoreWalletSession'];

test('silent restore finds a late EIP-6963 wallet by rdns and signs in without a prompt', async () => {
  const storage = seededStorage({ kind: 'eip6963', rdns: 'io.rabby' });
  const events = recorder();
  const { context, log } = glue({ storage, session: previewSession(storage, events) });
  const bound = [];
  context.bindWalletProviderEvents = (provider) => bound.push(provider);
  const restore = runInNewContext(program(RESTORE, 'restoreWalletSession'), context);
  // MetaMask announced at boot, but the player signed in with Rabby, which
  // announces itself 40 ms later.
  const metamask = fakeWallet({ accounts: [OTHER] });
  const rabby = fakeWallet();
  context.eip6963Registry.add({ info: { uuid: 'mm', name: 'MetaMask', rdns: 'io.metamask' }, provider: metamask });
  setTimeout(() => {
    context.eip6963Registry.add({ info: { uuid: 'rb', name: 'Rabby', rdns: 'io.rabby' }, provider: rabby });
    context.window.dispatchEvent(new Event('eip6963:announceProvider'));
  }, 40);
  await restore();
  assert.equal(context.connectedWallet, WALLET);
  assert.equal(context.connectedProvider, rabby, 'the remembered wallet, found by rdns');
  assert.equal(context.walletProviderPending, false);
  assert.deepEqual([context.walletPickKind, context.walletPickRdns, context.walletConnector, context.walletAuthenticated], ['eip6963', 'io.rabby', 'injected-evm', true]);
  assert.deepEqual(rabby.calls, ['eth_accounts', 'eth_chainId'], 'eth_accounts, never eth_requestAccounts or a signature');
  assert.deepEqual(metamask.calls, [], 'the other installed wallet is not asked');
  assert.deepEqual(bound, [rabby]);
  assert.equal(context.connectedChainId, '0x1159');
  assert.deepEqual(events.events, [{ wallet: WALLET, authenticated: true }], 'lesters:wallet-session after the restore');

  // The announcement never comes: restore waits at most 500 ms, then stays signed out.
  const quietStorage = seededStorage({ kind: 'eip6963', rdns: 'io.rabby' });
  const quiet = glue({ storage: quietStorage, session: previewSession(quietStorage) });
  quiet.context.bindWalletProviderEvents = () => { throw new Error('nothing to bind'); };
  const started = Date.now();
  await runInNewContext(program(RESTORE, 'restoreWalletSession'), quiet.context)();
  const waited = Date.now() - started;
  assert.ok(waited >= 450 && waited < 2000, `waited ${waited} ms`);
  assert.equal(quiet.context.connectedWallet, null);
  assert.equal(quiet.context.walletAuthenticated, false);
});

test('silent restore of a legacy wallet, and none at all when nothing is remembered', async () => {
  const storage = seededStorage({ kind: 'legacy' });
  const { context } = glue({ storage, session: previewSession(storage) });
  context.bindWalletProviderEvents = () => {};
  const legacy = fakeWallet();
  context.ethereum = legacy;
  await runInNewContext(program(RESTORE, 'restoreWalletSession'), context)();
  assert.equal(context.connectedWallet, WALLET);
  assert.equal(context.connectedProvider, legacy);
  assert.equal(context.walletPickKind, 'legacy');
  assert.deepEqual(legacy.calls, ['eth_accounts', 'eth_chainId']);

  // The wallet now shows another account: stays signed out quietly.
  const switchedStorage = seededStorage({ kind: 'legacy' });
  const switched = glue({ storage: switchedStorage, session: previewSession(switchedStorage) });
  switched.context.ethereum = fakeWallet({ accounts: [OTHER] });
  await runInNewContext(program(RESTORE, 'restoreWalletSession'), switched.context)();
  assert.equal(switched.context.connectedWallet, null);

  // A first-time visitor: the session module is never even loaded.
  const fresh = glue();
  fresh.context.ethereum = fakeWallet();
  await runInNewContext(program(RESTORE, 'restoreWalletSession'), fresh.context)();
  assert.equal(fresh.log.includes('load-session'), false);
  assert.equal(fresh.context.connectedWallet, null);
});

test('a remembered WalletConnect session restores from its token alone, without AppKit', async () => {
  const storage = seededStorage({ kind: 'walletconnect' });
  const { context, log } = glue({ storage, session: previewSession(storage) });
  context.bindWalletProviderEvents = () => { throw new Error('no provider exists yet'); };
  const injected = fakeWallet({ accounts: [OTHER] });
  const announced = fakeWallet({ accounts: [OTHER] });
  context.ethereum = injected;
  context.eip6963Registry.add({ info: { uuid: 'mm', name: 'MetaMask', rdns: 'io.metamask' }, provider: announced });
  await runInNewContext(program(RESTORE, 'restoreWalletSession'), context)();
  assert.deepEqual([context.connectedWallet, context.walletAuthenticated, context.walletConnector], [WALLET, true, 'injected-evm']);
  assert.equal(context.connectedProvider, null);
  assert.equal(context.walletProviderPending, true, 'the provider comes on the first wallet action');
  assert.equal(context.walletPickKind, 'walletconnect');
  assert.deepEqual(log.filter((entry) => entry.startsWith('import:')), [], 'walletconnect-provider (and AppKit) is not loaded at boot');
  assert.deepEqual([injected.calls, announced.calls], [[], []], 'no installed wallet is asked');
  // Nor can it stand in for the WalletConnect account afterwards.
  const detect = runInNewContext(program(['detectEthereumProvider'], 'detectEthereumProvider'), context);
  assert.equal(detect(), null);
});

test('another installed wallet cannot take over or sign out a pending WalletConnect session', () => {
  const storage = seededStorage({ kind: 'walletconnect' });
  const events = recorder();
  const session = previewSession(storage, events);
  const { context } = glue({ storage, session });
  context.walletSession = session;
  const bind = runInNewContext(program(['bindWalletProviderEvents', 'syncWalletAuthentication', 'rememberPickedWallet', 'announceWalletSignedOut'], 'bindWalletProviderEvents'), context);
  // Boot binds whatever is installed before restore runs.
  const metamask = fakeWallet();
  bind(metamask);
  Object.assign(context, { connectedWallet: WALLET, connectedProvider: null, walletProviderPending: true, walletConnector: 'injected-evm', walletAuthenticated: true, walletPickKind: 'walletconnect', connectedChainId: '0x1159' });
  metamask.emit('accountsChanged', [OTHER]);
  metamask.emit('chainChanged', '0x1');
  metamask.emit('accountsChanged', []);
  assert.deepEqual([context.connectedWallet, context.walletAuthenticated, context.connectedChainId], [WALLET, true, '0x1159']);
  assert.deepEqual(events.events, [], 'nothing announced');

  // Once the WalletConnect provider exists, only its own events count, and an
  // account change there is re-evaluated and remembered.
  const walletConnect = fakeWallet();
  bind(walletConnect);
  Object.assign(context, { connectedProvider: walletConnect, walletProviderPending: false });
  metamask.emit('accountsChanged', [OTHER]);
  assert.equal(context.connectedWallet, WALLET);
  walletConnect.emit('accountsChanged', [OTHER]);
  assert.equal(context.connectedWallet, OTHER);
  assert.equal(context.walletAuthenticated, false, 'the new account has not signed in');
  assert.deepEqual(events.events, [{ wallet: OTHER, authenticated: false }]);
  assert.deepEqual({ ...session.remembered() }, { kind: 'walletconnect', rdns: null, wallet: OTHER }, 'a reload restores the account the wallet is on now');
});

test('the first wallet action creates the WalletConnect provider, and only then', async () => {
  const walletConnect = fakeWallet();
  const created = [];
  const imports = { './src/walletconnect-provider.mjs': { createWalletConnectProvider: async (options) => { created.push(options); return walletConnect; } } };
  const storage = seededStorage({ kind: 'walletconnect' });
  const session = previewSession(storage);
  const { context, log } = glue({ storage, session, imports });
  context.walletSession = session;
  const bound = [];
  context.bindWalletProviderEvents = (provider) => bound.push(provider);
  Object.assign(context, { connectedWallet: WALLET, walletProviderPending: true, walletConnector: 'injected-evm', walletAuthenticated: true, walletPickKind: 'walletconnect' });
  const names = ['detectEthereumProvider', 'refreshInjectedChainId', 'ensureWalletProvider', 'walletProviderForAction', 'syncWalletAuthentication', 'rememberPickedWallet'];
  const api = runInNewContext(program(names, '({ ensureWalletProvider, walletProviderForAction })'), context);
  assert.equal(log.some((entry) => entry.startsWith('import:')), false);
  // A profile write (a DOM click) asks for the provider.
  const provider = await api.walletProviderForAction();
  assert.equal(provider, walletConnect);
  assert.deepEqual(plain(created), [{ reconnectOnly: true }], 'the stored session reconnects without a modal');
  assert.deepEqual([context.connectedProvider, context.walletProviderPending, context.connectedChainId], [walletConnect, false, '0x1159']);
  assert.deepEqual(bound, [walletConnect]);
  assert.equal(context.connectedWallet, WALLET);
  assert.equal(await api.walletProviderForAction(), walletConnect);
  assert.equal(created.length, 1, 'created once');

  // The wallet came back on another account: re-evaluated and remembered.
  const otherAccount = fakeWallet({ accounts: [OTHER] });
  const switchedStorage = seededStorage({ kind: 'walletconnect' });
  const switchedSession = previewSession(switchedStorage);
  const switched = glue({ storage: switchedStorage, session: switchedSession, imports: { './src/walletconnect-provider.mjs': { createWalletConnectProvider: async () => otherAccount } } });
  switched.context.walletSession = switchedSession;
  switched.context.bindWalletProviderEvents = () => {};
  Object.assign(switched.context, { connectedWallet: WALLET, walletProviderPending: true, walletConnector: 'injected-evm', walletAuthenticated: true, walletPickKind: 'walletconnect' });
  assert.equal(await runInNewContext(program(names, 'ensureWalletProvider'), switched.context)(), true);
  assert.deepEqual([switched.context.connectedWallet, switched.context.walletAuthenticated], [OTHER, false]);
  assert.equal(switchedSession.remembered().wallet, OTHER);

  // No stored session and the player closes the modal: no provider, still pending.
  const closed = glue({ imports: { './src/walletconnect-provider.mjs': { createWalletConnectProvider: async () => null } } });
  Object.assign(closed.context, { connectedWallet: WALLET, walletProviderPending: true, walletConnector: 'injected-evm' });
  assert.equal(await runInNewContext(program(names, 'walletProviderForAction'), closed.context)(), null);
  assert.equal(closed.context.walletProviderPending, true);
});

test('a double click on Sign in joins the sign-in in progress', async () => {
  const { context, log } = glue();
  let chooseCalls = 0;
  let pick;
  const provider = fakeWallet();
  Object.assign(context, {
    chooseWallet: () => { chooseCalls += 1; return new Promise((resolve) => { pick = resolve; }); },
    providerForWalletChoice: async () => provider,
    signInWithWalletProvider: async () => { log.push('sign-in'); context.connectedWallet = WALLET; context.walletConnector = 'injected-evm'; return WALLET; },
    connectMockWallet: () => { log.push('mock'); return 'mock'; },
    ensureWalletProvider: async () => true,
  });
  const api = runInNewContext(program(['signInFromPicker', 'connectWallet'], '({ connectWallet, signInFromPicker })'), context);
  const first = api.connectWallet();
  const second = api.connectWallet();
  await tick();
  assert.equal(chooseCalls, 1, 'one picker');
  pick({ kind: 'eip6963', uuid: 'mm', rdns: 'io.metamask' });
  assert.deepEqual(await Promise.all([first, second]), [WALLET, WALLET]);
  assert.equal(log.filter((entry) => entry === 'sign-in').length, 1, 'one sign-in');
  assert.equal(context.walletSignInInFlight, null, 'released once settled');
  // Signed in: Sign in is a no-op that returns the wallet.
  assert.equal(await api.connectWallet(), WALLET);
  assert.equal(chooseCalls, 1);

  // A vanished provider in the Ranked modal reopens the picker, but never
  // swaps in the simulated identity when no wallet answers.
  const picked = api.signInFromPicker({ allowSimulated: false });
  await tick();
  assert.equal(chooseCalls, 2, 'the picker opens even though the player looks signed in');
  pick({ kind: 'simulated' });
  assert.equal(await picked, null);
  assert.equal(log.includes('mock'), false);
  assert.match(log.find((entry) => entry.startsWith('notice:')), /No browser wallet answered/);
});

test('a fresh login remembers the account it signed', async () => {
  const remembered = [];
  const session = { signIn: async () => ({ ok: true, authenticated: true, expiresAt: Date.now() + 1000 }), remember: (value) => remembered.push(value) };
  const { context } = glue({ session });
  Object.assign(context, { HOSTED_PROFILE_SYNC: false, connectedWallet: OTHER, walletConnector: 'injected-evm', walletPickKind: 'eip6963', walletPickRdns: 'io.metamask' });
  const authenticate = runInNewContext(program(['authenticateWalletSiwe', 'rememberPickedWallet'], 'authenticateWalletSiwe'), context);
  assert.equal(await authenticate(fakeWallet(), OTHER), true);
  assert.equal(context.walletAuthenticated, true);
  assert.deepEqual(plain(remembered), [{ kind: 'eip6963', rdns: 'io.metamask', wallet: OTHER }]);

  // The session module cannot load (offline): signed out with a notice, no throw.
  const offline = glue();
  offline.context.loadWalletSession = async () => { throw new Error('chunk failed'); };
  assert.equal(await runInNewContext(program(['authenticateWalletSiwe', 'rememberPickedWallet'], 'authenticateWalletSiwe'), offline.context)(fakeWallet(), WALLET), false);
  assert.match(offline.log.find((entry) => entry.startsWith('notice:')), /Sign-in could not load/);
});

test('the session module loads once, with import(), and boot peeks at storage first', async () => {
  const created = [];
  const storage = memoryStorage();
  const { context, log } = glue({ storage, imports: { './src/wallet-session.mjs': { createWalletSession: (options) => { created.push(options); return { tag: 'session' }; } } } });
  delete context.loadWalletSession;
  Object.assign(context, { walletSessionLoading: null, HOSTED_PROFILE_SYNC: false, profileSync: { tag: 'sync' }, loadEthers, location: { hostname: 'localhost' }, LITVM_LITEFORGE_NETWORK: { chainId: 4441 } });
  const api = runInNewContext(program(['loadWalletSession', 'hasRememberedWalletConnector'], '({ loadWalletSession, hasRememberedWalletConnector })'), context);
  assert.equal(api.hasRememberedWalletConnector(), false);
  storage.setItem(WALLET_CONNECTOR_STORAGE_KEY, JSON.stringify({ kind: 'legacy', rdns: null, wallet: WALLET }));
  assert.equal(api.hasRememberedWalletConnector(), true);
  const [a, b] = await Promise.all([api.loadWalletSession(), api.loadWalletSession()]);
  assert.equal(a, b);
  assert.equal(await api.loadWalletSession(), a);
  assert.deepEqual(log.filter((entry) => entry.startsWith('import:')), ['import:./src/wallet-session.mjs']);
  assert.equal(created.length, 1);
  assert.deepEqual([created[0].hosted, created[0].storage, created[0].domain, created[0].chainId], [false, storage, 'localhost', 4441]);
});

test('the entry chip reads the entry status once its module has loaded', async () => {
  const { context } = glue();
  let loaded;
  const mounts = [];
  Object.assign(context, { document: { tag: 'document' }, loadWalletChips: () => new Promise((resolve) => { loaded = resolve; }) });
  const show = runInNewContext(program(['showEntryChip'], 'showEntryChip'), context);
  const session = { sessionId: 'game-session-1', entryReceipt: { status: 'pending' } };
  show(session);
  // The entry confirms while the chip module is still loading (first use).
  session.entryReceipt.status = 'confirmed';
  loaded({ mountEntryChip: (options) => mounts.push(options) });
  await tick();
  assert.equal(mounts[0].status, 'confirmed', 'not stuck on "Entry confirming…"');
  assert.equal(mounts[0].sessionId, 'game-session-1');
  const pending = { sessionId: 'game-session-2', entryReceipt: { status: 'pending' } };
  show(pending);
  loaded({ mountEntryChip: (options) => mounts.push(options) });
  await tick();
  assert.equal(mounts[1].status, 'broadcast');
});

test('mode select starts the background pre-flight after the pinned pair, live and signed in only', async () => {
  const start = main.indexOf('const renderOfficialModeSelect = () => {');
  assert.ok(start > 0);
  assert.match(main.slice(start, start + 200), /\{\n  officialPlayRoutes\.renderModeSelect\(\);\n  hmhChallengeUi\.render\(selectedGameId\);\n  startRankedPreflightInBackground\(\);\n/);

  const starts = [];
  const provider = fakeWallet();
  const { context } = glue();
  Object.assign(context, {
    SETTLEMENT_LIVE: true, connectedWallet: WALLET, walletAuthenticated: true, walletConnector: 'injected-evm', selectedGameId: 'chikun',
    detectEthereumProvider: () => provider, loadRankedPreflight: async () => ({ start: (options) => { starts.push(options); return Promise.resolve(null); } }),
  });
  const run = runInNewContext(program(['startRankedPreflightInBackground'], 'startRankedPreflightInBackground'), context);
  run();
  await tick();
  assert.equal(starts.length, 1);
  assert.deepEqual([starts[0].gameId, starts[0].wallet, starts[0].walletProvider], ['chikun', WALLET, provider]);
  // A pending WalletConnect session is read over the public RPC only; the pre-flight never creates AppKit.
  context.walletProviderPending = true;
  run();
  await tick();
  assert.equal(starts[1].walletProvider, null);
  context.walletProviderPending = false;
  // Not signed in, or preview: nothing starts.
  context.walletAuthenticated = false;
  run();
  context.walletAuthenticated = true;
  context.SETTLEMENT_LIVE = false;
  run();
  await tick();
  assert.equal(starts.length, 2);
});

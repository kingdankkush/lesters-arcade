// integration-glue, items A1-A5: one sign-in path (signin-entry's wallet
// session) shared by every Bearer caller (profile-boards' profile sync and
// index client, ranked-client's settlement client, the seed ticket), with a
// 401 from any of them dropping the token for the whole page.
//
// The main.js glue runs for real: its helper functions and the option
// callbacks it hands to createProfileSync / createIndexApiClient are sliced
// out of the portal source and evaluated in a VM, next to the real
// wallet-session, profile-sync, index-api and settlement modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

import { PORTAL_AST, PORTAL_MAIN, loadPortalFunctions, portalCallback, portalFunctionSource } from './helpers/ranked-client-vm.mjs';
import { createWalletSession, WALLET_CONNECTOR_STORAGE_KEY, WALLET_SESSION_EVENT } from '../apps/portal/src/wallet-session.mjs';
import { createProfileSync, SESSION_TOKEN_STORAGE_KEY } from '../apps/portal/src/profile-sync-client.mjs';
import { createIndexApiClient } from '../apps/portal/src/index-api-client.mjs';
import { createRankedSettlementClient } from '../apps/portal/src/ranked-settlement.mjs';
import { issueSessionToken, verifySiweLogin } from '../apps/portal/src/server-session.mjs';
import { loadEthers } from '../apps/portal/src/litvm-chain-client.mjs';

const ethers = await loadEthers();
// Public fixture key (0x11…11), never a real wallet.
const signer = new ethers.Wallet(`0x${'11'.repeat(32)}`);
const ADDRESS = signer.address;
const WALLET = ADDRESS.toLowerCase();
const NOW = Date.parse('2026-09-23T10:00:00.000Z');
const SECRET_FIXTURE = 'fixture-session-hmac-key-at-least-32-characters';
const main = PORTAL_MAIN.replace(/\r\n/g, '\n');

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
}

function fixtureWallet() {
  return {
    async request({ method, params = [] }) {
      if (method === 'eth_accounts') return [ADDRESS];
      if (method === 'personal_sign') return signer.signMessage(params[0]);
      throw new Error(`fixture wallet does not implement ${method}`);
    },
  };
}

// The hosted services: E1 nonce, E2 session (the real SIWE check and a real
// v2 token), E6/E6s profile, E7 PUT and E3 settle. `refuse` names the
// endpoints that answer 401 invalid-session to a Bearer call.
function hostedServices() {
  const requests = [];
  const refuse = new Set();
  const nonce = 'ab'.repeat(36);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  async function fetchImpl(url, init = {}) {
    const path = String(url);
    const authorization = init.headers?.authorization ?? init.headers?.Authorization ?? null;
    requests.push({ path, method: init.method ?? 'GET', authorization });
    if (path === '/api/session/nonce') return json(200, { ok: true, nonce, issuedAt: new Date(NOW - 2_000).toISOString(), expiresAt: new Date(NOW + 600_000).toISOString() });
    if (path === '/api/session') {
      const { challenge, signature } = JSON.parse(init.body);
      const verified = verifySiweLogin(ethers, { challenge, signature, allowedDomains: ['lestersarcade.io'], nowMs: NOW, expectedChainId: 4441 });
      if (!verified.ok || challenge.nonce !== nonce) return json(401, { ok: false, error: verified.error ?? 'nonce-invalid' });
      return json(200, { ok: true, wallet: verified.wallet, ...issueSessionToken(crypto, { secret: SECRET_FIXTURE, wallet: verified.wallet, nowMs: NOW, audience: 'lestersarcade:development' }) });
    }
    const endpoint = path.split('?')[0];
    if (authorization && refuse.has(endpoint)) return json(401, { ok: false, error: 'invalid-session' });
    if (endpoint === '/api/profile' && (init.method ?? 'GET') === 'GET') return json(200, { ok: true, wallet: WALLET, profile: { displayName: null }, games: {}, recentSessions: [], achievements: [], preferences: authorization ? {} : undefined });
    if (endpoint === '/api/profile' && init.method === 'PUT') return json(200, { ok: true, wallet: WALLET, preferences: JSON.parse(init.body).preferences, updatedAt: new Date(NOW).toISOString() });
    if (endpoint === '/api/profile/refresh') return json(200, { ok: true, profile: { displayName: null } });
    throw new Error(`unexpected request ${init.method ?? 'GET'} ${path}`);
  }
  return { fetchImpl, requests, refuse };
}

// The page as main.js wires it: profileSync and the index client take the
// callbacks main.js gives them, and the glue functions read the VM globals.
function portalStack() {
  const storage = memoryStorage();
  const services = hostedServices();
  const events = [];
  const eventTarget = { dispatchEvent(event) { events.push(event.detail); return true; } };
  const context = vm.createContext({ walletSession: null, walletAuthenticated: false, connectedWallet: null, profileSync: null });
  loadPortalFunctions(['walletSessionToken', 'walletSessionAuthenticated', 'invalidateWalletSession'], context);
  const profileSync = createProfileSync({
    fetchImpl: services.fetchImpl,
    storage,
    now: () => NOW,
    getToken: portalCallback('createProfileSync', 'getToken', context),
    onUnauthorized: portalCallback('createProfileSync', 'onUnauthorized', context),
  });
  context.profileSync = profileSync;
  const indexApi = createIndexApiClient({
    hosted: true,
    fetchImpl: services.fetchImpl,
    getToken: portalCallback('createIndexApiClient', 'getToken', context),
    onUnauthorized: portalCallback('createIndexApiClient', 'onUnauthorized', context),
  });
  const walletSession = createWalletSession({
    hosted: true, fetchImpl: services.fetchImpl, storage, now: () => NOW, profileSync, loadEthers,
    domain: 'lestersarcade.io', chainId: 4441, eventTarget,
  });
  async function signIn() {
    context.walletSession = walletSession;
    context.connectedWallet = WALLET;
    const result = await walletSession.signIn({ provider: fixtureWallet(), address: ADDRESS });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    context.walletAuthenticated = true;
    return result.token;
  }
  return { storage, services, events, context, profileSync, indexApi, walletSession, signIn };
}

const bearerOf = (request) => String(request?.authorization ?? '').replace(/^Bearer /, '') || null;

test('A1: the wallet session owns the only SIWE login, with the server nonce', () => {
  // main.js never logs in or builds a challenge itself.
  assert.doesNotMatch(main, /profileSync\.login\(/, 'main.js never calls profileSync.login');
  assert.doesNotMatch(main, /\bbuildSiweChallenge\(/, 'no browser-built challenge in main.js');
  assert.doesNotMatch(main, /\bgenerateNonce\(/, 'no browser nonce in main.js');
  const siwe = portalFunctionSource('authenticateWalletSiwe');
  assert.match(siwe, /session = await loadWalletSession\(\);/);
  assert.match(siwe, /const result = await session\.signIn\(\{ provider, address \}\);/, 'the one sign-in goes through walletSession.signIn');
  // Of every portal module, only wallet-session.mjs calls profileSync.login.
  const callers = ['apps/portal/src/wallet-session.mjs', 'apps/portal/src/index-api-client.mjs', 'apps/portal/src/name-claim-prompt.mjs', 'apps/portal/src/profile-chain.mjs', 'apps/portal/src/routes/hosted-profile-view.mjs', 'apps/portal/src/routes/official-profile-route.mjs', 'apps/portal/src/ranked-settlement.mjs', 'apps/portal/src/ranked-entry-flow.mjs']
    .filter((path) => /\.login\(/.test(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')));
  assert.deepEqual(callers, ['apps/portal/src/wallet-session.mjs']);
  const walletSessionSource = readFileSync(new URL('../apps/portal/src/wallet-session.mjs', import.meta.url), 'utf8');
  assert.match(walletSessionSource, /const nonce = await fetchServerNonce\(\);[\s\S]*buildSiweChallenge\(\{ domain, address, chainId, nonce: nonce\.nonce, issuedAt: nonce\.issuedAt \}\)[\s\S]*profileSync\.login\(\{ challenge, signature: signed\.signature \}\)/);
});

test('A2: every Bearer caller in main.js reads the token through the wallet session', () => {
  // No caller reads profileSync's token store directly (comments aside).
  const code = main.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /profileSync\.(?:session|hasSession|tokenFor)\b/);
  const optionsOf = (anchor) => {
    const from = main.indexOf(anchor);
    assert.ok(from > 0, anchor);
    return main.slice(from, main.indexOf('\n});', from) + 1);
  };
  const sync = optionsOf('const profileSync = createProfileSync({');
  assert.match(sync, /getToken: \(wallet\) => walletSessionToken\(wallet\),/);
  assert.match(sync, /onUnauthorized: \(\) => invalidateWalletSession\(\),/);
  const index = optionsOf('const indexApi = createIndexApiClient({');
  assert.match(index, /getToken: \(\) => walletSessionToken\(connectedWallet\),/);
  assert.match(index, /onUnauthorized: \(\) => invalidateWalletSession\(\),/);
  const settlement = portalFunctionSource('rankedSettlementClient');
  assert.match(settlement, /getToken: \(wallet\) => walletSessionToken\(wallet\),/);
  assert.match(settlement, /onUnauthorized: \(\) => invalidateWalletSession\(\),/);
  // The seed ticket (E15) and its 401 re-sign go through the session too.
  const entry = portalFunctionSource('requestRankedEntry');
  assert.match(entry, /fetchSeedTicket\(\{ token: session\.token\(sessionWallet\), session: pendingSession \}\)/);
  assert.match(entry, /if \(result\.status === 401 && reauth && !stopped\(\)\) \{\n\s+session\.invalidate\(\);/);
  // The profile and the hosted Scores/Profile auth state follow the session.
  assert.match(main, /isAuthenticated: \(wallet\) => walletSessionAuthenticated\(wallet\),/);
  assert.match(portalFunctionSource('pushProfileToCloudSoon'), /walletSessionAuthenticated\(connectedWallet\)/);
});

test('A2: profile pull and PUT, the self view, refresh and preferences all send the wallet session token', async () => {
  const stack = portalStack();
  // Before the session module loads nothing is signed in, so nothing is sent.
  assert.equal(stack.context.walletSessionToken(WALLET), null);
  assert.equal((await stack.profileSync.pushNow({ preferences: {} }, { wallet: WALLET })).error, 'no-session');
  assert.equal(stack.services.requests.length, 0);

  const token = await stack.signIn();
  assert.equal(stack.walletSession.token(WALLET), token);
  stack.services.requests.length = 0;
  assert.equal((await stack.profileSync.pull(WALLET)).self, true);
  assert.equal((await stack.profileSync.pushNow({ preferences: { selectedCharacterId: 'lilly' } }, { wallet: WALLET })).ok, true);
  assert.equal((await stack.indexApi.profile(WALLET, { self: true })).ok, true);
  assert.equal((await stack.indexApi.refreshProfile(WALLET)).ok, true);
  assert.equal((await stack.indexApi.savePreferences({ nameClaimDismissed: true })).ok, true);
  assert.deepEqual(stack.services.requests.map((request) => [request.method, request.path.split('?')[0], bearerOf(request)]), [
    ['GET', '/api/profile', token],
    ['PUT', '/api/profile', token],
    ['GET', '/api/profile', token],
    ['POST', '/api/profile/refresh', token],
    ['PUT', '/api/profile', token],
  ]);
});

for (const [label, endpoint, call] of [
  ['the index self view', '/api/profile', (stack) => stack.indexApi.profile(WALLET, { self: true })],
  ['the preferences PUT', '/api/profile', (stack) => stack.profileSync.pushNow({ preferences: {} }, { wallet: WALLET })],
  ['the profile pull', '/api/profile', (stack) => stack.profileSync.pull(WALLET)],
  ['the name-claim preferences', '/api/profile', (stack) => stack.indexApi.savePreferences({ nameClaimDismissed: true })],
]) {
  test(`A2: a 401 from ${label} drops the token for the whole page through walletSession.invalidate`, async () => {
    const stack = portalStack();
    await stack.signIn();
    stack.events.length = 0;
    stack.services.refuse.add(endpoint);
    await call(stack);
    assert.equal(stack.walletSession.token(WALLET), null, 'no caller can send it again');
    assert.equal(stack.walletSession.isAuthenticated(WALLET), false);
    assert.equal(stack.context.walletAuthenticated, false, 'the Ranked modal asks for a sign-in again');
    assert.equal(stack.storage.getItem(SESSION_TOKEN_STORAGE_KEY), null, 'the stored token is gone');
    assert.deepEqual(stack.events.at(-1), { wallet: WALLET, authenticated: false }, 'lesters:wallet-session announces the sign-out');
    // The wallet stays connected and remembered for Free play.
    stack.services.requests.length = 0;
    await stack.indexApi.profile(WALLET, { self: false });
    assert.equal(bearerOf(stack.services.requests[0]), null, 'later reads are public');
  });
}

test('A2: a 401 on a settle call reaches the wallet session through onUnauthorized', async () => {
  const unauthorized = [];
  const client = createRankedSettlementClient({
    live: true,
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'invalid-session' }), { status: 401 }),
    getToken: () => 'v2-token-fixture',
    storage: memoryStorage(),
    setTimeoutImpl: () => 0,
    clearTimeoutImpl: () => {},
    onUnauthorized: (wallet) => unauthorized.push(wallet),
  });
  const body = JSON.parse(readFileSync(new URL('./fixtures/ranked/chikun-valid.json', import.meta.url), 'utf8')).body;
  const handle = client.settle(body, { localScore: 1 });
  for (let i = 0; i < 20 && handle.state !== 'saved-locally'; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.code, 'sign-in-required');
  assert.deepEqual(unauthorized, [body.identity.wallet.toLowerCase()]);
});

test('A2: a token minted by the 1.7.0 flow is never sent by any caller', async () => {
  const stack = portalStack();
  const v1 = `${Buffer.from(`${WALLET}|${NOW + 3_600_000}`).toString('base64url')}.fixture-mac`;
  stack.storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: WALLET, token: v1, expiresAt: NOW + 3_600_000 }));
  const reloaded = createProfileSync({ storage: stack.storage, now: () => NOW, fetchImpl: stack.services.fetchImpl, getToken: portalCallback('createProfileSync', 'getToken', stack.context) });
  stack.context.profileSync = reloaded;
  stack.context.walletSession = createWalletSession({ hosted: true, storage: stack.storage, now: () => NOW, profileSync: reloaded, loadEthers, eventTarget: null });
  stack.context.connectedWallet = WALLET;
  assert.equal(stack.context.walletSessionToken(WALLET), null);
  assert.equal(stack.context.walletSessionAuthenticated(WALLET), false);
  await reloaded.pull(WALLET);
  await stack.indexApi.profile(WALLET, { self: true });
  assert.ok(stack.services.requests.every((request) => request.authorization === null), 'no request carried it');
});

// The profile-boards listener (top level in main.js), run for real.
function walletSessionListener() {
  const node = PORTAL_AST.body.find((entry) => entry.type === 'ExpressionStatement'
    && main.slice(entry.start, entry.end).startsWith("window.addEventListener('lesters:wallet-session'"));
  assert.ok(node, 'main.js registers the profile listener at the top level');
  const calls = [];
  const timers = [];
  const context = vm.createContext({
    HOSTED_PROFILE_SYNC: true,
    officialAppStep: 'profile',
    connectedWallet: null,
    officialProfileRoute: { invalidate: () => calls.push('profile.invalidate') },
    officialLeaderboardRoute: { invalidate: () => calls.push('boards.invalidate') },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    window: new EventTarget(),
  });
  context.hydrateProfileFromIndex = () => calls.push(`profile.hydrate:${context.connectedWallet}`);
  context.hydrateLeaderboardFromIndex = () => calls.push(`boards.hydrate:${context.connectedWallet}`);
  vm.runInContext(PORTAL_MAIN.slice(node.start, node.end), context);
  const flush = () => { while (timers.length) timers.shift()(); };
  return { context, calls, flush };
}

test('A3: sign-in, silent restore and sign-out each announce lesters:wallet-session, and the profile re-hydrates with the applied wallet', async () => {
  const page = walletSessionListener();
  const storage = memoryStorage();
  const services = hostedServices();
  const profileSync = createProfileSync({ fetchImpl: services.fetchImpl, storage, now: () => NOW });
  const session = createWalletSession({ hosted: true, fetchImpl: services.fetchImpl, storage, now: () => NOW, profileSync, loadEthers, domain: 'lestersarcade.io', eventTarget: page.context.window });
  const seen = [];
  page.context.window.addEventListener(WALLET_SESSION_EVENT, (event) => seen.push(event.detail));

  // Sign-in: the wallet is connected before the signature.
  page.context.connectedWallet = WALLET;
  await session.signIn({ provider: fixtureWallet(), address: ADDRESS });
  session.remember({ kind: 'legacy', rdns: null, wallet: ADDRESS });
  assert.deepEqual(page.calls, ['profile.invalidate', 'boards.invalidate'], 'the caches drop at once');
  page.flush();
  assert.deepEqual(page.calls.slice(2), [`profile.hydrate:${WALLET}`], 'then the view on screen reads again');

  // Silent restore (a reload): restore() announces before main.js applies
  // the wallet (restoreWalletSession sets connectedWallet after the await).
  page.calls.length = 0;
  page.context.connectedWallet = null;
  await session.restore({ provider: fixtureWallet() });
  page.context.connectedWallet = WALLET;
  page.flush();
  assert.deepEqual(page.calls, ['profile.invalidate', 'boards.invalidate', `profile.hydrate:${WALLET}`], 'the re-read sees the restored wallet, not the empty one');

  // Sign-out: executeSignOut clears the wallet and leaves for the splash
  // right after walletSession.signOut() announces.
  page.calls.length = 0;
  session.signOut();
  page.context.connectedWallet = null;
  page.context.officialAppStep = 'wallet-splash';
  page.flush();
  assert.deepEqual(page.calls, ['profile.invalidate', 'boards.invalidate'], 'no read for the wallet that just signed out');

  assert.deepEqual(seen, [
    { wallet: WALLET, authenticated: true },
    { wallet: WALLET, authenticated: true },
    { wallet: null, authenticated: false },
  ]);
  // Preview: the listener is inert.
  const preview = walletSessionListener();
  preview.context.HOSTED_PROFILE_SYNC = false;
  preview.context.window.dispatchEvent(Object.assign(new Event(WALLET_SESSION_EVENT), { detail: { wallet: WALLET, authenticated: true } }));
  preview.flush();
  assert.deepEqual(preview.calls, []);
  // main.js's own boot restore is the one that remembers the connector key.
  assert.match(main, new RegExp(`const WALLET_CONNECTOR_STORAGE_KEY = '${WALLET_CONNECTOR_STORAGE_KEY}';`));
});

test('A5: the profile asks players to "Sign in", never to connect a wallet', async () => {
  const preview = readFileSync(new URL('../apps/portal/src/routes/official-profile-route.mjs', import.meta.url), 'utf8');
  const hosted = readFileSync(new URL('../apps/portal/src/routes/hosted-profile-view.mjs', import.meta.url), 'utf8');
  assert.match(preview, /textContent: 'Sign in to Save Progress'/);
  assert.match(preview, /'Sign in to activate your profile'/);
  for (const source of [preview, hosted]) assert.doesNotMatch(source, /Connect Wallet|Connect wallet to|Connect a wallet to open/);
  // The splash button (signin-entry) says the same.
  assert.match(readFileSync(new URL('../apps/portal/src/routes/official-shell-routes.mjs', import.meta.url), 'utf8'), /connectedWallet \? 'Enter Arcade' : 'Sign in'/);
});

test('A5: the profile Sign in signs a connected, signed-out wallet in with one signature', async () => {
  const log = [];
  const context = vm.createContext({
    HOSTED_PROFILE_SYNC: true,
    connectedWallet: WALLET,
    connectedAddress: ADDRESS,
    walletConnector: 'injected-evm',
    walletAuthenticated: true, // stale: the token expired after the flag was set
    walletSignInInFlight: null,
    profileSignInInFlight: null,
    walletSession: { isAuthenticated: () => false, token: () => null },
    walletProviderForAction: async () => { log.push('provider'); return { request: async () => null }; },
    authenticateWalletSiwe: async (provider, address) => { log.push(`siwe:${address}`); return true; },
    signInFromPicker: async () => { log.push('picker'); return null; },
    connectWallet: async () => { log.push('connect'); return WALLET; },
    Promise,
  });
  const fns = vm.runInContext(`${portalFunctionSource('walletSessionAuthenticated')}\n${portalFunctionSource('signInFromProfile')}\n({ signInFromProfile })`, context);
  const first = fns.signInFromProfile();
  const second = fns.signInFromProfile();
  assert.equal(await first, WALLET);
  assert.equal(await second, WALLET);
  assert.deepEqual(log, ['provider', `siwe:${ADDRESS}`], 'one signature for a double click, no picker');

  // Signed in: nothing to do. No wallet: the picker (through connectWallet).
  log.length = 0;
  context.walletSession = { isAuthenticated: () => true, token: () => 'token' };
  assert.equal(await fns.signInFromProfile(), WALLET);
  context.connectedWallet = null;
  await fns.signInFromProfile();
  assert.deepEqual(log, ['connect']);
  // A vanished provider reopens the picker, never the simulated identity.
  log.length = 0;
  Object.assign(context, { connectedWallet: WALLET, walletSession: { isAuthenticated: () => false }, walletProviderForAction: async () => null });
  await fns.signInFromProfile();
  assert.deepEqual(log, ['picker']);
  assert.match(portalFunctionSource('signInFromProfile'), /signInFromPicker\(\{ allowSimulated: false \}\)/);
});

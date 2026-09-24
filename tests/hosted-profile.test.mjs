// Hosted Profile page (brief acceptance 3 and 4): /profile/<wallet> from E6, the
// owner's self view with D10 retries, the on-chain name editor once deployed,
// held-token badges only after an on-chain confirmation. Driven by E6 fixtures
// and a DOM double; no network, no chain.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import * as catalogModule from '../apps/portal/src/achievements/index.mjs';
import { createOfficialProfileRoute } from '../apps/portal/src/routes/official-profile-route.mjs';
import * as hostedProfileView from '../apps/portal/src/routes/hosted-profile-view.mjs';
import { ARCADE_AVATARS } from '../apps/portal/src/arcade-avatars.mjs';
import { RANKED_PENDING_STORAGE_KEY, createRankedRunHoldings } from '../apps/portal/src/index-api-client.mjs';
import { ERROR_CODE_ALLOWLIST } from '../server/settle/errors.mjs';

const {
  BLOCKED_NAME_COPY,
  DEAD_LETTER_COPY,
  HOSTED_PROFILE_TTL_MS,
  RETRY_FAILED_COPY,
  RETRY_HANDED_OFF_COPY,
  hostedSessionStatus,
  profileShareUrl,
  retryCooldownMs,
  retryFailureWords,
  settleErrorWords,
} = hostedProfileView;

const ME = `0x${'aa'.repeat(20)}`;
const OTHER = `0x${'bb'.repeat(20)}`;
const hex64 = (n) => n.toString(16).padStart(64, '0');
const explorer = (n) => `https://liteforge.explorer.caldera.xyz/tx/0x${hex64(n)}`;
const NOW = Date.parse('2026-09-23T12:00:00.000Z');

function session(n, overrides = {}) {
  return {
    sessionId32: `0x${hex64(n)}`, shareId: hex64(n), gameId: 'chikun', score: 1000 * n, status: 'confirmed',
    txHash: `0x${hex64(n + 100)}`, explorerUrl: explorer(n + 100), verifiedAt: '2026-09-22T10:00:00.000Z', confirmedAt: '2026-09-22T10:01:00.000Z',
    stats: { forksPassed: 20 }, ...overrides,
  };
}

// An E6 answer; `self` adds what only the self view carries (§4.3.6).
function e6({ wallet = ME, self = false, displayName = 'Lit Pilot', nameBlocked = null, sessions = [session(1)], achievements = [], avatarUri = 'lestersarcade:avatar/chikun' } = {}) {
  const body = {
    ok: true,
    wallet,
    profile: { displayName, avatarUri, hidden: false, onchainUpdatedAt: '2026-09-20T00:00:00.000Z' },
    games: {
      'lester-blaster': { rankedRuns: 4, confirmedRuns: 3, bestScore: 48_210, bestSessionId32: `0x${hex64(9)}`, ranks: { weekly: 3, monthly: 5, allTime: 12 }, totals: { kills: 400, survivalSeconds: 3900 }, lastPlayedAt: '2026-09-22T10:00:00.000Z' },
      chikun: { rankedRuns: 2, confirmedRuns: 2, bestScore: 19_475, bestSessionId32: `0x${hex64(1)}`, ranks: { weekly: 1, monthly: 1, allTime: 1 }, totals: { forksPassed: 60, coinsCollected: 30 }, lastPlayedAt: '2026-09-22T10:00:00.000Z' },
      stacked: { rankedRuns: 0, confirmedRuns: 0, bestScore: null, bestSessionId32: null, ranks: { weekly: null, monthly: null, allTime: null }, totals: {}, lastPlayedAt: null },
    },
    recentSessions: sessions,
    achievements,
    preferences: self ? { nameClaimDismissed: false } : null,
    updatedAt: '2026-09-22T10:00:00.000Z',
  };
  if (self) body.profile.nameBlocked = nameBlocked;
  return body;
}

function node(tag = 'div', props = {}) {
  const element = {
    tag,
    children: [],
    listeners: {},
    attributes: {},
    style: {},
    classList: { values: [], add(value) { this.values.push(value); } },
    ...props,
    dataset: { ...(props.dataset ?? {}) },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
  };
  return element;
}
const walk = (root, visit) => { visit(root); for (const child of root.children ?? []) walk(child, visit); };
const all = (root, predicate) => { const hits = []; walk(root, (candidate) => { if (predicate(candidate)) hits.push(candidate); }); return hits; };
const byClass = (root, className) => all(root, (candidate) => String(candidate.className ?? '').split(/\s+/).includes(className));
const text = (root) => { const parts = []; walk(root, (candidate) => { if (candidate.textContent) parts.push(candidate.textContent); }); return parts.join(' '); };
const buttons = (root, label) => all(root, (candidate) => candidate.tag === 'button' && candidate.textContent === label);
const settle = () => new Promise((resolve) => setImmediate(resolve));

function hostedProfile({
  connectedWallet = ME,
  viewedWallet = null,
  authenticated = true,
  answers = {},
  deploymentStatus = 'deployed',
  loadChainClient = async () => ({ fetchPlayerAchievements: async () => ({ ok: true, unlocked: [] }) }),
  loadProfileChain,
  copied = [],
  retryAnswer = { ok: true, status: 'submitted' },
  rankedClientHolds = () => false,
  dispatchEvent = null,
  active = true,
  lazy = false,
  walletProviderForAction = null,
} = {}) {
  const grid = node('grid');
  const calls = { profile: [], retrySettle: [], events: [], connect: 0, views: [] };
  const clock = { now: NOW };
  const timers = [];
  const indexApi = {
    profile: async (wallet, options) => {
      calls.profile.push([wallet, options]);
      const key = `${wallet}|${options?.self ? 'self' : 'public'}`;
      const answer = answers[key];
      return (typeof answer === 'function' ? answer() : answer) ?? e6({ wallet, self: Boolean(options?.self) });
    },
    retrySettle: async (id) => { calls.retrySettle.push(id); return typeof retryAnswer === 'function' ? retryAnswer(id) : retryAnswer; },
    refreshProfile: async () => ({ ok: true, profile: { displayName: 'Lit Pilot', avatarUri: null, hidden: false } }),
  };
  const routeState = { gameId: 'lester-blaster', viewedWallet, avatarJustSaved: false, usernameJustSaved: false };
  const route = createOfficialProfileRoute({
    hosted: true,
    indexApi,
    // The view module is handed over directly so it exists on the first
    // render; the lazy default has its own test.
    ...(lazy ? {} : { loadHostedView: () => hostedProfileView }),
    deployment: { status: deploymentStatus, addresses: { playerProfileRegistry: `0x${'3e'.repeat(20)}`, achievementRegistries: { chikun: `0x${'f6'.repeat(20)}`, 'lester-blaster': `0x${'c1'.repeat(20)}`, stacked: `0x${'54'.repeat(20)}` } } },
    isAuthenticated: (wallet) => authenticated && wallet === connectedWallet,
    isActive: () => active,
    dispatchEvent: (name, detail, ...rest) => { calls.events.push([name, detail, ...rest]); return dispatchEvent?.(name, detail); },
    rankedClientHolds,
    loadAchievementCatalog: async () => catalogModule,
    loadChainClient,
    loadProfileChain,
    loadEthers: async () => ({}),
    copyText: async (value) => { copied.push(value); },
    now: () => clock.now,
    setTimeoutImpl: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    dom: { officialCabinetGrid: grid },
    routeState,
    getContext: () => ({ connectedWallet, connectedChainId: '0x1159', walletConnector: 'injected-evm', state: { profiles: {} }, combat: {} }),
    el: (tag, props = {}) => node(tag, props),
    appendText: (parent, tag, content, className = '') => { const child = node(tag, { textContent: content, className }); parent.append(child); return child; },
    renderAvatarChip: (wallet, name, className) => node('img', { className: `avatar-chip-img avatar-chip-default ${className}`, src: 'default.jpg', dataset: { wallet: String(wallet) } }),
    renderAchievementIcon: (props) => node('img', { src: props.iconSrc, alt: props.label }),
    playSfxCue: () => {},
    connectWallet: () => { calls.connect += 1; },
    setView: (step, options) => calls.views.push([step, options]),
    detectEthereumProvider: () => ({ request: async () => null }),
    requestAnimationFrameRef: (callback) => callback(),
    ...(walletProviderForAction ? { walletProviderForAction } : {}),
    buildPlayerArcadeSnapshot: () => ({ profile: { handle: 'Local Name', usernameSet: true, displayName: 'Local Name' } }),
    validateUsername: () => ({ valid: true, message: 'ok' }),
    setArcadeUsername: () => ({ ok: true }),
    persistArcadeStateSoon: () => {},
    renderNav: () => {},
  });
  return { grid, route, calls, routeState, clock, timers };
}

async function rendered(h) {
  h.route.renderProfile();
  await h.route.hydrate();
  await settle();
  return h.grid;
}

test('public profile renders another wallet read-only', async () => {
  const achievements = [{ id: 'chikun-first-flight', gameId: 'chikun', tier: 'bronze', nft: false, sessionId32: `0x${hex64(1)}`, unlockedAt: '2026-09-22T10:01:00.000Z', tokenId: null, mintTxHash: null }];
  const h = hostedProfile({ viewedWallet: OTHER, answers: { [`${OTHER}|public`]: e6({ wallet: OTHER, displayName: 'Rival', achievements }) } });
  const grid = await rendered(h);
  assert.deepEqual(h.calls.profile, [[OTHER, { self: false }]], 'another wallet is always the public, cached view');
  const page = text(grid);
  assert.match(page, /Player Profile/);
  assert.match(page, /Rival/);
  assert.match(page, /#3/, 'weekly rank');
  assert.match(page, /#12/, 'all-time rank');
  assert.match(page, /Ranked Runs/);
  assert.equal(buttons(grid, 'Check name & fee').length, 0, 'no edit controls on someone else’s profile');
  assert.equal(buttons(grid, 'Save Username').length, 0);
  assert.equal(buttons(grid, 'Retry').length, 0);
  assert.equal(buttons(grid, 'View my profile').length, 1);
  buttons(grid, 'View my profile')[0].listeners.click();
  assert.deepEqual(h.calls.views.at(-1), ['profile', { wallet: null }]);
  const verified = byClass(grid, 'lt-verified-link');
  assert.equal(verified[0].href, explorer(101));
  assert.equal(verified[0].target, '_blank');
  const hero = byClass(grid, 'profile-hero-avatar')[0];
  assert.equal(hero.src, ARCADE_AVATARS.find((avatar) => avatar.id === 'chikun').src, 'the avatar resolves from ARCADE_AVATARS');
  const badge = byClass(grid, 'profile-achievement-card')[0];
  assert.match(text(badge), /First Flight/, 'joined with the catalog for the title');
  assert.equal(all(badge, (candidate) => candidate.tag === 'img')[0].src, '/assets/generated/achievement-badges/chikun/bronze.png');
  assert.doesNotMatch(page, /NFT|soulbound|minting/i, 'no NFT wording without a token (A32)');
  assert.doesNotMatch(page, /device-local|Cached Receipt|Trophy Room/i, 'hosted pages render index data only (A22)');
});

// integration-glue D18: the device-local STACKED facts ("Device-local
// preview", "replay-verified on this device") are the preview profile's; the
// hosted profile of a STACKED player shows the index's verified stats only.
test('a hosted STACKED profile shows no device-local preview text', async () => {
  const h = hostedProfile();
  h.routeState.gameId = 'stacked';
  await rendered(h);
  h.route.renderProfile();
  const shown = text(h.grid);
  assert.match(shown, /Your Verified Profile/);
  assert.doesNotMatch(shown, /Device-local|on this device\. Input labels|not online rankings|Local Ranked Runs|Score Source/i);
});

test('own profile shows the on-chain name editor only when deployed', async () => {
  const deployed = await rendered(hostedProfile());
  assert.equal(buttons(deployed, 'Check name & fee').length, 1);
  assert.equal(byClass(deployed, 'profile-avatar-option').length, ARCADE_AVATARS.length, 'the avatar picker offers every arcade avatar');
  assert.match(text(deployed), /Your Verified Profile/);
  assert.equal(buttons(deployed, 'Save Username').length, 0);

  const predicted = await rendered(hostedProfile({ deploymentStatus: 'predicted' }));
  assert.equal(buttons(predicted, 'Check name & fee').length, 0, 'no on-chain editor before the contracts are deployed');
  assert.equal(buttons(predicted, 'Save Username').length, 1, 'the local username editor stays');

  const signedOut = hostedProfile({ authenticated: false });
  const signedOutGrid = await rendered(signedOut);
  assert.deepEqual(signedOut.calls.profile, [[ME, { self: false }]], 'without a session the owner reads the public view');
  assert.equal(buttons(signedOutGrid, 'Check name & fee').length, 0, 'edit controls need the authenticated wallet');
  buttons(signedOutGrid, 'Sign in')[0].listeners.click();
  assert.equal(signedOut.calls.connect, 1, 'signing in starts from a button');

  const guest = hostedProfile({ connectedWallet: null });
  const guestGrid = await rendered(guest);
  assert.equal(guest.calls.profile.length, 0);
  assert.match(text(guestGrid), /Sign in to open your verified profile/, 'the "Sign in" wording of signin-entry');
  assert.doesNotMatch(text(guestGrid), /Connect Wallet|Connect a wallet/);
  buttons(guestGrid, 'Sign in')[0].listeners.click();
  assert.equal(guest.calls.connect, 1, 'the guest card signs in from its button');
});

test('the name editor checks the name and fee before the wallet opens', async () => {
  const prepared = [];
  const committed = [];
  const loadProfileChain = async () => ({
    publicReadProvider: () => ({}),
    prepareProfileChange: async (input) => {
      prepared.push(input);
      if (input.raw === 'Admin') return { ok: false, step: 'moderation', error: 'impersonation', message: 'That name isn’t allowed here. Choose another.' };
      return { ok: true, wallet: ME, cleaned: 'Lit Ace', avatarUri: input.avatarUri, feeLabel: 'Network fee about 0.0000421 zkLTC', fee: {} };
    },
    commitProfileChange: async (ready, options) => {
      committed.push(ready);
      options.dispatch('lesters:profile-changed', { wallet: ME, displayName: 'Lit Ace', avatarUri: ready.avatarUri });
      return { ok: true, refreshed: true };
    },
  });
  const h = hostedProfile({ loadProfileChain });
  const grid = await rendered(h);
  let input = byClass(grid, 'profile-onchain-name-input')[0];
  assert.equal(input.value, 'Lit Pilot', 'the editor starts from the on-chain name');
  input.value = 'Admin';
  input.listeners.input();
  await buttons(grid, 'Check name & fee')[0].listeners.click();
  await settle();
  assert.match(text(h.grid), /isn’t allowed here/);
  assert.equal(buttons(h.grid, 'Confirm in wallet').length, 0, 'a blocked name never reaches the wallet');

  byClass(h.grid, 'profile-avatar-option').find((option) => option.dataset.avatar === 'lilly').listeners.click();
  input = byClass(h.grid, 'profile-onchain-name-input')[0];
  input.value = '  Lit   Ace ';
  input.listeners.input();
  await buttons(h.grid, 'Check name & fee')[0].listeners.click();
  await settle();
  assert.equal(prepared.at(-1).avatarUri, 'lestersarcade:avatar/lilly');
  assert.equal(prepared.at(-1).registryAddress, `0x${'3e'.repeat(20)}`);
  assert.match(text(h.grid), /Lit Ace is free\. Network fee about 0\.0000421 zkLTC\./, 'the fee shows before the wallet opens');
  assert.equal(committed.length, 0);
  await buttons(h.grid, 'Confirm in wallet')[0].listeners.click();
  await settle();
  assert.equal(committed.length, 1, 'one wallet prompt, from the Confirm click');
  assert.deepEqual(h.calls.events.find(([name]) => name === 'lesters:profile-changed')?.[1], { wallet: ME, displayName: 'Lit Ace', avatarUri: 'lestersarcade:avatar/lilly' });
  assert.match(text(h.grid), /Saved on LitVM/);
});

test('the name editor gets its wallet provider from the click, so a restored WalletConnect session creates it there', async () => {
  // integration-glue A4: main.js passes walletProviderForAction, which awaits
  // ensureWalletProvider() before any on-chain profile read or write.
  const provider = { request: async () => null };
  const order = [];
  const loadProfileChain = async () => ({
    publicReadProvider: () => ({}),
    prepareProfileChange: async (input) => {
      order.push(['prepare', input.walletProvider]);
      return { ok: true, wallet: ME, cleaned: 'Lit Ace', avatarUri: input.avatarUri, feeLabel: 'Network fee about 0.0000421 zkLTC', fee: {} };
    },
    commitProfileChange: async (ready, options) => {
      order.push(['commit', options.walletProvider]);
      return { ok: true, refreshed: true };
    },
  });
  const h = hostedProfile({ loadProfileChain, walletProviderForAction: async () => { order.push(['provider']); return provider; } });
  const grid = await rendered(h);
  assert.deepEqual(order, [], 'rendering the editor never creates a provider (no AppKit at boot)');
  const input = byClass(grid, 'profile-onchain-name-input')[0];
  input.value = 'Lit Ace';
  input.listeners.input();
  await buttons(h.grid, 'Check name & fee')[0].listeners.click();
  await settle();
  await buttons(h.grid, 'Confirm in wallet')[0].listeners.click();
  await settle();
  assert.deepEqual(order.map(([step]) => step), ['provider', 'prepare', 'provider', 'commit'], 'the provider is resolved from each click, before the chain call');
  assert.equal(order[1][1], provider);
  assert.equal(order[3][1], provider);

  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const from = main.indexOf('const officialProfileRoute = createOfficialProfileRoute({');
  const routeCall = main.slice(from, main.indexOf('\n});', from) + 1);
  assert.match(routeCall, /\n {2}walletProviderForAction,\n/, 'main.js hands the profile its click-time provider');
  assert.match(routeCall, /\n {2}connectWallet: signInFromProfile,\n/, 'the profile Sign in signs a connected wallet in');
  assert.match(main, /async function walletProviderForAction\(\) \{\n {2}if \(walletProviderPending && !\(await ensureWalletProvider\(\)\)\) return null;/);
});

test('NFT badge only when a token id exists, confirmed on chain', async () => {
  const achievements = [
    { id: 'chikun-first-flight', gameId: 'chikun', tier: 'bronze', nft: false, sessionId32: `0x${hex64(1)}`, unlockedAt: '2026-09-22T10:01:00.000Z', tokenId: null, mintTxHash: null },
    { id: 'chikun-combo-40', gameId: 'chikun', tier: 'platinum', nft: true, sessionId32: `0x${hex64(2)}`, unlockedAt: '2026-09-22T10:02:00.000Z', tokenId: '123', mintTxHash: `0x${hex64(55)}` },
    { id: 'chikun-coins-375', gameId: 'chikun', tier: 'platinum', nft: true, sessionId32: `0x${hex64(3)}`, unlockedAt: '2026-09-22T10:03:00.000Z', tokenId: '456', mintTxHash: null },
  ];
  const reads = [];
  const loadChainClient = async () => ({ fetchPlayerAchievements: async (wallet, ids, options) => { reads.push([wallet, ids, options]); return { ok: true, unlocked: ['chikun-combo-40'] }; } });
  const h = hostedProfile({ viewedWallet: OTHER, answers: { [`${OTHER}|public`]: e6({ wallet: OTHER, achievements }) }, loadChainClient });
  const grid = await rendered(h);
  await settle();
  assert.deepEqual(reads, [[OTHER, ['chikun-combo-40', 'chikun-coins-375'], { gameId: 'chikun' }]], 'only token-holding unlocks are confirmed, over the public RPC client');
  const cards = byClass(h.grid, 'profile-achievement-card');
  assert.equal(cards.length, 3, 'every unlock is listed');
  const badges = byClass(h.grid, 'achievement-token-badge');
  assert.equal(badges.length, 1);
  assert.equal(badges[0].textContent, '⛓ Soulbound NFT');
  const link = byClass(h.grid, 'achievement-token-link')[0];
  assert.equal(link.href, `https://liteforge.explorer.caldera.xyz/tx/0x${hex64(55)}`);
  assert.match(text(cards[2]), /chikun-coins-375|Coin/i, 'an unconfirmed token keeps its achievement, without the badge');
  assert.equal(byClass(cards[2], 'achievement-token-badge').length, 0);

  // A failed confirmation hides the badge, never the achievement.
  const failing = hostedProfile({ viewedWallet: OTHER, answers: { [`${OTHER}|public`]: e6({ wallet: OTHER, achievements }) }, loadChainClient: async () => { throw new Error('rpc down'); } });
  await rendered(failing);
  await settle();
  assert.equal(byClass(failing.grid, 'achievement-token-badge').length, 0);
  assert.equal(byClass(failing.grid, 'profile-achievement-card').length, 3);

  // Phase 1: no token ids, no chain read at all.
  let phaseOneReads = 0;
  const phaseOne = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true, achievements: [achievements[0]] }) }, loadChainClient: async () => { phaseOneReads += 1; return {}; } });
  await rendered(phaseOne);
  await settle();
  assert.equal(phaseOneReads, 0);
});

test('own failed runs offer Retry and dead letters say no refunds', async () => {
  const sessions = [
    session(1, { status: 'failed', retryable: true, lastError: 'rpc-timeout', nextAttemptAt: '2026-09-23T12:05:00.000Z', txHash: null, explorerUrl: null }),
    session(2, { status: 'signed', retryable: true, lastError: null, nextAttemptAt: null, txHash: null, explorerUrl: null }),
    session(3, { status: 'submitted', retryable: true, lastError: null, nextAttemptAt: null }),
    session(4, { status: 'failed', retryable: false, lastError: 'session-not-paid', nextAttemptAt: null, txHash: null, explorerUrl: null }),
    session(5, { status: 'confirmed', retryable: false, lastError: null, nextAttemptAt: null }),
  ];
  const h = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true, sessions }) } });
  const grid = await rendered(h);
  assert.deepEqual(h.calls.profile[0], [ME, { self: true }], 'the owner reads the self view');
  const retries = buttons(grid, 'Retry');
  assert.equal(retries.length, 2, 'failed and signed runs that can still publish');
  const page = text(grid);
  assert.match(page, new RegExp(DEAD_LETTER_COPY.replace(/[.]/g, '\\.')));
  assert.match(page, /LiteForge took too long to answer/);
  assert.match(page, /LitVM could not find the paid entry/);
  assert.match(page, /Next automatic try in 5m/);
  assert.doesNotMatch(page, /rpc-timeout|session-not-paid/, 'raw error codes never show');

  await retries[0].listeners.click();
  await settle();
  assert.deepEqual(h.calls.events, [], 'ranked-client does not hold this run, so no retry request is sent');
  assert.deepEqual(h.calls.retrySettle, [`0x${hex64(1)}`], 'the stored settle is retried through the E3 retry body');
  assert.equal(h.calls.profile.filter(([, options]) => options.self).length, 2, 'the self view is read again');
});

test('a Retry goes to ranked-client when it holds the run, and never also to E3', async () => {
  const sessions = [
    session(1, { status: 'failed', retryable: true, lastError: 'rpc-timeout', txHash: null, explorerUrl: null }),
    session(2, { status: 'signed', retryable: true, lastError: null, txHash: null, explorerUrl: null }),
  ];
  const held = new Set([`0x${hex64(2)}`]);
  const h = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true, sessions }) }, rankedClientHolds: (id) => held.has(id) });
  await rendered(h);
  await buttons(h.grid, 'Retry')[1].listeners.click();
  await settle();
  assert.deepEqual(h.calls.events, [['lesters:ranked-retry-request', { sessionId32: `0x${hex64(2)}` }]], 'the held run is retried by its handle');
  assert.deepEqual(h.calls.retrySettle, [], 'and not by a second POST to /api/settle');
  const row = byClass(h.grid, 'profile-session-row')[1];
  assert.match(text(row), new RegExp(RETRY_HANDED_OFF_COPY));
  assert.equal(buttons(row, 'Retry')[0].disabled, true, 'held briefly so clicks do not restart its backoff');
  await buttons(row, 'Retry')[0].listeners.click();
  assert.equal(h.calls.events.length, 1, 'a second click inside the hold sends nothing');
  h.clock.now += 6_000;
  h.route.renderProfile();
  assert.equal(buttons(byClass(h.grid, 'profile-session-row')[1], 'Retry')[0].disabled, false, 'the button comes back');
  assert.doesNotMatch(text(h.grid), new RegExp(RETRY_HANDED_OFF_COPY));

  await buttons(h.grid, 'Retry')[0].listeners.click();
  await settle();
  assert.deepEqual(h.calls.retrySettle, [`0x${hex64(1)}`], 'a run it does not hold goes to E3 only');
  assert.equal(h.calls.events.length, 1);
});

test('a refused Retry says why in plain words and waits out retryAfterMs', async () => {
  const sessions = [session(1, { status: 'failed', retryable: true, lastError: 'rpc-timeout', txHash: null, explorerUrl: null })];
  let answer = { ok: false, status: 429, error: 'rate-limited', retryAfterMs: 30_000 };
  const h = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true, sessions }) }, retryAnswer: () => answer });
  await rendered(h);
  await buttons(h.grid, 'Retry')[0].listeners.click();
  await settle();
  const refused = byClass(h.grid, 'profile-session-retry-error');
  assert.equal(refused.length, 1);
  assert.equal(refused[0].textContent, 'Too many retries just now. Try again in a minute.');
  assert.equal(refused[0].attributes.role, 'alert');
  assert.doesNotMatch(text(h.grid), /rate-limited/, 'never the raw code');
  assert.equal(buttons(h.grid, 'Retry')[0].disabled, true, 'disabled for the server’s retryAfterMs');
  assert.ok(h.timers.some((timer) => timer.ms >= 30_000), 'a re-render is scheduled for when it may retry');
  await buttons(h.grid, 'Retry')[0].listeners.click();
  assert.equal(h.calls.retrySettle.length, 1, 'no request while waiting');

  h.clock.now += 31_000;
  h.route.renderProfile();
  assert.equal(buttons(h.grid, 'Retry')[0].disabled, false);
  answer = { ok: false, status: 503, error: 'settlement-not-configured' };
  await buttons(h.grid, 'Retry')[0].listeners.click();
  await settle();
  assert.equal(byClass(h.grid, 'profile-session-retry-error')[0].textContent, 'Ranked publishing is not available right now. Try again later.');
  assert.equal(buttons(h.grid, 'Retry')[0].disabled, false, 'no server hint, no wait');

  answer = { ok: true, status: 'submitted' };
  await buttons(h.grid, 'Retry')[0].listeners.click();
  await settle();
  assert.equal(byClass(h.grid, 'profile-session-retry-error').length, 0, 'a retry that went through clears the message');

  for (const [refusal, words] of [
    [{ ok: false, error: 'network' }, /could not be reached/],
    [{ ok: false, status: 401, error: 'invalid-session' }, /sign-in expired/],
    [{ ok: false, status: 403, error: 'wallet-mismatch' }, /another wallet/],
    [{ ok: false, status: 404, error: 'session-not-found' }, /no stored copy/],
    [{ ok: false, status: 503, error: 'settlement-paused' }, /paused/],
    [{ ok: false, status: 502, error: 'chain-read-failed' }, /LitVM could not be read/],
    [{ ok: false, status: 500, error: 'internal-error' }, new RegExp(RETRY_FAILED_COPY.replace(/[.]/g, '\\.'))],
  ]) {
    assert.match(retryFailureWords(refusal), words, refusal.error);
    assert.equal(retryFailureWords(refusal).includes(refusal.error), false, `${refusal.error} reads as words, never the code`);
  }
  assert.equal(retryCooldownMs({ status: 429, error: 'rate-limited' }), 60_000, 'a minute without a hint');
  assert.equal(retryCooldownMs({ error: 'network' }), 0);
  assert.equal(retryCooldownMs({ retryAfterMs: 5_000 }), 5_000);
});

// ranked-client's real listener (fable/pd-ranked-client main.js): it ignores
// the request unless settlement is live, never cancels or acknowledges it, and
// handles it after a lazy import: a held handle retries, otherwise resume()
// re-drives a stored body, otherwise nothing happens.
function rankedClientDouble({ live, storage }) {
  const calls = [];
  const handles = new Map();
  const target = new EventTarget();
  const client = {
    handleRetryRequest(detail) {
      const id = detail?.sessionId32 ?? null;
      const handle = id ? handles.get(id) : null;
      if (handle) { calls.push(['handle.retry', id]); return; }
      const stored = JSON.parse(storage.getItem(RANKED_PENDING_STORAGE_KEY) ?? '[]').filter((entry) => !id || entry.sessionId32 === id);
      for (const entry of stored) calls.push(['resume', entry.sessionId32]);
    },
  };
  target.addEventListener('lesters:ranked-retry-request', (event) => {
    if (!live) return;
    void Promise.resolve().then(() => client.handleRetryRequest(event?.detail ?? null));
  });
  // main.js dispatchPortalEvent: a plain CustomEvent on window.
  const dispatch = (name, detail) => { target.dispatchEvent(new CustomEvent(name, { detail })); };
  return { calls, handles, dispatch };
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

test('each Retry sends exactly one request with ranked-client’s real listener shape', async () => {
  const stored = `0x${hex64(1)}`;
  const inPage = `0x${hex64(2)}`;
  const elsewhere = `0x${hex64(3)}`;
  const sessions = [stored, inPage, elsewhere].map((id, index) => session(index + 1, { sessionId32: id, status: 'failed', retryable: true, lastError: 'rpc-timeout', txHash: null, explorerUrl: null }));
  for (const live of [true, false]) {
    const storage = memoryStorage({ [RANKED_PENDING_STORAGE_KEY]: JSON.stringify([{ sessionId32: stored, gameId: 'chikun', body: {} }]) });
    const rankedClient = rankedClientDouble({ live, storage });
    const holdings = createRankedRunHoldings({ live, storage });
    // A run finished in this page: ranked-client announced its handle.
    const handle = { sessionId32: inPage, state: 'saved-locally' };
    rankedClient.handles.set(inPage, handle);
    holdings.track({ handle, context: { sessionId32: inPage, gameId: 'chikun' } });
    const h = hostedProfile({
      answers: { [`${ME}|self`]: e6({ self: true, sessions }) },
      rankedClientHolds: (id) => holdings.holds(id),
      dispatchEvent: rankedClient.dispatch,
    });
    await rendered(h);
    for (const index of [0, 1, 2]) {
      h.clock.now += 10_000;
      h.route.renderProfile();
      await buttons(h.grid, 'Retry')[index].listeners.click();
      await settle();
    }
    if (live) {
      assert.deepEqual(rankedClient.calls, [['resume', stored], ['handle.retry', inPage]], 'held runs: ranked-client only');
      assert.deepEqual(h.calls.retrySettle, [elsewhere], 'the run this device does not hold: E3 only');
    } else {
      assert.deepEqual(rankedClient.calls, [], 'with settlement off ranked-client ignores the request');
      assert.deepEqual(h.calls.retrySettle, [stored, inPage, elsewhere], 'so every Retry goes to E3');
    }
    assert.equal(rankedClient.calls.length + h.calls.retrySettle.length, 3, 'one request per click, never two');
  }
});

test('a finished Ranked run or a stale entry reads the profile again on the next visit', async () => {
  const h = hostedProfile({ active: false });
  await rendered(h);
  assert.equal(h.calls.profile.length, 1);
  await h.route.hydrate();
  assert.equal(h.calls.profile.length, 1, 'a fresh profile is served from the cache');

  // main.js marks the profile stale on lesters:ranked-run and when the saved-run count changes.
  h.route.markStale(ME);
  await h.route.hydrate();
  assert.equal(h.calls.profile.length, 2, 'the run shows on the next visit');
  await h.route.hydrate();
  assert.equal(h.calls.profile.length, 2);

  h.clock.now += HOSTED_PROFILE_TTL_MS;
  await h.route.hydrate();
  assert.equal(h.calls.profile.length, 3, 'an entry older than the TTL is read again');

  h.route.markStale(OTHER);
  await h.route.hydrate();
  assert.equal(h.calls.profile.length, 3, 'another wallet going stale leaves this one cached');

  // The profile on screen reloads at once and keeps its answer meanwhile.
  const onScreen = hostedProfile();
  await rendered(onScreen);
  assert.equal(onScreen.calls.profile.length, 1);
  onScreen.route.markStale();
  assert.equal(onScreen.calls.profile.length, 2, 'the active profile reloads right away');
  onScreen.route.renderProfile();
  assert.match(text(onScreen.grid), /Lit Pilot/, 'still showing the last answer while it reloads');
  assert.match(text(onScreen.grid), /Refreshing/);
  await settle();
  assert.equal(onScreen.route.setPendingSavedRuns(2), true, 'the saved-run count reports a change');
  assert.equal(onScreen.route.setPendingSavedRuns(2), false);
});

test('saved runs on this device offer Retry saved runs', async () => {
  const h = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true }) } });
  await rendered(h);
  assert.equal(buttons(h.grid, 'Retry saved runs').length, 0);
  h.route.setPendingSavedRuns(2);
  assert.match(text(h.grid), /2 runs saved on this device/);
  buttons(h.grid, 'Retry saved runs')[0].listeners.click();
  assert.deepEqual(h.calls.events.at(-1), ['lesters:ranked-retry-request', { sessionId32: null }]);
  h.route.setPendingSavedRuns(0);
  assert.equal(buttons(h.grid, 'Retry saved runs').length, 0);

  const visitor = hostedProfile({ viewedWallet: OTHER });
  await rendered(visitor);
  visitor.route.setPendingSavedRuns(3);
  assert.equal(buttons(visitor.grid, 'Retry saved runs').length, 0, 'only on the owner’s own profile');
});

test('a blocked name explains itself only to its owner', async () => {
  const owner = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true, displayName: null, nameBlocked: 'profanity' }) } });
  const grid = await rendered(owner);
  assert.match(text(byClass(grid, 'profile-hero-card')[0]), new RegExp(BLOCKED_NAME_COPY));
  assert.equal(byClass(grid, 'profile-hero-name')[0].textContent, `${ME.slice(0, 6)}…${ME.slice(-4)}`, 'the short wallet stands in for the name');
  const visitor = hostedProfile({ viewedWallet: ME, connectedWallet: OTHER, answers: { [`${ME}|public`]: e6({ displayName: null }) } });
  const visitorGrid = await rendered(visitor);
  assert.doesNotMatch(text(visitorGrid), /isn’t allowed here/);
  assert.equal(byClass(visitorGrid, 'profile-hero-name')[0].textContent, `${ME.slice(0, 6)}…${ME.slice(-4)}`);
});

test('Share profile copies the profile URL and failures offer a retry', async () => {
  const copied = [];
  const h = hostedProfile({ viewedWallet: OTHER, copied });
  const grid = await rendered(h);
  await buttons(grid, 'Share profile')[0].listeners.click();
  assert.deepEqual(copied, [`https://lestersarcade.io/profile/${OTHER}`]);
  assert.equal(profileShareUrl(OTHER.toUpperCase().replace('0X', '0x')), `https://lestersarcade.io/profile/${OTHER}`);

  const offline = hostedProfile({ answers: { [`${ME}|self`]: { ok: false, error: 'network', retryable: true } } });
  const offlineGrid = await rendered(offline);
  assert.match(text(offlineGrid), /You appear to be offline/);
  offline.route.invalidate();
  assert.equal(buttons(offlineGrid, 'Try again').length, 1);
});

test('lastError codes map to plain words and statuses read truthfully', () => {
  for (const code of ERROR_CODE_ALLOWLIST) {
    const words = settleErrorWords(code);
    assert.equal(typeof words, 'string', code);
    assert.doesNotMatch(words, /-/, `${code} reads as words`);
  }
  assert.equal(settleErrorWords('something-new'), settleErrorWords('unknown-error'));
  assert.equal(settleErrorWords(null), null);
  assert.equal(hostedSessionStatus({ status: 'failed', retryable: true }, { self: false }).retry, false, 'the public view never offers Retry');
  assert.equal(hostedSessionStatus({ status: 'confirmed' }, { self: true }).label, 'Published on LitVM');
  assert.equal(hostedSessionStatus({ status: 'failed', retryable: false }, { self: true }).deadLetter, true);
});

test('preview never fetches and hydrate is a no-op', async () => {
  let calls = 0;
  const route = createOfficialProfileRoute({ hosted: false, indexApi: { profile: async () => { calls += 1; return { ok: true }; } } });
  assert.equal(await route.hydrate(), null);
  assert.equal(calls, 0);
});

test('a rejected self view falls back to the public view once', async () => {
  const h = hostedProfile({ answers: { [`${ME}|self`]: { ok: false, status: 401, error: 'invalid-session' } } });
  const grid = await rendered(h);
  await settle();
  assert.deepEqual(h.calls.profile, [[ME, { self: true }], [ME, { self: false }]], 'one self attempt, then the public view, no loop');
  assert.equal(buttons(grid, 'Check name & fee').length, 0, 'no edit controls without a working session');
  assert.equal(buttons(grid, 'Sign in').length, 1);
  h.route.invalidate();
  h.route.renderProfile();
  await h.route.hydrate();
  assert.deepEqual(h.calls.profile.at(-2), [ME, { self: true }], 'a new session (invalidate) tries the self view again');
});

test('saved runs show on the owner\u2019s profile before sign-in too', async () => {
  const h = hostedProfile({ authenticated: false });
  await rendered(h);
  h.route.setPendingSavedRuns(1);
  assert.match(text(h.grid), /1 run saved on this device/);
  assert.equal(buttons(h.grid, 'Retry saved runs').length, 1);
});

test('main.js routes Retry through the holdings and refreshes the verified views after a run', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(main, /const rankedRunHoldings = createRankedRunHoldings\(\{ live: SETTLEMENT_LIVE, storage: ARCADE_STORAGE \}\);/);
  assert.match(main, /rankedClientHolds: \(sessionId32\) => rankedRunHoldings\.holds\(sessionId32\),/);
  assert.doesNotMatch(main, /cancelable/, 'no invented acknowledgement: ranked-client never cancels the request');
  const listener = (name) => {
    const from = main.indexOf(`window.addEventListener('${name}'`);
    assert.ok(from > 0, `${name} listener`);
    return main.slice(from, main.indexOf('\n});', from));
  };
  const run = listener('lesters:ranked-run');
  assert.match(run, /rankedRunHoldings\.track\(event\?\.detail\);/, 'every announced handle is recorded');
  assert.match(run, /officialProfileRoute\.markStale\(/);
  assert.match(run, /officialLeaderboardRoute\.markStale\(event\?\.detail\?\.context\?\.gameId \?\? null\);/);
  const pending = listener('lesters:ranked-pending');
  assert.match(pending, /const changed = officialProfileRoute\.setPendingSavedRuns\(/);
  assert.match(pending, /if \(changed && HOSTED_PROFILE_SYNC\) \{\n\s+officialProfileRoute\.markStale\(connectedWallet\);\n\s+officialLeaderboardRoute\.markStale\(\);/);
  const renamed = listener('lesters:profile-changed');
  assert.match(renamed, /officialLeaderboardRoute\.markStale\(\);/);
  assert.match(renamed, /mergeRemoteProfile\(profile, \{ profile: \{ displayName: detail\.displayName \?\? null \} \}\)\.changed/, 'the nav follows the confirmed on-chain name');
  assert.match(renamed, /renderOfficialNav\(\);/);
});

test('the hosted profile loads on demand and preview never downloads it', async () => {
  const lazy = hostedProfile({ lazy: true, active: true });
  lazy.route.setPendingSavedRuns(2); // known before the view arrives
  lazy.route.renderProfile();
  assert.match(text(lazy.grid), /Loading verified profile…/, 'a loading card until the view module arrives');
  assert.equal(lazy.route.cachedSelfProfile(ME), null);
  await lazy.route.hydrate();
  await settle();
  assert.equal(lazy.calls.profile.length, 1, 'one E6 read once the view is in');
  assert.match(text(lazy.grid), /Your Verified Profile/);
  assert.match(text(lazy.grid), /2 runs saved on this device/, 'the saved-run count reached the view');
  assert.equal(lazy.route.cachedSelfProfile(ME)?.ok, true);

  let loads = 0;
  const preview = createOfficialProfileRoute({ hosted: false, indexApi: { profile: async () => ({ ok: true }) }, loadHostedView: () => { loads += 1; return hostedProfileView; } });
  assert.equal(await preview.hydrate(), null);
  preview.invalidate();
  preview.markStale();
  assert.equal(preview.cachedSelfProfile(ME), null);
  assert.equal(loads, 0, 'preview never requests the hosted module');
});

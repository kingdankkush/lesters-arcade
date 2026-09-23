// Hosted Profile page (brief acceptance 3 and 4): /profile/<wallet> from E6, the
// owner's self view with D10 retries, the on-chain name editor once deployed,
// held-token badges only after an on-chain confirmation. Driven by E6 fixtures
// and a DOM double; no network, no chain.
import assert from 'node:assert/strict';
import test from 'node:test';

import * as catalogModule from '../apps/portal/src/achievements/index.mjs';
import {
  BLOCKED_NAME_COPY,
  DEAD_LETTER_COPY,
  createOfficialProfileRoute,
  hostedSessionStatus,
  profileShareUrl,
  settleErrorWords,
} from '../apps/portal/src/routes/official-profile-route.mjs';
import { ARCADE_AVATARS } from '../apps/portal/src/arcade-avatars.mjs';
import { ERROR_CODE_ALLOWLIST } from '../server/settle/errors.mjs';

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
} = {}) {
  const grid = node('grid');
  const calls = { profile: [], retrySettle: [], events: [], connect: 0, views: [] };
  const indexApi = {
    profile: async (wallet, options) => {
      calls.profile.push([wallet, options]);
      const key = `${wallet}|${options?.self ? 'self' : 'public'}`;
      return answers[key] ?? e6({ wallet, self: Boolean(options?.self) });
    },
    retrySettle: async (id) => { calls.retrySettle.push(id); return { ok: true, status: 'submitted' }; },
    refreshProfile: async () => ({ ok: true, profile: { displayName: 'Lit Pilot', avatarUri: null, hidden: false } }),
  };
  let handled = false;
  const routeState = { gameId: 'lester-blaster', viewedWallet, avatarJustSaved: false, usernameJustSaved: false };
  const route = createOfficialProfileRoute({
    hosted: true,
    indexApi,
    deployment: { status: deploymentStatus, addresses: { playerProfileRegistry: `0x${'3e'.repeat(20)}`, achievementRegistries: { chikun: `0x${'f6'.repeat(20)}`, 'lester-blaster': `0x${'c1'.repeat(20)}`, stacked: `0x${'54'.repeat(20)}` } } },
    isAuthenticated: (wallet) => authenticated && wallet === connectedWallet,
    dispatchEvent: (name, detail, options) => { calls.events.push([name, detail, options]); return { handled }; },
    loadAchievementCatalog: async () => catalogModule,
    loadChainClient,
    loadProfileChain,
    loadEthers: async () => ({}),
    copyText: async (value) => { copied.push(value); },
    now: () => NOW,
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
    buildPlayerArcadeSnapshot: () => ({ profile: { handle: 'Local Name', usernameSet: true, displayName: 'Local Name' } }),
    validateUsername: () => ({ valid: true, message: 'ok' }),
    setArcadeUsername: () => ({ ok: true }),
    persistArcadeStateSoon: () => {},
    renderNav: () => {},
  });
  return { grid, route, calls, routeState, setHandled: (value) => { handled = value; } };
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
  assert.match(text(guestGrid), /Connect a wallet to open your verified profile/);
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
  assert.deepEqual(h.calls.events[0], ['lesters:ranked-retry-request', { sessionId32: `0x${hex64(1)}` }, { cancelable: true }]);
  assert.deepEqual(h.calls.retrySettle, [`0x${hex64(1)}`], 'no handle on this page, so the stored settle is retried');
  assert.equal(h.calls.profile.filter(([, options]) => options.self).length, 2, 'the self view is read again');

  h.setHandled(true);
  await buttons(h.grid, 'Retry')[1].listeners.click();
  await settle();
  assert.equal(h.calls.retrySettle.length, 1, 'ranked-client retried its own handle');
});

test('saved runs on this device offer Retry saved runs', async () => {
  const h = hostedProfile({ answers: { [`${ME}|self`]: e6({ self: true }) } });
  await rendered(h);
  assert.equal(buttons(h.grid, 'Retry saved runs').length, 0);
  h.route.setPendingSavedRuns(2);
  assert.match(text(h.grid), /2 runs saved on this device/);
  buttons(h.grid, 'Retry saved runs')[0].listeners.click();
  assert.deepEqual(h.calls.events.at(-1), ['lesters:ranked-retry-request', { sessionId32: null }, { cancelable: true }]);
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

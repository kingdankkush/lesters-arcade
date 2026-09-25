// The Scores and Profile routes load on the first visit (perf-lazy-hosted):
// main.js reaches them only through dynamic import(), a loading card holds the
// page until the chunk arrives, the route then renders exactly the DOM it
// renders when imported directly, a failed chunk shows Try again, and deep
// links still hydrate on first load. Fake DOM, fake index API; no network.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LAZY_ROUTE_COPY, createLazyLeaderboardRoute, createLazyProfileRoute, createLazyRouteLoader } from '../apps/portal/src/routes/lazy-routes.mjs';
import * as profileRouteModule from '../apps/portal/src/routes/official-profile-route.mjs';
import * as leaderboardRouteModule from '../apps/portal/src/routes/official-leaderboard-route.mjs';
import * as hostedProfileView from '../apps/portal/src/routes/hosted-profile-view.mjs';
import * as hostedLeaderboardView from '../apps/portal/src/routes/hosted-leaderboard-view.mjs';
import * as catalogModule from '../apps/portal/src/achievements/index.mjs';
import * as arcadeCore from '../apps/portal/src/arcade-core.mjs';
import { buildHmhRunDetailsModel, buildHmhRunHistoryModel } from '../apps/portal/src/hmh-run-history.mjs';
import { createPortalRouteController } from '../apps/portal/src/routes/portal-route-controller.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const ME = `0x${'aa'.repeat(20)}`;
const OTHER = `0x${'bb'.repeat(20)}`;
const NOW = Date.parse('2026-09-23T12:00:00.000Z');
const hex64 = (n) => n.toString(16).padStart(64, '0');
const settle = async (rounds = 4) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    listeners: {},
    attributes: {},
    style: {},
    classList: {
      values: [],
      add(value) { if (!this.values.includes(value)) this.values.push(value); },
      remove(...names) { this.values = this.values.filter((value) => !names.includes(value)); },
      toggle(name, enabled) { if (enabled) this.add(name); else this.remove(name); },
    },
    ...props,
    dataset: { ...(props.dataset ?? {}) },
    append(...children) { this.children.push(...children); },
    prepend(...children) { this.children.unshift(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    contains() { return false; },
  };
}
const walk = (root, visit) => { visit(root); for (const child of root.children ?? []) walk(child, visit); };
const all = (root, predicate) => { const hits = []; walk(root, (candidate) => { if (predicate(candidate)) hits.push(candidate); }); return hits; };
const text = (root) => { const parts = []; walk(root, (candidate) => { if (candidate.textContent) parts.push(candidate.textContent); if (candidate.text) parts.push(candidate.text); }); return parts.join(' '); };
const buttons = (root, label) => all(root, (candidate) => candidate.tag === 'button' && candidate.textContent === label);
// The rendered page: the grid's children (listeners are functions, so JSON
// drops them and compares structure, classes, attributes and copy).
const page = (grid) => JSON.stringify(grid.children);

// A loader whose module arrives when the test says so.
function deferredLoader(module) {
  const loader = { calls: 0, resolve: null, reject: null };
  loader.load = () => {
    loader.calls += 1;
    return new Promise((resolve, reject) => {
      loader.resolve = () => resolve(module);
      loader.reject = (error) => reject(error);
    });
  };
  return loader;
}

function sharedDom() {
  return {
    el: (tag, props = {}) => node(tag, props),
    appendText: (parent, tag, content, className = '') => { const child = node(tag, { textContent: content, className }); parent.append(child); return child; },
  };
}

// --- Profile fixtures ------------------------------------------------------

function e6({ wallet = ME, self = false, displayName = 'Lit Pilot' } = {}) {
  const body = {
    ok: true,
    wallet,
    profile: { displayName, avatarUri: 'lestersarcade:avatar/chikun', hidden: false, onchainUpdatedAt: '2026-09-20T00:00:00.000Z' },
    games: {
      'lester-blaster': { rankedRuns: 4, confirmedRuns: 3, bestScore: 48_210, bestSessionId32: `0x${hex64(9)}`, ranks: { weekly: 3, monthly: 5, allTime: 12 }, totals: { kills: 400 }, lastPlayedAt: '2026-09-22T10:00:00.000Z' },
      chikun: { rankedRuns: 0, confirmedRuns: 0, bestScore: null, bestSessionId32: null, ranks: { weekly: null, monthly: null, allTime: null }, totals: {}, lastPlayedAt: null },
      stacked: { rankedRuns: 0, confirmedRuns: 0, bestScore: null, bestSessionId32: null, ranks: { weekly: null, monthly: null, allTime: null }, totals: {}, lastPlayedAt: null },
    },
    recentSessions: [],
    achievements: [],
    preferences: self ? { nameClaimDismissed: false } : null,
    updatedAt: '2026-09-22T10:00:00.000Z',
  };
  if (self) body.profile.nameBlocked = null;
  return body;
}

function previewProfileDeps({ connected = true } = {}) {
  const wallet = `0x${'c'.repeat(40)}`;
  const state = arcadeCore.createInitialArcadeState();
  state.profiles[wallet] = arcadeCore.createPlayerProfile(wallet, { handle: 'QA_Profile' });
  state.profiles[wallet].usernameSet = true;
  state.runHistory = [{ wallet, gameId: 'lester-blaster', recordedAt: '2026-09-01T00:00:00.000Z', sessionId: 'paid-one', score: 702, mode: 'paid' }];
  state.profiles[wallet].progress['lester-blaster'].paidRuns = 1;
  const grid = node('grid');
  const noWrite = () => { throw new Error('render must not write'); };
  return {
    grid,
    deps: {
      ...arcadeCore,
      ...sharedDom(),
      buildHmhRunDetailsModel,
      buildHmhRunHistoryModel,
      hosted: false,
      dom: { officialCabinetGrid: grid },
      routeState: { gameId: 'lester-blaster', avatarJustSaved: false, usernameJustSaved: false, viewedWallet: null },
      getContext: () => ({ connectedWallet: connected ? wallet : null, connectedChainId: null, walletConnector: 'qa-fixture', state, combat: { score: 12_345, kills: 67, longestSurvivalThisRun: 125 } }),
      renderAvatarChip: () => node('avatar'),
      renderAchievementIcon: () => node('img'),
      renderSimulatedWalletNotice: () => node('notice'),
      isSimulatedWalletActive: () => true,
      detectEthereumProvider: () => null,
      formatSeconds: (seconds) => `${seconds}s`,
      formatSurvive: (seconds) => `${seconds}s`,
      documentRef: { createElement: (tag) => node(tag), createTextNode: (content) => node('#text', { textContent: content }) },
      connectWallet: noWrite, persistArcadeStateSoon: noWrite, playSfxCue: noWrite, renderNav: noWrite,
      setView: noWrite, setPlayerAvatar: noWrite, sanitizeAvatarImage: noWrite,
      requestAnimationFrameRef: (callback) => callback(),
    },
  };
}

function hostedProfileDeps({ viewedWallet = null, active = true, loadHostedView = () => hostedProfileView } = {}) {
  const grid = node('grid');
  const calls = { profile: [] };
  const indexApi = {
    profile: async (wallet, options) => { calls.profile.push([wallet, options]); return e6({ wallet, self: Boolean(options?.self), displayName: wallet === OTHER ? 'Rival' : 'Lit Pilot' }); },
    retrySettle: async () => ({ ok: true, status: 'submitted' }),
    refreshProfile: async () => ({ ok: true }),
  };
  const routeState = { gameId: 'lester-blaster', viewedWallet, avatarJustSaved: false, usernameJustSaved: false };
  return {
    grid,
    calls,
    routeState,
    deps: {
      ...sharedDom(),
      hosted: true,
      indexApi,
      loadHostedView,
      deployment: { status: 'deployed', addresses: { playerProfileRegistry: `0x${'3e'.repeat(20)}`, achievementRegistries: {} } },
      isAuthenticated: (wallet) => wallet === ME,
      isActive: () => active,
      dispatchEvent: () => {},
      loadAchievementCatalog: async () => catalogModule,
      loadChainClient: async () => ({ fetchPlayerAchievements: async () => ({ ok: true, unlocked: [] }) }),
      loadEthers: async () => ({}),
      copyText: async () => {},
      now: () => NOW,
      setTimeoutImpl: () => 0,
      dom: { officialCabinetGrid: grid },
      routeState,
      getContext: () => ({ connectedWallet: ME, connectedChainId: '0x1159', walletConnector: 'injected-evm', state: { profiles: {} }, combat: {} }),
      renderAvatarChip: (wallet, name, className) => node('img', { className: `avatar-chip-img ${className}`, src: 'default.jpg' }),
      renderAchievementIcon: (props) => node('img', { src: props.iconSrc, alt: props.label }),
      playSfxCue: () => {},
      connectWallet: () => {},
      setView: () => {},
      detectEthereumProvider: () => ({ request: async () => null }),
      requestAnimationFrameRef: (callback) => callback(),
      buildPlayerArcadeSnapshot: () => ({ profile: { handle: 'Local Name', usernameSet: true, displayName: 'Local Name' } }),
      validateUsername: () => ({ valid: true, message: 'ok' }),
      setArcadeUsername: () => ({ ok: true }),
      persistArcadeStateSoon: () => {},
      renderNav: () => {},
    },
  };
}

// --- Scores fixtures -------------------------------------------------------

const CABINETS = [
  { gameId: 'lester-blaster', id: 'hard-money-heroes', title: 'Hard Money Heroes' },
  { gameId: 'chikun', id: 'chikun', title: "Chikun's Escape" },
  { gameId: 'stacked', id: 'stacked', title: 'STACKED' },
];

function e5(params) {
  const rows = [1, 2, 3].map((rank) => {
    const wallet = `0x${rank.toString(16).padStart(4, '0')}${'ab'.repeat(18)}`;
    return {
      rank, wallet, walletShort: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`, displayName: `Pilot ${rank}`, avatarUri: null,
      score: 100_000 - rank * 100, stats: { kills: 90, survivalSeconds: 300, maxCombo: 12, level: 4, bossKills: 0 },
      sessionId32: `0x${hex64(rank)}`, shareId: hex64(rank), txHash: `0x${hex64(rank + 7)}`,
      explorerUrl: `https://liteforge.explorer.caldera.xyz/tx/0x${hex64(rank + 7)}`, confirmedAt: '2026-09-22T12:00:00.000Z',
    };
  });
  return { ok: true, gameId: params.game, period: params.period, periodKey: '2026-W39', resetsAt: '2026-09-28T00:00:00.000Z', page: 1, pageSize: 25, total: rows.length, rows, you: null };
}

function boardDeps({ hosted, active = true, loadHostedView = () => hostedLeaderboardView, pathname = '/scores' } = {}) {
  const grid = node('grid');
  const calls = { leaderboard: [] };
  const routeState = { gameId: 'lester-blaster' };
  return {
    grid,
    calls,
    routeState,
    deps: {
      ...sharedDom(),
      hosted,
      indexApi: { leaderboard: async (params) => { calls.leaderboard.push({ ...params }); return e5(params); } },
      loadHostedView,
      isActive: () => active,
      now: () => NOW,
      dom: { officialCabinetGrid: grid },
      routeState,
      storage: null,
      windowRef: { location: { pathname, search: '' }, history: { state: null, replaceState() {} } },
      getContext: () => ({ connectedWallet: null, state: { profiles: {} } }),
      buildLeaderboardExperienceV2Model: (_state, input) => ({ cadence: input.cadence, periodKey: '2026-W39', topEntries: [], total: 0, trustSummary: { flaggedRuns: 0 }, playerRank: null, playerEntry: null }),
      getAllCadenceLeaderboards: () => [{ cadence: 'weekly' }, { cadence: 'monthly' }, { cadence: 'all-time' }],
      documentRef: { createTextNode: (content) => ({ text: content }), querySelector: () => null },
      formatSurvive: () => '0:00',
      getGame: (gameId) => ({ title: CABINETS.find((cabinet) => cabinet.gameId === gameId)?.title ?? gameId }),
      humanList: (items) => items.join(', '),
      leaderboardEntryProvenance: () => ({ official: false, label: 'THIS DEVICE' }),
      playableCabinetNames: () => CABINETS.map((cabinet) => cabinet.title),
      publicLeaderboardCabinets: () => CABINETS,
      renderArcadeIcon: () => node('icon'),
      renderAvatarChip: (wallet, name, className) => node('img', { className: `avatar-chip-img ${className}`, src: 'default.jpg' }),
      resolveDisplayName: (_profile, wallet) => wallet,
      playRanked: () => {},
      viewProfile: () => {},
    },
  };
}

// --- main.js and the bundle graph -------------------------------------------

// The modules a bundle loads before anything is imported on demand: every
// dynamic import() is left outside, so only static edges are followed.
async function staticGraph(entry) {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [entry],
    absWorkingDir: repoRoot,
    bundle: true,
    write: false,
    format: 'esm',
    metafile: true,
    logLevel: 'silent',
    outdir: 'lazy-routes-test-out',
    external: ['pixi.js'],
    plugins: [{
      name: 'dynamic-imports-stay-lazy',
      setup(buildApi) {
        buildApi.onResolve({ filter: /.*/ }, (args) => (args.kind === 'dynamic-import' ? { path: args.path, external: true } : null));
      },
    }],
  });
  return new Set(Object.keys(result.metafile.inputs));
}

const mainUrl = new URL('../apps/portal/main.js', import.meta.url);

// The two factories main.js builds its routes with, run from main.js's own
// text: each import() is recorded and resolved against main.js, so a swapped
// or wrong specifier loads the wrong chunk here exactly as it would live.
async function mainRouteFactories() {
  const main = readFileSync(mainUrl, 'utf8').replace(/\r\n/g, '\n');
  const block = main.match(/^const createOfficialProfileRoute = \(deps\) => [\s\S]*?^\}\);\nconst createOfficialLeaderboardRoute = \(deps\) => [\s\S]*?^\}\);$/m)?.[0];
  assert.ok(block, 'main.js defines both factories, one after the other');
  const source = [
    `import { createLazyLeaderboardRoute, createLazyProfileRoute } from ${JSON.stringify(new URL('../apps/portal/src/routes/lazy-routes.mjs', import.meta.url).href)};`,
    'export function factories(importFromMain) {',
    block.replace(/\bimport\(/g, 'importFromMain('),
    '  return { createOfficialProfileRoute, createOfficialLeaderboardRoute };',
    '}',
  ].join('\n');
  const { factories } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  const specifiers = [];
  return { specifiers, ...factories((specifier) => { specifiers.push(specifier); return import(new URL(specifier, mainUrl).href); }) };
}

test('main.js reaches the Scores and Profile routes only through dynamic import()', async () => {
  const main = readFileSync(mainUrl, 'utf8').replace(/\r\n/g, '\n');
  assert.doesNotMatch(main, /^import [^;]*from '\.\/src\/routes\/official-(profile|leaderboard)-route\.mjs';$/m, 'no static import of either route');
  assert.match(main, /load: \(\) => import\('\.\/src\/routes\/official-profile-route\.mjs'\),/);
  assert.match(main, /load: \(\) => import\('\.\/src\/routes\/official-leaderboard-route\.mjs'\),/);
  assert.match(main, /loadHostedView: \(\) => import\('\.\/src\/routes\/hosted-profile-view\.mjs'\),/);
  assert.match(main, /loadHostedView: \(\) => import\('\.\/src\/routes\/hosted-leaderboard-view\.mjs'\),/);
  const from = main.indexOf('const officialProfileRoute = createOfficialProfileRoute({');
  const call = main.slice(from, main.indexOf('\n});', from));
  assert.match(call, /\n {2}buildHmhRunDetailsModel,\n {2}buildHmhRunHistoryModel,\n/, 'main.js hands the run-history builders to the lazy profile route');
  // The factories are code, so they live beside their call site, not inside
  // the static import block (contract §10.3 keeps that block import-only).
  const lastImport = [...main.matchAll(/^import [^\n]*$|^\} from '[^']+';$/gm)].at(-1).index;
  assert.ok(main.indexOf('\nconst createOfficialProfileRoute = ') > lastImport, 'the Profile factory is below the import block');
  assert.ok(main.indexOf('\nconst createOfficialLeaderboardRoute = ') > lastImport, 'the Scores factory is below the import block');
  assert.ok(main.indexOf('\nconst createOfficialLeaderboardRoute = ') < from, 'both factories are defined before the routes are built');

  const initial = await staticGraph('apps/portal/main.js');
  assert.ok(initial.has('apps/portal/src/routes/lazy-routes.mjs'));
  for (const lazy of [
    'apps/portal/src/routes/official-profile-route.mjs',
    'apps/portal/src/routes/official-leaderboard-route.mjs',
    'apps/portal/src/routes/hosted-profile-view.mjs',
    'apps/portal/src/routes/hosted-leaderboard-view.mjs',
    'apps/portal/src/leaderboard-view.mjs',
    'apps/portal/src/stacked-profile.mjs',
  ]) assert.equal(initial.has(lazy), false, `${lazy} is not in the portal's initial JS`);
});

test('main.js builds Profile from the profile chunk and Scores from the scores chunk', async () => {
  const main = await mainRouteFactories();
  const cases = [
    ['Profile preview', () => previewProfileDeps(), main.createOfficialProfileRoute, (route) => route.renderProfile(), /CANONICAL RUN HISTORY/,
      ['./src/routes/official-profile-route.mjs']],
    ['Profile hosted', () => hostedProfileDeps(), main.createOfficialProfileRoute, (route) => route.renderProfile(), /Your Verified Profile/,
      ['./src/routes/official-profile-route.mjs', './src/routes/hosted-profile-view.mjs']],
    ['Scores preview', () => boardDeps({ hosted: false }), main.createOfficialLeaderboardRoute, (route) => route.renderLeaderboards(), /Preview · this device/,
      ['./src/routes/official-leaderboard-route.mjs']],
    ['Scores hosted', () => boardDeps({ hosted: true }), main.createOfficialLeaderboardRoute, (route) => route.renderLeaderboards(), /Pilot 1/,
      ['./src/routes/official-leaderboard-route.mjs', './src/routes/hosted-leaderboard-view.mjs']],
  ];
  for (const [name, fixture, create, render, shows, chunks] of cases) {
    main.specifiers.length = 0;
    const h = fixture();
    const route = create(h.deps);
    render(route);
    await route.hydrate();
    await settle();
    assert.equal(buttons(h.grid, 'Try again').length, 0, `${name}: the factory's chunk has the route it builds`);
    assert.match(text(h.grid), shows, name);
    assert.deepEqual(main.specifiers, chunks, `${name}: the chunks main.js downloads for it`);
  }
});

test('the lazy route chunks share no module with the HMH or STACKED children', async () => {
  // A module both a lazy route and a child reach would split the child's
  // shared chunks and grow its initial JS (the HMH cap and the STACKED entry
  // budget, contract §11 rule 5). The Chikun child only shares chikun-profile.
  const [profile, board, hmh, stacked, chikun] = await Promise.all([
    'apps/portal/src/routes/official-profile-route.mjs',
    'apps/portal/src/routes/official-leaderboard-route.mjs',
    'apps/hmh-reboot/src/main.mjs',
    'apps/stacked/src/main.mjs',
    'apps/chikun/src/main.mjs',
  ].map(staticGraph));
  assert.ok(profile.size > 1 && board.size > 1 && hmh.size > 10 && stacked.size > 10);
  const shared = (route, child) => [...route].filter((input) => child.has(input));
  assert.deepEqual(shared(profile, hmh), [], 'the profile route reaches no HMH child module (hmh-run-history arrives from main.js)');
  assert.deepEqual(shared(board, hmh), []);
  assert.deepEqual(shared(profile, stacked), []);
  assert.deepEqual(shared(board, stacked), []);
  assert.deepEqual([...shared(profile, chikun), ...shared(board, chikun)], ['apps/portal/src/chikun-profile.mjs']);
  const source = readFileSync(new URL('../apps/portal/src/routes/official-profile-route.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from '\.\.\/hmh-run-history\.mjs'/);
});

// --- Profile -----------------------------------------------------------------

test('Profile preview: a loading card, then the same DOM as the route itself', async () => {
  const direct = previewProfileDeps();
  profileRouteModule.createOfficialProfileRoute(direct.deps).renderProfile();

  const lazy = previewProfileDeps();
  const loader = deferredLoader(profileRouteModule);
  let hostedViewLoads = 0;
  const route = createLazyProfileRoute(lazy.deps, { load: loader.load, loadHostedView: () => { hostedViewLoads += 1; } });
  route.renderProfile();
  assert.equal(loader.calls, 1, 'the first render starts the download');
  assert.match(text(lazy.grid), /^Loading profile…$/);
  const [card] = lazy.grid.children;
  assert.equal(card.className, 'official-info-card profile-state-card profile-state-loading');
  assert.equal(card.attributes.role, 'status');
  route.renderProfile();
  assert.equal(loader.calls, 1, 'one download per page');

  loader.resolve();
  await settle();
  assert.equal(page(lazy.grid), page(direct.grid), 'the device-local profile, exactly as rendered without the lazy step');
  assert.match(text(lazy.grid), /CANONICAL RUN HISTORY/);
  assert.equal(hostedViewLoads, 0, 'preview never downloads the hosted view');
  route.renderProfile();
  assert.equal(page(lazy.grid), page(direct.grid));
});

test('Profile hosted: the route\'s own loading card, then the verified profile', async () => {
  // What the route shows while its hosted view downloads.
  const waiting = hostedProfileDeps({ loadHostedView: () => new Promise(() => {}) });
  profileRouteModule.createOfficialProfileRoute(waiting.deps).renderProfile();

  const lazy = hostedProfileDeps();
  const loader = deferredLoader(profileRouteModule);
  const hostedView = deferredLoader(hostedProfileView);
  const route = createLazyProfileRoute(lazy.deps, { load: loader.load, loadHostedView: hostedView.load });
  route.renderProfile();
  assert.equal(page(lazy.grid), page(waiting.grid), 'the same "Loading verified profile…" card');
  assert.equal(LAZY_ROUTE_COPY.profile.hosted.loading, 'Loading verified profile…');
  assert.deepEqual([loader.calls, hostedView.calls], [1, 1], 'the hosted view downloads beside the route, not after it arrives');

  const hydrated = route.hydrate();
  loader.resolve();
  await settle();
  assert.match(text(lazy.grid), /^Loading verified profile…$/, 'the page waits for both chunks');
  assert.equal(lazy.calls.profile.length, 0);
  hostedView.resolve();
  await hydrated;
  await settle();

  const direct = hostedProfileDeps();
  const plain = profileRouteModule.createOfficialProfileRoute(direct.deps);
  plain.renderProfile();
  await plain.hydrate();
  await settle();
  assert.equal(page(lazy.grid), page(direct.grid), 'the verified profile, exactly as rendered without the lazy step');
  assert.match(text(lazy.grid), /Your Verified Profile/);
  assert.equal(lazy.calls.profile.length, 1, 'one E6 read');
  assert.equal(route.cachedSelfProfile(ME)?.ok, true, 'the self view is cached for the name prompt');
});

test('Profile: a failed chunk shows Try again instead of a blank page, and Try again loads it', async () => {
  for (const hosted of [false, true]) {
    const h = hosted ? hostedProfileDeps() : previewProfileDeps();
    const loader = deferredLoader(profileRouteModule);
    const warnings = [];
    let reloads = 0;
    const route = createLazyProfileRoute(h.deps, { load: loader.load, warn: (...args) => warnings.push(args.join(' ')), reload: () => { reloads += 1; } });
    route.renderProfile();
    loader.reject(new Error('chunk 404'));
    await settle();
    const copy = LAZY_ROUTE_COPY.profile[hosted ? 'hosted' : 'preview'];
    const [card] = h.grid.children;
    assert.equal(card.className, 'official-info-card profile-state-card profile-state-error');
    assert.equal(card.attributes.role, 'status');
    assert.match(text(h.grid), new RegExp(`${copy.failedTitle}.*${copy.failedDetail.replace('.', '\\.')}`));
    assert.equal(buttons(h.grid, 'Try again').length, 1);
    assert.match(warnings.join('\n'), /\[Profile\] page could not load: chunk 404/);

    route.renderProfile();
    assert.equal(loader.calls, 1, 'a render never retries a broken chunk by itself (no loop)');
    assert.equal(buttons(h.grid, 'Try again').length, 1);

    buttons(h.grid, 'Try again')[0].listeners.click();
    assert.equal(loader.calls, 2, 'Try again downloads the route again');
    assert.match(text(h.grid), new RegExp(`^${copy.loading}$`));
    loader.resolve();
    await settle();
    assert.equal(buttons(h.grid, 'Try again').length, 0);
    assert.match(text(h.grid), hosted ? /Your Verified Profile/ : /CANONICAL RUN HISTORY/);
    if (hosted) assert.equal(h.calls.profile.length, 1, 'Try again also reads the profile');
    assert.equal(reloads, 0, 'a retry that loads needs no reload');
  }
});

test('Profile: the hosted failure card is the route\'s own', async () => {
  const broken = hostedProfileDeps({ loadHostedView: () => Promise.reject(new Error('view 404')) });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const plain = profileRouteModule.createOfficialProfileRoute(broken.deps);
    plain.renderProfile();
    await settle();
  } finally {
    console.warn = warn;
  }
  const lazy = hostedProfileDeps();
  const loader = deferredLoader(profileRouteModule);
  const route = createLazyProfileRoute(lazy.deps, { load: loader.load, warn: () => {} });
  route.renderProfile();
  loader.reject(new Error('chunk 404'));
  await settle();
  assert.equal(page(lazy.grid), page(broken.grid));
});

test('Profile: calls made before the chunk arrives reach the route, and nothing else leaks', async () => {
  const h = hostedProfileDeps();
  const loader = deferredLoader(profileRouteModule);
  const route = createLazyProfileRoute(h.deps, { load: loader.load });
  assert.equal(route.cachedSelfProfile(ME), null);
  assert.equal(route.invalidate(ME), undefined);
  assert.equal(route.markStale(), undefined);
  assert.equal(loader.calls, 0, 'caches, counts and lookups never start a download');
  assert.equal(route.setPendingSavedRuns(2), true);
  assert.equal(route.setPendingSavedRuns('2'), false, 'unchanged count');
  assert.equal(loader.calls, 0);

  route.renderProfile();
  const hydrated = route.hydrate();
  loader.resolve();
  await hydrated;
  await settle();
  assert.match(text(h.grid), /2 runs saved on this device/, 'the saved-run count known before the chunk reached the view');
  assert.equal(route.setPendingSavedRuns(2), false);
  assert.equal(route.setPendingSavedRuns(0), true);
  await settle();
  assert.doesNotMatch(text(h.grid), /runs saved on this device/);
});

test('Profile: an inactive page is not painted when the chunk arrives', async () => {
  let active = true;
  const h = previewProfileDeps();
  h.deps.isActive = () => active;
  const loader = deferredLoader(profileRouteModule);
  const route = createLazyProfileRoute(h.deps, { load: loader.load });
  route.renderProfile();
  const loading = page(h.grid);
  active = false; // the player left the page
  loader.resolve();
  await settle();
  assert.equal(page(h.grid), loading, 'another page owns the grid now');
  active = true;
  route.renderProfile();
  assert.match(text(h.grid), /CANONICAL RUN HISTORY/, 'the next visit renders at once');
  assert.equal(loader.calls, 1);
});

test('Profile and Scores: an inactive page is not painted when the chunk fails', async () => {
  for (const [name, make, render] of [
    ['Profile', (deps, options) => createLazyProfileRoute(deps, options), (route) => route.renderProfile()],
    ['Scores', (deps, options) => createLazyLeaderboardRoute(deps, options), (route) => route.renderLeaderboards()],
  ]) {
    let active = true;
    const h = name === 'Profile' ? hostedProfileDeps() : boardDeps({ hosted: true });
    h.deps.isActive = () => active;
    const loader = deferredLoader(name === 'Profile' ? profileRouteModule : leaderboardRouteModule);
    const route = make(h.deps, { load: loader.load, warn: () => {}, reload: () => assert.fail('no reload') });
    render(route);
    const loading = page(h.grid);
    active = false; // the player left the page
    loader.reject(new Error('chunk 404'));
    await settle();
    assert.equal(page(h.grid), loading, `${name}: the failure card is not painted over the page that owns the grid now`);
    active = true;
    render(route);
    assert.equal(buttons(h.grid, 'Try again').length, 1, `${name}: the next visit shows Try again`);
    assert.equal(loader.calls, 1, `${name}: the visit itself does not retry`);
  }
});

test('Profile: once loaded, invalidate and markStale reach the route with their wallet', async () => {
  let active = true;
  const h = hostedProfileDeps();
  h.deps.isActive = () => active;
  const loader = deferredLoader(profileRouteModule);
  const route = createLazyProfileRoute(h.deps, { load: loader.load });
  route.renderProfile();
  const hydrated = route.hydrate();
  loader.resolve();
  await hydrated;
  await settle();
  assert.deepEqual(h.calls.profile, [[ME, { self: true }]]);
  assert.equal(route.cachedSelfProfile(ME)?.wallet, ME);
  const reads = async (step) => { await step(); await route.hydrate(); await settle(); return h.calls.profile.length; };

  assert.equal(await reads(() => {}), 1, 'a fresh profile is not read again');
  // lesters:ranked-run and lesters:ranked-pending (main.js) mark the player's
  // profile stale: the next visit reads E6 again.
  active = false;
  assert.equal(await reads(() => route.markStale(OTHER)), 1, 'another wallet\'s run leaves this profile fresh');
  assert.equal(await reads(() => route.markStale(ME)), 2, 'markStale(wallet) reaches the route');
  assert.equal(await reads(() => route.markStale()), 3, 'markStale() marks every wallet');
  // The profile on screen reads again at once.
  active = true;
  route.markStale(ME);
  await settle();
  assert.equal(h.calls.profile.length, 4, 'markStale on the page on screen reloads it');
  // lesters:wallet-session (sign-in, sign-out, a 401) drops the cached views.
  active = false;
  assert.equal(await reads(() => route.invalidate(OTHER)), 4, 'another wallet\'s invalidate keeps this profile');
  assert.equal(route.cachedSelfProfile(ME)?.wallet, ME);
  route.invalidate(ME);
  assert.equal(route.cachedSelfProfile(ME), null, 'invalidate(wallet) drops that wallet\'s self view');
  assert.equal(await reads(() => {}), 5);
  route.invalidate();
  assert.equal(route.cachedSelfProfile(ME), null, 'invalidate() drops every self view');
  assert.equal(await reads(() => {}), 6);
  assert.ok(h.calls.profile.every(([wallet]) => wallet === ME));
});

// --- Scores ------------------------------------------------------------------

test('Scores preview: a loading card, then the same board as the route itself', async () => {
  const direct = boardDeps({ hosted: false });
  leaderboardRouteModule.createOfficialLeaderboardRoute(direct.deps).renderLeaderboards();

  const lazy = boardDeps({ hosted: false });
  const loader = deferredLoader(leaderboardRouteModule);
  let hostedViewLoads = 0;
  const route = createLazyLeaderboardRoute(lazy.deps, { load: loader.load, loadHostedView: () => { hostedViewLoads += 1; } });
  route.renderLeaderboards();
  assert.equal(lazy.grid.children.length, 1);
  const [card] = lazy.grid.children;
  assert.equal(card.className, 'official-info-card leaderboard-board-card leaderboard-board-preview');
  assert.equal(card.children[0].className, 'leaderboard-empty-state leaderboard-state-loading');
  assert.equal(card.children[0].attributes.role, 'status');
  assert.match(text(lazy.grid), /^Loading scores…$/);

  loader.resolve();
  await settle();
  assert.equal(page(lazy.grid), page(direct.grid));
  assert.match(text(lazy.grid), /Preview · this device/);
  assert.equal(hostedViewLoads, 0, 'preview never downloads the hosted view');
  assert.equal(await route.hydrate(), null, 'preview hydrate fetches nothing');
  assert.equal(lazy.calls.leaderboard.length, 0);
});

test('Scores hosted: the route\'s own loading card, then the verified board', async () => {
  const waiting = boardDeps({ hosted: true, loadHostedView: () => new Promise(() => {}) });
  leaderboardRouteModule.createOfficialLeaderboardRoute(waiting.deps).renderLeaderboards();

  const lazy = boardDeps({ hosted: true });
  const loader = deferredLoader(leaderboardRouteModule);
  const hostedView = deferredLoader(hostedLeaderboardView);
  const route = createLazyLeaderboardRoute(lazy.deps, { load: loader.load, loadHostedView: hostedView.load });
  route.renderLeaderboards();
  assert.equal(page(lazy.grid), page(waiting.grid), 'the same "Loading verified scores…" card');
  assert.deepEqual([loader.calls, hostedView.calls], [1, 1], 'the hosted view downloads beside the route, not after it arrives');

  const hydrated = route.hydrate();
  hostedView.resolve();
  loader.resolve();
  await hydrated;
  await settle();

  const direct = boardDeps({ hosted: true });
  const plain = leaderboardRouteModule.createOfficialLeaderboardRoute(direct.deps);
  plain.renderLeaderboards();
  await plain.hydrate();
  await settle();
  assert.equal(page(lazy.grid), page(direct.grid));
  assert.match(text(lazy.grid), /Pilot 1/);
  assert.deepEqual(lazy.calls.leaderboard.map(({ game, period }) => [game, period]), [['lester-blaster', 'weekly']]);
});

test('Scores: a failed chunk shows Try again instead of a blank page, and Try again loads it', async () => {
  for (const hosted of [false, true]) {
    const h = boardDeps({ hosted });
    const loader = deferredLoader(leaderboardRouteModule);
    const warnings = [];
    let reloads = 0;
    const route = createLazyLeaderboardRoute(h.deps, { load: loader.load, warn: (...args) => warnings.push(args.join(' ')), reload: () => { reloads += 1; } });
    route.renderLeaderboards();
    loader.reject(new Error('chunk 404'));
    await settle();
    const copy = LAZY_ROUTE_COPY.scores[hosted ? 'hosted' : 'preview'];
    const state = h.grid.children[0].children[0];
    assert.equal(state.className, 'leaderboard-empty-state leaderboard-state-error');
    assert.match(text(h.grid), new RegExp(`${copy.failedTitle}.*${copy.failedDetail.replace('.', '\\.')}`));
    assert.equal(buttons(h.grid, 'Try again')[0].className, 'pixel-button leaderboard-empty-action');
    assert.match(warnings.join('\n'), /\[Scores\] page could not load: chunk 404/);

    route.renderLeaderboards();
    assert.equal(loader.calls, 1, 'no retry loop');
    buttons(h.grid, 'Try again')[0].listeners.click();
    assert.equal(loader.calls, 2);
    loader.resolve();
    await settle();
    assert.equal(buttons(h.grid, 'Try again').length, 0);
    assert.match(text(h.grid), hosted ? /Pilot 1/ : /Preview · this device/);
    assert.equal(h.calls.leaderboard.length, hosted ? 1 : 0, 'Try again reads the board only when hosted');
    assert.equal(reloads, 0);
  }
});

test('Scores: the hosted failure card is the route\'s own', async () => {
  const broken = boardDeps({ hosted: true, loadHostedView: () => Promise.reject(new Error('view 404')) });
  const warn = console.warn;
  console.warn = () => {};
  try {
    leaderboardRouteModule.createOfficialLeaderboardRoute(broken.deps).renderLeaderboards();
    await settle();
  } finally {
    console.warn = warn;
  }
  const lazy = boardDeps({ hosted: true });
  const loader = deferredLoader(leaderboardRouteModule);
  const route = createLazyLeaderboardRoute(lazy.deps, { load: loader.load, warn: () => {} });
  route.renderLeaderboards();
  loader.reject(new Error('chunk 404'));
  await settle();
  assert.equal(page(lazy.grid), page(broken.grid));
});

test('Scores: once loaded, invalidate and markStale reach the route with their game', async () => {
  let active = true;
  const h = boardDeps({ hosted: true });
  h.deps.isActive = () => active;
  const loader = deferredLoader(leaderboardRouteModule);
  const route = createLazyLeaderboardRoute(h.deps, { load: loader.load });
  assert.equal(route.markStale('lester-blaster'), undefined, 'before the chunk there is nothing to mark');
  route.renderLeaderboards();
  const hydrated = route.hydrate();
  loader.resolve();
  await hydrated;
  await settle();
  assert.equal(h.calls.leaderboard.length, 1);
  const reads = async (step) => { await step(); await route.hydrate(); await settle(); return h.calls.leaderboard.length; };

  assert.equal(await reads(() => {}), 1, 'a fresh board is not read again');
  // lesters:ranked-run marks that game's boards stale; ranked-pending and
  // profile-changed mark every board.
  active = false;
  assert.equal(await reads(() => route.markStale('chikun')), 1, 'another game\'s run leaves this board fresh');
  assert.equal(await reads(() => route.markStale('lester-blaster')), 2, 'markStale(gameId) reaches the route');
  assert.equal(await reads(() => route.markStale()), 3, 'markStale() marks every board');
  active = true;
  route.markStale('lester-blaster');
  await settle();
  assert.equal(h.calls.leaderboard.length, 4, 'markStale on the board on screen reloads it');
  // lesters:wallet-session drops every cached board.
  active = false;
  assert.equal(await reads(() => route.invalidate()), 5, 'invalidate() reaches the route');
  assert.ok(h.calls.leaderboard.every(({ game }) => game === 'lester-blaster'));
});

// --- Deep links (A6) -----------------------------------------------------------

function deepLink(pathname, { profile, board }) {
  let step = 'splash';
  const routeState = profile.routeState;
  const controller = createPortalRouteController({
    windowRef: { location: { pathname }, history: { pushState() {} }, addEventListener() {}, scrollTo() {}, requestAnimationFrame() {} },
    documentRef: { documentElement: { style: {} }, activeElement: null },
    getConnected: () => true,
    setStep: (next) => { step = next; },
    getSelectedGameId: () => 'lester-blaster',
    setSelectedGameId: () => {},
    getViewedWallet: () => routeState.viewedWallet ?? null,
    setViewedWallet: (wallet) => { routeState.viewedWallet = wallet ?? null; },
    render: () => {
      if (step === 'profile') profile.route.renderProfile();
      if (step === 'leaderboards') board.route.renderLeaderboards();
    },
    // main.js hydrateProfileFromIndex / hydrateLeaderboardFromIndex (hosted).
    hydrateProfile: () => { profile.route.hydrate().catch(() => {}); },
    hydrateLeaderboard: () => { board.route.hydrate().catch(() => {}); },
    isHtmlElement: () => false,
  });
  controller.applyLocation();
  return () => step;
}

test('deep links /profile/<wallet> and /scores still hydrate on first load', async () => {
  const profile = hostedProfileDeps();
  const board = boardDeps({ hosted: true });
  const profileLoader = deferredLoader(profileRouteModule);
  const boardLoader = deferredLoader(leaderboardRouteModule);
  profile.route = createLazyProfileRoute(profile.deps, { load: profileLoader.load });
  board.route = createLazyLeaderboardRoute(board.deps, { load: boardLoader.load });

  const step = deepLink(`/profile/${OTHER}`, { profile, board });
  assert.equal(step(), 'profile');
  assert.equal(profile.routeState.viewedWallet, OTHER);
  assert.match(text(profile.grid), /Loading verified profile…/);
  profileLoader.resolve();
  await settle(6);
  assert.deepEqual(profile.calls.profile, [[OTHER, { self: false }]], 'the viewed wallet\'s public profile is read once');
  assert.match(text(profile.grid), /Rival/);
  assert.equal(boardLoader.calls, 0, 'the Scores chunk is not downloaded for a profile link');

  const boardStep = deepLink('/scores', { profile, board });
  assert.equal(boardStep(), 'leaderboards');
  assert.match(text(board.grid), /Loading verified scores…/);
  boardLoader.resolve();
  await settle(6);
  assert.equal(board.calls.leaderboard.length, 1, 'the weekly board is read once');
  assert.match(text(board.grid), /Pilot 1/);
});

// --- The loader ----------------------------------------------------------------

test('the loader creates a synchronously supplied module at once and needs load and create', () => {
  assert.throws(() => createLazyRouteLoader({ create: () => ({}) }), /requires load/);
  assert.throws(() => createLazyRouteLoader({ load: () => ({}) }), /requires create/);
  const created = [];
  const loader = createLazyRouteLoader({ load: () => ({ tag: 'module' }), create: (module) => { created.push(module.tag); return { ready: true }; } });
  assert.deepEqual(loader.ensure(), { ready: true });
  assert.deepEqual(loader.ensure(), { ready: true });
  assert.deepEqual(created, ['module'], 'created once');
  assert.equal(loader.failed(), false);
});

test('a loader that throws, or a module without the factory, fails into Try again', async () => {
  const warnings = [];
  const throwing = createLazyRouteLoader({ load: () => { throw new Error('bad specifier'); }, create: () => ({}), warn: (...args) => warnings.push(args.join(' ')) });
  assert.equal(throwing.ensure(), null);
  assert.equal(await throwing.whenLoaded(), null);
  assert.equal(throwing.failed(), true);
  const h = previewProfileDeps();
  const route = createLazyProfileRoute(h.deps, { load: async () => ({}), warn: (...args) => warnings.push(args.join(' ')) });
  route.renderProfile();
  await settle();
  assert.equal(buttons(h.grid, 'Try again').length, 1, 'a chunk without createOfficialProfileRoute is a failed load');
  assert.equal(warnings.length, 2);
});

// --- Recovering from a failed chunk ------------------------------------------

test('Try again reloads the page when the import fails again (a failed module fetch stays failed)', async () => {
  for (const [name, make, render] of [
    ['Profile', (deps, options) => createLazyProfileRoute(deps, options), (route) => route.renderProfile()],
    ['Scores', (deps, options) => createLazyLeaderboardRoute(deps, options), (route) => route.renderLeaderboards()],
  ]) {
    const h = name === 'Profile' ? hostedProfileDeps() : boardDeps({ hosted: true });
    let loads = 0;
    let reloads = 0;
    // Chrome answers a second import() of a URL that failed from its module
    // map, without fetching: only a reload loads the chunk again.
    const route = make(h.deps, { load: () => { loads += 1; return Promise.reject(new Error('Failed to fetch dynamically imported module')); }, warn: () => {}, reload: () => { reloads += 1; } });
    render(route);
    await settle();
    assert.equal(buttons(h.grid, 'Try again').length, 1, name);
    buttons(h.grid, 'Try again')[0].listeners.click();
    await settle();
    assert.deepEqual([loads, reloads], [2, 1], `${name}: one more import, then one reload`);
    assert.equal(buttons(h.grid, 'Try again').length, 1, `${name}: the card stays until the page reloads`);
  }
});

test('Try again never reloads the portal under a player who left before the retry failed', async () => {
  for (const [name, make, render] of [
    ['Profile', (deps, options) => createLazyProfileRoute(deps, options), (route) => route.renderProfile()],
    ['Scores', (deps, options) => createLazyLeaderboardRoute(deps, options), (route) => route.renderLeaderboards()],
  ]) {
    let step = name === 'Profile' ? 'profile' : 'leaderboards';
    const own = step;
    const h = name === 'Profile' ? hostedProfileDeps() : boardDeps({ hosted: true });
    h.deps.isActive = () => step === own; // main.js: officialAppStep === '<page>'
    const loader = deferredLoader(name === 'Profile' ? profileRouteModule : leaderboardRouteModule);
    let reloads = 0;
    const route = make(h.deps, { load: loader.load, warn: () => {}, reload: () => { reloads += 1; } });
    render(route);
    loader.reject(new Error('Failed to fetch dynamically imported module'));
    await settle();
    buttons(h.grid, 'Try again')[0].listeners.click();
    assert.equal(loader.calls, 2, `${name}: Try again imports again`);
    // A slow retry: the player starts a run before it fails.
    step = 'gameplay';
    const gameplay = node('gameplay');
    h.grid.replaceChildren(gameplay);
    loader.reject(new Error('Failed to fetch dynamically imported module'));
    await settle();
    assert.equal(reloads, 0, `${name}: no reload while step = gameplay`);
    assert.deepEqual(h.grid.children, [gameplay], `${name}: the run keeps the screen`);

    // Back on the page, the card offers Try again; a retry that fails there reloads.
    step = own;
    render(route);
    assert.equal(buttons(h.grid, 'Try again').length, 1, `${name}: the next visit shows Try again`);
    assert.equal(loader.calls, 2, `${name}: the visit itself does not retry`);
    buttons(h.grid, 'Try again')[0].listeners.click();
    loader.reject(new Error('Failed to fetch dynamically imported module'));
    await settle();
    assert.equal(reloads, 1, `${name}: a retry that fails on screen reloads`);
  }
});

test('a hosted view chunk that fails lands on the same card, and Try again recovers it', async () => {
  const h = hostedProfileDeps();
  const route = deferredLoader(profileRouteModule);
  const hostedView = deferredLoader(hostedProfileView);
  let reloads = 0;
  const lazy = createLazyProfileRoute(h.deps, { load: route.load, loadHostedView: hostedView.load, warn: () => {}, reload: () => { reloads += 1; } });
  lazy.renderProfile();
  route.resolve();
  hostedView.reject(new Error('hosted view 404'));
  await settle();
  assert.match(text(h.grid), /This profile is unavailable right now\..*The verified profile could not load/);
  buttons(h.grid, 'Try again')[0].listeners.click();
  assert.deepEqual([route.calls, hostedView.calls], [2, 2], 'both chunks are asked for again');
  route.resolve();
  hostedView.resolve();
  await settle();
  assert.match(text(h.grid), /Your Verified Profile/);
  assert.equal(h.calls.profile.length, 1);
  assert.equal(reloads, 0);
});

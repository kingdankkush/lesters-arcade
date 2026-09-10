import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialProfileRoute } from '../apps/portal/src/routes/official-profile-route.mjs';
import * as profileRoute from '../apps/portal/src/routes/official-profile-route.mjs';
import * as arcadeCore from '../apps/portal/src/arcade-core.mjs';
import { createRunSummaryAccumulator, finalizeRunSummary } from '../sdk/hmh-run-summary.mjs';

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    listeners: {},
    classList: { values: [], add(value) { this.values.push(value); } },
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(key, value) { (this.attributes ??= {})[key] = value; },
  };
}

test('profile route renders guest local stats and connect CTA without wallet dependencies', () => {
  const grid = node('grid');
  const calls = { connect: 0, sfx: [] };
  const routeState = { gameId: 'lester-blaster', avatarJustSaved: false, usernameJustSaved: false };
  const context = {
    connectedWallet: null,
    connectedChainId: null,
    walletConnector: null,
    state: {},
    combat: { score: 12345, kills: 67, longestSurvivalThisRun: 125 },
  };
  const route = createOfficialProfileRoute({
    dom: { officialCabinetGrid: grid },
    routeState,
    getContext: () => context,
    el: (tag, props = {}) => node(tag, props),
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    renderAvatarChip: () => node('avatar'),
    isSimulatedWalletActive: () => false,
    playSfxCue: (cue) => calls.sfx.push(cue),
    connectWallet: () => { calls.connect += 1; },
    buildPlayerArcadeSnapshot: () => { throw new Error('wallet snapshot must not run for guests'); },
    buildProfileExperienceV2Model: () => { throw new Error('profile v2 must not run for guests'); },
  });

  route.renderProfile();
  assert.equal(grid.children.length, 2);
  assert.ok(grid.classList.values.includes('profile-command-grid'));
  const guestCard = grid.children[1];
  const flat = JSON.stringify(guestCard);
  assert.match(flat, /12,345/);
  assert.match(flat, /67/);
  assert.match(flat, /2:05/);
  assert.doesNotMatch(flat, /save progress permanently/i);
  assert.match(flat, /browser|device/i);
  assert.match(flat, /not.*available|not.*provide|not.*permanent/i);
  const connectButton = guestCard.children.find((child) => child.tag === 'button');
  assert.ok(connectButton);
  connectButton.listeners.click();
  assert.deepEqual(calls.sfx, ['menu-click']);
  assert.equal(calls.connect, 1);

  context.combat.score = 54321;
  route.renderProfile();
  assert.match(JSON.stringify(grid.children[1]), /54,321/, 'route must read fresh context on every render');
});

test('main delegates profile rendering and profile view state to the route module', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialProfileRoute/);
  assert.match(main, /const profileRouteState =/);
  assert.match(main, /createOfficialProfileRoute\([\s\S]*?documentRef: document/);
  assert.doesNotMatch(main, /function renderOfficialProfile\(/);
  assert.doesNotMatch(main, /let profileAvatarJustSaved/);
  assert.doesNotMatch(main, /let profileUsernameJustSaved/);
  assert.doesNotMatch(main, /let profileGameId/);
});

test('all-stats disclosure is native, lazy, complete and stable across repeated toggles', () => {
  assert.equal(typeof profileRoute.renderHmhRunDetails, 'function');
  const summary = finalizeRunSummary(createRunSummaryAccumulator({ seed: 7, buildHash: 'detail-test',
    mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 } }), {
    endTick: 60, elapsedMs: 1000, score: 41, level: 1, xp: 0, currentCombo: 0, maxCombo: 0,
    revealedCells: 0, totalCells: 10, terminalReason: 'defeated',
  });
  const detail = profileRoute.renderHmhRunDetails({ sessionId: 'ranked-1', runSummary: summary }, {
    el: node,
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
  });
  assert.equal(detail.tag, 'details');
  assert.equal(detail.children[0].tag, 'summary');
  assert.match(detail.children[0].textContent, /all captured stats/i);
  assert.equal(detail.children.length, 1, 'no hidden hundreds-of-fields DOM before opening');
  detail.open = true;
  detail.listeners.toggle();
  const flat = JSON.stringify(detail);
  assert.match(flat, /weapons.0.criticalHits/);
  assert.match(flat, /forkedStandard.droppedContacts/);
  assert.match(flat, /kills.byEnemyRole.0.count/);
  assert.match(flat, /lightningLedger.interruptions.invalidTarget/);
  assert.match(flat, /not.*on-chain/i);
  assert.match(flat, /not.*chronological/i);
  detail.open = false;
  detail.listeners.toggle();
  detail.open = true;
  detail.listeners.toggle();
  assert.equal(JSON.stringify(detail), flat, 'toggle does not append duplicate statistics');
});

test('profile history connects per-run disclosures and states its local retention limit', () => {
  const source = readFileSync(new URL('../apps/portal/src/routes/official-profile-route.mjs', import.meta.url), 'utf8');
  assert.match(source, /renderHmhRunDetails\(run,/);
  assert.match(source, /RUN_HISTORY_LIMIT/);
  assert.match(source, /hmhRunHistory.invalidRuns/);
  assert.match(source, /Recorded time unavailable/);
  assert.match(source, /testnet.*reset/i);
});

test('profile UI scopes cache statistics and does not render heuristic unlock rates', () => {
  const source = readFileSync(new URL('../apps/portal/src/routes/official-profile-route.mjs', import.meta.url), 'utf8');
  assert.match(source, /Cached Ranked Runs/);
  assert.match(source, /Cached Receipt Entries/);
  assert.match(source, /Global unlock rate unavailable/);
  assert.doesNotMatch(source, /rarityPct|approx.*unlock rate|Rarest unlocked badge|Rarest Badge/);
});

function connectedProfileTree({ history = [], settlements = [] } = {}) {
  const wallet = `0x${'c'.repeat(40)}`;
  const state = arcadeCore.createInitialArcadeState();
  state.profiles[wallet] = arcadeCore.createPlayerProfile(wallet, { handle: 'QA_Profile' });
  state.profiles[wallet].usernameSet = true;
  state.runHistory = history.map((row) => ({ wallet, gameId: 'lester-blaster', recordedAt: '2026-09-01T00:00:00.000Z', ...row }));
  const gameHistory = history.filter((row) => !row.gameId || row.gameId === 'lester-blaster');
  state.profiles[wallet].progress['lester-blaster'].paidRuns = gameHistory.filter((row) => row.mode === 'paid' || row.mode === 'ranked').length;
  state.profiles[wallet].progress['lester-blaster'].freeRuns = gameHistory.filter((row) => row.mode === 'free').length;
  state.settlements = settlements.map((row) => ({ wallet, gameId: 'lester-blaster', ...row }));
  const el = (tag, props = {}) => {
    const element = node(tag, { style: {}, dataset: {}, ...props });
    element.classList.remove = (...names) => { element.classList.values = element.classList.values.filter((v) => !names.includes(v)); };
    element.classList.toggle = (name, enabled) => { if (enabled) element.classList.add(name); else element.classList.remove(name); };
    return element;
  };
  const grid = el('div');
  const noWrite = () => { throw new Error('render must not invoke an account, persistence or gameplay action'); };
  const route = createOfficialProfileRoute({
    ...arcadeCore, el,
    dom: { officialCabinetGrid: grid },
    routeState: { gameId: 'lester-blaster', avatarJustSaved: false, usernameJustSaved: false },
    getContext: () => ({ connectedWallet: wallet, connectedChainId: null, walletConnector: 'qa-fixture', state, combat: {} }),
    appendText: (parent, tag, text, className = '') => parent.append(el(tag, { textContent: text, className })),
    renderAvatarChip: () => el('div'), renderAchievementIcon: () => el('img'), renderSimulatedWalletNotice: () => el('div'),
    isSimulatedWalletActive: () => true, detectEthereumProvider: () => null,
    formatSeconds: (seconds) => `${seconds}s`, formatSurvive: (seconds) => `${seconds}s`,
    documentRef: { createElement: el, createTextNode: (text) => el('#text', { textContent: text }) },
    connectWallet: noWrite, persistArcadeStateSoon: noWrite, playSfxCue: noWrite, renderNav: noWrite,
    setView: noWrite, setPlayerAvatar: noWrite, sanitizeAvatarImage: noWrite,
    requestAnimationFrameRef: (callback) => callback(),
  });
  route.renderProfile();
  return grid;
}
function descendants(element) { return [element, ...(element.children ?? []).flatMap(descendants)]; }
function hasClass(element, className) { return String(element.className ?? '').split(/\s+/).includes(className); }
function renderedText(element) { return descendants(element).map((n) => n.textContent ?? '').join(' '); }

test('the rendered trophy heading qualifies its count as cache coverage', () => {
  const tree = connectedProfileTree({ history: [{ sessionId: 'paid-one', score: 702, mode: 'paid' }] });
  const card = descendants(tree).find((n) => hasClass(n, 'profile-trophy-room-card'));
  assert.ok(card);
  const heading = card.children.find((n) => n.tag === 'strong');
  assert.match(heading.textContent, /cached.*ranked|ranked.*cache/i);
});

test('the rendered recent-Ranked list excludes Free and unknown modes', () => {
  const tree = connectedProfileTree({ history: ['free', 'paid', 'ranked', undefined].map((mode, i) => ({ sessionId: `mode-${i}`, mode, score: 701 + i })) });
  const card = descendants(tree).find((n) => hasClass(n, 'game-stats-card'));
  assert.ok(card);
  const rows = descendants(card).filter((n) => hasClass(n, 'game-history-row'));
  assert.equal(rows.length, 2);
  const text = rows.map(renderedText).join(' ');
  assert.match(text, /702 pts/); assert.match(text, /703 pts/);
  assert.doesNotMatch(text, /701 pts|704 pts/);
});

test('recent Ranked selection filters mode and cabinet before the feed limit', () => {
  const history = [
    ...Array.from({ length: 13 }, (_, i) => ({ sessionId: `new-free-${i}`, mode: 'free', score: 50 + i, recordedAt: '2026-09-03T00:00:00.000Z' })),
    ...Array.from({ length: 13 }, (_, i) => ({ sessionId: `other-game-${i}`, gameId: 'chikun', mode: 'paid', score: 150 + i, recordedAt: '2026-09-02T00:00:00.000Z' })),
    { sessionId: 'older-hmh-ranked', mode: 'ranked', score: 880, recordedAt: '2026-09-01T00:00:00.000Z' },
  ];
  const card = descendants(connectedProfileTree({ history })).find((n) => hasClass(n, 'game-stats-card'));
  const rows = descendants(card).filter((n) => hasClass(n, 'game-history-row'));
  assert.equal(rows.length, 1);
  assert.match(renderedText(rows[0]), /880 pts/);
});

test('the rendered settlement panel does not authenticate cached hashes or mode flags', () => {
  const tree = connectedProfileTree({ settlements: ['simulated', 'onchain'].map((mode, i) => ({ sessionId: `receipt-${i}`, score: 801 + i, mode, primaryTxHash: `0x${'4'.repeat(64)}`, settled: true, settledAt: '2026-09-01T00:00:00.000Z' })) });
  const card = descendants(tree).find((n) => hasClass(n, 'settlement-history-card'));
  assert.ok(card);
  assert.equal(descendants(card).filter((n) => hasClass(n, 'settlement-receipt')).length, 2);
  const text = renderedText(card);
  assert.match(text, /cached|local cache/i); assert.match(text, /not.*proof.*settlement|unverified/i);
  assert.doesNotMatch(text, /settled run|leaderboard stamped|each receipt stamps/i);
});

test('the empty settlement panel does not promise an available submission or gas-only settlement rail', () => {
  const card = descendants(connectedProfileTree()).find((n) => hasClass(n, 'settlement-history-card'));
  const text = renderedText(card);
  assert.match(text, /cached|local cache/i);
  assert.doesNotMatch(text, /settles score|fee covers gas|Submit Official Score/i);
});

test('the empty game-stat panel does not promise currently available Ranked publishing', () => {
  const card = descendants(connectedProfileTree()).find((n) => hasClass(n, 'game-stats-card'));
  const text = renderedText(card);
  assert.match(text, /local/i);
  assert.doesNotMatch(text, /then publish|publish.*to fill/i);
});

test('recent-run fallback labels never promote a cached hash to Settled', () => {
  const source = readFileSync(new URL('../apps/portal/src/routes/official-profile-route.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /primaryTxHash\s*\?\s*'Settled'/);
});

function achievementModule(snapshot, definitions) {
  assert.equal(typeof profileRoute.renderProfileAchievements, 'function');
  return profileRoute.renderProfileAchievements(snapshot, {
    ACHIEVEMENTS: definitions,
    el: node,
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    renderAchievementIcon: (props) => node('img', props),
  });
}
const achievementDefinition = { id: 'score-1000', title: 'A score badge', description: 'Reach 1,000 points.', tier: 'bronze', badgeSrc: 'unlocked.png', lockedBadgeSrc: 'locked.png' };
const flattenNodes = (root) => [root, ...(root.children ?? []).flatMap(flattenNodes)];

test('achievement module joins by stable ID, not title, and exposes native keyboard/touch disclosures', () => {
  const card = achievementModule({ achievements: [{ id: 'score-1000', title: 'Old title', unlocked: true, unlockedAt: '2026-09-10T05:00:00.000Z', iconSrc: 'unlocked.png' }] }, { SCORE: achievementDefinition });
  const nodes = flattenNodes(card);
  const details = nodes.find((n) => n.tag === 'details');
  assert.ok(details);
  assert.equal(details.children[0].tag, 'summary');
  assert.match(details.children[0].attributes['aria-label'], /A score badge.*Unlocked locally/);
  assert.equal(details.title, undefined, 'native disclosure replaces title-only tooltip');
  const badge = nodes.find((n) => n.className?.includes('profile-achievement-card'));
  assert.equal(badge.dataset.badgeFrame, 'achievement-tier-bronze');
  const time = nodes.find((n) => n.tag === 'time');
  assert.equal(time.attributes?.datetime, '2026-09-10T05:00:00.000Z');
  assert.match(time.textContent, /2026-09-10/);
  assert.match(JSON.stringify(card), /device-local|device local/i);
  assert.match(JSON.stringify(card), /not.*NFT/i);
});

test('achievement dates missing from legacy records stay explicitly unknown', () => {
  const card = achievementModule({ achievements: [{ id: 'score-1000', unlocked: true }] }, { SCORE: achievementDefinition });
  assert.match(JSON.stringify(card), /Unlock date not recorded/);
  assert.ok(!flattenNodes(card).some((n) => n.tag === 'time'));
});

test('achievement measured progress has a named native meter and visible counts including zero', () => {
  const card = achievementModule({ achievements: [{ id: 'score-1000', unlocked: false, progress: { status: 'measured', value: 0, target: 1000, fraction: 0, unit: 'best Ranked score' } }] }, { SCORE: achievementDefinition });
  const meter = flattenNodes(card).find((n) => n.tag === 'progress');
  assert.ok(meter);
  assert.equal(meter.attributes.value, '0');
  assert.equal(meter.attributes.max, '1000');
  assert.match(meter.attributes['aria-label'], /A score badge/);
  assert.match(JSON.stringify(card), /0 \/ 1000/);
});

test('achievement unavailable progress does not invent a meter or grant from a title collision', () => {
  const card = achievementModule({ achievements: [{ id: 'different-id', title: 'A score badge', unlocked: true }] }, { SCORE: achievementDefinition });
  assert.ok(!flattenNodes(card).some((n) => n.tag === 'progress'));
  assert.match(JSON.stringify(card), /Progress not recorded/);
  assert.match(JSON.stringify(card), /Locked/);
  assert.ok(flattenNodes(card).some((n) => n.tag === 'img' && n.iconSrc === 'locked.png'));
});

test('achievement renderer respects the browser read-only dataset property', () => {
  assert.doesNotThrow(() => profileRoute.renderProfileAchievements({ achievements: [] }, {
    ACHIEVEMENTS: { SCORE: achievementDefinition },
    el: (tag, props = {}) => {
      const result = node(tag, props);
      Object.defineProperty(result, 'dataset', { value: props.dataset ?? {}, writable: false });
      return result;
    },
    appendText: (parent, tag, text) => parent.append(node(tag, { textContent: text })),
    renderAchievementIcon: (props) => node('img', props),
  }));
});

test('achievement projection works through the actual portal DOM factory option allowlist', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('function el(');
  const end = main.indexOf('\nfunction appendText(', start);
  assert.ok(start >= 0 && end > start);
  const actualEl = runInNewContext(`(${main.slice(start, end)})`, { document: { createElement: (tag) => node(tag, { dataset: {} }) } });
  const card = profileRoute.renderProfileAchievements({ achievements: [{ id: achievementDefinition.id, unlocked: true,
    unlockedAt: '2026-09-10T05:00:00.000Z', progress: { status: 'measured', value: 75, target: 250, unit: 'score' } }] }, {
    ACHIEVEMENTS: { SCORE: achievementDefinition }, el: actualEl,
    appendText: (parent, tag, text, className) => parent.append(actualEl(tag, { textContent: text, className })),
    renderAchievementIcon: (props) => actualEl('img', { src: props.iconSrc, alt: props.label }),
  });
  const nodes = flattenNodes(card);
  assert.equal(nodes.find((n) => n.tag === 'time').attributes.datetime, '2026-09-10T05:00:00.000Z');
  assert.equal(nodes.find((n) => n.tag === 'progress').attributes.value, '75');
  assert.equal(nodes.find((n) => n.tag === 'progress').attributes.max, '250');
});

test('live profile route uses the achievement module and narrow-screen disclosure styles are scoped', () => {
  const source = readFileSync(new URL('../apps/portal/src/routes/official-profile-route.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../apps/portal/styles-arcade-polish.css', import.meta.url), 'utf8');
  assert.match(source, /renderProfileAchievements\(snapshot,/);
  assert.doesNotMatch(source, /unlockedByTitle/);
  assert.match(css, /\.achievement-disclosure[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.achievement-disclosure[\s\S]*?overflow-wrap:\s*anywhere/);
});

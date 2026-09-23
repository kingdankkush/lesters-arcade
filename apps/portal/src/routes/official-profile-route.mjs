import { buildChikunProfile } from '../chikun-profile.mjs';
import { buildHmhRunHistoryModel, buildHmhRunDetailsModel } from '../hmh-run-history.mjs';
import { RUN_HISTORY_LIMIT } from '../persistence.mjs';
import { normalizeAchievementUnlockDate } from '../achievement-progress.mjs';
import { buildStackedProfileFacts, stackedInputLabel } from '../stacked-profile.mjs';
import { ARCADE_AVATARS, ARCADE_AVATAR_URI_PREFIX, arcadeAvatarForUri } from '../arcade-avatars.mjs';
import { verifiedExplorerUrl } from '../leaderboard-view.mjs';
import { LITVM_DEPLOYMENT } from '../generated/litvm-addresses.mjs';

const formatPermille = (value) => `${(Math.max(0, Number(value) || 0) / 10).toFixed(1)}%`;
const titleCase = (value) => String(value ?? '').split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');

// DOM is created only when a player opens a run, not for every retained payload.
// Native details/summary supplies keyboard activation and expanded-state semantics.
export function renderHmhRunDetails(run, { el, appendText }) {
  const disclosure = el('details', { className: 'hmh-history-details' });
  disclosure.append(el('summary', { textContent: 'All captured stats', className: 'hmh-history-details-toggle' }));
  let rendered = false;
  disclosure.addEventListener('toggle', () => {
    if (!disclosure.open || rendered) return;
    rendered = true;
    const model = buildHmhRunDetailsModel(run.runSummary);
    if (!model) {
      appendText(disclosure, 'p', 'This summary is unavailable or does not match a supported schema.', 'tiny-note');
      return;
    }
    appendText(disclosure, 'p', `Session ${run.sessionId}`, 'hmh-history-session-id');
    appendText(disclosure, 'p', 'These are device-local gameplay facts, not verified on-chain stats. Ticks use 60 Hz; elapsed ms are milliseconds; distance milli is 1/1000 world unit; permille is parts per thousand. Litecoin is an in-game collectible count, not a wallet balance. Upgrade counts describe the final build, not a chronological selection history. Missing older-version fields are not reconstructed.', 'tiny-note');
    for (const section of model.sections) {
      const group = el('details', { className: 'hmh-history-stat-section' });
      group.append(el('summary', { textContent: section.label }));
      const fields = el('dl', { className: 'hmh-history-stat-fields' });
      for (const field of section.fields) {
        const pair = el('div', { className: 'hmh-history-stat-pair' });
        pair.setAttribute('data-stat-path', field.path);
        appendText(pair, 'dt', field.label);
        appendText(pair, 'dd', String(field.value));
        fields.append(pair);
      }
      group.append(fields);
      disclosure.append(group);
    }
  });
  return disclosure;
}

export function renderProfileAchievements(snapshot, { ACHIEVEMENTS, el, appendText, renderAchievementIcon }) {
  const byId = new Map((snapshot?.achievements ?? []).map((achievement) => [achievement.id, achievement]));
  const achievements = Object.values(ACHIEVEMENTS).map((definition) => {
    const record = byId.get(definition.id);
    return { ...definition, unlocked: record?.unlocked === true, unlockedAt: record?.unlockedAt,
      progress: record?.progress, iconSrc: record?.iconSrc };
  });
  const card = el('article', { className: 'official-info-card achievements-card achievements-module' });
  const head = el('div', { className: 'achievements-head' });
  appendText(head, 'span', 'ACHIEVEMENTS', 'cabinet-status-label');
  appendText(head, 'strong', `${achievements.filter((a) => a.unlocked).length} / ${achievements.length} unlocked`, 'achievements-count');
  card.append(head);
  appendText(card, 'p', 'Achievements earned on this device (preview). Dates record local unlocks. Progress uses recorded Ranked aggregates; missing or compound conditions are not estimated. Open a badge for its requirement.', 'tiny-note');
  const grid = el('div', { className: 'achievements-grid profile-achievement-grid' });
  for (const a of achievements) {
    const badge = el('article', {
      className: `${a.uiChrome?.badgeClassName ?? `achievement-badge tier-${a.tier ?? 'bronze'}`} profile-achievement-card ${a.unlocked ? 'unlocked' : 'locked'}`,
      dataset: { uiChrome: a.uiChrome?.toastFrameId ?? 'achievement-toast-frame', badgeFrame: a.uiChrome?.badgeFrameId ?? `achievement-tier-${a.tier ?? 'bronze'}` },
    });
    const disclosure = el('details', { className: 'achievement-disclosure' });
    const summary = el('summary');
    const status = a.unlocked ? 'Unlocked locally' : 'Locked';
    summary.setAttribute('aria-label', `${a.title}. ${status}. Show requirement`);
    summary.append(renderAchievementIcon({ iconSrc: a.iconSrc ?? (a.unlocked ? a.badgeSrc : a.lockedBadgeSrc), icon: a.unlocked ? (a.icon ?? '🏅') : '🔒', label: a.title }));
    appendText(summary, 'span', a.title, 'achievement-name');
    appendText(summary, 'small', status, 'achievement-record-status');
    disclosure.append(summary);
    appendText(disclosure, 'p', a.description, 'achievement-requirement');
    badge.append(disclosure);
    const date = a.unlocked ? normalizeAchievementUnlockDate(a.unlockedAt) : null;
    if (date) {
      const time = el('time', { textContent: `Unlocked ${date.slice(0, 10)} UTC`, className: 'achievement-record-date' });
      time.setAttribute('datetime', date);
      badge.append(time);
    }
    else if (a.unlocked) appendText(badge, 'small', 'Unlock date not recorded', 'achievement-record-date');
    if (a.progress?.status === 'measured') {
      const { value, target, unit } = a.progress;
      const meter = el('progress');
      meter.setAttribute('value', String(Math.min(value, target)));
      meter.setAttribute('max', String(target));
      meter.setAttribute('aria-label', `${a.title}: recorded local progress`);
      badge.append(meter);
      appendText(badge, 'small', `${value} / ${target} ${unit}`, 'achievement-progress-label');
    } else appendText(badge, 'small', 'Progress not recorded for this condition', 'achievement-progress-label');
    grid.append(badge);
  }
  card.append(grid);
  return card;
}

// ---------------------------------------------------------------------------
// Hosted profile (HOSTED_PROFILE_SYNC; guide §3.5, §5.7, contract §4.3.6, §7.8)
// ---------------------------------------------------------------------------

export const PROFILE_SHARE_ORIGIN = 'https://lestersarcade.io';
export const LITEFORGE_EXPLORER = 'https://liteforge.explorer.caldera.xyz';
export const HOSTED_PROFILE_GAMES = Object.freeze([
  Object.freeze({ gameId: 'lester-blaster', title: 'Hard Money Heroes' }),
  Object.freeze({ gameId: 'chikun', title: "Chikun's Escape" }),
  Object.freeze({ gameId: 'stacked', title: 'STACKED' }),
]);
export const BLOCKED_NAME_COPY = 'That name isn’t allowed here. Choose another.';
export const DEAD_LETTER_COPY = 'This run could not be published. Testnet entries are not refunded.';

const HEX_WALLET = /^0x[0-9a-fA-F]{40}$/;
const walletKey = (value) => (HEX_WALLET.test(String(value ?? '')) ? String(value).toLowerCase() : null);
const shortWallet = (wallet) => (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '');
const gameTitleFor = (gameId) => HOSTED_PROFILE_GAMES.find((game) => game.gameId === gameId)?.title ?? String(gameId ?? '');

// https://lestersarcade.io/profile/<wallet>
export function profileShareUrl(wallet) {
  const key = walletKey(wallet);
  return key ? `${PROFILE_SHARE_ORIGIN}/profile/${key}` : `${PROFILE_SHARE_ORIGIN}/profile`;
}

// Plain words for the allowlisted lastError codes of contract §4.4. A raw code
// is never shown: an unknown one reads as a generic hold-up.
const SETTLE_ERROR_WORDS = Object.freeze({
  'relayer-not-allowed': 'the publishing service is not ready yet',
  'relayer-underfunded': 'the publishing service is waiting for gas',
  'fee-too-high': 'LiteForge fees are high right now',
  'rpc-unavailable': 'LiteForge could not be reached',
  'rpc-timeout': 'LiteForge took too long to answer',
  'lease-busy': 'the publishing queue is busy',
  'nonce-conflict': 'the publishing queue is catching up',
  'dropped-tx': 'the network dropped the transaction',
  'verifier-rejected': 'the verifier asked for a fresh signature',
  'stored-run-mismatch': 'the stored run did not match its record',
  'settlement-paused': 'Ranked publishing is paused',
  stale: 'it waited too long to publish',
  'attestation-expired': 'its signature expired and is being renewed',
  'invalid-attestation': 'its signature is being renewed',
  'game-not-playable': 'this game is paused on LitVM',
  'ranked-entry-unset': 'the Ranked entry contract is not connected yet',
  'session-not-paid': 'LitVM could not find the paid entry',
  'session-exists': 'it was already published',
  'score-out-of-bounds': 'the score is outside the allowed range',
  'kills-out-of-bounds': 'a stat is outside the allowed range',
  'combo-out-of-bounds': 'a stat is outside the allowed range',
  'survival-out-of-bounds': 'a stat is outside the allowed range',
  'too-many-achievements': 'it carried too many achievements',
  'achievements-hash-mismatch': 'its achievements did not match',
  'empty-envelope-hash': 'its evidence record was incomplete',
  'empty-session-id': 'its session record was incomplete',
  'empty-game-id': 'its session record was incomplete',
  'empty-player': 'its session record was incomplete',
  'unknown-error': 'something went wrong while publishing',
});

export function settleErrorWords(code) {
  if (code == null || code === '') return null;
  return Object.hasOwn(SETTLE_ERROR_WORDS, code) ? SETTLE_ERROR_WORDS[code] : SETTLE_ERROR_WORDS['unknown-error'];
}

function relativeTime(iso, now) {
  const at = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(at)) return null;
  const minutes = Math.round((at - now) / 60_000);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `in ${hours}h` : `in ${Math.round(hours / 24)}d`;
}

// How a recent session reads on the profile (§4.3.6, D10). `retry` is true only
// on the owner's self view for a failed or signed run that can still publish;
// a dead letter (not retryable, not confirmed) says so and offers no button.
export function hostedSessionStatus(session = {}, { self = false, now = Date.now() } = {}) {
  const status = String(session.status ?? '');
  if (status === 'confirmed') return Object.freeze({ tone: 'verified', label: 'Published on LitVM', detail: null, retry: false, deadLetter: false });
  if (!self) return Object.freeze({ tone: 'pending', label: 'Publishing to LitVM…', detail: null, retry: false, deadLetter: false });
  const words = settleErrorWords(session.lastError);
  if (session.retryable === false) {
    return Object.freeze({ tone: 'failed', label: 'Not published', detail: words ? `${DEAD_LETTER_COPY} (${words}.)` : DEAD_LETTER_COPY, retry: false, deadLetter: true });
  }
  if (status === 'submitted') return Object.freeze({ tone: 'pending', label: 'Publishing to LitVM…', detail: null, retry: false, deadLetter: false });
  const next = relativeTime(session.nextAttemptAt, now);
  const retry = ['failed', 'signed'].includes(status) && session.retryable === true;
  const detail = status === 'failed'
    ? `Waiting to publish${words ? `: ${words}` : ''}.${next ? ` Next automatic try ${next}.` : ''}`
    : 'Signed and queued for LitVM.';
  return Object.freeze({ tone: status === 'failed' ? 'retrying' : 'pending', label: status === 'failed' ? 'Waiting to retry' : 'Queued to publish', detail, retry, deadLetter: false });
}

const TOTAL_LABELS = Object.freeze({
  kills: 'Kills', bossKills: 'Boss kills', survivalSeconds: 'Time survived', maxCombo: 'Combo total', level: 'Levels',
  forksPassed: 'Obstacles cleared', nearMisses: 'Near misses', coinsCollected: 'Coins', bestCombo: 'Combo total', laps: 'Laps',
  lines: 'Lines', quadClears: 'Halvings', perfectClears: 'Perfect clears',
});

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

const rankLabel = (rank) => (Number.isInteger(rank) && rank > 0 ? `#${rank.toLocaleString()}` : '—');

// The Profile page. Hosted (HOSTED_PROFILE_SYNC): the viewed wallet's public
// profile from GET /api/profile (/profile/<wallet>, or the connected wallet at
// /profile), the owner's self view with D10 retries, and the on-chain name and
// avatar editor once the contracts are deployed. Preview: today's
// device-local profile, with no request of any kind (A22).
export function createOfficialProfileRoute({
  ACHIEVEMENTS,
  ARCADE_GAMES,
  appendText,
  buildHardMoneyHeroesStatsModule,
  buildPlayerArcadeSnapshot,
  buildProfileExperienceV2Model,
  buildWalletConnectionModel,
  connectWallet,
  detectEthereumProvider,
  documentRef = globalThis.document,
  dom,
  el,
  FileReaderClass = globalThis.FileReader,
  formatSeconds,
  formatSurvive,
  getContext,
  getGame,
  isSimulatedWalletActive,
  persistArcadeStateSoon,
  playSfxCue,
  renderAchievementIcon,
  renderAvatarChip,
  renderNav,
  renderSimulatedWalletNotice,
  requestAnimationFrameRef = globalThis.requestAnimationFrame,
  routeState,
  sanitizeAvatarImage,
  setArcadeUsername,
  setPlayerAvatar,
  setView,
  validateAvatarFile,
  validateUsername,
  hosted = false,
  indexApi = null,
  deployment = LITVM_DEPLOYMENT,
  isAuthenticated = () => false,
  isActive = () => true,
  dispatchEvent = () => ({ handled: false }),
  loadProfileChain = () => import('../profile-chain.mjs'),
  loadEthers = () => import('../litvm-chain-client.mjs').then((module) => module.loadEthers()),
  loadAchievementCatalog = () => import('../achievements/index.mjs'),
  loadChainClient = () => import('../litvm-chain-client.mjs'),
  rpcUrl = 'https://liteforge.rpc.caldera.xyz/http',
  copyText = (text) => (globalThis.navigator?.clipboard?.writeText
    ? globalThis.navigator.clipboard.writeText(text)
    : Promise.reject(new Error('clipboard unavailable'))),
  playRanked = null,
  now = () => Date.now(),
} = {}) {
  // --- Hosted profile state (index data only; A22) --------------------------
  const hostedProfiles = new Map(); // `${wallet}|self|public` -> { status, response, request, error }
  const heldTokens = new Map(); // wallet -> { status, confirmed: Set('<gameId>:<id>') }
  const selfRejected = new Set(); // wallets whose token the self view refused (until the session changes)
  let achievementCatalog = null;
  let catalogRequest = null;
  let pendingSavedRuns = 0;
  const nameEditor = { wallet: null, raw: null, avatarUri: null, prepared: null, busy: false, message: '', tone: '' };

  function rerenderIfShown() {
    if (isActive()) renderOfficialProfile();
  }

  // Whose profile is on screen, and whether the viewer may read its self view.
  function viewedTarget() {
    const { connectedWallet } = getContext();
    const connected = walletKey(connectedWallet);
    const wallet = walletKey(routeState.viewedWallet) ?? connected;
    const own = Boolean(wallet) && wallet === connected;
    return { wallet, own, self: own && !selfRejected.has(wallet) && Boolean(isAuthenticated(wallet)) };
  }

  function profileEntry({ wallet, self }) {
    const key = `${wallet}|${self ? 'self' : 'public'}`;
    if (!hostedProfiles.has(key)) hostedProfiles.set(key, { status: 'idle', response: null, request: null, error: null });
    return hostedProfiles.get(key);
  }

  function loadCatalog() {
    if (achievementCatalog || catalogRequest || typeof loadAchievementCatalog !== 'function') return;
    catalogRequest = Promise.resolve()
      .then(() => loadAchievementCatalog())
      .then((module) => { achievementCatalog = module; rerenderIfShown(); })
      .catch(() => { /* titles fall back to ids */ })
      .finally(() => { catalogRequest = null; });
  }

  // Phase 2 only (A32): a held token shows its badge after the public RPC
  // confirms it with fetchPlayerAchievements; a failed confirmation hides the
  // badge, never the achievement.
  function confirmHeldTokens(wallet, response) {
    const held = (response?.achievements ?? []).filter((unlock) => unlock?.tokenId != null);
    if (!held.length || heldTokens.has(wallet) || typeof loadChainClient !== 'function') return;
    const record = { status: 'checking', confirmed: new Set() };
    heldTokens.set(wallet, record);
    const byGame = new Map();
    for (const unlock of held) byGame.set(unlock.gameId, [...(byGame.get(unlock.gameId) ?? []), unlock.id]);
    Promise.resolve()
      .then(() => loadChainClient())
      .then(async ({ fetchPlayerAchievements }) => {
        for (const [gameId, ids] of byGame) {
          // eslint-disable-next-line no-await-in-loop
          const answer = await fetchPlayerAchievements(wallet, ids, { gameId });
          if (answer?.ok) for (const id of answer.unlocked ?? []) record.confirmed.add(`${gameId}:${id}`);
        }
        record.status = 'done';
      })
      .catch(() => { record.status = 'failed'; })
      .finally(() => rerenderIfShown());
  }

  // The hydrate hook: read E6 (or the self view) for the wallet on screen.
  function hydrate({ force = false } = {}) {
    if (!hosted || !indexApi) return Promise.resolve(null);
    const target = viewedTarget();
    if (!target.wallet) return Promise.resolve(null);
    loadCatalog();
    const entry = profileEntry(target);
    if (entry.request) return entry.request;
    if (entry.status === 'ready' && !force) return Promise.resolve(entry);
    entry.status = entry.response ? 'refreshing' : 'loading';
    entry.request = indexApi.profile(target.wallet, { self: target.self }).then((answer) => {
      entry.request = null;
      if (!answer?.ok) {
        // A dead token was discarded by the client: read the public view instead.
        if (target.self && (answer?.status === 401 || answer?.error === 'sign-in-required')) {
          entry.status = 'idle';
          selfRejected.add(target.wallet);
          return hydrate();
        }
        entry.status = answer?.error === 'network' ? 'offline' : 'error';
        entry.error = answer?.error ?? 'error';
      } else {
        entry.status = 'ready';
        entry.response = answer;
        entry.error = null;
        confirmHeldTokens(target.wallet, answer);
      }
      rerenderIfShown();
      return entry;
    });
    return entry.request;
  }

  function invalidate(wallet = null) {
    const key = walletKey(wallet);
    for (const cacheKey of [...hostedProfiles.keys()]) {
      if (!key || cacheKey.startsWith(`${key}|`)) hostedProfiles.delete(cacheKey);
    }
    if (key) {
      heldTokens.delete(key);
      selfRejected.delete(key);
    } else {
      heldTokens.clear();
      selfRejected.clear();
    }
  }

  // The last self view read for a wallet (the name-claim prompt reuses it).
  function cachedSelfProfile(wallet) {
    const key = walletKey(wallet);
    return key ? hostedProfiles.get(`${key}|self`)?.response ?? null : null;
  }

  // lesters:ranked-pending { count } (ranked-client, §7.7).
  function setPendingSavedRuns(count) {
    const next = Math.max(0, Math.floor(Number(count) || 0));
    if (next === pendingSavedRuns) return;
    pendingSavedRuns = next;
    rerenderIfShown();
  }

  // D10: the ranked client retries its own handle when it holds one (it marks
  // the cancelable request handled); otherwise the stored settle is retried
  // through E3's retry body. Then the self view is read again.
  async function retrySession(sessionId32) {
    const outcome = dispatchEvent('lesters:ranked-retry-request', { sessionId32 }, { cancelable: true }) ?? {};
    if (!outcome.handled) await indexApi?.retrySettle?.(sessionId32);
    await hydrate({ force: true });
  }

  function hostedAvatar(avatarUri, label, sizeClass) {
    const avatar = arcadeAvatarForUri(avatarUri);
    if (!avatar) return renderAvatarChip(null, label, sizeClass);
    return el('img', { className: `avatar-chip-img ${sizeClass}`, src: avatar.src, alt: `${avatar.label} avatar` });
  }

  function statGrid(className, stats) {
    const grid = el('div', { className });
    for (const [label, value] of stats) {
      const cell = el('div', { className: 'game-stat-cell' });
      appendText(cell, 'span', value, 'game-stat-value');
      appendText(cell, 'span', label, 'game-stat-label');
      grid.append(cell);
    }
    return grid;
  }

  function renderHostedGuest() {
    const card = el('article', { className: 'official-info-card profile-guest-card' });
    appendText(card, 'span', 'Wallet Profiles', 'cabinet-status-label');
    appendText(card, 'strong', 'Connect a wallet to open your verified profile');
    appendText(card, 'small', 'Every wallet has a public profile of its verified Ranked runs. Open any player from the Scores page, or connect to see your own.');
    const connect = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Connect Wallet' });
    connect.addEventListener('click', () => { playSfxCue('menu-click'); connectWallet(); });
    card.append(connect);
    dom.officialCabinetGrid.append(card);
  }

  function renderHostedHero(target, response, entry) {
    const profile = response?.profile ?? {};
    const games = response?.games ?? {};
    const name = profile.displayName || shortWallet(target.wallet);
    const hero = el('article', { className: 'official-info-card profile-hero-card profile-hero-hosted hmh-visual-polish-v12' });
    appendText(hero, 'span', target.own ? 'Your Verified Profile' : 'Player Profile', 'cabinet-status-label');
    const top = el('div', { className: 'profile-hero-topline' });
    top.append(hostedAvatar(profile.avatarUri, name, 'profile-hero-avatar'));
    const identity = el('div', { className: 'profile-hero-identity' });
    appendText(identity, 'strong', name, 'profile-hero-name');
    appendText(identity, 'small', `${shortWallet(target.wallet)}${target.own ? ' · this is you' : ''} · verified Ranked runs on LitVM`);
    if (target.own && target.self && profile.nameBlocked) appendText(identity, 'p', BLOCKED_NAME_COPY, 'profile-name-blocked username-feedback');
    top.append(identity);
    hero.append(top);
    if (response) {
      const all = Object.values(games);
      const rankedRuns = all.reduce((sum, game) => sum + (Number(game?.rankedRuns) || 0), 0);
      const verifiedRuns = all.reduce((sum, game) => sum + (Number(game?.confirmedRuns) || 0), 0);
      const best = all.reduce((max, game) => Math.max(max, Number(game?.bestScore) || 0), 0);
      const stats = el('div', { className: 'profile-hero-stats' });
      for (const [label, value] of [
        ['Ranked Runs', rankedRuns.toLocaleString()],
        ['Verified Runs', verifiedRuns.toLocaleString()],
        ['Best Score', best.toLocaleString()],
        ['Achievements', (response.achievements ?? []).length.toLocaleString()],
      ]) {
        const stat = el('div', { className: 'profile-hero-stat' });
        appendText(stat, 'span', label);
        appendText(stat, 'strong', value);
        stats.append(stat);
      }
      hero.append(stats);
    }
    const actions = el('div', { className: 'profile-quick-actions' });
    const share = el('button', { className: 'pixel-button profile-share-button', type: 'button', textContent: 'Share profile' });
    const shareNote = el('small', { className: 'profile-share-feedback tiny-note' });
    share.addEventListener('click', async () => {
      playSfxCue('menu-click', 0.05);
      const url = profileShareUrl(target.wallet);
      try {
        await copyText(url);
        shareNote.textContent = 'Profile link copied.';
      } catch {
        shareNote.textContent = url;
      }
    });
    actions.append(share);
    if (target.own) {
      const play = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Play Ranked' });
      play.addEventListener('click', () => { playSfxCue('menu-click'); if (playRanked) playRanked(routeState.gameId); else setView('mode-select'); });
      actions.append(play);
    } else if (walletKey(getContext().connectedWallet)) {
      const mine = el('button', { className: 'pixel-button', type: 'button', textContent: 'View my profile' });
      mine.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setView('profile', { wallet: null }); });
      actions.append(mine);
    }
    const board = el('button', { className: 'pixel-button', type: 'button', textContent: 'View Leaderboard' });
    board.addEventListener('click', () => { playSfxCue('menu-click'); setView('leaderboards'); });
    actions.append(board);
    hero.append(actions, shareNote);
    if (entry.status === 'refreshing') appendText(hero, 'small', 'Refreshing…', 'tiny-note profile-refreshing');
    dom.officialCabinetGrid.append(hero);
  }

  function renderHostedGames(response) {
    const card = el('article', { className: 'official-info-card game-stats-card profile-verified-games-card' });
    appendText(card, 'span', 'VERIFIED RANKED STATS', 'cabinet-status-label');
    const bar = el('div', { className: 'leaderboard-game-tabs profile-game-tabs' });
    for (const game of HOSTED_PROFILE_GAMES) {
      const tab = el('button', { className: `pixel-button leaderboard-game-tab${game.gameId === routeState.gameId ? ' is-active' : ''}`, type: 'button' });
      appendText(tab, 'span', game.title, 'leaderboard-game-tab-title');
      tab.addEventListener('click', () => {
        if (routeState.gameId === game.gameId) return;
        routeState.gameId = game.gameId;
        renderOfficialProfile();
      });
      bar.append(tab);
    }
    card.append(bar);
    const game = response?.games?.[routeState.gameId] ?? null;
    if (!game || !(Number(game.rankedRuns) > 0)) {
      const empty = el('div', { className: 'profile-empty-state' });
      appendText(empty, 'strong', `No verified Ranked runs for ${gameTitleFor(routeState.gameId)} yet.`);
      appendText(empty, 'small', 'Ranked runs show here once they are published on LitVM.');
      card.append(empty);
      dom.officialCabinetGrid.append(card);
      return;
    }
    const last = Date.parse(String(game.lastPlayedAt ?? ''));
    card.append(statGrid('game-stats-grid profile-stats-grid-v9', [
      ['Best Score', game.bestScore == null ? '—' : Number(game.bestScore).toLocaleString()],
      ['Weekly Rank', rankLabel(game.ranks?.weekly)],
      ['Monthly Rank', rankLabel(game.ranks?.monthly)],
      ['All-time Rank', rankLabel(game.ranks?.allTime)],
      ['Ranked Runs', Number(game.rankedRuns || 0).toLocaleString()],
      ['Verified Runs', Number(game.confirmedRuns || 0).toLocaleString()],
      ['Last Played', Number.isFinite(last) ? new Date(last).toLocaleDateString() : '—'],
    ]));
    const totals = Object.entries(game.totals ?? {}).filter(([key, value]) => Object.hasOwn(TOTAL_LABELS, key) && Number.isFinite(Number(value)));
    if (totals.length) {
      appendText(card, 'span', 'VERIFIED TOTALS', 'cabinet-status-label game-stats-subhead');
      card.append(statGrid('game-stats-grid profile-totals-grid', totals.map(([key, value]) => [TOTAL_LABELS[key], key === 'survivalSeconds' ? formatDuration(value) : Number(value).toLocaleString()])));
    }
    dom.officialCabinetGrid.append(card);
  }

  function renderHostedSessions(target, response) {
    const card = el('article', { className: 'official-info-card profile-recent-sessions-card settlement-history-card' });
    appendText(card, 'span', 'RECENT RANKED RUNS', 'cabinet-status-label');
    const sessions = Array.isArray(response?.recentSessions) ? response.recentSessions : [];
    appendText(card, 'strong', sessions.length ? `${sessions.length} recent run${sessions.length === 1 ? '' : 's'}` : 'No Ranked runs yet');
    if (target.own && target.self && pendingSavedRuns > 0) {
      const saved = el('div', { className: 'profile-saved-runs' });
      appendText(saved, 'span', `${pendingSavedRuns} run${pendingSavedRuns === 1 ? '' : 's'} saved on this device`, 'profile-saved-runs-count');
      const retryAll = el('button', { className: 'pixel-button profile-retry-saved', type: 'button', textContent: 'Retry saved runs' });
      retryAll.addEventListener('click', () => {
        playSfxCue('menu-click', 0.05);
        dispatchEvent('lesters:ranked-retry-request', { sessionId32: null }, { cancelable: true });
      });
      saved.append(retryAll);
      card.append(saved);
    }
    const list = el('div', { className: 'game-history-list profile-session-list' });
    const clock = now();
    for (const session of sessions) {
      const status = hostedSessionStatus(session, { self: target.own && target.self, now: clock });
      const row = el('div', { className: `game-history-row profile-session-row session-${status.tone}` });
      appendText(row, 'span', `${Number(session.score ?? 0).toLocaleString()} pts`, 'game-history-score');
      const when = Date.parse(String(session.confirmedAt ?? session.verifiedAt ?? ''));
      appendText(row, 'span', `${gameTitleFor(session.gameId)}${Number.isFinite(when) ? ` · ${new Date(when).toLocaleDateString()}` : ''}`, 'game-history-detail');
      appendText(row, 'span', status.label, `game-history-chain trust-${status.tone}`);
      const explorerUrl = verifiedExplorerUrl(session.explorerUrl);
      if (status.tone === 'verified' && explorerUrl) {
        row.append(el('a', { className: 'game-history-link lt-verified-link', href: explorerUrl, target: '_blank', rel: 'noopener noreferrer', textContent: '⛓ verified' }));
      }
      if (status.tone === 'verified' && /^[0-9a-f]{64}$/.test(String(session.shareId ?? ''))) {
        row.append(el('a', { className: 'game-history-link profile-session-share', href: `/s/${session.shareId}`, textContent: 'Run page' }));
      }
      if (status.detail) appendText(row, 'small', status.detail, status.deadLetter ? 'profile-session-dead-letter tiny-note' : 'profile-session-detail tiny-note');
      if (status.retry) {
        const retry = el('button', { className: 'pixel-button profile-session-retry', type: 'button', textContent: 'Retry' });
        retry.addEventListener('click', () => {
          playSfxCue('menu-click', 0.05);
          retry.disabled = true;
          void retrySession(session.sessionId32);
        });
        row.append(retry);
      }
      list.append(row);
    }
    if (!sessions.length) appendText(list, 'small', target.own ? 'Play Ranked and your published runs appear here with their LitVM transactions.' : 'This wallet has no published Ranked runs yet.', 'profile-empty-state');
    card.append(list);
    dom.officialCabinetGrid.append(card);
  }

  function renderHostedAchievements(target, response) {
    const unlocks = Array.isArray(response?.achievements) ? response.achievements : [];
    const card = el('article', { className: 'official-info-card achievements-card achievements-module profile-verified-achievements' });
    const head = el('div', { className: 'achievements-head' });
    appendText(head, 'span', 'ACHIEVEMENTS', 'cabinet-status-label');
    appendText(head, 'strong', `${unlocks.length} unlocked`, 'achievements-count');
    card.append(head);
    appendText(card, 'p', 'Earned from verified Ranked runs and recorded by the arcade server against this wallet.', 'tiny-note');
    const grid = el('div', { className: 'achievements-grid profile-achievement-grid' });
    const held = heldTokens.get(target.wallet);
    for (const unlock of unlocks) {
      let definition = null;
      try { definition = achievementCatalog?.achievementById?.(unlock.gameId, unlock.id) ?? null; } catch { definition = null; }
      const tier = definition?.tier ?? unlock.tier ?? 'bronze';
      const title = definition?.title ?? unlock.id;
      const badge = el('article', { className: `achievement-badge tier-${tier} profile-achievement-card unlocked`, dataset: { achievement: unlock.id, game: unlock.gameId } });
      badge.append(renderAchievementIcon({ iconSrc: definition?.image ?? null, icon: '🏅', label: title }));
      appendText(badge, 'span', title, 'achievement-name');
      appendText(badge, 'small', `${gameTitleFor(unlock.gameId)} · ${tier}`, 'achievement-record-status');
      if (definition?.description) appendText(badge, 'p', definition.description, 'achievement-requirement');
      const date = normalizeAchievementUnlockDate(unlock.unlockedAt);
      if (date) {
        const time = el('time', { textContent: `Unlocked ${date.slice(0, 10)} UTC`, className: 'achievement-record-date' });
        time.setAttribute('datetime', date);
        badge.append(time);
      }
      // Phase 2 (A32): only a token the chain confirms is shown as one.
      if (unlock.tokenId != null && held?.confirmed?.has(`${unlock.gameId}:${unlock.id}`)) {
        appendText(badge, 'span', '⛓ Soulbound NFT', 'achievement-token-badge');
        const collection = deployment?.addresses?.achievementRegistries?.[unlock.gameId];
        const href = /^0x[0-9a-fA-F]{64}$/.test(String(unlock.mintTxHash ?? ''))
          ? `${LITEFORGE_EXPLORER}/tx/${unlock.mintTxHash}`
          : collection ? `${LITEFORGE_EXPLORER}/token/${collection}/instance/${unlock.tokenId}` : null;
        if (href) badge.append(el('a', { className: 'achievement-token-link', href, target: '_blank', rel: 'noopener noreferrer', textContent: 'View token' }));
      }
      grid.append(badge);
    }
    if (!unlocks.length) appendText(grid, 'small', target.own ? 'Your first verified Ranked run can unlock achievements.' : 'No achievements yet.', 'profile-empty-state');
    card.append(grid);
    dom.officialCabinetGrid.append(card);
  }

  // Names and avatars change on chain together through setProfile (D3). Only
  // for the connected, authenticated wallet, and only once the contracts are
  // deployed; every wallet prompt comes from a button.
  function renderOnchainEditor(target, response) {
    if (nameEditor.wallet !== target.wallet) Object.assign(nameEditor, { wallet: target.wallet, raw: null, avatarUri: null, prepared: null, busy: false, message: '', tone: '' });
    const profile = response?.profile ?? {};
    const card = el('article', { className: 'official-info-card username-editor-card profile-onchain-name-card' });
    appendText(card, 'span', 'NAME & AVATAR', 'cabinet-status-label');
    appendText(card, 'small', 'Your name and avatar live on LitVM, tied to this wallet. Saving is a small transaction you pay in zkLTC. 3–18 characters: letters, numbers, spaces and _ - .');
    if (profile.nameBlocked) appendText(card, 'p', BLOCKED_NAME_COPY, 'username-feedback profile-name-blocked');
    const form = el('div', { className: 'username-editor-form' });
    const input = el('input', { className: 'username-input profile-onchain-name-input', type: 'text' });
    input.maxLength = 18;
    input.placeholder = 'Your arcade name';
    input.value = nameEditor.raw ?? profile.displayName ?? '';
    input.setAttribute('aria-label', 'Arcade name');
    input.addEventListener('input', () => { nameEditor.raw = input.value; nameEditor.prepared = null; });
    const check = el('button', { className: 'pixel-button username-save-button', type: 'button', textContent: 'Check name & fee' });
    form.append(input, check);
    card.append(form);

    const picker = el('div', { className: 'leaderboard-game-tabs profile-avatar-picker', role: 'group' });
    picker.setAttribute('aria-label', 'Choose an arcade avatar');
    const chosen = nameEditor.avatarUri ?? (arcadeAvatarForUri(profile.avatarUri) ? profile.avatarUri : '');
    for (const avatar of ARCADE_AVATARS) {
      const uri = `${ARCADE_AVATAR_URI_PREFIX}${avatar.id}`;
      const option = el('button', { className: `pixel-button profile-avatar-option${uri === chosen ? ' is-active' : ''}`, type: 'button', title: avatar.label });
      option.setAttribute('aria-pressed', uri === chosen ? 'true' : 'false');
      option.dataset.avatar = avatar.id;
      const image = el('img', { className: 'avatar-chip-img profile-avatar-choice', src: avatar.src, alt: avatar.label });
      // Some arcade avatars are large portrait strips: size the choice explicitly
      // (object-fit: cover on .avatar-chip-img shows the centred portrait).
      image.width = 56;
      image.height = 56;
      image.loading = 'lazy';
      image.decoding = 'async';
      option.append(image);
      option.addEventListener('click', () => {
        nameEditor.avatarUri = uri;
        nameEditor.raw = input.value;
        nameEditor.prepared = null;
        playSfxCue('menu-click', 0.05);
        renderOfficialProfile();
      });
      picker.append(option);
    }
    card.append(picker);

    const feedback = el('p', { className: 'username-feedback tiny-note profile-onchain-feedback', textContent: nameEditor.message });
    feedback.setAttribute('role', 'status');
    if (nameEditor.tone) feedback.dataset.state = nameEditor.tone;
    card.append(feedback);
    const setStatus = (message, tone = '') => {
      nameEditor.message = message;
      nameEditor.tone = tone;
      feedback.textContent = message;
      feedback.dataset.state = tone;
    };

    check.disabled = nameEditor.busy;
    check.addEventListener('click', async () => {
      if (nameEditor.busy) return;
      nameEditor.busy = true;
      nameEditor.raw = input.value;
      nameEditor.prepared = null;
      setStatus('Checking the name on LitVM…');
      try {
        const [chain, ethers] = await Promise.all([loadProfileChain(), loadEthers()]);
        const prepared = await chain.prepareProfileChange({
          raw: input.value,
          avatarUri: nameEditor.avatarUri ?? chosen ?? '',
          wallet: target.wallet,
          walletProvider: detectEthereumProvider(),
          readProvider: chain.publicReadProvider(ethers, rpcUrl),
          ethers,
          registryAddress: deployment?.addresses?.playerProfileRegistry,
        });
        nameEditor.prepared = prepared.ok ? prepared : null;
        if (prepared.ok) nameEditor.raw = prepared.cleaned;
        setStatus(prepared.ok ? `${prepared.cleaned} is free. ${prepared.feeLabel}.` : prepared.message, prepared.ok ? 'ok' : 'error');
      } catch {
        setStatus('Could not check that name right now. Try again.', 'error');
      } finally {
        nameEditor.busy = false;
        renderOfficialProfile();
      }
    });

    if (nameEditor.prepared?.ok && nameEditor.prepared.wallet === target.wallet) {
      const confirm = el('button', { className: 'pixel-button profile-action-primary profile-onchain-confirm', type: 'button', textContent: 'Confirm in wallet' });
      confirm.disabled = nameEditor.busy;
      confirm.addEventListener('click', async () => {
        if (nameEditor.busy || !nameEditor.prepared) return;
        nameEditor.busy = true;
        confirm.disabled = true;
        setStatus('Confirm the change in your wallet…');
        try {
          const [chain, ethers] = await Promise.all([loadProfileChain(), loadEthers()]);
          const done = await chain.commitProfileChange(nameEditor.prepared, {
            walletProvider: detectEthereumProvider(),
            ethers,
            registryAddress: deployment?.addresses?.playerProfileRegistry,
            indexApi,
            dispatch: (name, detail) => dispatchEvent(name, detail),
            onBroadcast: () => setStatus('Waiting for LitVM to confirm…'),
          });
          if (done.ok) {
            nameEditor.prepared = null;
            nameEditor.raw = null;
            nameEditor.avatarUri = null;
            setStatus(done.refreshed ? '✓ Saved on LitVM.' : '✓ Saved on LitVM. It can take a few minutes to show everywhere.', 'ok');
            invalidate(target.wallet);
            void hydrate({ force: true });
          } else {
            setStatus(done.message, 'error');
          }
        } catch {
          setStatus('The change did not go through. Try again.', 'error');
        } finally {
          nameEditor.busy = false;
          renderOfficialProfile();
        }
      });
      card.append(confirm);
    }
    dom.officialCabinetGrid.append(card);
    if (routeState.focusNameEditor) {
      routeState.focusNameEditor = false;
      requestAnimationFrameRef(() => {
        card.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        input.focus?.();
      });
    }
  }

  function renderHostedProfile() {
    const target = viewedTarget();
    dom.officialCabinetGrid.replaceChildren();
    dom.officialCabinetGrid.classList.add('profile-command-grid');
    if (!target.wallet) {
      renderHostedGuest();
      return;
    }
    const entry = profileEntry(target);
    if (entry.status === 'idle') void hydrate();
    const response = entry.response;
    renderHostedHero(target, response, entry);
    if (!response) {
      const state = el('article', { className: `official-info-card profile-state-card profile-state-${entry.status}` });
      state.setAttribute('role', 'status');
      if (entry.status === 'offline' || entry.status === 'error') {
        appendText(state, 'strong', entry.status === 'offline' ? 'You appear to be offline.' : 'This profile is unavailable right now.');
        appendText(state, 'small', 'Verified profiles load from the arcade index. Try again in a moment.');
        const retry = el('button', { className: 'pixel-button', type: 'button', textContent: 'Try again' });
        retry.addEventListener('click', () => { entry.status = 'idle'; void hydrate(); renderOfficialProfile(); });
        state.append(retry);
      } else {
        appendText(state, 'strong', 'Loading verified profile…');
      }
      dom.officialCabinetGrid.append(state);
      return;
    }
    if (target.own) {
      if (!target.self) {
        const signIn = el('article', { className: 'official-info-card username-editor-card profile-sign-in-card' });
        appendText(signIn, 'span', 'NAME & AVATAR', 'cabinet-status-label');
        appendText(signIn, 'small', 'Sign in with your wallet to edit your name and avatar, retry runs and see runs still publishing.');
        const button = el('button', { className: 'pixel-button', type: 'button', textContent: 'Sign in' });
        button.addEventListener('click', () => { playSfxCue('menu-click'); connectWallet(); });
        signIn.append(button);
        dom.officialCabinetGrid.append(signIn);
      } else if (deployment?.status === 'deployed') {
        renderOnchainEditor(target, response);
      } else {
        renderLocalUsernameEditor();
      }
    }
    renderHostedGames(response);
    renderHostedSessions(target, response);
    renderHostedAchievements(target, response);
  }

  // The device-local username editor: preview, and hosted before the
  // contracts are deployed (brief acceptance 4).
  function renderLocalUsernameEditor({ profile, state, connectedWallet } = {}) {
    if (!state) ({ state, connectedWallet } = getContext());
    if (!profile) profile = buildPlayerArcadeSnapshot(state, connectedWallet)?.profile;
    const editor = el('article', { className: 'official-info-card username-editor-card' });
    appendText(editor, 'span', 'DISPLAY NAME', 'cabinet-status-label');
    appendText(editor, 'small', profile?.usernameSet
      ? 'This name shows on every leaderboard. 3–18 chars, unique, no hate speech.'
      : 'By default leaderboards show your wallet address. Set a username to display instead. 3–18 chars, unique, no hate speech.');

    const form = el('div', { className: 'username-editor-form' });
    const input = el('input', { className: 'username-input', type: 'text' });
    input.maxLength = 18;
    input.placeholder = 'Your display name';
    input.value = profile?.usernameSet ? profile.handle : '';
    input.setAttribute('aria-label', 'Display name');
    const saveBtn = el('button', { className: 'pixel-button username-save-button', textContent: 'Save Username', type: 'button' });
    const feedback = el('p', { className: 'username-feedback tiny-note' });

    // Persistent post-save confirmation: if the profile was just re-rendered as a
    // result of a username save, show "✓ Username saved!" + flash the card so the
    // user gets clear visual proof the save worked (mirrors the avatar save UX).
    if (routeState.usernameJustSaved) {
      routeState.usernameJustSaved = false;
      feedback.textContent = '✓ Display name saved!';
      feedback.dataset.state = 'ok';
      requestAnimationFrameRef(() => {
        editor.classList.add('username-saved-flash');
      });
    }

    // live validation
    input.addEventListener('input', () => {
      const v = validateUsername(input.value);
      feedback.textContent = input.value.trim() ? v.message : '';
      feedback.dataset.state = input.value.trim() ? (v.valid ? 'ok' : 'error') : '';
    });

    saveBtn.addEventListener('click', () => {
      const res = setArcadeUsername(state, connectedWallet, input.value);
      if (res.ok) {
        routeState.usernameJustSaved = true; // surfaced as a persistent note on re-render
        persistArcadeStateSoon();
        playSfxCue('menu-click', 0.06);
        // Refresh the nav (display name) + profile panel in place. Do NOT call the
        // global render() here — it resets officialAppStep and bounces the user off
        // the profile screen (same reason as the avatar save below).
        renderNav();
        renderOfficialProfile();
      } else {
        feedback.textContent = res.message;
        feedback.dataset.state = 'error';
      }
    });

    form.append(input, saveBtn);
    editor.append(form, feedback);
    dom.officialCabinetGrid.append(editor);
  }

  function renderOfficialProfile() {
    if (hosted) {
      renderHostedProfile();
      return;
    }
    const { connectedChainId, connectedWallet, combat, state, walletConnector } = getContext();
    dom.officialCabinetGrid.replaceChildren();
    dom.officialCabinetGrid.classList.add('profile-command-grid');
    const viewedOther = walletKey(routeState.viewedWallet);
    if (viewedOther && viewedOther !== walletKey(connectedWallet)) {
      const notice = el('article', { className: 'official-info-card profile-preview-notice' });
      appendText(notice, 'span', 'Preview · this device', 'cabinet-status-label');
      appendText(notice, 'strong', `Profile ${shortWallet(viewedOther)}`);
      appendText(notice, 'small', 'Public wallet profiles open when verified Ranked publishing goes live. This preview only has the profile recorded on this device.');
      dom.officialCabinetGrid.append(notice);
    }
    const snapshot = connectedWallet ? buildPlayerArcadeSnapshot(state, connectedWallet) : null;
    const profileV2 = connectedWallet ? buildProfileExperienceV2Model(state, connectedWallet, { selectedGameId: routeState.gameId }) : null;
    routeState.historyFilters ??= { heroId: 'all', weaponId: 'all', mode: 'all', date: 'all', result: 'all' };
    const hmhRunHistory = connectedWallet ? buildHmhRunHistoryModel(state.runHistory, {
      wallet: connectedWallet,
      filters: routeState.historyFilters,
    }) : null;
    const profile = snapshot?.profile;

    const profileHero = el('article', { className: 'official-info-card profile-hero-card hmh-visual-polish-v12' });
    appendText(profileHero, 'span', 'Wallet Profile // Parent Account', 'cabinet-status-label');
    const heroTop = el('div', { className: 'profile-hero-topline' });
    heroTop.append(renderAvatarChip(connectedWallet, profile?.displayName, 'profile-hero-avatar'));
    const heroIdentity = el('div', { className: 'profile-hero-identity' });
    appendText(heroIdentity, 'strong', profile?.displayName ?? 'Connect wallet to activate profile', 'profile-hero-name');
    // The "locked identity for settlement" claim is only true of a real wallet.
    // Saying it over the fallback identity is the exact misreading U11a exists to
    // stop, so the simulated case gets its own line.
    const walletIsSimulated = isSimulatedWalletActive();
    appendText(heroIdentity, 'small', connectedWallet
      ? walletIsSimulated
        ? `${connectedWallet.slice(0, 10)}…${connectedWallet.slice(-8)} // simulated wallet // local test identity only — progress here does not settle on-chain or carry over to a real wallet`
        : `${connectedWallet.slice(0, 10)}…${connectedWallet.slice(-8)} // ${walletConnector} // wallet is your locked identity for scores, achievements & settlement`
      : 'Wallet is the locked identity for progress, high scores, achievements, avatars, and LitVM settlement receipts.');
    heroTop.append(heroIdentity);
    profileHero.append(heroTop);

    if (connectedWallet && snapshot) {
      const bestScore = profileV2?.trophyRoom.summary.bestScore ?? Math.max(...Object.values(snapshot.progress ?? {}).map((entry) => Math.max(entry.bestPaidScore ?? 0, entry.bestFreeScore ?? 0)), 0);
      const heroStats = el('div', { className: 'profile-hero-stats' });
      for (const [label, value] of [
        ['Rank', profile.rank],
        ['XP', profile.xp.toLocaleString()],
        ['Best Score', bestScore.toLocaleString()],
        ['Cached Ranked Runs', String(profileV2?.trophyRoom.summary.totalRankedRuns ?? 'Unavailable')],
        ['Achievements', `${profileV2?.achievements.summary.unlocked ?? snapshot.achievementSummary.unlocked}/${profileV2?.achievements.summary.total ?? snapshot.achievementSummary.total}`],
        ['Cached Receipt Entries', String(profileV2?.trophyRoom.summary.settledRuns ?? 'Unavailable')],
        ['Privacy', profileV2?.privacy.options.find((option) => option.id === profileV2.privacy.current)?.label ?? 'Public'],
      ]) {
        const stat = el('div', { className: 'profile-hero-stat' });
        appendText(stat, 'span', label);
        appendText(stat, 'strong', value);
        heroStats.append(stat);
      }
      profileHero.append(heroStats);

      const quickActions = el('div', { className: 'profile-quick-actions' });
      const playRanked = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Play Ranked' });
      playRanked.addEventListener('click', () => { playSfxCue('menu-click'); setView('mode-select'); });
      const viewBoard = el('button', { className: 'pixel-button', type: 'button', textContent: 'View Leaderboard' });
      viewBoard.addEventListener('click', () => { playSfxCue('menu-click'); setView('leaderboards'); });
      quickActions.append(playRanked, viewBoard);
      profileHero.append(quickActions);
    }
    dom.officialCabinetGrid.append(profileHero);

    if (connectedWallet && profileV2) {
      const trophyCard = el('article', { className: 'official-info-card profile-trophy-room-card' });
      appendText(trophyCard, 'span', 'TROPHY ROOM', 'cabinet-status-label');
      appendText(trophyCard, 'strong', `${profileV2.trophyRoom.summary.achievementsUnlocked}/${profileV2.trophyRoom.summary.achievementsTotal} badges · ${profileV2.trophyRoom.summary.totalRankedRuns} cached Ranked runs`);
      const trophyGrid = el('div', { className: 'profile-hero-stats profile-trophy-grid' });
      for (const card of profileV2.trophyRoom.cards) {
        const cell = el('div', { className: `profile-hero-stat trophy-card-${card.id} trophy-tone-${card.tone ?? card.tier ?? 'muted'}` });
        appendText(cell, 'span', card.label);
        appendText(cell, 'strong', `${card.icon ? `${card.icon} ` : ''}${card.value}`);
        if (card.meta) appendText(cell, 'small', card.meta);
        trophyGrid.append(cell);
      }
      trophyCard.append(trophyGrid);
      dom.officialCabinetGrid.append(trophyCard);
    }

    // Guest profile: show local play stats so guests feel they have a profile too.
    if (!connectedWallet) {
      const guestCard = el('article', { className: 'official-info-card profile-guest-card' });
      appendText(guestCard, 'span', 'Guest Session // Local Stats', 'cabinet-status-label');
      appendText(guestCard, 'strong', 'Playing as Guest');
      appendText(guestCard, 'small', 'Guest stats are local to this browser. Connecting a wallet identifies a local profile; permanent or cross-device history and verified Ranked publishing are not available yet.');
      // Pull local stats from the game state if available.
      const localBest = combat?.longestSurvivalThisRun ?? 0;
      const localKills = combat?.kills ?? 0;
      const localScore = combat?.score ?? 0;
      const guestStats = el('div', { className: 'profile-hero-stats' });
      for (const [label, value] of [
        ['Best Score', localScore.toLocaleString()],
        ['Total Kills', localKills.toLocaleString()],
        ['Longest Survival', `${Math.floor(localBest / 60)}:${String(localBest % 60).padStart(2, '0')}`],
        ['Mode', 'Free Practice'],
      ]) {
        const stat = el('div', { className: 'profile-hero-stat' });
        appendText(stat, 'span', label);
        appendText(stat, 'strong', value);
        guestStats.append(stat);
      }
      guestCard.append(guestStats);
      const connectCta = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Connect Wallet to Save Progress' });
      connectCta.addEventListener('click', () => { playSfxCue('menu-click'); connectWallet(); });
      guestCard.append(connectCta);
      dom.officialCabinetGrid.append(guestCard);
      return;
    }

    const walletModel = buildWalletConnectionModel({
      providerAvailable: Boolean(detectEthereumProvider()?.request),
      wallet: connectedWallet,
      chainId: connectedChainId,
      connector: walletConnector,
    });
    const walletCard = el('article', { className: `official-info-card profile-wallet-rail-card ${walletModel.status} ${walletModel.chainGuard.status}` });
    appendText(walletCard, 'span', 'Wallet + Chain Guard', 'cabinet-status-label');
    appendText(walletCard, 'strong', walletModel.simulated
      ? 'Simulated Wallet'
      : walletModel.chainGuard.status === 'right-chain' ? 'LiteForge Ready' : 'Action Needed');
    // The chain-guard copy opens with "Wallet connected", which contradicts the
    // headline above it when the wallet is the local fallback.
    appendText(walletCard, 'small', walletModel.simulated
      ? 'No browser wallet is connected, so there is no chain to guard. Chain checks resume once you connect a real wallet.'
      : walletModel.chainGuard.copy);
    const walletFacts = el('div', { className: 'profile-wallet-facts' });
    for (const [label, value] of [
      ['Network', `${walletModel.network.name} · ${walletModel.network.chainIdHex}`],
      ['Gas', walletModel.network.nativeCurrency.symbol],
      ['Connector', walletModel.simulated ? 'simulated (no real wallet)' : walletConnector],
      ['Writes', walletModel.permissions.writeScopes.join(' · ')],
    ]) {
      const fact = el('span', { className: 'profile-wallet-fact' });
      fact.append(el('em', { textContent: label }), documentRef.createTextNode(value));
      walletFacts.append(fact);
    }
    walletCard.append(walletFacts);
    if (walletModel.disclosure) {
      walletCard.append(renderSimulatedWalletNotice(walletModel.disclosure, 'profile-simulated-wallet-notice'));
    }
    dom.officialCabinetGrid.append(walletCard);

    if (profileV2) {
      const privacyCard = el('article', { className: 'official-info-card profile-privacy-card' });
      appendText(privacyCard, 'span', 'PRIVACY', 'cabinet-status-label');
      appendText(privacyCard, 'strong', 'Profile visibility');
      appendText(privacyCard, 'small', 'Wallet remains the locked identity for scores and receipts. Visibility controls how much of the profile should appear in future public discovery.');
      const privacyOptions = el('div', { className: 'leaderboard-game-tabs profile-privacy-tabs' });
      for (const option of profileV2.privacy.options) {
        const button = el('button', { className: `pixel-button leaderboard-game-tab${option.id === profileV2.privacy.current ? ' is-active' : ''}`, type: 'button' });
        appendText(button, 'span', option.label, 'leaderboard-game-tab-title');
        appendText(button, 'small', option.copy, 'profile-privacy-copy');
        button.addEventListener('click', () => {
          state.profiles[connectedWallet].preferences ??= {};
          state.profiles[connectedWallet].preferences.profileVisibility = option.id;
          persistArcadeStateSoon();
          playSfxCue('menu-click', 0.05);
          renderOfficialProfile();
        });
        privacyOptions.append(button);
      }
      privacyCard.append(privacyOptions);
      dom.officialCabinetGrid.append(privacyCard);
    }

    renderLocalUsernameEditor({ profile, state, connectedWallet });

    // --- Avatar upload (.jpg/.png, 2MB cap) ---
    const avatarCard = el('article', { className: 'official-info-card avatar-editor-card' });
    appendText(avatarCard, 'span', 'AVATAR', 'cabinet-status-label');
    appendText(avatarCard, 'small', 'Upload a .jpg or .png (max 2MB). Shows in the nav and on leaderboards next to your score.');
    const avatarRow = el('div', { className: 'avatar-editor-row' });
    const preview = el('div', { className: 'profile-avatar avatar-preview-shell' });
    const previewImg = el('img', { className: 'avatar-preview-image', alt: 'Selected avatar preview' });
    const previewFallback = renderAvatarChip(connectedWallet, profile?.displayName, 'profile-avatar');
    const previewHint = el('p', { className: 'avatar-preview-hint tiny-note' });
    // Hint text only appears after a file is chosen — the default preview should
    // show the avatar cleanly without any overlay text or blue-tinted bar.
    previewHint.hidden = true;
    preview.append(previewFallback, previewImg, previewHint);
    previewImg.hidden = true;
    const fileInput = el('input', { className: 'avatar-file-input', type: 'file' });
    fileInput.accept = 'image/png,image/jpeg';
    fileInput.setAttribute('aria-label', 'Choose avatar image');
    const chooseBtn = el('button', { className: 'pixel-button', type: 'button', textContent: 'Choose Image' });
    const avatarSaveBtn = el('button', { className: 'pixel-button', type: 'button', textContent: 'Save Avatar' });
    avatarSaveBtn.disabled = true; // el() ignores `disabled` (not in attr allow-list); set it directly.
    chooseBtn.addEventListener('click', () => fileInput.click());
    const avatarFeedback = el('p', { className: 'avatar-feedback tiny-note' });
    // Persistent post-save confirmation: if the profile was just re-rendered as a
    // result of an avatar save, show "Avatar saved!" + flash the card so the user
    // gets clear visual proof the upload worked.
    if (routeState.avatarJustSaved) {
      routeState.avatarJustSaved = false;
      avatarFeedback.textContent = '✓ Avatar saved!';
      avatarFeedback.dataset.state = 'ok';
      previewHint.textContent = 'Your avatar is now live in the nav and on leaderboards.';
      requestAnimationFrameRef(() => {
        avatarCard.classList.add('avatar-saved-flash');
      });
    }
    let pendingAvatarDataUrl = '';
    let pendingAvatarName = '';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      pendingAvatarDataUrl = '';
      pendingAvatarName = '';
      avatarSaveBtn.disabled = true;
      if (!file) return;
      const fileCheck = validateAvatarFile({ type: file.type, size: file.size });
      if (!fileCheck.ok) {
        avatarFeedback.textContent = fileCheck.message;
        avatarFeedback.dataset.state = 'error';
        return;
      }
      const reader = new FileReaderClass();
      reader.onload = () => {
        pendingAvatarDataUrl = String(reader.result ?? '');
        pendingAvatarName = file.name;
        previewFallback.hidden = true;
        previewImg.hidden = false;
        previewImg.src = pendingAvatarDataUrl;
        previewHint.hidden = false;
        previewHint.textContent = `Preview ready: ${file.name}`;
        avatarFeedback.textContent = 'Preview loaded. Click Save Avatar to upload it.';
        avatarFeedback.dataset.state = 'ok';
        avatarSaveBtn.disabled = false;
      };
      reader.onerror = () => {
        avatarFeedback.textContent = 'Could not read that file. Try another image.';
        avatarFeedback.dataset.state = 'error';
      };
      reader.readAsDataURL(file);
    });
    avatarSaveBtn.addEventListener('click', async () => {
      if (!pendingAvatarDataUrl) return;
      avatarSaveBtn.disabled = true;
      let storedDataUrl = pendingAvatarDataUrl;
      try {
        // Re-encode through a canvas to strip metadata + cap dimensions before
        // persisting. Falls back to the raw preview only if re-encode fails.
        storedDataUrl = await sanitizeAvatarImage(pendingAvatarDataUrl);
      } catch (err) {
        console.error('[avatar] sanitize failed, rejecting upload:', err);
        avatarFeedback.textContent = 'Could not process that image. Try a different .png or .jpg.';
        avatarFeedback.dataset.state = 'error';
        avatarSaveBtn.disabled = false;
        return;
      }
      setPlayerAvatar(connectedWallet, storedDataUrl);
      routeState.avatarJustSaved = true; // surfaced as a persistent note on re-render
      // Refresh only the nav avatar chip + the profile panel in place. Do NOT call
      // the global render() here — it resets officialAppStep and bounces the user
      // off the profile screen back to the cabinet floor.
      renderNav();
      renderOfficialProfile();
    });
    const avatarControls = el('div', { className: 'avatar-editor-controls' });
    avatarControls.append(chooseBtn, avatarSaveBtn, avatarFeedback);
    avatarRow.append(preview, avatarControls);
    avatarCard.append(avatarRow, fileInput);
    dom.officialCabinetGrid.append(avatarCard);

    // --- Game-specific stats + recent run history (game switcher) ---
    // Stats are tracked per game; switch which game's stats/history you're viewing.
    const statsCard = el('article', { className: 'official-info-card game-stats-card' });
    appendText(statsCard, 'span', 'GAME STATS & HISTORY', 'cabinet-status-label');
    const statsGameBar = el('div', { className: 'leaderboard-game-tabs profile-game-tabs' });
    for (const game of ARCADE_GAMES) {
      const playable = game.status === 'playable';
      const tab = el('button', {
        className: `pixel-button leaderboard-game-tab${game.id === routeState.gameId ? ' is-active' : ''}${playable ? '' : ' is-locked'}`,
        type: 'button',
      });
      appendText(tab, 'span', game.title, 'leaderboard-game-tab-title');
      if (!playable) appendText(tab, 'span', 'SOON', 'leaderboard-game-tab-badge');
      tab.disabled = !playable;
      if (playable) {
        tab.addEventListener('click', () => {
          if (routeState.gameId === game.id) return;
          routeState.gameId = game.id;
          renderOfficialProfile();
        });
      }
      statsGameBar.append(tab);
    }
    statsCard.append(statsGameBar);

    const gp = snapshot?.progress?.[routeState.gameId];
    const stackedFacts=routeState.gameId==='stacked'?buildStackedProfileFacts(gp,connectedWallet):null;
    const factText=value=>value===null?'Not recorded':value.toLocaleString();
    const hmhStats = routeState.gameId === 'lester-blaster'
      ? buildHardMoneyHeroesStatsModule(state, connectedWallet, routeState.gameId)
      : null;
    const chikunTotals = buildChikunProfile(state.sessions, connectedWallet);
    const chikunNumber = value => value == null ? 'Unknown' : value.toLocaleString();
    if (!gp || (gp.paidRuns + gp.freeRuns) === 0) {
      const empty = el('div', { className: 'profile-empty-state' });
      appendText(empty, 'strong', `No runs recorded for ${getGame(routeState.gameId).title} yet.`);
      appendText(empty, 'small', routeState.gameId==='stacked'?'Play Free Mode for its separate practice medal shelf, or a local Ranked run to record verified scores, lines, level and combos here.':'Start Free Mode to practice. Local run metadata can fill this card with recorded score, kills, survival, achievements, and cached receipt entries.');
      statsCard.append(empty);
    } else {
      const bestScore = hmhStats?.bestScore ?? Math.max(gp.bestPaidScore ?? 0, gp.bestFreeScore ?? 0);
      const stats = stackedFacts ? [
        ['Best Score',factText(stackedFacts.bestScore)],['Local Ranked Runs',String(stackedFacts.runs)],
        ['Total Lines',factText(stackedFacts.totalLines)],['Pieces',factText(stackedFacts.totalPieces)],
        ['HALVINGS',factText(stackedFacts.totalHalvings)],['Best Level',factText(stackedFacts.bestLevel)],
        ['Best Combo',factText(stackedFacts.bestCombo)],['Best Back-to-Back',factText(stackedFacts.bestBackToBack)],
        ['Perfect Clears',factText(stackedFacts.perfectClears)],['Spins',factText(stackedFacts.spins)],
        ['Ledger Rows Cleared',factText(stackedFacts.ledgerCleared)],['Holds',factText(stackedFacts.holds)],
        ['Longest Run',stackedFacts.longestTicks===null?'Not recorded':formatSeconds(stackedFacts.longestTicks/60)],
      ] : routeState.gameId === 'chikun' ? [
        ['Best Score · Ground & Sky', chikunNumber(chikunTotals.bestScore)],
        ['Current Runs', chikunNumber(chikunTotals.runs)],
        ['Longest Run', chikunTotals.longest == null ? 'Unknown' : formatSeconds(chikunTotals.longest)],
        ['Coins', chikunNumber(chikunTotals.coins)],
        ['Obstacles Cleared', chikunNumber(chikunTotals.forks)],
        ['Near Misses', chikunNumber(chikunTotals.nearMisses)],
        ['Best Combo', chikunNumber(chikunTotals.bestCombo)],
        ['Flaps', chikunNumber(chikunTotals.flaps)],
        ['Awards', chikunNumber(chikunTotals.awards)],
        ['Score Source', 'Device-local'],
        ['Historical Runs', chikunNumber(chikunTotals.historicalRuns)],
      ] : [
        ['Best Score', bestScore.toLocaleString()],
        ['Runs', `${gp.paidRuns + gp.freeRuns} (${gp.paidRuns} ranked)`],
        ['Longest Run', hmhStats?.longestSurvivalLabel ?? formatSeconds(gp.longestRunSeconds ?? 0)],
        ['Leaderboard', hmhStats?.rank ? `#${hmhStats.rank} / ${hmhStats.totalRanked}` : 'Unranked'],
        ['Total Kills', (hmhStats?.totalKills ?? gp.totalKills ?? 0).toLocaleString()],
        ['Power-Ups', (hmhStats?.powerUpsGrabbed ?? gp.cumulativePowerUps ?? 0).toLocaleString()],
        ['Boss Kills', `${hmhStats?.bossKills ?? gp.bossKills ?? 0}`],
        ['Max Combo', `${gp.maxCombo ?? 0}`],
      ];
      const statGrid = el('div', { className: 'game-stats-grid profile-stats-grid-v9' });
      for (const [label, value] of stats) {
        const cell = el('div', { className: 'game-stat-cell' });
        appendText(cell, 'span', value, 'game-stat-value');
        appendText(cell, 'span', label, 'game-stat-label');
        statGrid.append(cell);
      }
      statsCard.append(statGrid);

      if (hmhStats?.topAchievement) {
        const topAchievement = el('div', { className: `profile-top-achievement tier-${hmhStats.topAchievement.tier}` });
        appendText(topAchievement, 'span', 'Featured unlocked badge', 'cabinet-status-label');
        appendText(topAchievement, 'strong', `${hmhStats.topAchievement.icon ?? '🏅'} ${hmhStats.topAchievement.title}`);
        appendText(topAchievement, 'small', `${hmhStats.topAchievement.description} · Global unlock rate unavailable.`);
        statsCard.append(topAchievement);
      }

      const breakdown = el('div', { className: 'profile-breakdown-grid' });
      const enemyCard = el('div', { className: 'profile-breakdown-card' });
      appendText(enemyCard, 'span', stackedFacts?'Rising ledger':routeState.gameId === 'chikun' ? 'Flight ledger' : 'Enemy breakdown', 'cabinet-status-label');
      const enemyCopy = stackedFacts?`${factText(stackedFacts.ledgerReceived)} rows received · ${factText(stackedFacts.ledgerCleared)} rows cleared. Older fields without a captured value stay unrecorded.`:routeState.gameId === 'chikun'
        ? `Ground & Sky records: ${chikunNumber(chikunTotals.coins)} coins · ${chikunNumber(chikunTotals.forks)} obstacles · ${chikunNumber(chikunTotals.nearMisses)} near misses. Older physics remain in history.`
        : hmhStats?.enemyBreakdown?.length
        ? hmhStats.enemyBreakdown.slice(0, 3).map((enemy) => `${enemy.title}: ${enemy.kills}`).join(' · ')
        : 'No typed enemy kills recorded yet.';
      appendText(enemyCard, 'small', enemyCopy);
      const bossCard = el('div', { className: 'profile-breakdown-card' });
      appendText(bossCard, 'span', stackedFacts?'Device-local preview':routeState.gameId === 'chikun' ? 'Ranked integrity' : 'Boss ledger', 'cabinet-status-label');
      const bossCopy = stackedFacts?'Scores are replay-verified on this device. Input labels are self-reported. Free medals are separate; these records are not online rankings or chain confirmations.':routeState.gameId === 'chikun'
        ? 'Ranked results are accepted only after the parent replays the child input evidence against the issued seed, build, and season.'
        : hmhStats?.bossBreakdown?.length
        ? hmhStats.bossBreakdown.slice(0, 3).map((boss) => `${boss.title}: ${boss.kills}`).join(' · ')
        : `${gp.bossKills ?? 0} boss kill(s) recorded.`;
      appendText(bossCard, 'small', bossCopy);
      breakdown.append(enemyCard, bossCard);
      statsCard.append(breakdown);

      // Recent run history for THIS game (most recent first).
      const sessions = (profileV2?.sessionFeed.rankedRows
        ?? (profileV2?.sessionFeed.rows ?? []).filter((s) => (s.gameId === routeState.gameId || s.gameId === 'hmh' && routeState.gameId === 'lester-blaster')
          && (s.mode === 'paid' || s.mode === 'ranked')))
        .slice(0, 5);
      if (sessions.length) {
        appendText(statsCard, 'span', 'RECENT CACHED RANKED RUNS', 'cabinet-status-label game-stats-subhead');
        const histList = el('div', { className: 'game-history-list' });
        for (const s of sessions) {
          const row = el('div', { className: 'game-history-row' });
          const rs = s.runStats ?? {};
          appendText(row, 'span', `${(s.score ?? rs.score ?? 0).toLocaleString()} pts`, 'game-history-score');
          appendText(row, 'span', stackedFacts?`${s.urlSessionId??s.sessionId.slice(0,12)} · ${rs.linesCleared??'—'} lines · Level ${rs.level??'—'} · Combo ${rs.maxCombo??'—'} · ${stackedInputLabel(rs.inputDevice)} · ${formatSurvive(rs.elapsedSeconds??0)}`:routeState.gameId === 'chikun'
            ? `${s.urlSessionId ?? s.sessionId.slice(0, 12)} · ${rs.coinsCollected ?? "?"} coins · ${rs.forksPassed ?? "?"} obstacles · ${rs.nearMisses ?? "?"} near misses · ${s.survivalLabel ?? formatSurvive(rs.elapsedSeconds ?? 0)}`
            : `${s.urlSessionId ?? s.sessionId.slice(0, 12)} · ${rs.kills ?? 0} kills · ${s.survivalLabel ?? formatSurvive(rs.surviveSeconds ?? rs.elapsedSeconds ?? 0)}`, 'game-history-detail');
          appendText(row, 'span', s.trust?.label ?? 'Cached metadata', `game-history-chain trust-${s.trust?.tone ?? 'muted'}`);
          if (s.detailHref) {
            const link = el('a', { className: 'game-history-link', href: s.detailHref, textContent: 'Open run' });
            row.append(link);
          }
          histList.append(row);
        }
        statsCard.append(histList);
      }
    }
    dom.officialCabinetGrid.append(statsCard);

    if (hmhRunHistory && routeState.gameId === 'lester-blaster') {
      const historyCard = el('article', { className: 'official-info-card canonical-run-history-card' });
      appendText(historyCard, 'span', 'CANONICAL RUN HISTORY', 'cabinet-status-label');
      appendText(historyCard, 'strong', `${hmhRunHistory.totalCanonicalRuns} schema-validated run${hmhRunHistory.totalCanonicalRuns === 1 ? '' : 's'} on this device`);
      appendText(historyCard, 'small', `This device retains the latest ${RUN_HISTORY_LIMIT} run summaries across games, wallets and modes, not a permanent ranked archive. Gameplay format validation does not verify a blockchain result. Parent session receipts are separate.`);
      appendText(historyCard, 'small', 'Testnet progress is provisional. Scores, achievements and unlocks will reset for the mainnet launch; testnet records will not become mainnet records.', 'hmh-history-testnet-notice');

      const filterGrid = el('div', { className: 'hmh-history-filter-grid' });
      const filterSpecs = [
        ['heroId', 'Hero', hmhRunHistory.options.heroes],
        ['weaponId', 'Weapon', hmhRunHistory.options.weapons],
        ['mode', 'Mode', hmhRunHistory.options.modes],
        ['date', 'Date', hmhRunHistory.options.dates],
        ['result', 'Result', hmhRunHistory.options.results],
      ];
      for (const [key, label, options] of filterSpecs) {
        const field = el('label', { className: 'hmh-history-filter' });
        appendText(field, 'span', label, 'hmh-history-filter-label');
        const select = el('select', { className: 'hmh-history-select' });
        select.setAttribute('aria-label', `Filter run history by ${label.toLowerCase()}`);
        for (const option of options) {
          const node = el('option', { textContent: option.label });
          node.value = option.id;
          select.append(node);
        }
        select.value = hmhRunHistory.filters[key];
        select.addEventListener('change', () => {
          routeState.historyFilters = { ...routeState.historyFilters, [key]: select.value };
          renderOfficialProfile();
        });
        field.append(select);
        filterGrid.append(field);
      }
      historyCard.append(filterGrid);

      const pb = hmhRunHistory.personalBests;
      const pbGrid = el('div', { className: 'profile-hero-stats hmh-history-pb-grid' });
      for (const [label, value] of [
        ['Best Score', pb.score.toLocaleString()],
        ['Survival', formatSeconds(pb.survivalTicks / 60)],
        ['Level', String(pb.level)],
        ['Max Combo', `×${pb.maxCombo}`],
        ['Boss Clears', String(pb.bossClears)],
        ['Damage', pb.damage.toLocaleString()],
        ['Trigger Accuracy', formatPermille(pb.triggerAccuracyPermille)],
        ['Projectile Accuracy', formatPermille(pb.projectileAccuracyPermille)],
      ]) {
        const cell = el('div', { className: 'profile-hero-stat' });
        appendText(cell, 'span', label);
        appendText(cell, 'strong', value);
        pbGrid.append(cell);
      }
      historyCard.append(pbGrid);

      const detailsBySessionId = new Map((profileV2?.sessionFeed.rows ?? []).map((row) => [row.sessionId, row.detailHref]));
      const runList = el('div', { className: 'hmh-history-run-list', role: 'table' });
      runList.setAttribute('aria-label', 'Canonical Hard Money Heroes run history');
      const tableHeader = el('div', { className: 'hmh-history-run-row hmh-history-table-header', role: 'row' });
      for (const label of ['Run', 'Performance', 'Build']) tableHeader.append(el('span', { textContent: label, role: 'columnheader' }));
      runList.append(tableHeader);
      if (hmhRunHistory.rows.length === 0) {
        appendText(runList, 'small', hmhRunHistory.emptyMessage, 'profile-empty-state');
      }
      for (const run of hmhRunHistory.rows) {
        const row = el('article', { className: `hmh-history-run-row provenance-${run.provenance.id}`, role: 'row' });
        row.setAttribute('aria-label', `${run.score} points, ${run.heroLabel}, ${run.provenance.label}`);
        const heading = el('div', { className: 'hmh-history-run-heading', role: 'cell' });
        appendText(heading, 'strong', `${run.score.toLocaleString()} pts · ${run.heroLabel}`);
        appendText(heading, 'span', run.provenance.label, `hmh-history-provenance provenance-${run.provenance.id}`);
        appendText(heading, 'small', Number.isFinite(run.timestamp) ? new Date(run.timestamp).toLocaleString() : 'Recorded time unavailable');
        row.append(heading);
        const performance = el('div', { className: 'hmh-history-performance', role: 'cell' });
        appendText(performance, 'small', `${titleCase(run.mode)} · ${titleCase(run.result)} · ${formatSeconds(run.survivalTicks / 60)} · ${run.kills} kills · Level ${run.level} · ×${run.maxCombo} combo`);
        appendText(performance, 'small', `${run.primaryWeaponLabels.join(' + ') || 'No weapon activity'} · trigger ${formatPermille(run.triggerAccuracyPermille)} · projectile ${formatPermille(run.projectileAccuracyPermille)}`);
        row.append(performance);
        const buildText = run.build.ranks.length
          ? run.build.ranks.map((rank) => `${titleCase(rank.upgradeId)} ${rank.rank}`).join(' · ')
          : 'No upgrades selected';
        const buildCell = el('div', { className: 'hmh-history-build', role: 'cell' });
        appendText(buildCell, 'small', `Build: ${buildText}`);
        const detailHref = detailsBySessionId.get(run.sessionId);
        if (detailHref) buildCell.append(el('a', { className: 'game-history-link', href: detailHref, textContent: 'Open parent session / receipt' }));
        buildCell.append(renderHmhRunDetails(run, { el, appendText }));
        row.append(buildCell);
        runList.append(row);
      }
      historyCard.append(runList);

      if (hmhRunHistory.weapons.length) {
        appendText(historyCard, 'span', 'WEAPON USAGE', 'cabinet-status-label game-stats-subhead');
        const weaponGrid = el('div', { className: 'profile-breakdown-grid hmh-history-weapon-grid' });
        for (const weapon of hmhRunHistory.weapons.slice(0, 6)) {
          const cell = el('div', { className: 'profile-breakdown-card' });
          appendText(cell, 'strong', weapon.label);
          appendText(cell, 'small', `${weapon.runs} run${weapon.runs === 1 ? '' : 's'} · ${weapon.damage.toLocaleString()} damage · ${weapon.kills} kills`);
          appendText(cell, 'small', `Trigger ${formatPermille(weapon.triggerAccuracyPermille)} · projectile ${formatPermille(weapon.projectileAccuracyPermille)} · reload ${formatPermille(weapon.reloadRatePermille)} · empty ${formatPermille(weapon.emptyRatePermille)}`);
          weaponGrid.append(cell);
        }
        historyCard.append(weaponGrid);
      }

      if (hmhRunHistory.heroes.length) {
        appendText(historyCard, 'span', 'HERO EFFECTIVENESS', 'cabinet-status-label game-stats-subhead');
        const heroGrid = el('div', { className: 'profile-breakdown-grid hmh-history-hero-grid' });
        for (const hero of hmhRunHistory.heroes) {
          const cell = el('div', { className: 'profile-breakdown-card' });
          appendText(cell, 'strong', hero.label);
          appendText(cell, 'small', `${hero.runs} run${hero.runs === 1 ? '' : 's'} · ${formatPermille(hero.completionRatePermille)} completed`);
          appendText(cell, 'small', `${hero.averageDamage.toLocaleString()} avg damage · ${hero.averageKills} avg kills · prefers ${hero.preferredWeaponLabel}`);
          heroGrid.append(cell);
        }
        historyCard.append(heroGrid);
      }
      if (hmhRunHistory.invalidRuns > 0) appendText(historyCard, 'small', `${hmhRunHistory.invalidRuns} invalid or unsupported summary record(s) are excluded from these metrics.`, 'tiny-note');
      if (hmhRunHistory.legacyRuns > 0) appendText(historyCard, 'small', `${hmhRunHistory.legacyRuns} legacy run${hmhRunHistory.legacyRuns === 1 ? '' : 's'} predate canonical summaries and are excluded from these metrics.`, 'tiny-note');
      dom.officialCabinetGrid.append(historyCard);
    }

    if (profileV2) {
      const collectionCard = el('article', { className: 'official-info-card profile-collection-card' });
      appendText(collectionCard, 'span', 'COLLECTION', 'cabinet-status-label');
      appendText(collectionCard, 'strong', `${profileV2.collection.unlockCounts.gamesPlayed} games played · ${profileV2.collection.unlockCounts.charactersUnlocked} heroes unlocked`);
      const gameRows = el('div', { className: 'game-history-list profile-collection-list' });
      for (const game of profileV2.collection.games.filter((item) => item.playable).slice(0, 4)) {
        const row = el('div', { className: `game-history-row collection-game-row${game.played ? ' is-played' : ' is-empty'}` });
        appendText(row, 'span', game.title, 'game-history-score');
        appendText(row, 'span', `${game.bestScoreLabel} best · ${game.totalRuns} run(s) · ${game.longestRunLabel}`, 'game-history-detail');
        const playLink = el('a', { className: 'game-history-link', href: game.routePath, textContent: game.played ? 'Replay' : 'Play' });
        row.append(playLink);
        gameRows.append(row);
      }
      const characterRows = el('div', { className: 'achievements-grid profile-character-collection' });
      for (const character of profileV2.collection.characters) {
        const chip = el('div', { className: `achievement-badge tier-bronze ${character.unlocked ? 'unlocked' : 'locked'}` });
        appendText(chip, 'span', character.unlocked ? '🧍' : '🔒', 'achievement-icon');
        appendText(chip, 'span', character.title, 'achievement-name');
        appendText(chip, 'small', character.unlocked ? (character.selected ? 'Selected' : 'Unlocked') : character.unlockDescription, 'achievement-tooltip');
        characterRows.append(chip);
      }
      collectionCard.append(gameRows, characterRows);
      dom.officialCabinetGrid.append(collectionCard);
    }

    // --- Parent-local achievement dates, progress and accessible requirements ---
    dom.officialCabinetGrid.append(renderProfileAchievements(snapshot, { ACHIEVEMENTS, el, appendText, renderAchievementIcon }));

    // --- Settlement history (score settles to LitVM via zkLTC) ---
    const settlements = snapshot?.settlements ?? [];
    const settleCard = el('article', { className: 'official-info-card settlement-history-card settlement-ledger-v9' });
    appendText(settleCard, 'span', 'LITVM SETTLEMENT', 'cabinet-status-label');
    appendText(settleCard, 'strong', settlements.length
      ? `${settlements.length} cached receipt entr${settlements.length === 1 ? 'y' : 'ies'}`
      : 'No cached receipt entries');
    appendText(settleCard, 'small', 'This panel shows unverified metadata retained in the local profile cache. A cached hash, mode, or settled flag is not proof of settlement and does not verify or stamp a leaderboard result.');
    const settleList = el('div', { className: 'settlement-ledger-list' });
    if (settlements.length === 0) {
      const emptyReceipt = el('div', { className: 'settlement-receipt empty' });
      appendText(emptyReceipt, 'span', 'No cached receipt metadata', 'settlement-receipt-title');
      appendText(emptyReceipt, 'small', 'No local receipt metadata is cached for this wallet.');
      settleList.append(emptyReceipt);
    } else {
      for (const s of settlements.slice(-4).reverse()) {
        const receipt = el('div', { className: `settlement-receipt mode-${s.mode}` });
        const tx = s.primaryTxHash ? `${s.primaryTxHash.slice(0, 10)}…${s.primaryTxHash.slice(-6)}` : 'hash unavailable';
        appendText(receipt, 'span', `${s.score.toLocaleString()} pts · cached ${s.mode ?? 'unknown'} metadata`, 'settlement-receipt-title');
        appendText(receipt, 'small', `Session ${s.sessionId.slice(0, 18)}… · tx ${tx}`);
        const receiptMeta = el('div', { className: 'settlement-receipt-meta' });
        appendText(receiptMeta, 'span', s.settledAt ? `Cached timestamp: ${new Date(s.settledAt).toLocaleString()}` : 'Cached timestamp not recorded');
        if (s.primaryTxHash) appendText(receiptMeta, 'span', 'Unverified cached hash');
        receipt.append(receiptMeta);
        settleList.append(receipt);
      }
    }
    settleCard.append(settleList);
    dom.officialCabinetGrid.append(settleCard);
  }

  let officialLeaderboardCadence = 'all-time';
  // Leaderboard sort/filter/search UI state (Top-50 board).
  let leaderboardSortKey = 'score'; // 'score' | 'name' | 'date' | 'kills' | 'survive' | 'level'
  let leaderboardSortDir = 'desc';  // 'asc' | 'desc'
  let leaderboardSearch = '';
  // Which game's leaderboard is being viewed. Defaults to the active play target
  // (HMH). Game-specific so future cabinets get their own boards via the switcher.
  let leaderboardGameId = 'lester-blaster';

  return Object.freeze({ renderProfile: renderOfficialProfile, hydrate, invalidate, setPendingSavedRuns, cachedSelfProfile });
}

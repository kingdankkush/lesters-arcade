// The hosted Profile page (HOSTED_PROFILE_SYNC; guide §3.5, §5.7, contract
// §4.3.6, §7.8): the viewed wallet's public profile from GET /api/profile
// (/profile/<wallet>, or the connected wallet at /profile), the owner's self
// view with D10 retries, and the on-chain name and avatar editor once the
// contracts are deployed. official-profile-route.mjs loads this module on
// demand only when the portal is hosted, so preview visitors never download it
// (contract §11 rule 5). Rendering is synchronous; hydrate() fetches and
// renders again.

import { normalizeAchievementUnlockDate } from '../achievement-progress.mjs';
import { ARCADE_AVATARS, ARCADE_AVATAR_URI_PREFIX, arcadeAvatarForUri } from '../arcade-avatars.mjs';
import { verifiedExplorerUrl } from '../leaderboard-view.mjs';

export const PROFILE_SHARE_ORIGIN = 'https://lestersarcade.io';
export const LITEFORGE_EXPLORER = 'https://liteforge.explorer.caldera.xyz';
export const HOSTED_PROFILE_GAMES = Object.freeze([
  Object.freeze({ gameId: 'lester-blaster', title: 'Hard Money Heroes' }),
  Object.freeze({ gameId: 'chikun', title: "Chikun's Escape" }),
  Object.freeze({ gameId: 'stacked', title: 'STACKED' }),
]);
export const BLOCKED_NAME_COPY = 'That name isn’t allowed here. Choose another.';
// A loaded hosted profile is re-read on the next visit once it is this old, or
// when a Ranked run or a published saved run marks it stale (markStale).
export const HOSTED_PROFILE_TTL_MS = 60_000;
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

// Plain words for a Retry that E3 refused (§4.3.3 errors, §4.1). A raw code
// is never shown.
export const RETRY_HANDED_OFF_COPY = 'Retrying from this device…';
export const RETRY_FAILED_COPY = 'The retry did not go through. Try again in a moment.';
const RETRY_FAILURE_WORDS = Object.freeze({
  network: 'Lester’s Arcade could not be reached. Check your connection and try again.',
  'sign-in-required': 'Sign in with your wallet to retry this run.',
  'invalid-session': 'Your sign-in expired. Sign in again to retry this run.',
  'wallet-mismatch': 'This run belongs to another wallet.',
  'session-not-found': 'The arcade has no stored copy of this run to retry.',
  'rate-limited': 'Too many retries just now. Try again in a minute.',
  'settlement-paused': 'Ranked publishing is paused; this run will publish when it resumes.',
  'settlement-not-configured': 'Ranked publishing is not available right now. Try again later.',
  'address-mismatch': 'Ranked publishing is not available right now. Try again later.',
  'chain-read-failed': 'LitVM could not be read just now. Try again shortly.',
});
// Without a server hint, a rate-limited retry waits a minute.
const RATE_LIMITED_COOLDOWN_MS = 60_000;
// A retry handed to ranked-client holds the button this long, so repeated
// clicks do not restart its backoff over and over.
const HANDED_OFF_COOLDOWN_MS = 5_000;

export function retryFailureWords(answer = {}) {
  const code = String(answer?.error ?? '');
  if (Object.hasOwn(RETRY_FAILURE_WORDS, code)) return RETRY_FAILURE_WORDS[code];
  if (answer?.status === 401) return RETRY_FAILURE_WORDS['invalid-session'];
  if (answer?.status === 429) return RETRY_FAILURE_WORDS['rate-limited'];
  return RETRY_FAILED_COPY;
}

// How long a refused Retry keeps its button disabled (ms).
export function retryCooldownMs(answer = {}) {
  const hinted = Number(answer?.retryAfterMs);
  if (Number.isFinite(hinted) && hinted > 0) return Math.min(hinted, 10 * 60_000);
  return answer?.error === 'rate-limited' || answer?.status === 429 ? RATE_LIMITED_COOLDOWN_MS : 0;
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

export function createHostedProfileView({
  appendText,
  connectWallet,
  copyText,
  deployment,
  detectEthereumProvider,
  dispatchEvent = () => {},
  dom,
  el,
  getContext,
  getPendingSavedRuns = () => 0,
  indexApi = null,
  isActive = () => true,
  isAuthenticated = () => false,
  loadAchievementCatalog,
  loadChainClient,
  loadEthers,
  loadProfileChain,
  now = () => Date.now(),
  playRanked = null,
  playSfxCue,
  rankedClientHolds = () => false,
  renderAchievementIcon,
  renderAvatarChip,
  renderLocalUsernameEditor,
  renderPage,
  requestAnimationFrameRef = globalThis.requestAnimationFrame,
  routeState,
  rpcUrl,
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  setView,
} = {}) {
  const hostedProfiles = new Map(); // `${wallet}|self|public` -> { status, response, request, error }
  const heldTokens = new Map(); // wallet -> { status, confirmed: Set('<gameId>:<id>') }
  const selfRejected = new Set(); // wallets whose token the self view refused (until the session changes)
  let achievementCatalog = null;
  let catalogRequest = null;
  // D10 Retry buttons, per session: { busy, message, tone, until }.
  const retryStates = new Map();
  const nameEditor = { wallet: null, raw: null, avatarUri: null, prepared: null, busy: false, message: '', tone: '' };

  const renderOfficialProfile = () => renderPage();

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
    if (!hostedProfiles.has(key)) hostedProfiles.set(key, { status: 'idle', response: null, request: null, error: null, loadedAt: null, stale: false });
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

  function entryIsFresh(entry) {
    return entry.status === 'ready' && !entry.stale
      && Number.isFinite(entry.loadedAt) && now() - entry.loadedAt < HOSTED_PROFILE_TTL_MS;
  }

  // The hydrate hook: read E6 (or the self view) for the wallet on screen,
  // unless it is loading, or loaded and still fresh (entryIsFresh).
  function hydrate({ force = false } = {}) {
    if (!indexApi) return Promise.resolve(null);
    const target = viewedTarget();
    if (!target.wallet) return Promise.resolve(null);
    loadCatalog();
    const entry = profileEntry(target);
    if (entry.request) return entry.request;
    if (!force && entryIsFresh(entry)) return Promise.resolve(entry);
    entry.stale = false;
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
        entry.loadedAt = now();
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

  // Marks cached profiles out of date (every wallet, or one) so the next visit
  // reads E6 again: a Ranked run finished, a saved run published. The profile
  // on screen reloads now and keeps showing the old answer meanwhile.
  function markStale(wallet = null) {
    const key = walletKey(wallet);
    for (const [cacheKey, entry] of hostedProfiles) {
      if (!key || cacheKey.startsWith(`${key}|`)) entry.stale = true;
    }
    if (isActive()) void hydrate();
  }

  // The last self view read for a wallet (the name-claim prompt reuses it).
  function cachedSelfProfile(wallet) {
    const key = walletKey(wallet);
    return key ? hostedProfiles.get(`${key}|self`)?.response ?? null : null;
  }

  // D10 (§7.8): a run ranked-client holds is retried by its handle
  // (lesters:ranked-retry-request); any other run through E3's retry body
  // (retrySettle). Exactly one of the two, never both: two POSTs would race on
  // the relayer lease. A refused retry says why in plain words and keeps the
  // button disabled for the server's retryAfterMs. Then the self view is read
  // again.
  function retryState(sessionId32) {
    const state = retryStates.get(sessionId32);
    if (state && !state.busy && state.tone === 'pending' && now() >= state.until) {
      retryStates.delete(sessionId32);
      return null;
    }
    return state ?? null;
  }

  function scheduleRetryRerender(until) {
    const wait = until - now();
    if (!(wait > 0)) return;
    try { setTimeoutImpl(() => rerenderIfShown(), wait + 50); } catch { /* re-enabled on the next render */ }
  }

  async function retrySession(sessionId32) {
    const id = String(sessionId32 ?? '').toLowerCase();
    const current = retryState(id);
    if (current?.busy || (current?.until && now() < current.until)) return;
    retryStates.set(id, { busy: true, message: '', tone: '', until: 0 });
    let held = false;
    try { held = Boolean(rankedClientHolds(id)); } catch { held = false; }
    if (held) {
      dispatchEvent('lesters:ranked-retry-request', { sessionId32: id });
      const until = now() + HANDED_OFF_COOLDOWN_MS;
      retryStates.set(id, { busy: false, message: RETRY_HANDED_OFF_COPY, tone: 'pending', until });
      scheduleRetryRerender(until);
    } else {
      let answer;
      try { answer = await indexApi?.retrySettle?.(id); } catch { answer = { ok: false, error: 'network' }; }
      if (answer?.ok) {
        retryStates.delete(id);
      } else {
        const cooldown = retryCooldownMs(answer ?? {});
        const until = cooldown > 0 ? now() + cooldown : 0;
        retryStates.set(id, { busy: false, message: retryFailureWords(answer ?? {}), tone: 'error', until });
        scheduleRetryRerender(until);
      }
    }
    rerenderIfShown();
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
    // Saved runs live in this browser, so the owner sees them signed in or not.
    const pendingSavedRuns = getPendingSavedRuns();
    if (target.own && pendingSavedRuns > 0) {
      const saved = el('div', { className: 'profile-saved-runs' });
      appendText(saved, 'span', `${pendingSavedRuns} run${pendingSavedRuns === 1 ? '' : 's'} saved on this device`, 'profile-saved-runs-count');
      const retryAll = el('button', { className: 'pixel-button profile-retry-saved', type: 'button', textContent: 'Retry saved runs' });
      retryAll.addEventListener('click', () => {
        playSfxCue('menu-click', 0.05);
        dispatchEvent('lesters:ranked-retry-request', { sessionId32: null });
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
        const id = String(session.sessionId32 ?? '').toLowerCase();
        const retrying = retryState(id);
        const retry = el('button', { className: 'pixel-button profile-session-retry', type: 'button', textContent: 'Retry' });
        retry.disabled = Boolean(retrying?.busy || (retrying?.until && clock < retrying.until));
        retry.addEventListener('click', () => {
          playSfxCue('menu-click', 0.05);
          retry.disabled = true;
          return retrySession(session.sessionId32);
        });
        row.append(retry);
        if (retrying?.message) {
          const note = appendText(row, 'small', retrying.message, `profile-session-retry-note tiny-note${retrying.tone === 'error' ? ' profile-session-retry-error' : ''}`);
          note.setAttribute('role', retrying.tone === 'error' ? 'alert' : 'status');
        }
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
      // Size the choice explicitly (object-fit: cover on .avatar-chip-img).
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

  return Object.freeze({ render: renderHostedProfile, hydrate, invalidate, markStale, cachedSelfProfile });
}

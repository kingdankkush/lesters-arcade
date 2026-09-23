// Ranked results screen model (contract §7.3; guide §3.3, §5.11). Pure: no
// DOM, network, clock or storage. It turns the settlement handle snapshot
// (§7.2), the run context of the `lesters:ranked-run` event (§7.7) and the
// leaderboard standing (E5 `you` per period) into everything the screen
// shows. Rules that matter:
//   - never a dead end: every state keeps Play again, Practice and Back;
//   - never a fake success: "Verified on LitVM" (the Ranked share template)
//     and the Published step exist only once the session is confirmed;
//   - no NFT wording in phase 1 (A32): an achievement shows a token only when
//     the server reports a non-null tokenId (phase 2).
import { achievementById } from './achievements/index.mjs';
import { LITVM_DEPLOYMENT } from './generated/litvm-addresses.mjs';
import { SHARE_ORIGIN, buildFreeShareText, buildRankedShareText, sharePageUrl } from './share-links.mjs';

export const EXPLORER_ORIGIN = 'https://liteforge.explorer.caldera.xyz';
// Decision D2: Weekly is the headline standing until the owner switches Daily on.
export const DAILY_STANDING_ENABLED = false;

export const RANKED_RESULT_GAMES = Object.freeze({
  'lester-blaster': 'Hard Money Heroes',
  chikun: "Chikun's Escape",
  stacked: 'STACKED',
});

export const BANNER_TEXT = Object.freeze({
  preview: 'Ranked preview · not published while online settlement is off',
  practice: "Entry didn't confirm, so this run was practice",
  'saved-locally': 'Saved. Publishing will retry automatically',
  retrying: 'Publishing will retry shortly',
  paused: 'Ranked publishing is paused; your run is saved and will publish when it resumes',
});

// Server codes (§4.3.3 errors, §4.4 lastError allowlist) in plain words.
const REJECTIONS = Object.freeze([
  [/^entry-not-paid$|^session-not-paid$/, "The Ranked entry payment wasn't found on LitVM, so this run can't be published."],
  [/^entry-underpaid$/, 'The Ranked entry paid less than the Ranked minimum, so this run can’t be published.'],
  [/^replay-rejected$/, "The server replayed this run and it didn't match, so it wasn't published."],
  [/^implausible-run$/, "This run didn't pass the server's plausibility checks, so it wasn't published."],
  [/^score-out-of-bounds$|-out-of-bounds$/, 'The score is outside the allowed range, so it wasn’t published.'],
  [/^seed-ticket-/, "This run's Ranked seed ticket expired or didn't match, so it wasn't published."],
  [/^run-stale$|^stale$/, 'This run is too old to publish. Ranked runs publish within 7 days.'],
  [/^hero-locked$/, "That hero isn't unlocked for Ranked on this wallet yet, so the run wasn't published."],
  [/^session-conflict$/, 'A different run was already sent for this entry, so this one wasn’t published.'],
  [/^wallet-mismatch$/, 'This run belongs to a different wallet than the one signed in.'],
  [/^(invalid-body|invalid-evidence|session-key-mismatch|session-envelope-invalid|stored-run-mismatch)$|^(identity|evidence|run-summary)-/, "The run data didn't pass the server's checks, so it wasn't published."],
  [/^achievements-hash-mismatch$|^too-many-achievements$|^empty-/, 'LitVM rejected the publish transaction for this run.'],
]);
const REJECTION_FALLBACK = "The arcade server couldn't publish this run.";

export function rejectionText(code) {
  const text = String(code ?? '');
  for (const [pattern, words] of REJECTIONS) if (pattern.test(text)) return words;
  return REJECTION_FALLBACK;
}

const ADDRESS = /^0x[0-9a-f]{40}$/;
const SESSION_KEY = /^0x[0-9a-f]{64}$/;
const TX_URL = /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/;
const KNOWN_STATES = new Set(['preview', 'waiting-entry', 'verifying', 'queued', 'publishing', 'published', 'retrying', 'saved-locally', 'rejected', 'practice']);
const ENTRY_RANK = Object.freeze({ none: 0, pending: 1, confirmed: 2, failed: 2 });

export function shortWallet(wallet) {
  const text = String(wallet ?? '').toLowerCase();
  return ADDRESS.test(text) ? `${text.slice(0, 6)}…${text.slice(-4)}` : '';
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function whole(value) {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.round(number));
}

function formatCount(value) {
  const number = whole(value);
  return number === null ? '—' : number.toLocaleString('en-US');
}

function formatClock(value) {
  const seconds = whole(value);
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function formatCombo(value) {
  const number = whole(value);
  return number === null ? '—' : `×${number.toLocaleString('en-US')}`;
}

function formatRegion(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : '—';
}

function formatBoss(value) {
  const number = whole(value);
  if (number === null) return '—';
  return number > 0 ? 'Defeated' : 'Not defeated';
}

// Guide §3.3 per-game stats (§6.3 keys; the headline keys of E5/E9 cover them).
const STAT_ROWS = Object.freeze({
  'lester-blaster': [
    ['kills', 'Kills', formatCount], ['survivalSeconds', 'Time', formatClock], ['maxCombo', 'Best combo', formatCombo],
    ['level', 'Level', formatCount], ['bossKills', 'Boss', formatBoss],
  ],
  chikun: [
    ['regionReached', 'Region', formatRegion], ['laps', 'Laps', formatCount], ['forksPassed', 'Forks', formatCount],
    ['nearMisses', 'Near-misses', formatCount], ['coinsCollected', 'Coins', formatCount], ['bestCombo', 'Best combo', formatCombo],
  ],
  stacked: [
    ['lines', 'Lines', formatCount], ['level', 'Level', formatCount], ['quadClears', 'Halvings', formatCount],
    ['perfectClears', 'Perfect clears', formatCount], ['maxCombo', 'Best combo', formatCombo], ['survivalSeconds', 'Time', formatClock],
  ],
});

function isStatsObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function entryOf(snapshot, context) {
  const fromSnapshot = snapshot?.entry ?? {};
  const fromContext = context?.entry ?? {};
  const rank = (entry) => ENTRY_RANK[entry?.status] ?? 0;
  const primary = rank(fromContext) > rank(fromSnapshot) ? fromContext : fromSnapshot;
  const txHash = [primary.txHash, fromSnapshot.txHash, fromContext.txHash].find((hash) => typeof hash === 'string' && SESSION_KEY.test(hash)) ?? null;
  return { status: Object.hasOwn(ENTRY_RANK, primary.status) ? primary.status : 'none', txHash };
}

function standingText(standing) {
  const parts = [];
  const rank = (entry) => whole(entry?.rank);
  const daily = DAILY_STANDING_ENABLED ? rank(standing?.daily) : null;
  const weekly = rank(standing?.weekly);
  const allTime = rank(standing?.allTime);
  if (daily) parts.push(`#${daily.toLocaleString('en-US')} today`);
  else if (weekly) parts.push(`#${weekly.toLocaleString('en-US')} this week`);
  if (allTime) parts.push(`#${allTime.toLocaleString('en-US')} all-time`);
  return { parts, share: daily ? `Rank ${daily.toLocaleString('en-US')} today` : weekly ? `Rank ${weekly.toLocaleString('en-US')} this week` : '' };
}

function step(id, status, label, href = null) {
  return Object.freeze({ id, status, label, href });
}

function timelineFor({ state, entry, server, error }) {
  const offline = state === 'preview' || state === 'practice';
  const serverStatus = server?.status ?? null;
  const published = state === 'published';
  const rejected = state === 'rejected';

  let entryStep;
  if (state === 'preview') entryStep = step('entry', 'skipped', 'Preview entry · no zkLTC spent');
  else if (state === 'practice' || entry.status === 'failed') entryStep = step('entry', 'failed', "Entry didn't confirm");
  else if (entry.status === 'confirmed' || server) entryStep = step('entry', 'done', 'Entry confirmed');
  else if (error?.code === 'entry-pending' || entry.status === 'pending' || state === 'waiting-entry') entryStep = step('entry', 'active', 'Entry confirming on LitVM…');
  else if (['verifying', 'queued', 'publishing'].includes(state)) entryStep = step('entry', 'done', 'Entry confirmed');
  else entryStep = step('entry', 'pending', 'Entry');
  if (entry.txHash && entryStep.status !== 'skipped') entryStep = step('entry', entryStep.status, entryStep.label, `${EXPLORER_ORIGIN}/tx/${entry.txHash}`);

  let verified;
  if (offline) verified = step('verified', 'skipped', state === 'preview' ? 'Server verification is off in preview' : 'Not verified (practice run)');
  else if (server) verified = step('verified', 'done', 'Run verified by the arcade server');
  else if (state === 'verifying') verified = step('verified', 'active', 'Verifying the run…');
  else if (state === 'retrying') verified = step('verified', 'active', 'Verification will retry shortly');
  else if (rejected) verified = step('verified', 'failed', 'Verification failed');
  else verified = step('verified', 'pending', 'Run verified by the arcade server');

  let publishing;
  if (offline) publishing = step('publishing', 'skipped', 'Not published to LitVM');
  else if (published) publishing = step('publishing', 'done', 'Sent to LitVM');
  else if (rejected) publishing = server ? step('publishing', 'failed', 'Publishing to LitVM failed') : step('publishing', 'skipped', 'Not published to LitVM');
  else if (state === 'publishing' || serverStatus === 'submitted') publishing = step('publishing', 'active', 'Publishing to LitVM…');
  else if (state === 'queued' || serverStatus === 'pending' || serverStatus === 'signed') publishing = step('publishing', 'active', 'Queued to publish on LitVM');
  else if (state === 'retrying' && serverStatus === 'failed') publishing = step('publishing', 'active', 'Publishing will retry shortly');
  else publishing = step('publishing', 'pending', 'Publishing to LitVM');

  const explorerUrl = typeof server?.explorerUrl === 'string' && TX_URL.test(server.explorerUrl) ? server.explorerUrl : null;
  let publishedStep;
  if (published) publishedStep = step('published', 'done', 'Published on LitVM', explorerUrl);
  else if (offline || rejected) publishedStep = step('published', 'skipped', 'Not published');
  else publishedStep = step('published', 'pending', 'Published');

  const count = Array.isArray(server?.achievements) ? server.achievements.length : 0;
  let achievements;
  if (offline) achievements = step('achievements', 'skipped', 'Achievements record in live Ranked runs');
  else if (server) achievements = step('achievements', 'done', count ? `${count} achievement${count === 1 ? '' : 's'} recorded` : 'No new achievements this run');
  else if (rejected) achievements = step('achievements', 'skipped', 'No achievements recorded');
  else achievements = step('achievements', 'pending', 'Achievements recorded');

  return Object.freeze([entryStep, verified, publishing, publishedStep, achievements]);
}

function bannerFor({ state, error, server }) {
  const code = error?.code ?? server?.lastError ?? null;
  const banner = (kind, text, detail = null) => Object.freeze({ kind, text, detail });
  if (state === 'preview') return banner('preview', BANNER_TEXT.preview, 'Your run stays on this device. Free Mode is always open.');
  if (state === 'practice') return banner('practice', BANNER_TEXT.practice, 'Nothing is published for a practice run.');
  if ((state === 'saved-locally' || state === 'retrying') && code === 'settlement-paused') return banner('paused', BANNER_TEXT.paused);
  if (state === 'saved-locally') {
    const detail = code === 'sign-in-required' ? 'Sign in again with the same wallet to finish publishing.' : null;
    return banner('saved-locally', BANNER_TEXT['saved-locally'], detail);
  }
  if (state === 'retrying') return banner('retrying', BANNER_TEXT.retrying);
  if (state === 'rejected') return banner('rejected', rejectionText(code), 'Testnet entries are not refunded.');
  return banner(null, null);
}

function achievementsFor(gameId, server) {
  if (!Array.isArray(server?.achievements)) return [];
  const collection = String(LITVM_DEPLOYMENT?.addresses?.achievementRegistries?.[gameId] ?? '').toLowerCase();
  return server.achievements.map((item) => {
    let entry = null;
    try { entry = achievementById(gameId, item?.id); } catch { entry = null; }
    const tokenId = typeof item?.tokenId === 'string' && /^[0-9]{1,78}$/.test(item.tokenId) ? item.tokenId : null;
    return Object.freeze({
      id: String(item?.id ?? ''),
      title: entry?.title ?? String(item?.title ?? item?.id ?? ''),
      tier: entry?.tier ?? String(item?.tier ?? 'bronze'),
      image: entry?.image ?? (typeof item?.image === 'string' && item.image.startsWith('/assets/') ? item.image : null),
      tokenId,
      // Phase 2 only (A32): a held token links to its explorer page.
      tokenHref: tokenId && ADDRESS.test(collection) ? `${EXPLORER_ORIGIN}/token/${collection}/instance/${tokenId}` : null,
    });
  }).filter((item) => item.id);
}

export function buildRankedResultsModel({ snapshot, context = {}, standing = null } = {}) {
  const snap = snapshot ?? { state: 'preview' };
  const state = KNOWN_STATES.has(snap.state) ? snap.state : 'verifying';
  const gameId = context?.gameId ?? snap.gameId ?? null;
  const server = snap.server && typeof snap.server === 'object' ? snap.server : null;
  const error = snap.error && typeof snap.error === 'object' ? snap.error : null;
  const entry = entryOf(snap, context);
  const serverScore = finite(server?.score);
  const score = whole(serverScore ?? finite(context?.localScore) ?? finite(snap.localScore)) ?? 0;
  const wallet = String(context?.wallet ?? snap.wallet ?? server?.wallet ?? '').toLowerCase();
  const displayName = typeof context?.displayName === 'string' && context.displayName.trim() ? context.displayName.trim() : null;

  const statsFromServer = isStatsObject(server?.stats);
  const statsSource = statsFromServer ? server.stats : (isStatsObject(context?.localStats) ? context.localStats : {});
  const stats = (STAT_ROWS[gameId] ?? []).map(([key, label, format]) => Object.freeze({ key, label, value: format(statsSource[key]) }));

  const published = state === 'published';
  const previousBest = finite(context?.previousBest);
  const personalBestDelta = (published || state === 'preview') && previousBest !== null && score > previousBest ? score - Math.max(0, Math.round(previousBest)) : null;
  const ranks = published ? standingText(standing) : { parts: [], share: '' };
  const standingParts = [...ranks.parts];
  if (personalBestDelta !== null) standingParts.push(`New personal best (+${personalBestDelta.toLocaleString('en-US')})`);

  const sessionId32 = [snap.sessionId32, context?.sessionId32, server?.sessionId32].find((id) => typeof id === 'string' && SESSION_KEY.test(id)) ?? null;
  // §7.3: a Ranked share (with "Verified on LitVM") only once the run is on
  // chain; preview and practice share the Free template to the site root.
  const canShareRanked = published && sessionId32 !== null && Object.hasOwn(RANKED_RESULT_GAMES, gameId);
  const canShareFree = (state === 'preview' || state === 'practice') && Object.hasOwn(RANKED_RESULT_GAMES, gameId);
  let share = null;
  if (canShareRanked) {
    share = Object.freeze({
      template: 'ranked',
      text: buildRankedShareText(gameId, { score, standingLabel: ranks.share, stats: statsSource, personalBest: personalBestDelta !== null }),
      url: sharePageUrl(sessionId32),
    });
  } else if (canShareFree) {
    share = Object.freeze({ template: 'free', text: buildFreeShareText(gameId, { score, stats: statsSource }), url: SHARE_ORIGIN });
  }

  return Object.freeze({
    gameId,
    title: context?.gameTitle ?? RANKED_RESULT_GAMES[gameId] ?? 'Ranked run',
    state,
    hero: Object.freeze({ score, scoreLabel: score.toLocaleString('en-US'), handle: displayName ?? (shortWallet(wallet) || 'Player') }),
    standing: Object.freeze({ text: standingParts.length ? standingParts.join(' · ') : null, personalBestDelta }),
    stats: Object.freeze(stats),
    statsSource: statsFromServer ? 'server' : 'local',
    timeline: timelineFor({ state, entry, server, error }),
    achievements: Object.freeze(achievementsFor(gameId, server)),
    actions: Object.freeze({ share: share !== null, retry: state === 'saved-locally', playAgain: true, practice: true, profile: ADDRESS.test(wallet) }),
    banner: bannerFor({ state, error, server }),
    share,
  });
}

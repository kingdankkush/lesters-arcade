// Game version labels (owner decision 2026-09-25): balance changes do not
// reset testnet seasons, so every verified score shows the game version it was
// played on. Pure and dependency-free; the index labels E5 leaderboard rows,
// E6 recent sessions and E9 session reads with it (server/neon/rows.mjs), and
// the browser can label anything else the same way.
//
//   lester-blaster  'HMH v<major>.<minor>' from the buildHash ':cabinet-'
//                   segment. A valid HMH build without one (1.8.x, before
//                   HMH_CABINET_VERSION existed) was played on 'HMH v0.5'.
//   chikun          'Chikun v<N>' from runtimeId 'chikun:canvas-runtime-v<N>'.
//   stacked         'STACKED v<major>.<minor>' from the buildHash cabinet.
//
// Anything else never throws and never guesses: a row with no build hash (a
// chain-index row), a malformed value or an unknown game reads '<Game> v?',
// or 'v?' alone.

export const GAME_VERSION_SHORT_NAMES = Object.freeze({ 'lester-blaster': 'HMH', chikun: 'Chikun', stacked: 'STACKED' });
// Fixed: rows made before the cabinet segment keep this label after bumps.
export const HMH_PRE_CABINET_VERSION = '0.5';
export const UNKNOWN_GAME_VERSION = 'v?';

// Contract A11 build hashes; only the shown cabinet parts are bounded.
const BUILD_HASH = /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+(?::cabinet-(\d{1,6})\.(\d{1,6})\.\d+)?$/;
const CHIKUN_RUNTIME = /^(?:chikun:)?canvas-runtime-v(\d{1,6})$/;
const MAX_INPUT_LENGTH = 128;

const textOf = (value) => (typeof value === 'string' && value.length <= MAX_INPUT_LENGTH ? value : '');

function versionOf(gameId, buildHash, runtimeId) {
  if (gameId === 'chikun') {
    const runtime = CHIKUN_RUNTIME.exec(textOf(runtimeId));
    return runtime ? `v${Number(runtime[1])}` : null;
  }
  const build = BUILD_HASH.exec(textOf(buildHash));
  if (!build) return null;
  if (build[1] !== undefined) return `v${Number(build[1])}.${Number(build[2])}`;
  return gameId === 'lester-blaster' ? `v${HMH_PRE_CABINET_VERSION}` : null;
}

// versionLabelFor('lester-blaster', { buildHash: 'site-1.8.2:game-1.8.2:cabinet-0.5.0' }) → 'HMH v0.5'
export function versionLabelFor(gameId, source = null) {
  if (typeof gameId !== 'string' || !Object.hasOwn(GAME_VERSION_SHORT_NAMES, gameId)) return UNKNOWN_GAME_VERSION;
  const { buildHash = null, runtimeId = null } = source && typeof source === 'object' ? source : {};
  return `${GAME_VERSION_SHORT_NAMES[gameId]} ${versionOf(gameId, buildHash, runtimeId) ?? UNKNOWN_GAME_VERSION}`;
}

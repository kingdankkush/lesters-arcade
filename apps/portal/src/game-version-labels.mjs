// Game version labels (owner decision 2026-09-25): balance changes do not
// reset testnet seasons, so every verified score shows the game version it was
// played on. Pure: it imports only the two one-line cabinet constants. The
// index labels E5 leaderboard rows, E6 recent sessions and E9 session reads
// with it (server/neon/rows.mjs), and the browser can label anything else the
// same way.
//
//   lester-blaster  'HMH v<major>.<minor>' from the buildHash ':cabinet-'
//                   segment. A valid HMH build without one (1.8.x, before
//                   HMH_CABINET_VERSION existed) was played on 'HMH v0.5'.
//   chikun          'Chikun v<N>' from runtimeId 'chikun:canvas-runtime-v<N>'.
//   stacked         'STACKED v<major>.<minor>' from the buildHash cabinet.
//
// The server format-checks a buildHash but cannot prove its cabinet (contract
// A11), so an HMH or STACKED cabinet is shown only inside the range this
// deploy has shipped (SHIPPED_CABINETS): a version not shipped yet, or never
// shipped, reads '<Game> v?' instead of the claim. The server sets Chikun's
// runtime id itself, so Chikun needs no range.
//
// Anything else never throws and never guesses: an HMH or STACKED row with no
// build hash (a chain-index row), a malformed value or an unknown game reads
// '<Game> v?', or 'v?' alone.
import { HMH_CABINET_VERSION } from './hmh-cabinet-version.mjs';
import { STACKED_CABINET_VERSION } from './stacked-cabinet.mjs';

export const GAME_VERSION_SHORT_NAMES = Object.freeze({ 'lester-blaster': 'HMH', chikun: 'Chikun', stacked: 'STACKED' });
// Fixed: rows made before the cabinet segment keep this label after bumps.
export const HMH_PRE_CABINET_VERSION = '0.5';
export const UNKNOWN_GAME_VERSION = 'v?';

const majorMinorOf = (version) => version.split('.').slice(0, 2).join('.');

// For each build-hash game, 'major.minor' of the first cabinet a ranked run
// could carry and of the one this deploy builds. HMH's segment starts at
// 0.5.0; every ranked STACKED run was verified on cabinet 0.2.0 or later.
export const SHIPPED_CABINETS = Object.freeze({
  'lester-blaster': Object.freeze({ first: HMH_PRE_CABINET_VERSION, current: majorMinorOf(HMH_CABINET_VERSION) }),
  stacked: Object.freeze({ first: '0.2', current: majorMinorOf(STACKED_CABINET_VERSION) }),
});

// Contract A11 build hashes; only the shown cabinet parts are bounded.
const BUILD_HASH = /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+(?::cabinet-(\d{1,6})\.(\d{1,6})\.\d+)?$/;
const CHIKUN_RUNTIME = /^(?:chikun:)?canvas-runtime-v(\d{1,6})$/;
const MAX_INPUT_LENGTH = 128;

const textOf = (value) => (typeof value === 'string' && value.length <= MAX_INPUT_LENGTH ? value : '');
// Negative, zero or positive as [major, minor] sits before, at or after 'major.minor'.
const compareCabinet = ([major, minor], version) => {
  const [otherMajor, otherMinor] = String(version).split('.').map(Number);
  return major - otherMajor || minor - otherMinor;
};

function versionOf(gameId, buildHash, runtimeId, cabinets) {
  if (gameId === 'chikun') {
    const runtime = CHIKUN_RUNTIME.exec(textOf(runtimeId));
    return runtime ? `v${Number(runtime[1])}` : null;
  }
  const build = BUILD_HASH.exec(textOf(buildHash));
  if (!build) return null;
  if (build[1] === undefined) return gameId === 'lester-blaster' ? `v${HMH_PRE_CABINET_VERSION}` : null;
  const cabinet = [Number(build[1]), Number(build[2])];
  const range = cabinets?.[gameId];
  // NaN (a malformed range) fails both checks, so it shows nothing.
  if (!range || !(compareCabinet(cabinet, range.first) >= 0 && compareCabinet(cabinet, range.current) <= 0)) return null;
  return `v${cabinet[0]}.${cabinet[1]}`;
}

// versionLabelFor('lester-blaster', { buildHash: 'site-1.8.2:game-1.8.2:cabinet-0.5.0' }) → 'HMH v0.5'
// `cabinets` defaults to this deploy's SHIPPED_CABINETS; tests pass others.
export function versionLabelFor(gameId, source = null, options = null) {
  if (typeof gameId !== 'string' || !Object.hasOwn(GAME_VERSION_SHORT_NAMES, gameId)) return UNKNOWN_GAME_VERSION;
  const { buildHash = null, runtimeId = null } = source && typeof source === 'object' ? source : {};
  const cabinets = options?.cabinets ?? SHIPPED_CABINETS;
  return `${GAME_VERSION_SHORT_NAMES[gameId]} ${versionOf(gameId, buildHash, runtimeId, cabinets) ?? UNKNOWN_GAME_VERSION}`;
}

// A label as an API answer carries it, when it has the shape versionLabelFor
// writes; anything else (absent from a body cached before the field existed,
// or unexpected text) is null, and the hosted views show no version for it.
const LABEL = /^(?:[A-Za-z]{1,12} )?v(?:\d{1,6}(?:\.\d{1,6})?|\?)$/;
export function versionLabelText(value) {
  return typeof value === 'string' && LABEL.test(value) ? value : null;
}

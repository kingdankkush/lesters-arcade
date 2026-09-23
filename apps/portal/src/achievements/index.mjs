// Achievement registry and derivation (contract §6.2). Shared by the browser and
// the settle server; pure ESM with no DOM, clock or environment access.
// Catalog order is the display and derivation order. The catalogs, not the
// stored achievement_unlocks.nft flag, decide which ids are NFT candidates (A20).
import { HMH_ACHIEVEMENTS, HMH_HISTORY_FIELDS } from './hmh.mjs';
import { CHIKUN_ACHIEVEMENTS, CHIKUN_HISTORY_FIELDS } from './chikun.mjs';
import { STACKED_ACHIEVEMENTS, STACKED_HISTORY_FIELDS } from './stacked.mjs';

export const ACHIEVEMENT_GAME_IDS = Object.freeze(['lester-blaster', 'chikun', 'stacked']);

const REGISTRY = new Map([
  ['lester-blaster', { entries: HMH_ACHIEVEMENTS, fields: HMH_HISTORY_FIELDS }],
  ['chikun', { entries: CHIKUN_ACHIEVEMENTS, fields: CHIKUN_HISTORY_FIELDS }],
  ['stacked', { entries: STACKED_ACHIEVEMENTS, fields: STACKED_HISTORY_FIELDS }],
].map(([gameId, game]) => [gameId, Object.freeze({
  ...game,
  byId: new Map(game.entries.map((entry) => [entry.id, entry])),
  nftIds: Object.freeze(game.entries.filter((entry) => entry.nft).map((entry) => entry.id)),
})]));

function gameOf(gameId) {
  const game = typeof gameId === 'string' ? REGISTRY.get(gameId) : undefined;
  if (!game) throw new Error(`unknown achievement gameId: ${String(gameId)}`);
  return game;
}

export function catalogFor(gameId) {
  return gameOf(gameId).entries;
}

export function achievementById(gameId, id) {
  return gameOf(gameId).byId.get(id) ?? null;
}

export function nftAchievementIds(gameId) {
  return [...gameOf(gameId).nftIds];
}

// Stats paths the history query sums and maximizes (§6.5); catalog-owned only.
export function historyFieldsFor(gameId) {
  const { sum, max } = gameOf(gameId).fields;
  return { sum: [...sum], max: [...max] };
}

export function emptyHistory(wallet, gameId) {
  const { sum, max } = gameOf(gameId).fields;
  return {
    wallet, gameId, runs: 0,
    sums: Object.fromEntries(sum.map((path) => [path, 0])),
    maxima: Object.fromEntries(max.map((path) => [path, 0])),
    unlockedIds: [],
  };
}

// Every available achievement this verified run newly earns, in catalog order.
export function deriveEarnedAchievements(gameId, verifiedRun, history) {
  const { entries } = gameOf(gameId);
  if (!verifiedRun || verifiedRun.gameId !== gameId) throw new Error(`verified run gameId must be ${gameId}`);
  if (!verifiedRun.stats || typeof verifiedRun.stats !== 'object') throw new Error('verified run stats are required');
  if (history?.gameId !== undefined && history.gameId !== gameId) throw new Error(`achievement history gameId must be ${gameId}`);
  const unlocked = new Set(Array.isArray(history?.unlockedIds) ? history.unlockedIds : []);
  const safeHistory = history ?? emptyHistory(verifiedRun.wallet ?? null, gameId);
  return Object.freeze(entries.filter((entry) => entry.available && !unlocked.has(entry.id) && entry.criteria(verifiedRun, safeHistory)));
}

// keccak256 of the UTF-8 id, as AchievementRegistry keys achievements (§2.1 style).
export function achievementId32(ethers, id) {
  if (typeof id !== 'string' || !id) throw new TypeError('achievement id must be a non-empty string');
  return ethers.id(id);
}

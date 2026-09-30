// Achievement registry and derivation (contract §6.2). Shared by the browser and
// the settle server; pure ESM with no DOM, clock or environment access.
// Catalog order is the display and derivation order. The catalogs, not the
// stored achievement_unlocks.nft flag, decide which ids are NFT candidates (A20).
import { HMH_ACHIEVEMENTS, HMH_HISTORY_FIELDS } from './hmh.mjs';
import { CHIKUN_ACHIEVEMENTS, CHIKUN_HISTORY_FIELDS } from './chikun.mjs';
import { STACKED_ACHIEVEMENTS, STACKED_HISTORY_FIELDS } from './stacked.mjs';
import { ARCADE_ACHIEVEMENTS, ARCADE_ACHIEVEMENT_GAME_ID } from './arcade.mjs';

export const ACHIEVEMENT_GAME_IDS = Object.freeze(['lester-blaster', 'chikun', 'stacked']);
// The parent-owned catalog (arcade.mjs): not a cabinet, so it is not one of the
// game ids above. Any cabinet's verified run can earn its entries, and their
// ids are reserved across the game catalogs.
export const ACHIEVEMENT_PARENT_ID = ARCADE_ACHIEVEMENT_GAME_ID;

const PARENT = Object.freeze({
  entries: ARCADE_ACHIEVEMENTS,
  byId: new Map(ARCADE_ACHIEVEMENTS.map((entry) => [entry.id, entry])),
  ids: Object.freeze(ARCADE_ACHIEVEMENTS.map((entry) => entry.id)),
});

const REGISTRY = new Map([
  ['lester-blaster', { entries: HMH_ACHIEVEMENTS, fields: HMH_HISTORY_FIELDS }],
  ['chikun', { entries: CHIKUN_ACHIEVEMENTS, fields: CHIKUN_HISTORY_FIELDS }],
  ['stacked', { entries: STACKED_ACHIEVEMENTS, fields: STACKED_HISTORY_FIELDS }],
].map(([gameId, game]) => {
  for (const entry of game.entries) {
    if (PARENT.byId.has(entry.id)) throw new Error(`${gameId} catalog reuses the parent-owned id ${entry.id}`);
  }
  return [gameId, Object.freeze({
    ...game,
    byId: new Map(game.entries.map((entry) => [entry.id, entry])),
    nftIds: Object.freeze(game.entries.filter((entry) => entry.nft).map((entry) => entry.id)),
  })];
}));

function gameOf(gameId) {
  const game = typeof gameId === 'string' ? REGISTRY.get(gameId) : undefined;
  if (!game) throw new Error(`unknown achievement gameId: ${String(gameId)}`);
  return game;
}
const isParent = (gameId) => gameId === ACHIEVEMENT_PARENT_ID;

export function catalogFor(gameId) {
  return isParent(gameId) ? PARENT.entries : gameOf(gameId).entries;
}

// The parent-owned entries, in catalog order (the same list as catalogFor('arcade')).
export function parentCatalog() {
  return PARENT.entries;
}

// A game's own entry, else the parent-owned entry of that id: the server
// records a parent-owned unlock under the cabinet of the run that earned it.
export function achievementById(gameId, id) {
  const own = isParent(gameId) ? null : gameOf(gameId).byId.get(id);
  return own ?? PARENT.byId.get(id) ?? null;
}

export function nftAchievementIds(gameId) {
  return isParent(gameId) ? [] : [...gameOf(gameId).nftIds];
}

// Stats paths the history query sums and maximizes (§6.5), and the parent-owned
// ids whose unlocks count whichever cabinet recorded them; catalog-owned only.
export function historyFieldsFor(gameId) {
  const { sum, max } = gameOf(gameId).fields;
  return { sum: [...sum], max: [...max], shared: [...PARENT.ids] };
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

// The §6.5 history must arrive complete and typed. A missing or malformed field
// throws instead of reading as "nothing yet": that would hand back ids the
// wallet already holds, or silently never unlock a run-count or cumulative entry
// (for example when the driver returns count(*) or sum(...) as strings).
function checkHistory(game, gameId, history) {
  if (!history || typeof history !== 'object') throw new TypeError('achievement history is required');
  if (history.gameId !== gameId) throw new TypeError(`achievement history gameId must be ${gameId}`);
  if (!Number.isSafeInteger(history.runs) || history.runs < 0) throw new TypeError('achievement history runs must be a non-negative integer');
  if (!Array.isArray(history.unlockedIds) || !history.unlockedIds.every((id) => typeof id === 'string')) {
    throw new TypeError('achievement history unlockedIds must be an array of strings');
  }
  for (const [bucket, paths] of [['sums', game.fields.sum], ['maxima', game.fields.max]]) {
    const values = history[bucket];
    if (!values || typeof values !== 'object') throw new TypeError(`achievement history ${bucket} must be an object`);
    for (const path of paths) {
      if (typeof values[path] !== 'number' || !Number.isFinite(values[path])) throw new TypeError(`achievement history ${bucket}.${path} must be a finite number`);
    }
  }
}

// Every available achievement this verified run newly earns, in catalog order:
// the game's own entries, then the parent-owned ones (arcade.mjs). The history
// lists parent-owned unlocks from every cabinet (historyFieldsFor shared ids),
// so a parent-owned entry is earned once per wallet, not once per cabinet.
export function deriveEarnedAchievements(gameId, verifiedRun, history) {
  const game = gameOf(gameId);
  if (!verifiedRun || verifiedRun.gameId !== gameId) throw new Error(`verified run gameId must be ${gameId}`);
  if (!verifiedRun.stats || typeof verifiedRun.stats !== 'object') throw new Error('verified run stats are required');
  checkHistory(game, gameId, history);
  const unlocked = new Set(history.unlockedIds);
  const earns = (entry) => entry.available && !unlocked.has(entry.id) && entry.criteria(verifiedRun, history);
  return Object.freeze([...game.entries.filter(earns), ...PARENT.entries.filter(earns)]);
}

// keccak256 of the UTF-8 id, as AchievementRegistry keys achievements (§2.1 style).
export function achievementId32(ethers, id) {
  if (typeof id !== 'string' || !id) throw new TypeError('achievement id must be a non-empty string');
  return ethers.id(id);
}

// Cosmetic unlockables (contract §7.9, A7; guide §5.13, owner decision D8).
//
// Every entry is gated on a server-recorded achievement (an `available` id of
// that game's catalog, achievements/index.mjs) or on a verified run count
// (`games[g].confirmedRuns` of GET /api/profile). Cosmetics change how a game
// looks, never how it plays: they travel to each child through its settings
// channel as one optional `cosmetics` key and never enter evidence, a replay
// input or a result tuple.
//
// Phase note (A7). Phase 1 grants an unlock from an EARNED achievement (a row
// in achievement_unlocks, read through E6) or from the verified run count.
// Phase 2 adds HELD soulbound tokens (an E6 achievement whose tokenId is not
// null). unlockState already accepts `heldAchievementIds`, so phase 2 needs no
// client change; in phase 1 no token exists and that set is empty.
//
// No new art: coats are hue and saturation filters on the Chikun sprite, trails
// are particle colours, hats are a few pixel rectangles, STACKED skins are
// palettes and scene grades, and HMH skins are Pixi tints. `artStatus` stays in
// the shape for future art upgrades; every entry here is 'ready'.
//
// Pure module: no DOM, storage, clock or network (the store owns those).
import { ACHIEVEMENT_GAME_IDS, achievementById } from './achievements/index.mjs';

export const UNLOCKABLE_GAME_IDS = ACHIEVEMENT_GAME_IDS;
export const UNLOCKABLE_KINDS = Object.freeze(['character', 'hero-skin', 'weapon-skin', 'coat', 'trail', 'hat', 'piece-skin', 'scene']);

// The selectable cosmetic slots per game, in panel order. A slot is named after
// its kind; the same names key `preferences.cosmetics[gameId]` (E7).
export const COSMETIC_SLOTS = Object.freeze({
  'lester-blaster': Object.freeze(['hero-skin', 'weapon-skin']),
  chikun: Object.freeze(['coat', 'trail', 'hat']),
  stacked: Object.freeze(['piece-skin', 'scene']),
});

// The key each slot uses in the child's `settings.cosmetics` (contract §7.9).
export const CHILD_COSMETIC_KEYS = Object.freeze({
  'hero-skin': 'heroTint',
  'weapon-skin': 'weaponTint',
  coat: 'coat',
  trail: 'trail',
  hat: 'hat',
  'piece-skin': 'pieceSkin',
  scene: 'scene',
});

const CHIKUN_PREVIEW = '/assets/generated/chikun-flight-v3/poster.webp';
const entry = (value) => Object.freeze({ artStatus: 'ready', ...value, requires: Object.freeze({ ...value.requires }) });

export const UNLOCKABLES = Object.freeze([
  // Hard Money Heroes heroes. The hero select owns the choice
  // (hmh-character-config.mjs buildCharacterUnlockMap); the panel only shows them.
  entry({ id: 'hmh-hero-lester', gameId: 'lester-blaster', kind: 'character', characterId: 'lester-original', title: 'Lester', requires: { confirmedRuns: 5 }, preview: '/assets/generated/hmh-hero-portraits/lester-original.webp', swatch: '#345dcc' }),
  entry({ id: 'hmh-hero-lilly', gameId: 'lester-blaster', kind: 'character', characterId: 'lilly', title: 'Lilly', requires: { confirmedRuns: 10 }, preview: '/assets/generated/hmh-hero-portraits/lilly.webp', swatch: '#1fb5a8' }),
  // Hero skins: Pixi tints of the selected hero's body layers.
  entry({ id: 'hmh-hero-silver', gameId: 'lester-blaster', kind: 'hero-skin', title: 'Litecoin Silver', tint: 0xc9d8ee, swatch: '#c9d8ee', requires: { achievementId: 'score-10000' }, preview: '/assets/generated/hmh-hero-portraits/lit-commando.webp' }),
  entry({ id: 'hmh-hero-neon', gameId: 'lester-blaster', kind: 'hero-skin', title: 'Neon Signal', tint: 0x8ff6ff, swatch: '#8ff6ff', requires: { achievementId: 'big-combo' }, preview: '/assets/generated/hmh-hero-portraits/lit-valkyrie.webp' }),
  entry({ id: 'hmh-hero-gold', gameId: 'lester-blaster', kind: 'hero-skin', title: 'Gold Reserve', tint: 0xffdb7a, swatch: '#ffdb7a', requires: { achievementId: 'boss-breaker' }, preview: '/assets/generated/hmh-hero-portraits/lit-commando.webp' }),
  entry({ id: 'hmh-hero-crimson', gameId: 'lester-blaster', kind: 'hero-skin', title: 'Liquidation Red', tint: 0xff9c9c, swatch: '#ff9c9c', requires: { achievementId: 'enemy-reaper-250' }, preview: '/assets/generated/hmh-hero-portraits/lit-valkyrie.webp' }),
  // Weapon skins: Pixi tints of the held weapon and its projectiles.
  entry({ id: 'hmh-weapon-hashstorm', gameId: 'lester-blaster', kind: 'weapon-skin', title: 'Hashstorm Violet', tint: 0xd3b0ff, swatch: '#d3b0ff', requires: { achievementId: 'weapon-collector' }, preview: '/assets/lester-blaster-weapons.svg' }),
  entry({ id: 'hmh-weapon-amber', gameId: 'lester-blaster', kind: 'weapon-skin', title: 'Blast Amber', tint: 0xffc47e, swatch: '#ffc47e', requires: { achievementId: 'grenade-century' }, preview: '/assets/lester-blaster-weapons.svg' }),
  entry({ id: 'hmh-weapon-seafoam', gameId: 'lester-blaster', kind: 'weapon-skin', title: 'Seafoam Tracer', tint: 0xa4ffcf, swatch: '#a4ffcf', requires: { achievementId: 'hash-rail-specialist' }, preview: '/assets/lester-blaster-weapons.svg' }),
  entry({ id: 'hmh-weapon-veteran', gameId: 'lester-blaster', kind: 'weapon-skin', title: 'Veteran Steel', tint: 0xb8c8e0, swatch: '#b8c8e0', requires: { confirmedRuns: 25 }, preview: '/assets/lester-blaster-weapons.svg' }),
  // Chikun coats: hue and saturation filters on the sprite (apps/chikun/src/character.mjs).
  entry({ id: 'chikun-coat-golden', gameId: 'chikun', kind: 'coat', title: 'Golden Coat', swatch: '#e8b845', requires: { achievementId: 'chikun-coins-60' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-coat-glacier', gameId: 'chikun', kind: 'coat', title: 'Glacier Coat', swatch: '#7fd4ff', requires: { achievementId: 'chikun-reach-coast' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-coat-emerald', gameId: 'chikun', kind: 'coat', title: 'Emerald Coat', swatch: '#5fe08a', requires: { achievementId: 'chikun-reach-forest' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-coat-royal', gameId: 'chikun', kind: 'coat', title: 'Royal Coat', swatch: '#b58cff', requires: { achievementId: 'chikun-loop-1' }, preview: CHIKUN_PREVIEW }),
  // Chikun trails: particle colours of the flap, obstacle and coin bursts.
  entry({ id: 'chikun-trail-gold', gameId: 'chikun', kind: 'trail', title: 'Gold Dust', swatch: '#ffd84a', requires: { achievementId: 'chikun-stack-three' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-trail-neon', gameId: 'chikun', kind: 'trail', title: 'Neon Wake', swatch: '#19f7ff', requires: { achievementId: 'chikun-close-call' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-trail-ember', gameId: 'chikun', kind: 'trail', title: 'Ember Streak', swatch: '#ff7b2f', requires: { achievementId: 'chikun-speed-2x' }, preview: CHIKUN_PREVIEW }),
  // Chikun hats: pixel rectangles drawn on the sprite's head each frame.
  entry({ id: 'chikun-hat-cap', gameId: 'chikun', kind: 'hat', title: 'Arcade Cap', swatch: '#345dcc', requires: { achievementId: 'chikun-first-flight' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-hat-top', gameId: 'chikun', kind: 'hat', title: 'Top Hat', swatch: '#23232b', requires: { achievementId: 'chikun-survive-4m' }, preview: CHIKUN_PREVIEW }),
  entry({ id: 'chikun-hat-crown', gameId: 'chikun', kind: 'hat', title: 'Crown', swatch: '#ffd23f', requires: { achievementId: 'chikun-loop-2' }, preview: CHIKUN_PREVIEW }),
  // STACKED piece skins: palettes (apps/stacked/src/render/cosmetic-palettes.mjs).
  entry({ id: 'stacked-pieces-silver', gameId: 'stacked', kind: 'piece-skin', title: 'Litecoin Silver', swatch: '#b9c9e4', requires: { achievementId: 'stacked-first-line' }, preview: '/assets/cartridge-stacked.svg' }),
  entry({ id: 'stacked-pieces-sunset', gameId: 'stacked', kind: 'piece-skin', title: 'Sunset Ledger', swatch: '#ff8a5c', requires: { achievementId: 'stacked-first-halving' }, preview: '/assets/cartridge-stacked.svg' }),
  entry({ id: 'stacked-pieces-seafoam', gameId: 'stacked', kind: 'piece-skin', title: 'Seafoam Block', swatch: '#6ff0b4', requires: { achievementId: 'stacked-level-10' }, preview: '/assets/cartridge-stacked.svg' }),
  entry({ id: 'stacked-pieces-gold', gameId: 'stacked', kind: 'piece-skin', title: 'Gold Standard', swatch: '#ffcf4a', requires: { achievementId: 'stacked-halvings-3' }, preview: '/assets/cartridge-stacked.svg' }),
  // STACKED scene grades: colour grades over every existing visualizer. The
  // visualizers themselves stay free (none is ever locked).
  entry({ id: 'stacked-scene-noir', gameId: 'stacked', kind: 'scene', title: 'Noir Grade', swatch: '#9fb2d6', requires: { achievementId: 'stacked-survive-2m' }, preview: '/assets/stacked-mode-select/stacked-mode-bg.svg' }),
  entry({ id: 'stacked-scene-sunset', gameId: 'stacked', kind: 'scene', title: 'Sunset Grade', swatch: '#ffb48c', requires: { achievementId: 'stacked-chain-5' }, preview: '/assets/stacked-mode-select/stacked-mode-bg.svg' }),
  entry({ id: 'stacked-scene-forge', gameId: 'stacked', kind: 'scene', title: 'Hashrate Green', swatch: '#8effb4', requires: { achievementId: 'stacked-survive-7m' }, preview: '/assets/stacked-mode-select/stacked-mode-bg.svg' }),
]);

const BY_ID = new Map(UNLOCKABLES.map((item) => [item.id, item]));
const WALLET = /^0x[0-9a-f]{40}$/;

export function unlockableById(id) {
  return typeof id === 'string' ? BY_ID.get(id) ?? null : null;
}

export function unlockablesFor(gameId, kind = null) {
  return UNLOCKABLES.filter((item) => item.gameId === gameId && (kind === null || item.kind === kind));
}

// The catalog entry an achievement-gated unlockable names, or null.
export function requiredAchievement(item) {
  const id = item?.requires?.achievementId;
  if (typeof id !== 'string') return null;
  try { return achievementById(item.gameId, id); } catch { return null; }
}

// Player-facing requirement copy (contract A32: no NFT, soulbound or minting
// wording in phase 1). Achievement gates say "Earn <title>".
export function requirementText(item) {
  if (!item) return '';
  if (item.artStatus !== 'ready') return 'Coming soon';
  const achievement = requiredAchievement(item);
  if (achievement) return `Earn ${achievement.title}`;
  const runs = item.requires?.confirmedRuns;
  if (Number.isSafeInteger(runs)) return `Finish ${runs} verified Ranked ${runs === 1 ? 'run' : 'runs'}`;
  return '';
}

export function emptyUnlocks() {
  return {
    achievementIds: new Set(),
    heldAchievementIds: new Set(),
    confirmedRuns: Object.fromEntries(UNLOCKABLE_GAME_IDS.map((gameId) => [gameId, 0])),
  };
}

const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);

// unlockState(entry, { achievementIds, heldAchievementIds, confirmedRuns }).
// `reason` is 'earned' | 'held' | 'verified-runs' when unlocked, else
// 'achievement-required' | 'verified-runs-required' | 'coming-soon' | 'unknown'.
export function unlockState(item, { achievementIds, heldAchievementIds, confirmedRuns } = {}) {
  if (!item || !BY_ID.has(item.id)) return { unlocked: false, reason: 'unknown' };
  if (item.artStatus !== 'ready') return { unlocked: false, reason: 'coming-soon' };
  const achievementId = item.requires.achievementId;
  if (typeof achievementId === 'string') {
    if (achievementIds?.has?.(achievementId)) return { unlocked: true, reason: 'earned' };
    // Phase 2: a held soulbound token unlocks too (A7). Empty in phase 1.
    if (heldAchievementIds?.has?.(achievementId)) return { unlocked: true, reason: 'held' };
    return { unlocked: false, reason: 'achievement-required' };
  }
  const required = item.requires.confirmedRuns;
  if (Number.isSafeInteger(required)) {
    const current = count(confirmedRuns?.[item.gameId]);
    return current >= required
      ? { unlocked: true, reason: 'verified-runs', current, required }
      : { unlocked: false, reason: 'verified-runs-required', current, required };
  }
  return { unlocked: false, reason: 'unknown' };
}

// E6 (GET /api/profile, public or self view) → the unlock inputs. Only ids
// of the matching game's catalog count; a non-null tokenId marks a held token.
export function unlocksFromProfileResponse(profileResponse) {
  const unlocks = emptyUnlocks();
  const achievements = Array.isArray(profileResponse?.achievements) ? profileResponse.achievements : [];
  for (const unlock of achievements) {
    if (!unlock || typeof unlock.id !== 'string' || !UNLOCKABLE_GAME_IDS.includes(unlock.gameId)) continue;
    if (!achievementById(unlock.gameId, unlock.id)) continue;
    unlocks.achievementIds.add(unlock.id);
    if (unlock.tokenId !== null && unlock.tokenId !== undefined) unlocks.heldAchievementIds.add(unlock.id);
  }
  for (const gameId of UNLOCKABLE_GAME_IDS) unlocks.confirmedRuns[gameId] = count(profileResponse?.games?.[gameId]?.confirmedRuns);
  return unlocks;
}

// A JSON-safe copy for the per-wallet cache, and back.
export function serializeUnlocks(unlocks) {
  return {
    achievementIds: [...(unlocks?.achievementIds ?? [])].filter((id) => typeof id === 'string').sort(),
    heldAchievementIds: [...(unlocks?.heldAchievementIds ?? [])].filter((id) => typeof id === 'string').sort(),
    confirmedRuns: Object.fromEntries(UNLOCKABLE_GAME_IDS.map((gameId) => [gameId, count(unlocks?.confirmedRuns?.[gameId])])),
  };
}

export function deserializeUnlocks(value) {
  const unlocks = emptyUnlocks();
  if (!value || typeof value !== 'object') return unlocks;
  const known = (id) => typeof id === 'string' && UNLOCKABLE_GAME_IDS.some((gameId) => achievementById(gameId, id));
  for (const id of Array.isArray(value.achievementIds) ? value.achievementIds : []) if (known(id)) unlocks.achievementIds.add(id);
  for (const id of Array.isArray(value.heldAchievementIds) ? value.heldAchievementIds : []) if (known(id)) unlocks.heldAchievementIds.add(id);
  for (const gameId of UNLOCKABLE_GAME_IDS) unlocks.confirmedRuns[gameId] = count(value.confirmedRuns?.[gameId]);
  return unlocks;
}

// preferences.cosmetics (E7 shape { [gameId]: { [slot]: id } }) reduced to
// known games, slots and ids of that slot's kind. Nothing else survives.
export function normalizeCosmeticSelection(value) {
  const selection = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return selection;
  for (const [gameId, slots] of Object.entries(COSMETIC_SLOTS)) {
    const chosen = value[gameId];
    if (!chosen || typeof chosen !== 'object' || Array.isArray(chosen)) continue;
    for (const slot of slots) {
      const item = unlockableById(chosen[slot]);
      if (item && item.gameId === gameId && item.kind === slot) (selection[gameId] ??= {})[slot] = item.id;
    }
  }
  return selection;
}

// The selection a game may use now: a slot keeps its id only while that item
// is still unlocked (a selection is honoured only if still unlocked).
export function resolveCosmeticSelection(gameId, selection, unlocks) {
  const slots = COSMETIC_SLOTS[gameId];
  if (!slots) throw new Error(`unknown unlockables gameId: ${String(gameId)}`);
  const chosen = normalizeCosmeticSelection(selection)[gameId] ?? {};
  return Object.fromEntries(slots.map((slot) => {
    const item = unlockableById(chosen[slot]);
    return [slot, item && unlockState(item, unlocks ?? emptyUnlocks()).unlocked ? item.id : null];
  }));
}

// The child's `settings.cosmetics` value (contract §7.9 table):
//   chikun  { coat, trail, hat }          ids from the fixed allowlist
//   stacked { pieceSkin, scene }          ids from the fixed allowlist
//   HMH     { heroTint, weaponTint }      0xRRGGBB integers from the tints above
export function childCosmeticsFor(gameId, selection, unlocks) {
  const resolved = resolveCosmeticSelection(gameId, selection, unlocks);
  const out = {};
  for (const [slot, id] of Object.entries(resolved)) {
    const item = unlockableById(id);
    out[CHILD_COSMETIC_KEYS[slot]] = gameId === 'lester-blaster' ? (item ? item.tint : null) : (item ? item.id : null);
  }
  return out;
}

// The tints the parent may send to the HMH child (its allowlist).
export const HMH_COSMETIC_TINTS = Object.freeze({
  heroTint: Object.freeze(unlockablesFor('lester-blaster', 'hero-skin').map((item) => item.tint)),
  weaponTint: Object.freeze(unlockablesFor('lester-blaster', 'weapon-skin').map((item) => item.tint)),
});

export function normalizeUnlockWallet(value) {
  const wallet = String(value ?? '').toLowerCase();
  return WALLET.test(wallet) ? wallet : null;
}

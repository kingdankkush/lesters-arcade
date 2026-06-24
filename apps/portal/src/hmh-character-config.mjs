export const HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG = Object.freeze({
  rosterDecisionStatus: 'resolved-commando-valkyrie-starters-lester-lilly-unlockables',
  directionMode: '8-direction-backbone',
  starterLegacyId: 'lit-commando',
  startersLegacyIds: Object.freeze(['lit-commando', 'lit-valkyrie']),
  starterCharacterIds: Object.freeze(['lit-commando', 'lit-valkyrie']),
  levelOneUnlockLegacyId: 'lester-original',
  levelOneUnlockAchievementId: 'getaway-clear',
  levelOneUnlockCharacterId: 'lester-original',
  levelOneUnlockTitle: 'Lester',
  levelOneUnlockDescription: 'Unlock Lester by completing Level 1: The Crypto Wasteland.',
  tenRankedUnlockCharacterId: 'lilly',
  tenRankedUnlockLegacyId: 'lilly',
  tenRankedUnlockAchievementId: 'ten-paid-runs',
  tenRankedUnlockTitle: 'Lilly',
  tenRankedUnlockDescription: 'Unlock Lilly after completing 10 ranked Hard Money Heroes matches.',
  unlockableCharacters: Object.freeze([
    Object.freeze({
      id: 'lester-original',
      legacyId: 'lester-original',
      title: 'Lester',
      achievementId: 'getaway-clear',
      cta: 'CLEAR LEVEL 1 TO UNLOCK',
      description: 'Unlock Lester by completing Level 1: The Crypto Wasteland.',
    }),
    Object.freeze({
      id: 'lilly',
      legacyId: 'lilly',
      title: 'Lilly',
      achievementId: 'ten-paid-runs',
      paidRunsRequired: 10,
      cta: 'PLAY 10 RANKED MATCHES TO UNLOCK',
      description: 'Unlock Lilly after completing 10 ranked Hard Money Heroes matches.',
    }),
  ]),
});

export const HMH_PLAYABLE_CHARACTER_VISUAL_KITS = Object.freeze({
  'lit-commando': Object.freeze({
    id: 'lit-commando',
    source: 'animated-roster',
    manifestPath: './assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']),
    productionStatus: 'needs death plus missing shoot/hurt directions before AAA lock',
  }),
  'lit-valkyrie': Object.freeze({
    id: 'lit-valkyrie',
    source: 'animated-roster',
    manifestPath: './assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']),
    productionStatus: 'needs one missing death direction before AAA lock',
  }),
  'lester-original': Object.freeze({
    id: 'lester-original',
    source: 'lester-production-manifest + user reference stills',
    manifestPath: './assets/lester-production/lester-production-sprite-manifest.json',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']),
    productionStatus: 'reference locked; needs full 8-direction production pass for every combat state',
  }),
  lilly: Object.freeze({
    id: 'lilly',
    source: 'animated-roster + user reference stills',
    manifestPath: './assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']),
    productionStatus: 'runtime kit currently complete, but should be rebuilt/QAed against Justin reference sprites for AAA lock',
  }),
});

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clone(value) {
  return value == null || typeof structuredClone !== 'function'
    ? JSON.parse(JSON.stringify(value ?? null))
    : structuredClone(value);
}

function configuredStarterIds(config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const starters = Array.isArray(config.starterCharacterIds) && config.starterCharacterIds.length
    ? config.starterCharacterIds
    : Array.isArray(config.startersLegacyIds) && config.startersLegacyIds.length
      ? config.startersLegacyIds
      : [config.starterLegacyId];
  return Object.freeze(
    [...new Set(starters.map((id) => normalizeId(id)).filter(Boolean))],
  );
}

function configuredUnlockables(config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  if (Array.isArray(config.unlockableCharacters) && config.unlockableCharacters.length) {
    return Object.freeze(config.unlockableCharacters.map((unlock) => Object.freeze({ ...unlock, id: normalizeId(unlock.id ?? unlock.legacyId) })));
  }
  const legacyLevelOne = normalizeId(config.levelOneUnlockCharacterId ?? config.levelOneUnlockLegacyId);
  return legacyLevelOne
    ? Object.freeze([Object.freeze({ id: legacyLevelOne, achievementId: config.levelOneUnlockAchievementId, cta: 'CLEAR LEVEL 1 TO UNLOCK' })])
    : Object.freeze([]);
}

function profileRankedRuns(profile = {}) {
  const topLevel = Math.max(0, Number(profile.totalPaidRuns) || 0);
  const progressMax = Math.max(
    0,
    ...Object.values(profile.progress ?? {}).map((game) => Number(game?.paidRuns) || 0),
  );
  return Math.max(topLevel, progressMax);
}

function unlockEarned(unlock = {}, profile = {}, earned = new Set()) {
  const achievementId = normalizeId(unlock.achievementId);
  if (achievementId && earned.has(achievementId)) return true;
  if (Number.isFinite(Number(unlock.paidRunsRequired)) && profileRankedRuns(profile) >= Number(unlock.paidRunsRequired)) return true;
  return false;
}

export function buildCharacterUnlockMap(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const starterIds = configuredStarterIds(config);
  const earned = new Set((profile.achievements ?? []).map((id) => normalizeId(id)));
  const existing = profile.unlocks?.characters ?? {};
  const unlocks = { ...existing };
  for (const starterId of starterIds) unlocks[starterId] = true;
  for (const unlock of configuredUnlockables(config)) {
    if (unlock.id) unlocks[unlock.id] = unlockEarned(unlock, profile, earned);
  }
  return Object.freeze(unlocks);
}

export function syncConfiguredCharacterUnlocks(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  profile.unlocks ??= {};
  profile.unlocks.characters = clone(buildCharacterUnlockMap(profile, config));
  profile.preferences ??= {};
  const starters = configuredStarterIds(config);
  const fallback = starters[0] ?? normalizeId(config.starterLegacyId);
  if (!profile.preferences.selectedCharacterId || !profile.unlocks.characters[normalizeId(profile.preferences.selectedCharacterId)]) {
    profile.preferences.selectedCharacterId = fallback;
  }
  return profile.unlocks.characters;
}

export function resolveSelectedCharacterId(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const unlocks = buildCharacterUnlockMap(profile, config);
  const preferred = normalizeId(profile.preferences?.selectedCharacterId ?? config.starterLegacyId);
  if (unlocks[preferred]) return preferred;
  const starters = configuredStarterIds(config);
  return starters.find((id) => unlocks[id]) ?? normalizeId(config.starterLegacyId);
}

export function setPreferredCharacter(profile = {}, characterId, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const desired = normalizeId(characterId);
  const unlocks = buildCharacterUnlockMap(profile, config);
  if (!unlocks[desired]) {
    return { ok: false, reason: 'locked', selectedCharacterId: resolveSelectedCharacterId(profile, config) };
  }
  profile.preferences ??= {};
  profile.preferences.selectedCharacterId = desired;
  return { ok: true, selectedCharacterId: desired };
}

export function buildCharacterSelectEntries(baseRoster = [], profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const unlocks = buildCharacterUnlockMap(profile, config);
  const selectedCharacterId = resolveSelectedCharacterId(profile, config);
  const unlockById = new Map(configuredUnlockables(config).map((unlock) => [normalizeId(unlock.id), unlock]));
  return baseRoster.map((entry) => {
    const entryId = normalizeId(entry.id);
    const legacyId = normalizeId(entry.legacyId ?? entry.id);
    const lookupId = entryId || legacyId;
    const unlock = unlockById.get(lookupId);
    const unlocked = Boolean(unlocks[lookupId]);
    const cta = unlocked
      ? `SELECT — PLAY AS ${String(entry.name ?? entry.title ?? lookupId).toUpperCase()}`
      : unlock?.cta ?? 'LOCKED';
    return Object.freeze({
      ...entry,
      id: lookupId,
      legacyId: lookupId,
      locked: !unlocked,
      unlocked,
      selected: selectedCharacterId === lookupId,
      unlockDescription: unlock?.description ?? entry.unlockDescription,
      cta,
    });
  });
}

export function playableCharacterVisualKitFor(characterId) {
  return HMH_PLAYABLE_CHARACTER_VISUAL_KITS[normalizeId(characterId)] ?? null;
}

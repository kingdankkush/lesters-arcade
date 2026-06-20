export const HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG = Object.freeze({
  rosterDecisionStatus: 'pending-justin-confirmation',
  directionMode: '8-direction-backbone',
  starterLegacyId: 'lester',
  levelOneUnlockLegacyId: 'lilly',
  levelOneUnlockAchievementId: 'getaway-clear',
});

export const HMH_PLAYABLE_CHARACTER_VISUAL_KITS = Object.freeze({
  lester: Object.freeze({
    legacyId: 'lester',
    source: 'lester-production-manifest',
    manifestPath: './assets/lester-production/lester-production-sprite-manifest.json',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'jump']),
  }),
  lilly: Object.freeze({
    legacyId: 'lilly',
    source: 'animated-roster',
    manifestPath: './assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee']),
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

export function buildCharacterUnlockMap(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const starterId = normalizeId(config.starterLegacyId);
  const unlockId = normalizeId(config.levelOneUnlockLegacyId);
  const earned = new Set((profile.achievements ?? []).map((id) => normalizeId(id)));
  const existing = profile.unlocks?.characters ?? {};
  const unlocks = {
    ...existing,
    [starterId]: true,
    [unlockId]: earned.has(normalizeId(config.levelOneUnlockAchievementId)),
  };
  return Object.freeze(unlocks);
}

export function syncConfiguredCharacterUnlocks(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  profile.unlocks ??= {};
  profile.unlocks.characters = clone(buildCharacterUnlockMap(profile, config));
  profile.preferences ??= {};
  if (!profile.preferences.selectedCharacterId || !profile.unlocks.characters[normalizeId(profile.preferences.selectedCharacterId)]) {
    profile.preferences.selectedCharacterId = normalizeId(config.starterLegacyId);
  }
  return profile.unlocks.characters;
}

export function resolveSelectedCharacterId(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const unlocks = buildCharacterUnlockMap(profile, config);
  const preferred = normalizeId(profile.preferences?.selectedCharacterId ?? config.starterLegacyId);
  return unlocks[preferred] ? preferred : normalizeId(config.starterLegacyId);
}

export function setPreferredCharacter(profile = {}, legacyId, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG) {
  const desired = normalizeId(legacyId);
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
  return baseRoster.map((entry) => {
    const legacyId = normalizeId(entry.legacyId ?? entry.id);
    const unlocked = Boolean(unlocks[legacyId]);
    const cta = unlocked
      ? `SELECT — PLAY AS ${String(entry.name ?? entry.title ?? legacyId).toUpperCase()}`
      : legacyId === normalizeId(config.levelOneUnlockLegacyId)
        ? 'CLEAR LEVEL 1 TO UNLOCK'
        : 'LOCKED';
    return Object.freeze({
      ...entry,
      legacyId,
      locked: !unlocked,
      unlocked,
      selected: selectedCharacterId === legacyId,
      cta,
    });
  });
}

export function playableCharacterVisualKitFor(legacyId) {
  return HMH_PLAYABLE_CHARACTER_VISUAL_KITS[normalizeId(legacyId)] ?? null;
}

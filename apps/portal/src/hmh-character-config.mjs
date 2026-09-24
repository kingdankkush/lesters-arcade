export const HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG = Object.freeze({
  rosterDecisionStatus: 'resolved-commando-valkyrie-starters-lester-lilly-ranked-unlockables',
  directionMode: '8-direction-backbone',
  starterLegacyId: 'lit-commando',
  startersLegacyIds: Object.freeze(['lit-commando', 'lit-valkyrie']),
  starterCharacterIds: Object.freeze(['lit-commando', 'lit-valkyrie']),
  // Legacy fields stay present for older saved profiles/tests. WO-95 no longer
  // grants fresh Lester unlocks for Level 1 clears, but existing players who
  // earned `getaway-clear` keep Lester through `legacyMigrationAchievementId`.
  levelOneUnlockLegacyId: 'lester-original',
  levelOneUnlockAchievementId: 'getaway-clear',
  levelOneUnlockCharacterId: 'lester-original',
  levelOneUnlockTitle: 'Lester',
  levelOneUnlockDescription: 'Legacy migration only: existing Level 1 clear profiles keep Lester.',
  tenRankedUnlockCharacterId: 'lilly',
  tenRankedUnlockLegacyId: 'lilly',
  tenRankedUnlockAchievementId: 'ten-paid-runs',
  tenRankedUnlockTitle: 'Lilly',
  tenRankedUnlockDescription: 'Complete 10 Ranked Hard Money Heroes games on this wallet to unlock Lilly.',
  unlockableCharacters: Object.freeze([
    Object.freeze({
      id: 'lester-original',
      legacyId: 'lester-original',
      title: 'Lester',
      gate: Object.freeze({ type: 'ranked-matches-played', count: 5 }),
      legacyMigrationAchievementId: 'getaway-clear',
      cta: 'Complete 5 Ranked games to unlock Lester.',
      description: 'Unlock Lester after 5 completed Ranked Hard Money Heroes games on this wallet. Free mode does not count. Previously earned unlocks are kept.',
    }),
    Object.freeze({
      id: 'lilly',
      legacyId: 'lilly',
      title: 'Lilly',
      gate: Object.freeze({ type: 'ranked-matches-played', count: 10 }),
      cta: 'Complete 10 Ranked games to unlock Lilly.',
      description: 'Unlock Lilly after 10 completed Ranked Hard Money Heroes games on this wallet. Free mode does not count.',
    }),
  ]),
});

export const HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES = Object.freeze({
  'lit-commando': Object.freeze({
    id: 'lit-commando',
    name: 'Lit Commando',
    tagline: 'Tanky Bruiser',
    bio: 'Battle-worn commando with a dark mullet, red neckerchief, and olive field shirt with rolled sleeves. More HP, armor, and damage — a touch slower. Walks straight into the panic with hard money on his side.',
    stats: Object.freeze([Object.freeze(['Power', 5]), Object.freeze(['Speed', 3]), Object.freeze(['Armor', 5]), Object.freeze(['Luck', 3])]),
    simMultipliers: Object.freeze({ maxHealth: 1.2, damage: 1.12, armor: 1.1, movementSpeed: 0.92, incomingDamage: 0.9 }),
    combatStats: Object.freeze({ maxHealth: 120, speed: 0.92, jump: 1.0, melee: 1.15, luck: 0.95 }),
    viability: Object.freeze({ ok: true, style: 'durable opener', tradeoff: 'slower movement offsets higher health, damage, and armor' }),
    startingWeaponId: 'auto-miner',
    startingWeaponDurationSeconds: 45,
    passive: Object.freeze({ id: 'reserve-plating', title: 'Reserve Plating', description: 'Takes 10% less incoming damage.' }),
    signature: Object.freeze({ id: 'boss-reserve', title: 'Boss Reserve', description: 'Major-boss clears restore 15% maximum health.', bossRecoveryFraction: 0.15 }),
  }),
  'lit-valkyrie': Object.freeze({
    id: 'lit-valkyrie',
    name: 'Lit Valkyrie',
    tagline: 'Agile Glass-Cannon',
    bio: 'Battle-ready survivor with long wavy blonde hair, a red headband, and an olive cropped tank. Faster movement, higher fire-rate and crit chance — but more fragile. Darts through the panic and punishes mistakes.',
    stats: Object.freeze([Object.freeze(['Power', 4]), Object.freeze(['Speed', 5]), Object.freeze(['Armor', 2]), Object.freeze(['Luck', 5])]),
    simMultipliers: Object.freeze({ movementSpeed: 1.15, rateOfFire: 1.12, criticalChance: 1.15, maxHealth: 0.88, movingFireRate: 1.12 }),
    combatStats: Object.freeze({ maxHealth: 88, speed: 1.15, jump: 1.0, melee: 0.95, luck: 1.15 }),
    viability: Object.freeze({ ok: true, style: 'mobile glass-cannon', tradeoff: 'lower health offsets speed, fire-rate, and crit upside' }),
    startingWeaponId: 'spread-ltc',
    startingWeaponDurationSeconds: 45,
    passive: Object.freeze({ id: 'velocity-trigger', title: 'Velocity Trigger', description: 'Fires 12% faster while moving.' }),
    signature: Object.freeze({ id: 'momentum-volley', title: 'Momentum Volley', description: 'Movement turns Spread LTC into a faster opening sweep.', movingFireRateMultiplier: 1.12 }),
  }),
  'lester-original': Object.freeze({
    id: 'lester-original',
    name: 'Lester',
    tagline: 'Original Commando',
    bio: 'Cobalt-blue spherical mascot head with Litecoin mark, blue scarf and olive vest. Balanced stats. Unlock after 5 completed Ranked Hard Money Heroes games on this wallet.',
    stats: Object.freeze([Object.freeze(['Power', 3]), Object.freeze(['Speed', 3]), Object.freeze(['Armor', 3]), Object.freeze(['Luck', 3])]),
    simMultipliers: Object.freeze({ maxHealth: 1.0, damage: 1.0, armor: 1.0, movementSpeed: 1.0, xpGain: 1.12 }),
    combatStats: Object.freeze({ maxHealth: 100, speed: 1.0, jump: 1.0, melee: 1.0, luck: 1.0 }),
    viability: Object.freeze({ ok: true, style: 'balanced unlockable', tradeoff: 'no extreme stat; consistency is the reward' }),
    startingWeaponId: 'coin-blaster',
    startingWeaponDurationSeconds: 0,
    passive: Object.freeze({ id: 'compound-xp', title: 'Compound Experience', description: 'Collects 12% more XP from every source.' }),
    signature: Object.freeze({ id: 'settled-bounty', title: 'Settled Bounty', description: 'Major-boss score payouts are worth 10% more.', bossScoreMultiplier: 1.1 }),
  }),
  lilly: Object.freeze({
    id: 'lilly',
    name: 'Lilly',
    tagline: 'Ranked Veteran',
    bio: 'Tactical veteran with wavy teal hair, round tinted glasses, and a long gold-trimmed teal coat. Unlock after 10 completed Ranked Hard Money Heroes games on this wallet.',
    stats: Object.freeze([Object.freeze(['Power', 3]), Object.freeze(['Speed', 4]), Object.freeze(['Armor', 3]), Object.freeze(['Luck', 4])]),
    simMultipliers: Object.freeze({ movementSpeed: 1.08, rateOfFire: 1.05, criticalChance: 1.08, maxHealth: 0.96, luck: 1.15 }),
    combatStats: Object.freeze({ maxHealth: 96, speed: 1.08, jump: 1.0, melee: 1.05, luck: 1.08 }),
    viability: Object.freeze({ ok: true, style: 'agile veteran', tradeoff: 'moderate HP dip offsets broad mobility/fire-rate/crit lift' }),
    startingWeaponId: 'scatter-shotgun',
    startingWeaponDurationSeconds: 45,
    passive: Object.freeze({ id: 'dividend-luck', title: 'Dividend Luck', description: 'Improves deterministic power-up drop rolls by 15%.' }),
    signature: Object.freeze({ id: 'closeout-dividend', title: 'Closeout Dividend', description: 'Block Breaker pressure converts close-range clears into richer pickup odds.', dropLuckMultiplier: 1.15 }),
  }),
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
    source: 'animated-roster',
    manifestPath: './assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
    directionMode: '8-direction-backbone',
    states: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']),
    productionStatus: 'canonical roster source; reference-locked identity still needs Wave 3 dash/victory QA before AAA lock',
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

function canonicalPlayableCharacterId(value) {
  const id = normalizeId(value);
  return id === 'lester' ? 'lester-original' : id;
}

export function playableCharacterStatIdentityFor(characterId) {
  const id = canonicalPlayableCharacterId(characterId);
  return HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES[id] ?? null;
}

function characterStatIdentityEntry(characterId) {
  const identity = playableCharacterStatIdentityFor(characterId);
  if (!identity) return null;
  return Object.freeze({
    ...clone(identity),
    statTruthSource: 'hmh-character-config',
  });
}

export function buildCharacterStatIdentityRoster() {
  return Object.freeze(Object.keys(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES).map(characterStatIdentityEntry).filter(Boolean));
}

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
  // The parent stores this completed-game aggregate inside the wallet profile.
  // Arcade totals and another game's history cannot recruit HMH characters.
  const count = Number(profile.progress?.['lester-blaster']?.paidRuns);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

// Hosted mode (HOSTED_PROFILE_SYNC; D4 clean slate, contract §7.9): the Lester
// and Lilly gates count only verified Ranked runs, games['lester-blaster']
// .confirmedRuns from GET /api/profile (or the unlockables slice's cached copy
// of it). Local unlock flags, local run counts and the local getaway-clear
// migration are ignored there, because a browser can edit all of them.
//
// Callers pass { hosted: HOSTED_PROFILE_SYNC, verifiedRuns }:
// - hosted:true is hosted mode. A missing, undefined, null or invalid count
//   (first visit, offline, E6 not loaded yet) counts as 0 verified runs, never
//   as the local path, so a paid Ranked run can never start with a hero E3
//   then refuses with 422 hero-locked (entries are not refunded).
// - hosted:false is preview mode: today's device-local logic.
// - Without `hosted`, the verifiedRuns key itself selects hosted mode, even
//   when its value is undefined ({ verifiedRuns: cache?.count }); only options
//   without that key keep the device-local logic.
// The server enforces the same gates for Ranked (E3, §4.3.3 step 11).
export function verifiedRunsFor(options = {}) {
  if (!options || typeof options !== 'object') return null;
  const hosted = options.hosted === true || (options.hosted !== false && Object.hasOwn(options, 'verifiedRuns'));
  if (!hosted) return null;
  const raw = options.verifiedRuns;
  const count = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

// Unlockables slice (contract §7.9, A7): the portal registers where a profile's
// gate options come from, so calls that pass no options (arcade-core's profile
// syncs on connect, after every recorded run and in the arcade snapshot) apply
// the hero select's gates, with the cached verified count, to the connected
// wallet. With no provider, or for a profile it does not name, `{}` keeps the
// device-local logic.
let characterUnlockOptionsProvider = null;
const providedOptions = new WeakSet();
export function setCharacterUnlockOptionsProvider(provider) {
  characterUnlockOptionsProvider = typeof provider === 'function' ? provider : null;
}
function providedUnlockOptions(profile) {
  let options = null;
  try { options = characterUnlockOptionsProvider?.(profile) ?? null; } catch { options = null; }
  if (!options || typeof options !== 'object') return {};
  const copy = { ...options };
  providedOptions.add(copy);
  return copy;
}
// Hosted gates whose verified count is not known yet (no E6 answer, no cache).
function verifiedCountPending(options = {}) {
  return verifiedRunsFor(options) !== null && (options.verifiedRuns === null || options.verifiedRuns === undefined);
}

function gateProgress(unlock = {}, profile = {}, verifiedRuns = null) {
  const gate = unlock.gate ?? (Number.isFinite(Number(unlock.paidRunsRequired))
    ? { type: 'ranked-matches-played', count: Number(unlock.paidRunsRequired) }
    : null);
  if (!gate || gate.type !== 'ranked-matches-played') return null;
  const required = Math.max(0, Math.floor(Number(gate.count) || 0));
  const verified = verifiedRuns !== null;
  const current = Math.min(required, verified ? verifiedRuns : profileRankedRuns(profile));
  return Object.freeze({
    type: gate.type,
    current,
    required,
    remaining: Math.max(0, required - current),
    percent: required > 0 ? Math.round((current / required) * 100) : 100,
    meterText: `RANKED MATCHES: ${current} / ${required}`,
    note: verified
      ? 'Verified HMH Ranked games on this wallet, published on LitVM. Free mode does not count.'
      : 'Completed HMH Ranked games on this wallet. Free mode does not count.',
    source: verified ? 'verified' : 'device',
  });
}

function unlockEarned(unlock = {}, profile = {}, earned = new Set(), verifiedRuns = null) {
  if (verifiedRuns === null) {
    const legacyMigrationAchievementId = normalizeId(unlock.legacyMigrationAchievementId);
    const existing = profile.unlocks?.characters?.[normalizeId(unlock.id)] === true;
    if (existing) return true;
    if (legacyMigrationAchievementId && earned.has(legacyMigrationAchievementId)) return true;
    const achievementId = normalizeId(unlock.achievementId);
    if (achievementId && earned.has(achievementId)) return true;
  }
  const progress = gateProgress(unlock, profile, verifiedRuns);
  if (progress && progress.current >= progress.required) return true;
  return false;
}

export function buildCharacterUnlockMap(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, options = providedUnlockOptions(profile)) {
  const verifiedRuns = verifiedRunsFor(options);
  const starterIds = configuredStarterIds(config);
  const earned = new Set((profile.achievements ?? []).map((id) => normalizeId(id)));
  // Sticky local flags only count on the device-local (preview) path.
  const existing = verifiedRuns === null ? profile.unlocks?.characters ?? {} : {};
  const unlocks = { ...existing };
  for (const starterId of starterIds) unlocks[starterId] = true;
  for (const unlock of configuredUnlockables(config)) {
    if (unlock.id) unlocks[unlock.id] = unlockEarned(unlock, profile, earned, verifiedRuns);
  }
  return Object.freeze(unlocks);
}

export function syncConfiguredCharacterUnlocks(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, options = providedUnlockOptions(profile)) {
  profile.unlocks ??= {};
  profile.unlocks.characters = clone(buildCharacterUnlockMap(profile, config, options));
  profile.preferences ??= {};
  const starters = configuredStarterIds(config);
  const fallback = starters[0] ?? normalizeId(config.starterLegacyId);
  // A sync with the provider's options (arcade-core passes none) runs on every
  // connect, run and snapshot: while the hosted count is still unknown the
  // saved pick waits for it instead of falling back to the starter.
  // resolveSelectedCharacterId still refuses a locked pick at every use, and
  // explicit options keep the repair.
  const waiting = providedOptions.has(options) && Boolean(profile.preferences.selectedCharacterId) && verifiedCountPending(options);
  if (!waiting && (!profile.preferences.selectedCharacterId || !profile.unlocks.characters[normalizeId(profile.preferences.selectedCharacterId)])) {
    profile.preferences.selectedCharacterId = fallback;
  }
  return profile.unlocks.characters;
}

export function resolveSelectedCharacterId(profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, options = providedUnlockOptions(profile)) {
  const unlocks = buildCharacterUnlockMap(profile, config, options);
  const preferred = normalizeId(profile.preferences?.selectedCharacterId ?? config.starterLegacyId);
  if (unlocks[preferred]) return preferred;
  const starters = configuredStarterIds(config);
  return starters.find((id) => unlocks[id]) ?? normalizeId(config.starterLegacyId);
}

export function setPreferredCharacter(profile = {}, characterId, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, options = providedUnlockOptions(profile)) {
  const desired = normalizeId(characterId);
  const unlocks = buildCharacterUnlockMap(profile, config, options);
  if (!unlocks[desired]) {
    return { ok: false, reason: 'locked', selectedCharacterId: resolveSelectedCharacterId(profile, config, options) };
  }
  profile.preferences ??= {};
  profile.preferences.selectedCharacterId = desired;
  return { ok: true, selectedCharacterId: desired };
}

export function buildCharacterSelectEntries(baseRoster = [], profile = {}, config = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, options = providedUnlockOptions(profile)) {
  const verifiedRuns = verifiedRunsFor(options);
  const unlocks = buildCharacterUnlockMap(profile, config, options);
  const selectedCharacterId = resolveSelectedCharacterId(profile, config, options);
  const unlockById = new Map(configuredUnlockables(config).map((unlock) => [normalizeId(unlock.id), unlock]));
  return baseRoster.map((entry) => {
    const entryId = normalizeId(entry.id);
    const legacyId = normalizeId(entry.legacyId ?? entry.id);
    const lookupId = entryId || legacyId;
    const identity = characterStatIdentityEntry(lookupId);
    const unlock = unlockById.get(lookupId);
    const unlocked = Boolean(unlocks[lookupId]);
    const unlockProgress = unlock ? gateProgress(unlock, profile, verifiedRuns) : null;
    const displayName = identity?.name ?? entry.name ?? entry.title ?? lookupId;
    const cta = unlocked
      ? `SELECT — PLAY AS ${String(displayName).toUpperCase()}`
      : unlock?.cta ?? 'LOCKED';
    return Object.freeze({
      ...entry,
      ...(identity ?? {}),
      id: lookupId,
      legacyId: lookupId,
      name: displayName,
      title: identity?.name ?? entry.title ?? displayName,
      tagline: identity?.tagline ?? entry.tagline,
      bio: identity?.bio ?? entry.bio,
      stats: identity?.stats ?? entry.stats,
      simMultipliers: identity?.simMultipliers,
      combatStats: identity?.combatStats,
      viability: identity?.viability,
      statTruthSource: identity?.statTruthSource ?? 'base-roster-entry',
      locked: !unlocked,
      unlocked,
      selected: selectedCharacterId === lookupId,
      unlockDescription: unlock?.description ?? entry.unlockDescription,
      unlockProgress,
      cta,
    });
  });
}

export function playableCharacterVisualKitFor(characterId) {
  return HMH_PLAYABLE_CHARACTER_VISUAL_KITS[normalizeId(characterId)] ?? null;
}

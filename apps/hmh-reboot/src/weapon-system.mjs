import { freezeDeep } from './value-guards.mjs';
const TICKS_PER_SECOND = 60;
const UINT32_MAX = 0xffff_ffff;
const EPSILON = 1e-12;


function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function validTick(value, name = 'tick') {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function validSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

function normalize(direction) {
  const x = finite(direction?.x, 'direction.x');
  const y = finite(direction?.y, 'direction.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) throw new TypeError('direction must be non-zero');
  return { x: x / magnitude, y: y / magnitude };
}

function rotate(direction, radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return Object.freeze({
    x: direction.x * cosine - direction.y * sine,
    y: direction.x * sine + direction.y * cosine,
  });
}

function seededUnit(seed, key) {
  let hash = (validSeed(seed) ^ 0x811c9dc5) >>> 0;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

const STOP_POLICY = freezeDeep({ type: 'stop' });
const PELLET_POLICY = freezeDeep({ type: 'pellet' });

export const HMH_WEAPON_DEFINITIONS = freezeDeep({
  'coin-blaster': {
    id: 'coin-blaster',
    title: 'The Settler',
    displayName: 'Pistol',
    kind: 'projectile',
    damage: 3,
    // Cycle 049 measured balance step: the moving-target benchmark showed
    // the pistol landing only ~18% against strafing rushers at mid range;
    // a cadence bump (2.6 -> 3.0) lifts sustained pressure ~15% without
    // touching damage or the upgrade tree. Before/after rows live in
    // docs/qa/hmh-weapon-benchmark.json history.
    fireRatePerSecond: 3.0,
    reloadSeconds: 1.5,
    clipSize: 8,
    projectileSpeed: 1200,
    range: 720,
    projectileRadius: 2,
    spreadRadians: 0,
    pelletCount: 1,
    recoil: 22,
    pickupReserveAmmo: null,
    policy: STOP_POLICY,
  },
  'scatter-shotgun': {
    id: 'scatter-shotgun',
    title: 'The Block Breaker',
    displayName: 'Shotgun',
    kind: 'projectile',
    damage: 9,
    fireRatePerSecond: 0.95,
    reloadSeconds: 2,
    clipSize: 2,
    projectileSpeed: 900,
    range: 480,
    projectileRadius: 3,
    spreadRadians: Math.PI * 28 / 180,
    pelletCount: 8,
    recoil: 64,
    pickupReserveAmmo: 12,
    policy: PELLET_POLICY,
  },
  'auto-miner': {
    id: 'auto-miner',
    title: 'The Hashstorm',
    displayName: 'Machine Gun',
    kind: 'projectile',
    damage: 2,
    fireRatePerSecond: 12,
    reloadSeconds: 3,
    clipSize: 120,
    projectileSpeed: 1320,
    range: 840,
    projectileRadius: 1.5,
    spreadRadians: Math.PI * 4 / 180,
    pelletCount: 1,
    recoil: 8,
    pickupReserveAmmo: 240,
    maxHeat: 100,
    heatPerShot: 6,
    heatRecoveryPerTick: 0.5,
    heatResumeThreshold: 35,
    policy: STOP_POLICY,
  },
  'launcher-rig': {
    id: 'launcher-rig',
    compatibilityId: 'launcher-rig',
    title: 'Launcher Rig',
    displayName: 'Grenade Launcher',
    kind: 'grenade-launch',
    grenadeId: 'satoshi-frag',
    // The launcher fires real satoshi-frag grenades at runtime; these
    // declared values mirror the authoritative grenade definition so the
    // benchmark and HUD describe what actually detonates (Cycle 048 —
    // Cycle 047 raised the grenade to 34/150 and this record lagged).
    damage: 34,
    fireRatePerSecond: 0.75,
    reloadSeconds: 2.4,
    clipSize: 4,
    projectileSpeed: 560,
    range: 640,
    projectileRadius: 4,
    blastRadius: 150,
    spreadRadians: 0,
    pelletCount: 1,
    recoil: 74,
    pickupReserveAmmo: 8,
    policy: { type: 'splash', radius: 150 },
  },
});

// The score multipliers are retained compatibility data for the parent portal.
// The child simulation never applies or settles them.
export const HMH_WEAPON_EVOLUTIONS = freezeDeep({
  'coin-blaster': { id: 'settler-rail', projectileTag: 'rail-dividend', scoreMultiplier: 1.35 },
  'auto-miner': { id: 'hashstorm-overdrive', projectileTag: 'overdrive-barrage', scoreMultiplier: 1.3 },
  'hash-rail': { id: 'crit-candle', projectileTag: 'gold-crit', scoreMultiplier: 1.4 },
  'crypto-bombs': { id: 'crypto-bomb-orbit', projectileTag: 'orbit-bomb', scoreMultiplier: 1.25 },
});

const UPGRADE_TREES = freezeDeep({
  'coin-blaster': {
    rateOfFire: [{ multiplier: 1.18, special: 'fast-rounds' }, { multiplier: 1.38, special: 'long-rounds' }, { multiplier: 1.62, special: 'burst-fire' }],
    damage: [{ flatBonus: 1 }, { flatBonus: 3, special: 'ricochet' }, { flatBonus: 5, special: 'armor-piercing' }],
    reloadSpeed: [{ multiplier: 1.22 }, { multiplier: 1.48, special: 'shock-rounds' }, { multiplier: 1.78, special: 'extended-mag' }],
  },
  'scatter-shotgun': {
    rateOfFire: [{ multiplier: 1.1 }, { multiplier: 1.22 }, { multiplier: 1.36, special: 'double-barrel' }],
    damage: [{ flatBonus: 1 }, { flatBonus: 3 }, { flatBonus: 5, special: 'explosive' }],
    reloadSpeed: [{ multiplier: 1.18 }, { multiplier: 1.4 }, { multiplier: 1.66, special: 'quad-shell' }],
  },
  'auto-miner': {
    rateOfFire: [{ multiplier: 1.2 }, { multiplier: 1.44 }, { multiplier: 1.72, special: 'overheat-reduction' }],
    damage: [{ flatBonus: 0.5 }, { flatBonus: 1 }, { flatBonus: 2, special: 'tracer-rounds' }],
    reloadSpeed: [{ multiplier: 1.25 }, { multiplier: 1.56 }, { multiplier: 1.95, special: 'drum-mag' }],
  },
  // The launcher was the only carryable weapon with no upgrade path at all.
  'launcher-rig': {
    rateOfFire: [{ multiplier: 1.12 }, { multiplier: 1.26 }, { multiplier: 1.42, special: 'twin-tube' }],
    damage: [{ flatBonus: 2 }, { flatBonus: 5 }, { flatBonus: 8, special: 'shaped-charge' }],
    reloadSpeed: [{ multiplier: 1.2 }, { multiplier: 1.45 }, { multiplier: 1.7, special: 'bandolier' }],
  },
});

export const pistolProgressionByWeapon = (ranks = {}) => ({
  'coin-blaster': { branches: {
    damage: ranks['proof-of-work'] ?? 0,
    rateOfFire: ranks['hot-wallet'] ?? 0,
    reloadSpeed: ranks['block-reward'] ?? 0,
  } },
});

// Tier-three capstones. Before this, five of these tags were inert: a player
// spent three tiers and received only the numeric bonus, with the named
// capability doing nothing at all.
const SPECIAL_EFFECTS = freezeDeep({
  // Rounds punch through a target and keep going.
  'armor-piercing': { policy: { type: 'pierce', maxTargets: 3 } },
  ricochet: { policy: { type: 'ricochet', maxBounces: 1 } },
  // Shells detonate on impact.
  explosive: { policy: { type: 'splash', radius: 58 } },
  'shaped-charge': { policy: { type: 'splash', radius: 210 } },
  // Both barrels at once: more pellets across the same arc.
  'double-barrel': { pelletCountBonus: 6 },
  'twin-tube': { pelletCountBonus: 1, spreadRadiansOverride: Math.PI * 7 / 180 },
  // Flatter, faster rounds that reach further.
  'tracer-rounds': { projectileSpeedMultiplier: 1.35, rangeMultiplier: 1.25, projectileTag: 'tracer-round' },
  // A fast three-round burst, then the normal cadence gap.
  'fast-rounds': { projectileSpeedMultiplier: 1.1, rangeMultiplier: 1.08 },
  'long-rounds': { projectileSpeedMultiplier: 1.22, rangeMultiplier: 1.18 },
  'burst-fire': { burstCount: 3, burstIntervalTicks: 4, projectileSpeedMultiplier: 1.3, rangeMultiplier: 1.25 },
  'shock-rounds': { shock: [0.12, 1.5] },
  'extended-mag': { clipSize: 12, shock: [0.18, 1.75] },
  bandolier: { clipSize: 7 },
});

function tierNode(tree, branch, value) {
  if (value === undefined || value === null || value === 0) return null;
  if (!Number.isInteger(value) || value < 0 || value > 3) throw new TypeError(`${branch} tier must be an integer from zero to three`);
  return tree?.[branch]?.[value - 1] ?? null;
}

function evolutionFamilyForWeapon(weaponId) {
  return weaponId === 'launcher-rig' ? 'crypto-bombs' : weaponId;
}

export function applyWeaponProgression(weaponId, { branches = {}, evolutionId = null } = {}) {
  const definition = HMH_WEAPON_DEFINITIONS[weaponId];
  if (!definition) throw new TypeError(`unknown weapon ${String(weaponId)}`);
  const tree = UPGRADE_TREES[weaponId];
  let fireRateMultiplier = 1;
  let damageFlatBonus = 0;
  let reloadMultiplier = 1;
  const specials = [];
  for (const branch of ['rateOfFire', 'damage', 'reloadSpeed']) {
    const node = tierNode(tree, branch, branches?.[branch]);
    if (!node) continue;
    if (branch === 'rateOfFire') fireRateMultiplier *= node.multiplier ?? 1;
    if (branch === 'damage') damageFlatBonus += node.flatBonus ?? 0;
    if (branch === 'reloadSpeed') reloadMultiplier *= node.multiplier ?? 1;
    if (node.special) specials.push(node.special);
  }
  const family = evolutionFamilyForWeapon(weaponId);
  const evolution = HMH_WEAPON_EVOLUTIONS[family] ?? null;
  if (evolutionId !== null && evolution?.id !== evolutionId) throw new TypeError(`evolution ${String(evolutionId)} is not valid for ${weaponId}`);
  let clipSize = definition.clipSize;
  if (specials.includes('extended-mag')) clipSize = 12;
  if (specials.includes('quad-shell')) clipSize = 4;
  if (specials.includes('drum-mag')) clipSize = 180;

  let pelletCount = definition.pelletCount;
  let spreadRadians = definition.spreadRadians;
  let projectileSpeed = definition.projectileSpeed;
  let range = definition.range;
  let specialPolicy = null;
  let specialTag = null;
  let burstCount = 1;
  let burstIntervalTicks = 0;
  let shock = null;
  for (const special of specials) {
    const effect = SPECIAL_EFFECTS[special];
    if (!effect) continue;
    if (effect.policy) specialPolicy = effect.policy;
    if (effect.pelletCountBonus) pelletCount += effect.pelletCountBonus;
    if (effect.spreadRadiansOverride !== undefined) spreadRadians = effect.spreadRadiansOverride;
    if (effect.projectileSpeedMultiplier) projectileSpeed *= effect.projectileSpeedMultiplier;
    if (effect.rangeMultiplier) range *= effect.rangeMultiplier;
    if (effect.projectileTag) specialTag = effect.projectileTag;
    if (effect.burstCount) burstCount = effect.burstCount;
    if (effect.burstIntervalTicks) burstIntervalTicks = effect.burstIntervalTicks;
    if (effect.clipSize) clipSize = effect.clipSize;
    if (effect.shock) shock = effect.shock;
  }

  const crowdControlCapstone = weaponId === 'coin-blaster'
    && ['rateOfFire', 'damage', 'reloadSpeed'].every((branch) => branches?.[branch] === 3);
  if (crowdControlCapstone) {
    shock = [0.25, 3];
  }

  // The evolution keeps priority over a capstone policy: it is the rarer award.
  const projectilePolicy = evolutionId === 'settler-rail'
    ? freezeDeep({ type: 'pierce', maxTargets: 3 })
    : specialPolicy ?? definition.policy;
  return freezeDeep({
    weaponId,
    damage: definition.damage + damageFlatBonus,
    damageFlatBonus,
    fireRateMultiplier,
    reloadMultiplier,
    cadenceTicks: Math.max(1, Math.ceil(TICKS_PER_SECOND / (definition.fireRatePerSecond * fireRateMultiplier))),
    reloadTicks: Math.max(1, Math.ceil(definition.reloadSeconds * TICKS_PER_SECOND / reloadMultiplier)),
    clipSize,
    specials,
    pelletCount,
    spreadRadians,
    projectileSpeed,
    range,
    burstCount,
    burstIntervalTicks,
    projectileTag: evolutionId ? evolution.projectileTag : specialTag,
    projectilePolicy,
    shock,
    heatPerShot: (definition.heatPerShot ?? 0) * (specials.includes('overheat-reduction') ? 0.72 : 1),
    maxHeat: definition.maxHeat ?? 0,
    heatRecoveryPerTick: definition.heatRecoveryPerTick ?? 0,
    heatResumeThreshold: definition.heatResumeThreshold ?? 0,
  });
}

function createPerWeaponState(id, { owned = false } = {}) {
  const progression = applyWeaponProgression(id);
  const definition = HMH_WEAPON_DEFINITIONS[id];
  // Cycle 036 Priority D: the pistol is the always-owned unlimited-reserve
  // fallback. Every other weapon is a true pickup: unowned at run start, with
  // finite reserve granted by weapon caches.
  const alwaysOwned = definition.pickupReserveAmmo === null;
  const isOwned = alwaysOwned || owned;
  return {
    id,
    owned: isOwned,
    ammoInClip: progression.clipSize,
    // Owning a finite weapon implies carrying its authored ammo; unowned
    // pickups hold nothing until a cache grants them.
    reserveAmmo: alwaysOwned ? null : (isOwned ? definition.pickupReserveAmmo : 0),
    nextFireTick: 0,
    reloadStartedTick: null,
    reloadCompleteTick: null,
    heat: 0,
    overheated: false,
    heatUpdatedTick: 0,
    burstRemaining: 0,
  };
}

export function createWeaponLoadout({
  weaponIds = ['coin-blaster'],
  activeWeaponId = weaponIds[0],
  seed = 0,
  switchTicks = 6,
} = {}) {
  if (!Array.isArray(weaponIds) || weaponIds.length === 0) throw new TypeError('weaponIds must be a non-empty array');
  if (!Number.isInteger(switchTicks) || switchTicks < 0) throw new TypeError('switchTicks must be a non-negative integer');
  const unique = new Set();
  const weapons = {};
  for (const rawId of weaponIds) {
    const id = String(rawId);
    if (!HMH_WEAPON_DEFINITIONS[id]) throw new TypeError(`unknown weapon ${id}`);
    if (unique.has(id)) throw new TypeError(`duplicate weapon ${id}`);
    unique.add(id);
    weapons[id] = createPerWeaponState(id, { owned: id === String(activeWeaponId) });
  }
  if (!weapons[activeWeaponId]) throw new TypeError(`unknown weapon ${String(activeWeaponId)}`);
  return {
    seed: validSeed(seed),
    activeWeaponId,
    weapons,
    sequence: 0,
    lastTick: -1,
    switchTicks,
    switchReadyTick: 0,
  };
}

export function getActiveWeaponState(state) {
  const weapon = state?.weapons?.[state.activeWeaponId];
  if (!weapon) throw new TypeError('active weapon state is unavailable');
  return weapon;
}

// Projection-only status for HUD, accessibility, and browser evidence. It reads
// the authoritative fixed-tick state without advancing or mutating it.
export function getWeaponReadabilityStatus(state, { tick, progressionByWeapon = {} } = {}) {
  const currentTick = validTick(tick);
  if (currentTick < state?.lastTick) throw new TypeError('readability tick cannot precede the current weapon tick');
  const weapon = getActiveWeaponState(state);
  const definition = HMH_WEAPON_DEFINITIONS[weapon.id];
  const progression = applyWeaponProgression(weapon.id, progressionByWeapon?.[weapon.id]);
  let mode = 'ready';
  let ticksRemaining = 0;
  if (weapon.reloadCompleteTick !== null) {
    mode = 'reloading';
    ticksRemaining = Math.max(0, weapon.reloadCompleteTick - currentTick);
  } else if (weapon.overheated) {
    mode = 'overheated';
  } else if (currentTick < state.switchReadyTick) {
    mode = 'switching';
    ticksRemaining = state.switchReadyTick - currentTick;
  } else if (weapon.ammoInClip <= 0) {
    mode = 'empty';
  }
  const secondsRemaining = Number((ticksRemaining / TICKS_PER_SECOND).toFixed(1));
  const ammoLabel = `${definition.displayName.toUpperCase()} ${weapon.ammoInClip}/${progression.clipSize}`;
  let statusLabel = '';
  let accessibleState = '';
  if (mode === 'reloading') {
    statusLabel = `RELOAD ${secondsRemaining.toFixed(1)}S`;
    accessibleState = `reloading, ${secondsRemaining.toFixed(1)} seconds remaining`;
  } else if (mode === 'overheated') {
    statusLabel = `COOLING ${Math.round(weapon.heat)}%`;
    accessibleState = `cooling, heat ${Math.round(weapon.heat)} percent`;
  } else if (mode === 'switching') {
    statusLabel = `SWITCH ${secondsRemaining.toFixed(1)}S`;
    accessibleState = `switching, ${secondsRemaining.toFixed(1)} seconds remaining`;
  } else if (mode === 'empty') {
    statusLabel = 'EMPTY';
    accessibleState = 'empty';
  } else if (weapon.heat > 0) {
    statusLabel = `HEAT ${Math.round(weapon.heat)}%`;
    accessibleState = `ready, heat ${Math.round(weapon.heat)} percent`;
  } else {
    accessibleState = 'ready';
  }
  return freezeDeep({
    weaponId: weapon.id,
    displayName: definition.displayName,
    mode,
    owned: weapon.owned,
    reserveAmmo: weapon.reserveAmmo,
    ammoInClip: weapon.ammoInClip,
    clipSize: progression.clipSize,
    heat: weapon.heat,
    ticksRemaining,
    secondsRemaining,
    hudLabel: statusLabel ? `${ammoLabel} // ${statusLabel}` : ammoLabel,
    accessibleLabel: `${definition.displayName}, ${weapon.ammoInClip} of ${progression.clipSize} rounds, ${accessibleState}`,
  });
}

function assertMonotonic(state, tick) {
  validTick(tick);
  if (tick <= state.lastTick) throw new TypeError('tick must be monotonic');
  state.lastTick = tick;
}

export function selectWeapon(state, weaponId, { tick } = {}) {
  assertMonotonic(state, tick);
  if (!state.weapons?.[weaponId]) throw new TypeError(`unknown weapon ${String(weaponId)}`);
  if (!state.weapons[weaponId].owned) throw new TypeError(`weapon ${String(weaponId)} is unowned`);
  const previousWeaponId = state.activeWeaponId;
  state.activeWeaponId = weaponId;
  state.switchReadyTick = tick + state.switchTicks;
  return freezeDeep({ type: 'weapon:switch', tick, previousWeaponId, weaponId, readyTick: state.switchReadyTick });
}

export function grantWeaponPickup(state, { tick, weaponId, select = false, progressionByWeapon = {} } = {}) {
  validTick(tick);
  if (tick <= state.lastTick) throw new TypeError('weapon grant must precede the current weapon step');
  const id = String(weaponId);
  const weapon = state.weapons[id];
  if (!weapon) throw new TypeError(`unknown weapon ${id}`);
  const definition = HMH_WEAPON_DEFINITIONS[id];
  const progression = applyWeaponProgression(id, progressionByWeapon?.[id]);
  const authored = definition.pickupReserveAmmo;
  const alreadyOwned = weapon.owned;
  weapon.owned = true;
  // The pickup includes a loaded weapon plus an authored reserve. Repeat
  // pickups add reserve, bounded at twice the authored grant so hoarding
  // cannot trivialize the finite-ammo economy.
  weapon.ammoInClip = progression.clipSize;
  weapon.reloadStartedTick = null;
  weapon.reloadCompleteTick = null;
  if (authored !== null) {
    weapon.reserveAmmo = Math.min(authored * 2, (weapon.reserveAmmo ?? 0) + authored);
  }
  const previousWeaponId = state.activeWeaponId;
  if (select) {
    state.activeWeaponId = id;
    state.switchReadyTick = tick + state.switchTicks;
  }
  return freezeDeep({
    type: 'weapon:granted',
    tick,
    weaponId: id,
    alreadyOwned,
    ammoInClip: weapon.ammoInClip,
    reserveAmmo: weapon.reserveAmmo,
    previousWeaponId,
    activeWeaponId: state.activeWeaponId,
  });
}

export function refillWeaponLoadout(state, { tick, weaponId = null, select = false, progressionByWeapon = {} } = {}) {
  validTick(tick);
  if (tick <= state.lastTick) throw new TypeError('weapon pickup must precede the current weapon step');
  const weaponIds = weaponId === null ? Object.keys(state.weapons).sort() : [String(weaponId)];
  for (const id of weaponIds) {
    const weapon = state.weapons[id];
    if (!weapon) throw new TypeError(`unknown weapon ${id}`);
    // A refill services what the player carries; it never grants ownership.
    if (!weapon.owned) continue;
    const progression = applyWeaponProgression(id, progressionByWeapon?.[id]);
    const authored = HMH_WEAPON_DEFINITIONS[id].pickupReserveAmmo;
    if (authored !== null) {
      weapon.reserveAmmo = Math.min(authored * 2, (weapon.reserveAmmo ?? 0) + authored);
    }
    weapon.ammoInClip = progression.clipSize;
    weapon.reloadStartedTick = null;
    weapon.reloadCompleteTick = null;
    weapon.heat = 0;
    weapon.overheated = false;
    weapon.heatUpdatedTick = tick;
  }
  const previousWeaponId = state.activeWeaponId;
  // Selection through a refill honors ownership exactly like selectWeapon.
  if (select && weaponId !== null && state.weapons[String(weaponId)].owned) {
    state.activeWeaponId = String(weaponId);
    state.switchReadyTick = tick + state.switchTicks;
  }
  return freezeDeep({ type: 'weapon:pickup-refill', tick, weaponIds, previousWeaponId, activeWeaponId: state.activeWeaponId });
}

function completeReloads(state, tick, progressionByWeapon, events) {
  for (const id of Object.keys(state.weapons).sort()) {
    const weapon = state.weapons[id];
    if (weapon.reloadCompleteTick === null || tick < weapon.reloadCompleteTick) continue;
    const progression = applyWeaponProgression(id, progressionByWeapon?.[id]);
    if (weapon.reserveAmmo === null) {
      weapon.ammoInClip = progression.clipSize;
    } else {
      const loaded = Math.min(progression.clipSize - weapon.ammoInClip, weapon.reserveAmmo);
      weapon.ammoInClip += loaded;
      weapon.reserveAmmo -= loaded;
    }
    weapon.reloadStartedTick = null;
    weapon.reloadCompleteTick = null;
    events.push(freezeDeep({ type: 'weapon:reload-complete', tick, weaponId: id, ammoInClip: weapon.ammoInClip, reserveAmmo: weapon.reserveAmmo }));
  }
}

function coolWeaponHeat(state, tick, progressionByWeapon, events) {
  for (const id of Object.keys(state.weapons).sort()) {
    const weapon = state.weapons[id];
    const progression = applyWeaponProgression(id, progressionByWeapon?.[id]);
    const elapsedTicks = Math.max(0, tick - weapon.heatUpdatedTick);
    weapon.heat = Math.max(0, weapon.heat - progression.heatRecoveryPerTick * elapsedTicks);
    weapon.heatUpdatedTick = tick;
    if (weapon.overheated && weapon.heat <= progression.heatResumeThreshold) {
      weapon.overheated = false;
      events.push(freezeDeep({ type: 'weapon:heat-ready', tick, weaponId: id, heat: weapon.heat }));
    }
  }
}

function startReload(weapon, progression, tick, events) {
  if (weapon.reloadCompleteTick !== null || weapon.ammoInClip > 0) return;
  // A finite-reserve weapon with nothing left cannot reload; it reads EMPTY
  // and the always-owned pistol remains the fallback.
  if (weapon.reserveAmmo !== null && weapon.reserveAmmo <= 0) return;
  weapon.reloadStartedTick = tick;
  weapon.reloadCompleteTick = tick + progression.reloadTicks;
  events.push(freezeDeep({
    type: 'weapon:reload-start',
    tick,
    weaponId: weapon.id,
    completeTick: weapon.reloadCompleteTick,
  }));
}

function spreadOffsets(profile, state, attackId) {
  const count = profile.pelletCount;
  if (count === 1) {
    if (profile.spreadRadians === 0) return [0];
    return [(seededUnit(state.seed, `${attackId}:spread`) - 0.5) * profile.spreadRadians];
  }
  const interval = profile.spreadRadians / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => {
    const base = -profile.spreadRadians * 0.5 + interval * index;
    const jitter = (seededUnit(state.seed, `${attackId}:pellet:${index}`) - 0.5) * interval * 0.32;
    return base + jitter;
  });
}

function buildShots({ definition, progression, state, direction, attackId }) {
  const shock = (progression.shock?.[0] ?? 0) > seededUnit(state.seed, `${attackId}:shock`);
  return Object.freeze(spreadOffsets(progression, state, attackId).map((angleOffset, pelletIndex) => {
    const shotDirection = rotate(direction, angleOffset);
    const id = `${attackId}:${String(pelletIndex).padStart(2, '0')}`;
    return freezeDeep({
      id,
      attackId,
      weaponId: definition.id,
      kind: definition.kind,
      grenadeId: definition.grenadeId ?? null,
      pelletIndex,
      angleOffset,
      direction: shotDirection,
      speed: progression.projectileSpeed,
      range: progression.range,
      radius: definition.projectileRadius,
      damage: progression.damage,
      policy: progression.projectilePolicy,
      projectileTag: progression.projectileTag,
      shock,
      knockbackMultiplier: shock ? progression.shock[1] : 1,
    });
  }));
}

export function stepWeaponLoadout(state, {
  tick,
  fire = false,
  direction,
  progressionByWeapon = {},
} = {}) {
  assertMonotonic(state, tick);
  const events = [];
  coolWeaponHeat(state, tick, progressionByWeapon, events);
  completeReloads(state, tick, progressionByWeapon, events);
  // Owner playtest 2026-08-02: an exhausted pickup stranded the player
  // weaponless until death. A finite-reserve weapon with no clip, no
  // reserve, and no reload in flight hands control back to the always-owned
  // pistol immediately and deterministically.
  const active = state.weapons[state.activeWeaponId];
  if (state.activeWeaponId !== 'coin-blaster'
    && active.ammoInClip <= 0
    && active.reserveAmmo !== null && active.reserveAmmo <= 0
    && active.reloadCompleteTick === null) {
    const previousWeaponId = state.activeWeaponId;
    state.activeWeaponId = 'coin-blaster';
    state.switchReadyTick = tick + state.switchTicks;
    events.push(freezeDeep({ type: 'weapon:auto-fallback', tick, previousWeaponId, weaponId: 'coin-blaster', readyTick: state.switchReadyTick }));
  }
  if (!fire || tick < state.switchReadyTick) return freezeDeep({ tick, events });
  const normalizedDirection = normalize(direction);
  const weapon = state.weapons[state.activeWeaponId];
  const definition = HMH_WEAPON_DEFINITIONS[state.activeWeaponId];
  const progression = applyWeaponProgression(state.activeWeaponId, progressionByWeapon?.[state.activeWeaponId]);
  if (weapon.overheated) return freezeDeep({ tick, events });
  if (weapon.reloadCompleteTick !== null) return freezeDeep({ tick, events });
  if (weapon.ammoInClip <= 0) {
    startReload(weapon, progression, tick, events);
    return freezeDeep({ tick, events });
  }
  if (tick < weapon.nextFireTick) return freezeDeep({ tick, events });
  const attackId = `${definition.id}:${String(state.sequence).padStart(8, '0')}`;
  state.sequence += 1;
  const shots = buildShots({ definition, progression, state, direction: normalizedDirection, attackId });
  weapon.ammoInClip -= 1;
  if (progression.burstCount > 1) {
    const remaining = weapon.burstRemaining > 0 ? weapon.burstRemaining - 1 : progression.burstCount - 1;
    weapon.burstRemaining = remaining;
    // Out of ammo mid-burst ends the burst rather than stranding the counter.
    weapon.nextFireTick = remaining > 0 && weapon.ammoInClip > 0
      ? tick + progression.burstIntervalTicks
      : tick + progression.cadenceTicks;
    if (remaining <= 0 || weapon.ammoInClip <= 0) weapon.burstRemaining = 0;
  } else {
    weapon.burstRemaining = 0;
    weapon.nextFireTick = tick + progression.cadenceTicks;
  }
  if (progression.heatPerShot > 0) {
    weapon.heat = Math.min(progression.maxHeat, weapon.heat + progression.heatPerShot);
  }
  events.push(freezeDeep({
    type: 'weapon:fire',
    tick,
    attackId,
    weaponId: definition.id,
    ammoInClip: weapon.ammoInClip,
    recoil: definition.recoil,
    heat: weapon.heat,
    shots,
  }));
  if (progression.maxHeat > 0 && weapon.heat >= progression.maxHeat) {
    weapon.overheated = true;
    events.push(freezeDeep({ type: 'weapon:overheat', tick, weaponId: definition.id, heat: weapon.heat }));
  }
  startReload(weapon, progression, tick, events);
  return freezeDeep({ tick, events });
}

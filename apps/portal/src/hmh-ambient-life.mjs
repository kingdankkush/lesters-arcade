const freeze = (value) => Object.freeze(value);

export const HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY = freeze({
  id: 'wo106-level-one-ambient-life-v1',
  triggerRadiusTiles: 4.5,
  maxFleeOffsetTiles: 1.25,
  calmBobPixels: 1.25,
  reducedMotion: 'disable non-critical bobbing; keep flee offset when the player approaches so critters read alive',
  bossLockPolicy: 'ambient vehicles and critters are calm-pocket-only and never spawn as boss-lock clutter',
});

const BIOME_QUOTAS = freeze({
  desert: freeze({ maxCritters: 1, maxVehicles: 1, allowedInBossLock: false, note: 'dust burrows and abandoned roadside vehicles only' }),
  forest: freeze({ maxCritters: 2, maxVehicles: 0, allowedInBossLock: false, note: 'small animals and firefly/reed pockets' }),
  road: freeze({ maxCritters: 1, maxVehicles: 2, allowedInBossLock: false, note: 'parked vehicles and cache vans near shoulders' }),
  town: freeze({ maxCritters: 1, maxVehicles: 1, allowedInBossLock: false, note: 'rats/pigeons and service vehicles at plaza edges' }),
  water: freeze({ maxCritters: 1, maxVehicles: 0, allowedInBossLock: false, note: 'shoreline critter cues only' }),
  rocky: freeze({ maxCritters: 1, maxVehicles: 0, allowedInBossLock: false, note: 'burrows and dust puffs only' }),
});

export function ambientLifeQuotaForBiome(biome) {
  return BIOME_QUOTAS[biome] ?? freeze({ maxCritters: 0, maxVehicles: 0, allowedInBossLock: false, note: 'unknown biome: no ambient life' });
}

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

export function planCritterFleeMotion({
  critterX = 0,
  critterY = 0,
  playerX = 0,
  playerY = 0,
  frame = 0,
  triggerRadiusTiles = HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.triggerRadiusTiles,
} = {}) {
  const dx = critterX - playerX;
  const dy = critterY - playerY;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance > triggerRadiusTiles) {
    return freeze({ state: 'calm', triggered: false, offsetX: 0, offsetY: 0, worldOffsetX: 0, worldOffsetY: 0, bobY: 0 });
  }
  const safeDistance = Math.max(0.001, distance);
  const strength = Math.max(0, Math.min(1, (triggerRadiusTiles - distance) / triggerRadiusTiles));
  const wobble = Math.sin((frame + Math.round(critterX * 13) + Math.round(critterY * 17)) * 0.11) * 0.12;
  const maxOffset = HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.maxFleeOffsetTiles;
  const offsetX = (dx / safeDistance) * (0.3 + strength * maxOffset) + wobble;
  const offsetY = (dy / safeDistance) * (0.3 + strength * maxOffset);
  return freeze({
    state: 'flee',
    triggered: true,
    offsetX: rounded(offsetX),
    offsetY: rounded(offsetY),
    worldOffsetX: rounded(offsetX),
    worldOffsetY: rounded(offsetY),
    bobY: rounded(-Math.abs(Math.sin(frame * 0.2)) * 0.08),
  });
}

export function ambientLifeCueForVisibleObject(object, { playerX = 0, playerY = 0, frame = 0, biome = null, bossLock = false } = {}) {
  const assetKey = String(object?.assetKey ?? object?.exactAssetKey ?? '');
  if (!assetKey.startsWith('wo106-world/')) return null;
  if (bossLock) return freeze({ kind: 'suppressed', reason: 'boss-lock', allowedInBossLock: false });
  if (assetKey.includes('critter-dust-burrow')) {
    const motion = planCritterFleeMotion({
      critterX: Number(object?.gridX ?? object?.worldX ?? 0),
      critterY: Number(object?.gridY ?? object?.worldY ?? 0),
      playerX,
      playerY,
      frame,
    });
    return freeze({
      kind: 'critter-flee-cue',
      policyId: HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.id,
      biome,
      allowedInBossLock: false,
      triggerRadiusTiles: HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.triggerRadiusTiles,
      motion,
    });
  }
  if (assetKey.includes('pickup') || assetKey.includes('van') || assetKey.includes('vehicle')) {
    return freeze({
      kind: 'vehicle-micro-scene',
      policyId: HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.id,
      biome,
      allowedInBossLock: false,
      motion: freeze({ state: 'parked', triggered: false, offsetX: 0, offsetY: 0, worldOffsetX: 0, worldOffsetY: 0, bobY: 0 }),
    });
  }
  return freeze({
    kind: 'ambient-micro-scene',
    policyId: HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.id,
    biome,
    allowedInBossLock: false,
    motion: freeze({ state: 'calm', triggered: false, offsetX: 0, offsetY: 0, worldOffsetX: 0, worldOffsetY: 0, bobY: 0 }),
  });
}

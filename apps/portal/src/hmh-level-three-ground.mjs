import {
  HMH_LEVEL_THREE_FINAL_GROUND,
  levelThreeFinalGroundAssetByKey,
} from '../assets/generated/hmh-level-three-ground/final-getaway/level3-final-getaway-ground-manifest.mjs';

export const HMH_LEVEL_THREE_ID = 'level-3-the-getaway';

const THEME_ROLE = Object.freeze({
  rooftop: 'rooftop-tar',
  roof: 'rooftop-tar',
  edge: 'roof-edge',
  glass: 'glass-bridge',
  skybridge: 'glass-bridge',
  train: 'train-roof',
  rail: 'rail-gap',
  storm: 'storm-runoff',
  speed: 'speed-lines',
  grate: 'maintenance-grate',
  extraction: 'extraction-car',
});

const BIOME_ROLE = Object.freeze({
  pavement: 'rooftop-tar',
  town: 'rooftop-tar',
  road: 'train-roof',
  water: 'storm-runoff',
  rocky: 'maintenance-grate',
  forest: 'extraction-car',
  grass: 'extraction-car',
  desert: 'speed-lines',
  sand: 'speed-lines',
});

function stableIndex(seed, worldX, worldY, count) {
  if (!count) return 0;
  let h = (Math.round(worldX) * 374761393) ^ (Math.round(worldY) * 668265263) ^ (seed | 0) ^ 0x3badf00d;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return Math.abs(h) % count;
}

function roleKeys(role) {
  return HMH_LEVEL_THREE_FINAL_GROUND.roles?.[role] ?? [];
}

function preferredKey(keys) {
  return keys.find((key) => levelThreeFinalGroundAssetByKey(key)?.preferred) ?? keys[0] ?? null;
}

export function levelThreeGroundRoleForTile({ biome, theme = null, neighbors = [] } = {}) {
  const themeRole = THEME_ROLE[theme];
  if (themeRole) return themeRole;
  const neighborSet = new Set((neighbors ?? []).filter(Boolean));
  if (neighborSet.has('water') || biome === 'water') return 'storm-runoff';
  if (neighborSet.has('rail') || neighborSet.has('train')) return 'roof-to-train';
  return BIOME_ROLE[biome] ?? 'rooftop-tar';
}

export function selectLevelThreeGroundTile({
  levelId = HMH_LEVEL_THREE_ID,
  seed = 0,
  worldX = 0,
  worldY = 0,
  biome = 'pavement',
  theme = null,
  neighbors = [],
} = {}) {
  if (levelId !== HMH_LEVEL_THREE_ID) return null;
  const role = levelThreeGroundRoleForTile({ biome, theme, neighbors });
  const keys = roleKeys(role);
  if (!keys.length) return null;
  const patchX = Math.floor(worldX / 4);
  const patchY = Math.floor(worldY / 4);
  const accent = keys.length > 1 && stableIndex(seed, patchX, patchY, 100) < 22;
  const key = accent ? keys[stableIndex(seed + 31, patchX, patchY, keys.length)] : preferredKey(keys);
  const asset = levelThreeFinalGroundAssetByKey(key) ?? levelThreeFinalGroundAssetByKey(preferredKey(keys));
  return asset ? Object.freeze({ ...asset, role, fallback: null }) : null;
}

export function requiredLevelThreeGroundRoles() {
  return Object.freeze(['rooftop-tar', 'roof-edge', 'glass-bridge', 'train-roof', 'rail-gap', 'storm-runoff', 'speed-lines', 'maintenance-grate', 'extraction-car', 'roof-to-train', 'glass-to-rail']);
}

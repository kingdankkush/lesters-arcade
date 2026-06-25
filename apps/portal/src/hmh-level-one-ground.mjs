import { HMH_LEVEL_ONE_SBS_GROUND, sbsGroundAssetByKey } from '../assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs';
import { HMH_LEVEL_ONE_FINAL_PAINT_GROUND, finalPaintGroundAssetByKey } from '../assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.mjs';

export const HMH_LEVEL_ONE_ID = 'level-1-crypto-wasteland';

const THEME_ROLE = Object.freeze({
  pavement: 'road',
  carpet: 'road',
  grass: 'grass',
  sand: 'sand',
});

const BIOME_ROLE = Object.freeze({
  town: 'road',
  road: 'road',
  pavement: 'road',
  desert: 'sand',
  sand: 'sand',
  forest: 'grass',
  grass: 'grass',
  rocky: 'rocky',
  water: 'water',
});

function stableIndex(seed, worldX, worldY, count) {
  if (!count) return 0;
  let h = (Math.round(worldX) * 374761393) ^ (Math.round(worldY) * 668265263) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return Math.abs(h) % count;
}

function roleKeysFrom(manifest, role) {
  return manifest.roles?.[role] ?? [];
}

function finalPaintRoleKeys(role) {
  return roleKeysFrom(HMH_LEVEL_ONE_FINAL_PAINT_GROUND, role);
}

function sbsRoleKeys(role) {
  return roleKeysFrom(HMH_LEVEL_ONE_SBS_GROUND, role);
}

function preferredKey(keys, lookup) {
  const preferred = keys.find((key) => lookup(key)?.preferred);
  return preferred ?? keys[0] ?? null;
}

export function levelOneGroundRoleForTile({ biome, theme = null, neighbors = [] } = {}) {
  const neighborSet = new Set((neighbors ?? []).filter(Boolean));
  if (biome === 'water') return 'water';

  if (neighborSet.has('water')) {
    if (biome === 'desert' || theme === 'sand') return 'shore';
    if (biome === 'forest' || theme === 'grass') return 'shore';
    if (biome === 'rocky') return 'shore';
    return 'shore';
  }

  const base = THEME_ROLE[theme] ?? BIOME_ROLE[biome] ?? 'dirt';
  if ((base === 'grass' && (neighborSet.has('desert') || neighborSet.has('sand')))
    || (base === 'sand' && (neighborSet.has('forest') || neighborSet.has('grass')))) {
    return 'grass-to-sand';
  }
  if ((base === 'grass' && (neighborSet.has('road') || neighborSet.has('town')))
    || (base === 'road' && (neighborSet.has('forest') || neighborSet.has('grass')))) {
    return 'grass-to-dirt';
  }
  if ((base === 'sand' && (neighborSet.has('road') || neighborSet.has('town') || neighborSet.has('rocky')))
    || (base === 'road' && (neighborSet.has('desert') || neighborSet.has('sand')))) {
    return 'dirt-to-sand';
  }
  return base;
}

export function selectLevelOneGroundTile({
  levelId = HMH_LEVEL_ONE_ID,
  seed = 0,
  worldX = 0,
  worldY = 0,
  biome = 'town',
  theme = null,
  neighbors = [],
} = {}) {
  if (levelId !== HMH_LEVEL_ONE_ID) return null;
  const role = levelOneGroundRoleForTile({ biome, theme, neighbors });
  const finalKeys = finalPaintRoleKeys(role);
  const fallbackKeys = sbsRoleKeys(role);
  const keys = finalKeys.length ? finalKeys : fallbackKeys;
  const lookup = finalKeys.length ? finalPaintGroundAssetByKey : sbsGroundAssetByKey;
  if (!keys.length) return null;

  // Keep the preferred art dominant. Accent variants appear in broad patches so
  // the terrain reads hand-authored, not checkerboard-noisy.
  const patchX = Math.floor(worldX / 5);
  const patchY = Math.floor(worldY / 5);
  const accent = keys.length > 1 && stableIndex(seed, patchX, patchY, 100) < 18;
  const key = accent ? keys[stableIndex(seed + 17, patchX, patchY, keys.length)] : preferredKey(keys, lookup);
  const asset = lookup(key) ?? lookup(preferredKey(keys, lookup));
  if (asset) return Object.freeze({ ...asset, role, fallback: finalKeys.length ? 'sbs-cc0' : null });

  const fallbackKey = preferredKey(fallbackKeys, sbsGroundAssetByKey);
  const fallbackAsset = sbsGroundAssetByKey(fallbackKey);
  return fallbackAsset ? Object.freeze({ ...fallbackAsset, role, fallback: null }) : null;
}

export function requiredLevelOneGroundRoles() {
  return Object.freeze(['grass', 'dirt', 'sand', 'rocky', 'water', 'shore', 'grass-to-dirt', 'dirt-to-sand']);
}

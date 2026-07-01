import {
  HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT,
  curatedLevelOneCriticalPath,
} from './hmh-level-one-curated-world-contract.mjs';
import { curatedLevelKitAssetByKey } from '../assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';

const ROLE_FOR_USE = Object.freeze({
  landmark: 'landmark',
  boundary: 'wall',
  route: 'road',
  arena: 'road',
  dressing: 'smallprop',
  terrain: 'smallprop',
  water: 'water-strip',
  enemy: 'smallprop',
  hero: 'smallprop',
  vfx: 'smallprop',
});

const SOLID_FOR_USE = Object.freeze({
  landmark: true,
  boundary: true,
  route: false,
  arena: false,
  dressing: false,
  terrain: false,
  water: false,
  enemy: false,
  hero: false,
  vfx: false,
});

const SPAWN_EXTRAS = Object.freeze([
  ['spawn-road-left', 'level-1/road/road1-ground', 'route', -6, 5, false],
  ['spawn-road-center', 'level-1/road/road1-ground', 'route', 0, 5, false],
  ['spawn-road-right', 'level-1/road/road1-ground', 'route', 6, 5, false],
  ['spawn-sign', 'level-1/prop/bus-stop-sign', 'dressing', 6, 3, false],
  ['spawn-desert-dressing-0', 'level-1/prop/desert-09', 'dressing', -7, 8, false],
  ['spawn-desert-dressing-1', 'level-1/prop/desert-10', 'dressing', 10, 8, false],
  ['spawn-cactus-0', 'curated-prop/cactus1-1', 'boundary', -10, 2, true],
  ['spawn-cactus-1', 'curated-prop/cactus2-1', 'boundary', 14, 2, true],
  ['spawn-rock-0', 'level-1/prop/oval-rock1-grass-shadow', 'boundary', -12, 7, true],
  ['spawn-rock-1', 'level-1/prop/oval-rock2-ground-shadow', 'boundary', 16, 7, true],
  ['spawn-bone-0', 'level-1/prop/dragon-bones-body-ground-shadow', 'dressing', -14, 4, false],
]);

const ZONE_OFFSETS = Object.freeze([
  [-3, -2], [0, -2], [3, -2],
  [-4, 0], [0, 0], [4, 0],
  [-3, 2], [0, 2], [3, 2],
]);

export function levelOneCuratedRuntimeArtPolicy() {
  return Object.freeze({
    id: 'level-one-visible-curated-runtime-v1',
    requiredWorldSource: 'hmh-level-one-curated-world-contract',
    curatedManifestId: HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetSource.manifestId,
    sceneObjectsNearAllowed: false,
    enemyFallbacksAllowed: false,
    disallowedEnemyFallbacks: Object.freeze(['HMH_ENEMIES_WAVE', 'combatArt.enemies', 'rectangle-fallback']),
  });
}

export function levelOneCuratedAssetSrc(assetKey) {
  return curatedLevelKitAssetByKey(assetKey)?.src ?? null;
}

function anchorForZone(zone) {
  // Contract xPct/yPct are map-composition percentages. The live roguelike world
  // uses compact isometric tile coordinates, so keep X as the route progression
  // and compress Y into a readable lane around the player's starting camera.
  return Object.freeze({
    x: Math.round(zone.xPct),
    y: Math.round(5 + ((zone.yPct ?? 50) - 50) / 6),
  });
}

function objectFromAsset({ id, assetKey, use, x, y, notes = '', zoneId = null, index = 0 }) {
  // Terrain sheets belong to the ground-tile renderer, not the obstacle/prop
  // renderer. Drawing them as props is what made the corrected runtime look like
  // repeated grey block clutter instead of a clean authored route.
  if (use === 'terrain') return null;
  const record = curatedLevelKitAssetByKey(assetKey);
  if (!record) return null;
  const sceneRole = ROLE_FOR_USE[use] ?? 'smallprop';
  return Object.freeze({
    id,
    assetKey,
    curatedAssetKey: assetKey,
    imageSrc: record.src,
    curated: true,
    sourcePolicy: 'Justin-curated-level-kit-only',
    role: sceneRole,
    sceneRole,
    gridX: x,
    gridY: y,
    solid: SOLID_FOR_USE[use] ?? false,
    zHeight: use === 'landmark' ? 4 : use === 'boundary' ? 2 : 0,
    drawOrderBias: use === 'landmark' ? 16 : use === 'boundary' ? 8 : 0,
    text: notes,
    sourceZoneId: zoneId,
    propIndex: index,
  });
}

function extraSpawnObjects() {
  return SPAWN_EXTRAS.map(([id, assetKey, use, x, y, solid], index) => {
    const object = objectFromAsset({
      id: `curated-spawn-broken-road-${id}`,
      assetKey,
      use,
      x,
      y,
      zoneId: 'spawn-broken-road',
      notes: 'hand-authored spawn-camera visible curated asset',
      index,
    });
    return object ? Object.freeze({ ...object, solid }) : null;
  }).filter(Boolean);
}

export function buildLevelOneCuratedVisibleSceneObjects({ playerX = 0, playerY = 5, window = 18 } = {}) {
  const objects = [...extraSpawnObjects()];
  for (const zone of curatedLevelOneCriticalPath()) {
    const anchor = anchorForZone(zone);
    zone.assetRefs.forEach((ref, index) => {
      const [dx, dy] = ZONE_OFFSETS[index % ZONE_OFFSETS.length];
      const object = objectFromAsset({
        id: `curated-${zone.id}-${index}-${String(ref.use).replace(/[^a-z0-9-]/gi, '-')}`,
        assetKey: ref.assetKey,
        use: ref.use,
        x: anchor.x + dx,
        y: anchor.y + dy,
        notes: ref.notes,
        zoneId: zone.id,
        index,
      });
      if (object) objects.push(object);
    });
  }

  const visible = objects.filter((object) =>
    Math.abs(object.gridX - playerX) <= window + 6
    && Math.abs(object.gridY - playerY) <= window + 6,
  );
  const ids = new Set();
  return Object.freeze(visible.filter((object) => {
    if (ids.has(object.id)) return false;
    ids.add(object.id);
    return true;
  }));
}

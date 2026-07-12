import { LEVEL_ONE_AUTHORED_PREFAB_STAMPS } from './hmh-level-one-visible-runtime.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3CellAt,
} from './hmh-level-one-world-v3-runtime.mjs';

const STAMP_BY_ID = new Map(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.map((stamp) => [stamp.id, stamp]));
const SPAWN_CLEAR_RADIUS = 5;

const STAMP_PLACEMENTS = Object.freeze([
  Object.freeze({ stampId: 'desert-road-salvage-wall', anchorId: 'spawn', kind: 'spawn' }),
  Object.freeze({ stampId: 'ruined-camp-bone-yard', anchorId: 'old-hashrate-camp', kind: 'poi' }),
  Object.freeze({ stampId: 'compact-southeast-glow-bank', anchorId: 'wrecked-lighthouse', kind: 'poi' }),
]);

const ANCHOR_BY_ID = new Map([
  ...Object.entries(HMH_LEVEL_ONE_WORLD_V3.anchors).map(([id, anchor]) => [id, { id, ...anchor }]),
  ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest.map((anchor) => [anchor.id, anchor]),
]);

const ROLE_FOR_USE = Object.freeze({
  landmark: 'landmark',
  boundary: 'wall',
  canopy: 'canopy-occluder',
  dressing: 'smallprop',
  ambient: 'decor',
  water: 'water-strip',
});

const DEFAULT_FOOTPRINT = Object.freeze({
  landmark: Object.freeze({ w: 3.8, h: 2.2 }),
  boundary: Object.freeze({ w: 1.4, h: 1.0 }),
  canopy: Object.freeze({ w: 0.9, h: 0.9 }),
  dressing: Object.freeze({ w: 0.7, h: 0.7 }),
  ambient: Object.freeze({ w: 0.2, h: 0.2 }),
  water: Object.freeze({ w: 0.2, h: 0.2 }),
});

function footprintPolygon(footprint) {
  const w = Math.max(0.1, Number(footprint?.w) || 0.5);
  const h = Math.max(0.1, Number(footprint?.h) || 0.5);
  return Object.freeze([Object.freeze([
    Object.freeze([0, 0]),
    Object.freeze([w, 0]),
    Object.freeze([w, h]),
    Object.freeze([0, h]),
  ])]);
}

function worldCell(authoredX, authoredY) {
  const world = authoredCellToWorld(authoredX, authoredY);
  return levelOneWorldV3CellAt(world.x, world.y);
}

function placementAllowed(authoredX, authoredY, solid) {
  const cell = worldCell(authoredX, authoredY);
  if (!cell.inBounds || cell.isBridge) return false;
  if (!solid) return true;
  return !cell.blocked && cell.route === '.';
}

function nearestPlacement(authoredX, authoredY, solid) {
  if (placementAllowed(authoredX, authoredY, solid)) return { x: authoredX, y: authoredY };
  for (let radius = 1; radius <= 7; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = authoredX + dx;
        const y = authoredY + dy;
        if (placementAllowed(x, y, solid)) return { x, y };
      }
    }
  }
  return null;
}

function objectFromStamp(placement, stamp, object, index) {
  const anchor = ANCHOR_BY_ID.get(placement.anchorId);
  if (!anchor) return null;
  const solid = Boolean(object.solid);
  let desiredX = Math.round(anchor.x + Number(object.dx || 0));
  let desiredY = Math.round(anchor.y + Number(object.dy || 0));
  const preserveArenaCenter = !['ambient', 'vfx', 'water'].includes(object.use);
  const arenaClearRadius = preserveArenaCenter ? Math.max(0, Number(anchor.arenaRadius) || 0) : 0;
  const anchorDistance = Math.hypot(desiredX - anchor.x, desiredY - anchor.y);
  if (arenaClearRadius > 0 && anchorDistance < arenaClearRadius + 1) {
    const angle = anchorDistance > 0.01
      ? Math.atan2(desiredY - anchor.y, desiredX - anchor.x)
      : (index / Math.max(1, stamp.objects.length)) * Math.PI * 2;
    const perimeterRadius = arenaClearRadius + 1 + (index % 2);
    desiredX = Math.round(anchor.x + Math.cos(angle) * perimeterRadius);
    desiredY = Math.round(anchor.y + Math.sin(angle) * perimeterRadius);
  }
  const placed = nearestPlacement(desiredX, desiredY, solid);
  if (!placed) return null;
  const world = authoredCellToWorld(placed.x, placed.y);
  if (Math.hypot(world.x, world.y) < SPAWN_CLEAR_RADIUS && solid) return null;
  const footprint = Object.freeze({ ...(object.metadata?.footprintTiles ?? DEFAULT_FOOTPRINT[object.use] ?? DEFAULT_FOOTPRINT.dressing) });
  return Object.freeze({
    id: `world-v3-${placement.anchorId}-${stamp.id}-${index}`,
    assetKey: object.assetKey,
    gridX: world.x,
    gridY: world.y,
    authoredX: placed.x,
    authoredY: placed.y,
    role: object.use,
    sceneRole: ROLE_FOR_USE[object.use] ?? 'smallprop',
    solid,
    sourceZoneId: placement.anchorId,
    authoredPrefabStamp: true,
    prefabStampId: stamp.id,
    routeBeat: placement.kind,
    exactAssetKey: object.assetKey,
    footprintTiles: footprint,
    collisionPolygons: solid ? footprintPolygon(footprint) : null,
    drawOrderBias: object.use === 'canopy' ? 2 : object.use === 'landmark' ? 1 : 0,
    zHeight: object.use === 'canopy' || object.use === 'landmark' ? 1 : 0,
    worldV3: true,
  });
}

function authoredStampObjects() {
  const objects = [];
  for (const placement of STAMP_PLACEMENTS) {
    const stamp = STAMP_BY_ID.get(placement.stampId);
    if (!stamp) continue;
    stamp.objects.forEach((object, index) => {
      const placed = objectFromStamp(placement, stamp, object, index);
      if (placed) objects.push(placed);
    });
  }
  return objects;
}

const NATURAL_ASSET_BY_TERRAIN = Object.freeze({
  F: Object.freeze(['level-1/flora/broken-tree3', 'level-1/flora/burned-tree2', 'curated-tree/jul9-riparian-cottonwood-idle-00']),
  G: Object.freeze(['level-1/flora/oak-tree', 'curated-tree/jul9-riparian-cottonwood-idle-00']),
  R: Object.freeze(['level-1/prop/oval-rock2-ground-shadow', 'level-1/prop/oval-rock4-ground-shadow']),
  S: Object.freeze(['curated-tree/jul9-desert-mesquite-idle-00', 'curated-tree/jul9-desert-joshua-idle-00']),
});

function stableHash(x, y, salt = 0) {
  let value = Math.imul(x + 31, 0x45d9f3b) ^ Math.imul(y + 17, 0x119de1f3) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function naturalObjects() {
  const objects = [];
  for (let y = 2; y < 98; y += 1) {
    for (let x = 2; x < 98; x += 1) {
      const terrain = HMH_LEVEL_ONE_WORLD_V3.layers.terrain[y][x];
      const assets = NATURAL_ASSET_BY_TERRAIN[terrain];
      if (!assets) continue;
      const cell = worldCell(x, y);
      if (cell.blocked || cell.route !== '.' || cell.encounter !== '.') continue;
      const cadence = terrain === 'F' ? 17 : terrain === 'G' ? 31 : terrain === 'R' ? 37 : 53;
      const hash = stableHash(x, y, terrain.charCodeAt(0));
      if (hash % cadence !== 0) continue;
      const world = authoredCellToWorld(x, y);
      if (Math.hypot(world.x, world.y) < SPAWN_CLEAR_RADIUS + 2) continue;
      const footprint = Object.freeze({ w: terrain === 'R' ? 0.75 : 0.68, h: terrain === 'R' ? 0.6 : 0.68 });
      objects.push(Object.freeze({
        id: `world-v3-natural-${terrain}-${x}-${y}`,
        assetKey: assets[hash % assets.length],
        gridX: world.x,
        gridY: world.y,
        authoredX: x,
        authoredY: y,
        role: terrain === 'R' ? 'boundary' : 'canopy',
        sceneRole: terrain === 'R' ? 'rock' : 'canopy-occluder',
        solid: true,
        sourceZoneId: `terrain-${terrain}`,
        authoredPrefabStamp: false,
        prefabStampId: null,
        routeBeat: 'authored-natural-cluster',
        exactAssetKey: assets[hash % assets.length],
        footprintTiles: footprint,
        collisionPolygons: footprintPolygon(footprint),
        drawOrderBias: terrain === 'R' ? 0 : 2,
        zHeight: terrain === 'R' ? 0 : 1,
        worldV3: true,
      }));
    }
  }
  return objects;
}

const ORIGINAL_LANDMARK_SPECS = Object.freeze([
  Object.freeze({ id: 'world-v3-wrecked-lighthouse-landmark', anchorId: 'wrecked-lighthouse', assetKey: 'world-v3-landmark/wrecked-litecoin-lighthouse', offsetX: 7, offsetY: 0, footprint: Object.freeze({ w: 4.2, h: 3.2 }), solid: true, zHeight: 4 }),
  Object.freeze({ id: 'world-v3-ghost-saloon-landmark', anchorId: 'ghost-saloon-square', assetKey: 'world-v3-landmark/ghost-saloon-square', offsetX: 8, offsetY: 0, footprint: Object.freeze({ w: 5.0, h: 3.6 }), solid: true, zHeight: 4 }),
  Object.freeze({ id: 'world-v3-dry-forest-cave-landmark', anchorId: 'dry-forest-cave', assetKey: 'world-v3-landmark/dry-forest-cave-mouth', offsetX: 0, offsetY: -7, footprint: Object.freeze({ w: 5.2, h: 4.0 }), solid: true, zHeight: 4 }),
  Object.freeze({ id: 'world-v3-mesa-overlook-landmark', anchorId: 'mesa-overlook', assetKey: 'world-v3-landmark/mesa-overlook-outcrop', offsetX: 7, offsetY: -1, footprint: Object.freeze({ w: 5.0, h: 4.0 }), solid: true, zHeight: 3 }),
  Object.freeze({ id: 'world-v3-frontier-town-hall-landmark', anchorId: 'frontier-town-square', assetKey: 'world-v3-landmark/frontier-town-exchange-hall', offsetX: -2, offsetY: -7, footprint: Object.freeze({ w: 4.8, h: 3.5 }), solid: true, zHeight: 4 }),
  Object.freeze({ id: 'world-v3-crossroads-trading-post-landmark', anchorId: 'crossroads-trading-post', assetKey: 'world-v3-infrastructure/crossroads-wagon-trading-post', offsetX: 7, offsetY: 2, footprint: Object.freeze({ w: 5.4, h: 3.8 }), solid: true, zHeight: 4 }),
  Object.freeze({ id: 'world-v3-rugpull-gulch-landmark', anchorId: 'rugpull-gulch-boss-yard', assetKey: 'world-v3-infrastructure/rugpull-gulch-sheriff-water-tower', offsetX: -10, offsetY: 4, footprint: Object.freeze({ w: 6.2, h: 4.2 }), drawFootprint: Object.freeze({ w: 5.0, h: 3.4 }), solid: true, zHeight: 5 }),
  Object.freeze({ id: 'world-v3-litecoin-city-threshold-landmark', anchorId: 'extraction', assetKey: 'world-v3-landmark/litecoin-city-threshold-gate', offsetX: 4, offsetY: 0, footprint: Object.freeze({ w: 4.8, h: 3.0 }), solid: false, zHeight: 4 }),
]);

function originalLandmark(spec) {
  const anchor = ANCHOR_BY_ID.get(spec.anchorId);
  if (!anchor) return null;
  const placed = nearestPlacement(anchor.x + spec.offsetX, anchor.y + spec.offsetY, spec.solid);
  if (!placed) return null;
  const world = authoredCellToWorld(placed.x, placed.y);
  return Object.freeze({
    id: spec.id,
    assetKey: spec.assetKey,
    gridX: world.x,
    gridY: world.y,
    authoredX: placed.x,
    authoredY: placed.y,
    role: 'landmark',
    sceneRole: 'landmark',
    solid: spec.solid,
    interactive: true,
    sourceZoneId: spec.anchorId,
    authoredPrefabStamp: true,
    prefabStampId: spec.id,
    routeBeat: spec.anchorId === 'extraction' ? 'extraction-landmark' : 'poi-landmark',
    exactAssetKey: spec.assetKey,
    footprintTiles: spec.footprint,
    ...(spec.drawFootprint ? { drawFootprintTiles: spec.drawFootprint } : {}),
    collisionPolygons: spec.solid ? footprintPolygon(spec.footprint) : null,
    drawOrderBias: 4,
    zHeight: spec.zHeight,
    worldV3: true,
  });
}

const ORIGINAL_LANDMARKS = ORIGINAL_LANDMARK_SPECS.map(originalLandmark).filter(Boolean);

function pineCreekBridgeOverlay() {
  const bridge = HMH_LEVEL_ONE_WORLD_V3.bridges.find((entry) => entry.id === 'pine-creek-wood-bridge');
  if (!bridge) return null;
  const world = authoredCellToWorld(bridge.x, bridge.y);
  return Object.freeze({
    id: 'world-v3-pine-creek-timber-bridge',
    assetKey: 'world-v3-infrastructure/pine-creek-timber-bridge',
    gridX: world.x,
    gridY: world.y,
    authoredX: bridge.x,
    authoredY: bridge.y,
    role: 'bridge',
    sceneRole: 'bridge-overhang',
    solid: false,
    interactive: false,
    sourceZoneId: bridge.id,
    authoredPrefabStamp: true,
    prefabStampId: 'world-v3-pine-creek-timber-bridge',
    routeBeat: 'navigation-test',
    exactAssetKey: 'world-v3-infrastructure/pine-creek-timber-bridge',
    footprintTiles: Object.freeze({ w: 6.0, h: 3.0 }),
    collisionPolygons: null,
    drawOrderBias: -1,
    zHeight: 1,
    worldV3: true,
  });
}

const PINE_CREEK_BRIDGE = pineCreekBridgeOverlay();
export const HMH_LEVEL_ONE_WORLD_V3_OBJECTS = Object.freeze([
  ...authoredStampObjects(),
  ...ORIGINAL_LANDMARKS,
  ...(PINE_CREEK_BRIDGE ? [PINE_CREEK_BRIDGE] : []),
  ...naturalObjects(),
]);

export function buildLevelOneWorldV3VisibleObjects({ playerX = 0, playerY = 0, window = 18 } = {}) {
  const radius = Math.max(1, Number(window) || 18) + 8;
  return Object.freeze(HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((object) => (
    Math.abs(object.gridX - playerX) <= radius && Math.abs(object.gridY - playerY) <= radius
  )));
}

export function levelOneWorldV3ObjectReport() {
  const byStamp = {};
  const byTerrain = {};
  for (const object of HMH_LEVEL_ONE_WORLD_V3_OBJECTS) {
    if (object.prefabStampId) byStamp[object.prefabStampId] = (byStamp[object.prefabStampId] ?? 0) + 1;
    else byTerrain[object.sourceZoneId] = (byTerrain[object.sourceZoneId] ?? 0) + 1;
  }
  return Object.freeze({
    total: HMH_LEVEL_ONE_WORLD_V3_OBJECTS.length,
    solid: HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((object) => object.solid).length,
    interactiveOrLandmark: HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((object) => object.role === 'landmark' || object.role === 'dressing').length,
    byStamp: Object.freeze(byStamp),
    byTerrain: Object.freeze(byTerrain),
  });
}

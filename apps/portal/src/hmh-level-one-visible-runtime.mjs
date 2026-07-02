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

function routeTile(id, x, y, role = 'road') {
  return Object.freeze({ id, x, y, role, layer: 'ground' });
}

function openingSpec(id, assetKey, use, x, y, options = {}) {
  return Object.freeze({
    id,
    assetKey,
    use,
    x,
    y,
    solid: options.solid ?? SOLID_FOR_USE[use] ?? false,
    notes: options.notes ?? '',
    sourceZoneId: options.sourceZoneId ?? 'opening-broken-road',
  });
}

const OPENING_ROUTE_TILES = Object.freeze([
  ...Array.from({ length: 17 }, (_, i) => routeTile(`main-road-${i}`, -12 + i * 3, 5, 'road')),
  ...Array.from({ length: 5 }, (_, i) => routeTile(`gas-station-apron-${i}`, -4 + i * 2, 7, 'road')),
  ...Array.from({ length: 6 }, (_, i) => routeTile(`town-telegraph-shoulder-${i}`, 18 + i * 3, 4, i < 2 ? 'road' : 'rocky')),
]);

const OPENING_LANDMARKS = Object.freeze([
  openingSpec('gas-station-landmark', 'level-1/building/landmark-gas-station', 'landmark', -9, 8, {
    notes: 'large curated spawn landmark anchors the opening camera',
  }),
  openingSpec('boarded-storefront-telegraph', 'level-1/building/ghost-boarded-storefront', 'landmark', 21, 2, {
    notes: 'telegraphs ghost-town main street ahead instead of random desert scatter',
  }),
  openingSpec('saloon-silhouette-telegraph', 'level-1/building/ghost-saloon-front', 'landmark', 31, 3, {
    notes: 'distant saloon silhouette frames the next combat beat',
  }),
  openingSpec('storefront-side-anchor', 'level-1/building/storefront-0', 'landmark', 9, 2, {
    notes: 'small town-side anchor for the spawn camera composition',
  }),
  openingSpec('route-arcade-cache', 'level-1/building/arcade-cabinet', 'dressing', 12, 8, {
    solid: false,
    notes: 'small Lester arcade landmark rewards the first detour read without blocking the scene',
  }),
]);

const OPENING_BOUNDARIES = Object.freeze([
  openingSpec('north-cactus-0', 'curated-prop/cactus1-1', 'boundary', -14, 2, { solid: true }),
  openingSpec('north-cactus-1', 'curated-prop/cactus2-1', 'boundary', -6, 2, { solid: true }),
  openingSpec('north-rock-0', 'level-1/prop/oval-rock1-grass-shadow', 'boundary', 5, 2, { solid: true }),
  openingSpec('north-rock-1', 'level-1/prop/oval-rock2-ground-shadow', 'boundary', 15, 2, { solid: true }),
  openingSpec('north-desert-line-0', 'level-1/prop/desert-09', 'boundary', 24, 2, { solid: true }),
  openingSpec('north-desert-line-1', 'level-1/prop/desert-10', 'boundary', 35, 2, { solid: true }),
  openingSpec('south-rock-0', 'level-1/prop/oval-rock1-ground-shadow', 'boundary', -12, 10, { solid: true }),
  openingSpec('south-cactus-0', 'curated-prop/cactus1-2', 'boundary', 2, 10, { solid: true }),
  openingSpec('south-broken-tree', 'curated-prop/broken-tree3', 'boundary', 22, 10, { solid: true }),
  openingSpec('south-bush-line', 'curated-prop/autumn-bush2', 'boundary', 36, 9, { solid: true }),
]);

const OPENING_SET_DRESSING = Object.freeze([
  openingSpec('spawn-bus-stop-sign', 'level-1/prop/bus-stop-sign', 'dressing', 6, 3, { solid: false }),
  openingSpec('dragon-bone-foreground', 'level-1/prop/dragon-bones-body-ground-shadow', 'dressing', -16, 6, { solid: false }),
  openingSpec('small-desert-0', 'level-1/prop/desert-13', 'dressing', -1, 8, { solid: false }),
  openingSpec('small-desert-1', 'level-1/prop/desert-14', 'dressing', 18, 7, { solid: false }),
  openingSpec('roadside-crate', 'level-1/building/wooden-crate', 'dressing', 11, 4, { solid: false }),
  openingSpec('route-soda-machine', 'level-1/building/soda-machine', 'dressing', 27, 6, { solid: false }),
]);

const OPENING_COMPOSITION = Object.freeze({
  id: 'level-one-opening-authored-aaa-v1',
  source: 'Justin curated hmh-curated-level-kit',
  clearLane: Object.freeze({ centerY: 5, widthTiles: 7, startX: -16, endX: 38 }),
  routeTiles: OPENING_ROUTE_TILES,
  landmarks: OPENING_LANDMARKS,
  boundaries: OPENING_BOUNDARIES,
  setDressing: OPENING_SET_DRESSING,
  objects: Object.freeze([...OPENING_LANDMARKS, ...OPENING_BOUNDARIES, ...OPENING_SET_DRESSING]),
});

function chunkSpec(id, districtId, objects, data = {}) {
  return Object.freeze({
    id,
    districtId,
    label: data.label ?? id,
    routeRead: data.routeRead ?? 'authored traversal chunk',
    objects: Object.freeze(objects.map((object, index) => Object.freeze({
      id: object.id ?? `${id}-${index}`,
      assetKey: object.assetKey,
      use: object.use,
      dx: object.dx ?? 0,
      dy: object.dy ?? 0,
      solid: object.solid,
      notes: object.notes ?? data.routeRead ?? '',
    }))),
  });
}

export const LEVEL_ONE_WORLD_DRESSING_CHUNKS = Object.freeze([
  chunkSpec('desert-road-salvage-wall', 'desert-approach', [
    { assetKey: 'level-1/prop/desert-09', use: 'boundary', dx: -5, dy: -3, solid: true },
    { assetKey: 'level-1/prop/desert-10', use: 'boundary', dx: 3, dy: -3, solid: true },
    { assetKey: 'level-1/prop/dragon-bones-body-ground-shadow', use: 'landmark', dx: -3, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock4-ground-shadow', use: 'boundary', dx: 5, dy: 2, solid: true },
    { assetKey: 'level-1/prop/bus-stop-sign', use: 'dressing', dx: 0, dy: -1, solid: false },
  ], { label: 'Broken road salvage wall', routeRead: 'desert road edges and salvage silhouettes break up empty sand' }),
  chunkSpec('ghost-town-frontage-pocket', 'ghost-town', [
    { assetKey: 'level-1/building/ghost-boarded-storefront', use: 'landmark', dx: -5, dy: -4, solid: true },
    { assetKey: 'level-1/building/ghost-saloon-front', use: 'landmark', dx: 3, dy: -4, solid: true },
    { assetKey: 'level-1/prop/street-lamp', use: 'dressing', dx: -1, dy: -1, solid: false },
    { assetKey: 'level-1/building/wooden-crate', use: 'dressing', dx: 5, dy: 2, solid: false },
    { assetKey: 'level-1/prop/town-01', use: 'boundary', dx: -4, dy: 3, solid: true },
    { assetKey: 'level-1/prop/trash-can', use: 'dressing', dx: 2, dy: 3, solid: false },
  ], { label: 'Ghost town street frontage', routeRead: 'false-front silhouettes and curb dressing make the street read authored' }),
  chunkSpec('forest-mushroom-ring', 'dead-forest-loop', [
    { assetKey: 'level-1/flora/broken-tree3', use: 'boundary', dx: -4, dy: -3, solid: true },
    { assetKey: 'level-1/flora/burned-tree2', use: 'boundary', dx: 5, dy: -2, solid: true },
    { assetKey: 'level-1/prop/orange-mushrooms1-ground-shadow', use: 'landmark', dx: 0, dy: 0, solid: false },
    { assetKey: 'level-1/prop/black-mushrooms2-ground-shadow', use: 'dressing', dx: -3, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock2-ground-shadow', use: 'boundary', dx: 4, dy: 3, solid: true },
  ], { label: 'Dead forest mushroom ring', routeRead: 'tree walls and mushroom color accents define forest loops' }),
  chunkSpec('shoreline-ford-bank', 'country-road', [
    { assetKey: 'level-1/water/water-02', use: 'water', dx: -4, dy: 0, solid: false },
    { assetKey: 'level-1/water/water-03', use: 'water', dx: 0, dy: 0, solid: false },
    { assetKey: 'level-1/prop/water-ruins2', use: 'landmark', dx: 4, dy: -2, solid: true },
    { assetKey: 'level-1/prop/oval-rock5-ground-shadow', use: 'boundary', dx: -5, dy: 3, solid: true },
    { assetKey: 'level-1/prop/caury-white1-ground-shadow', use: 'dressing', dx: 2, dy: 3, solid: false },
  ], { label: 'Shoreline ford bank', routeRead: 'waterline, rocks, and small shore reads make bridge/ford traversal legible' }),
  chunkSpec('farmstead-fence-pocket', 'residential-edge', [
    { assetKey: 'level-1/building/town-10', use: 'landmark', dx: -4, dy: -3, solid: true },
    { assetKey: 'level-1/prop/park-bench', use: 'dressing', dx: 3, dy: -1, solid: false },
    { assetKey: 'level-1/flora/oak-tree', use: 'boundary', dx: 5, dy: 2, solid: true },
    { assetKey: 'level-1/prop/mailbox', use: 'dressing', dx: -2, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock1-grass-shadow', use: 'boundary', dx: -5, dy: 2, solid: true },
  ], { label: 'Farmstead fence pocket', routeRead: 'farm edge reads as a lived-in loop rather than blank grass' }),
  chunkSpec('innercity-gate-barricade', 'inner-city-threshold', [
    { assetKey: 'level-1/building/industrial-warehouse-facade', use: 'landmark', dx: -5, dy: -4, solid: true },
    { assetKey: 'level-1/building/innercity-billboard-frame', use: 'landmark', dx: 4, dy: -4, solid: true },
    { assetKey: 'level-1/prop/blue-gray-ruins1', use: 'boundary', dx: -4, dy: 3, solid: true },
    { assetKey: 'level-1/prop/brown-ruins2', use: 'boundary', dx: 4, dy: 3, solid: true },
    { assetKey: 'level-1/prop/traffic-cone', use: 'dressing', dx: 0, dy: 1, solid: false },
  ], { label: 'Inner-city gate barricade', routeRead: 'industrial silhouettes and ruins frame the boss-yard approach' }),
  chunkSpec('ruined-camp-bone-yard', 'desert-bone-camp', [
    { assetKey: 'level-1/prop/dragon-bones-full-ground-shadow', use: 'landmark', dx: -2, dy: -2, solid: false },
    { assetKey: 'level-1/prop/sand-ruins3', use: 'boundary', dx: 5, dy: -2, solid: true },
    { assetKey: 'level-1/prop/brown-gray-ruins4', use: 'boundary', dx: -5, dy: 3, solid: true },
    { assetKey: 'level-1/prop/desert-14', use: 'dressing', dx: 2, dy: 3, solid: false },
    { assetKey: 'level-1/prop/rocky-05', use: 'boundary', dx: 0, dy: 5, solid: true },
  ], { label: 'Ruined camp bone yard', routeRead: 'bone and ruin setpieces create desert arena edges' }),
  chunkSpec('roadside-arcade-cache', 'desert-approach', [
    { assetKey: 'level-1/building/arcade-cabinet', use: 'landmark', dx: -3, dy: -1, solid: false },
    { assetKey: 'level-1/building/soda-machine', use: 'dressing', dx: 3, dy: -1, solid: false },
    { assetKey: 'level-1/building/wooden-crate', use: 'dressing', dx: 5, dy: 2, solid: false },
    { assetKey: 'level-1/prop/road-03', use: 'dressing', dx: -5, dy: 2, solid: false },
    { assetKey: 'level-1/prop/desert-08', use: 'boundary', dx: 0, dy: 4, solid: true },
  ], { label: 'Roadside arcade cache', routeRead: 'coin-slot fantasy and roadside props create a reward pocket' }),
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

export function buildLevelOneOpeningComposition() {
  return OPENING_COMPOSITION;
}

export function levelOneCuratedAssetSrc(assetKey) {
  return curatedLevelKitAssetByKey(assetKey)?.src ?? null;
}

export function levelOneOpeningGroundRoleForTile({ worldX = 0, worldY = 0 } = {}) {
  const x = Math.round(worldX);
  const y = Math.round(worldY);
  if (x < -22 || x > 44 || y < -4 || y > 16) return null;

  // Diegetic shoulder bands first, so the road has visible boundaries instead of
  // infinite flat sand. The playable lane still remains wide at y=4..6.
  if (x >= 12 && x <= 40 && y >= 2 && y <= 3) return 'rocky';
  if (x >= 10 && x <= 40 && y >= 8 && y <= 11) return 'grass';
  if (x >= -18 && x <= 40 && y >= 4 && y <= 6) return 'road';
  if (x >= -8 && x <= 10 && y >= 7 && y <= 8) return 'road';
  if (x < -10 && y >= 1 && y <= 8) return 'rocky';
  if (y >= 9) return 'grass';
  return 'sand';
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

function objectFromAsset({ id, assetKey, use, x, y, notes = '', zoneId = null, index = 0, solid = undefined }) {
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
    use,
    gridX: x,
    gridY: y,
    solid: solid ?? SOLID_FOR_USE[use] ?? false,
    zHeight: use === 'landmark' ? 4 : use === 'boundary' ? 2 : 0,
    drawOrderBias: use === 'landmark' ? 16 : use === 'boundary' ? 8 : 0,
    text: notes,
    sourceZoneId: zoneId,
    propIndex: index,
  });
}

function openingObjects() {
  return OPENING_COMPOSITION.objects
    .map((spec, index) => objectFromAsset({
      id: `curated-opening-${spec.id}`,
      assetKey: spec.assetKey,
      use: spec.use,
      x: spec.x,
      y: spec.y,
      solid: spec.solid,
      zoneId: spec.sourceZoneId,
      notes: spec.notes,
      index,
    }))
    .filter(Boolean);
}

function contractZoneObjects() {
  const objects = [];
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
  return objects;
}

function chunkHash(cellX, cellY) {
  let h = Math.imul(cellX | 0, 374761393) ^ Math.imul(cellY | 0, 668265263) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

export function levelOneWorldDressingChunkForCell({ cellX = 0, cellY = 0 } = {}) {
  if (!LEVEL_ONE_WORLD_DRESSING_CHUNKS.length) return null;
  const hash = chunkHash(Math.round(cellX), Math.round(cellY));
  return LEVEL_ONE_WORLD_DRESSING_CHUNKS[hash % LEVEL_ONE_WORLD_DRESSING_CHUNKS.length] ?? null;
}

function worldDressingObjects({ playerX = 0, playerY = 5, window = 18 } = {}) {
  const spacing = 14;
  const pad = 10;
  const minCellX = Math.floor((playerX - window - pad) / spacing);
  const maxCellX = Math.ceil((playerX + window + pad) / spacing);
  const minCellY = Math.floor((playerY - window - pad) / spacing);
  const maxCellY = Math.ceil((playerY + window + pad) / spacing);
  const objects = [];
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const chunk = levelOneWorldDressingChunkForCell({ cellX, cellY });
      if (!chunk) continue;
      const hash = chunkHash(cellX, cellY);
      const anchorX = cellX * spacing + spacing / 2 + ((hash % 5) - 2);
      const anchorY = cellY * spacing + spacing / 2 + (((hash >>> 4) % 5) - 2);
      if (Math.abs(anchorX - playerX) > window + pad || Math.abs(anchorY - playerY) > window + pad) continue;
      chunk.objects.forEach((spec, index) => {
        const x = anchorX + spec.dx;
        const y = anchorY + spec.dy;
        // Keep a generous fight lane immediately around the player; silhouettes
        // frame the screen instead of spawning directly underfoot.
        if (Math.hypot(x - playerX, y - playerY) < 5.5 && spec.solid !== false) return;
        const object = objectFromAsset({
          id: `curated-world-${cellX}-${cellY}-${chunk.id}-${index}`,
          assetKey: spec.assetKey,
          use: spec.use,
          x,
          y,
          solid: spec.solid,
          notes: spec.notes,
          zoneId: `world-dressing-${chunk.id}`,
          index,
        });
        if (object) objects.push(object);
      });
    }
  }
  return objects;
}

export function buildLevelOneCuratedVisibleSceneObjects({ playerX = 0, playerY = 5, window = 18 } = {}) {
  const objects = [...openingObjects(), ...contractZoneObjects(), ...worldDressingObjects({ playerX, playerY, window })];
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

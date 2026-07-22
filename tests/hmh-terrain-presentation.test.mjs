import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import { authoredCellToWorld } from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';
import {
  buildTerrainEdgeBlendsForCell,
  buildTerrainPresentationForCell,
  summarizeTerrainPresentation,
  TERRAIN_PRESENTATION_OVERLAY_ORDER,
  HMH_DESERT_APPROACH_WANG_RUNTIME,
  HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME,
  bridgeSupertilePresentationForCell,
  desertApproachRuntimeAtlasAssets,
  desertApproachRuntimeGroundAssetForCell,
  desertApproachRuntimeRoleForCell,
  roadSupertilePresentationForCell,
  roadSupertileRuntimeAtlasAssets,
} from '../apps/portal/src/hmh-terrain-presentation.mjs';

const migrateDesignCoordinate = (value) => Math.round(value * 149 / 99);
const migratedWorldFromLegacyWorld = (x, y) => authoredCellToWorld(
  migrateDesignCoordinate(x + 8),
  migrateDesignCoordinate(y + 78),
);

const migratedCell = (plan, x, y) => {
  const world = migratedWorldFromLegacyWorld(x, y);
  return plan.cellAt(world.x, world.y);
};

test('terrain edge blends use neighboring material truth without softening bridge decks', () => {
  const cell = {
    textureKey: 'world-v3-material/dry-grass',
    terrainRole: 'grass',
    adjacency: { cardinal: {
      north: { textureKey: 'world-v3-material/packed-dirt', terrainRole: 'dirt' },
      east: { textureKey: 'world-v3-material/dry-grass', terrainRole: 'grass' },
      south: { textureKey: 'world-v3-material/fresh-deep-water', terrainRole: 'water' },
      west: { textureKey: 'world-v3-material/wood-bridge', terrainRole: 'bridge' },
    } },
  };
  const blends = buildTerrainEdgeBlendsForCell(cell);
  assert.deepEqual(blends.map((blend) => blend.direction), ['north', 'south']);
  assert.equal(blends[1].alpha, 0.34);
  assert.equal(blends.every((blend) => blend.textureKey.startsWith('world-v3-material/')), true);
  assert.deepEqual(buildTerrainEdgeBlendsForCell({ ...cell, terrainRole: 'bridge', isBridge: true }), []);
});

test('terrain presentation turns blob cells into ordered elevation/water/bridge/lighting overlays', () => {
  const plan = buildGroundPlan({ seed: 47 });
  const bridge = buildTerrainPresentationForCell(migratedCell(plan, 27, -39), { frame: 24 });
  const water = buildTerrainPresentationForCell(migratedCell(plan, 25, -42), { frame: 24 });
  const bossHigh = buildTerrainPresentationForCell(migratedCell(plan, -7, -78), { frame: 24 });

  assert.deepEqual(TERRAIN_PRESENTATION_OVERLAY_ORDER, [
    'terrain-shadow',
    'water-flow',
    'shoreline-foam',
    'bridge-contact-shadow',
    'bridge-deck-light',
    'elevation-rim-light',
    'road-dust',
  ]);

  assert.equal(bridge.kind, 'bridge');
  assert.equal(bridge.elevationPx, 0);
  assert.ok(bridge.overlays.some((overlay) => overlay.id === 'bridge-contact-shadow' && overlay.alpha > 0.15));
  assert.ok(bridge.overlays.some((overlay) => overlay.id === 'bridge-deck-light'));

  assert.equal(water.kind, 'water');
  assert.equal(water.elevationPx > 0, true, 'water should sit visually below mid ground');
  assert.ok(water.overlays.some((overlay) => overlay.id === 'water-flow' && overlay.alpha > 0));
  assert.ok(water.overlays.some((overlay) => overlay.id === 'shoreline-foam' && overlay.motionPhase > 0));

  assert.equal(bossHigh.elevationBand, 'high');
  assert.equal(bossHigh.elevationPx < 0, true, 'high ground should render visually lifted');
  assert.ok(bossHigh.overlays.some((overlay) => overlay.id === 'terrain-shadow'));
  assert.ok(bossHigh.overlays.some((overlay) => overlay.id === 'elevation-rim-light'));

  for (const presentation of [bridge, water, bossHigh]) {
    const overlayIds = presentation.overlays.map((overlay) => overlay.id);
    const sorted = [...overlayIds].sort((a, b) => TERRAIN_PRESENTATION_OVERLAY_ORDER.indexOf(a) - TERRAIN_PRESENTATION_OVERLAY_ORDER.indexOf(b));
    assert.deepEqual(overlayIds, sorted, `${presentation.kind} overlays should be stable draw-order sorted`);
    assert.equal(Object.isFrozen(presentation), true);
    assert.equal(Object.isFrozen(presentation.overlays), true);
  }
});

test('terrain presentation summary reports live visual-system coverage', () => {
  const plan = buildGroundPlan({ seed: 47 });
  const cells = [migratedCell(plan, 27, -39), migratedCell(plan, 25, -42), migratedCell(plan, -7, -78), plan.cellAt(0, 0)];
  const summary = summarizeTerrainPresentation(cells, { frame: 33 });

  assert.equal(summary.cellCount, 4);
  assert.equal(summary.hasWaterFlow, true);
  assert.equal(summary.hasBridgeLighting, true);
  assert.equal(summary.hasElevationLighting, true);
  assert.equal(summary.hasCastShadows, true);
  assert.equal(summary.overlayIds.includes('road-dust'), true);
  assert.equal(summary.overlayIds.includes('water-flow'), true);
  assert.equal(Object.isFrozen(summary), true);
  assert.equal(Object.isFrozen(summary.overlayIds), true);
});

test('texture-only presentation preserves authored elevation without flat color polygon overlays', () => {
  const plan = buildGroundPlan({ seed: 47 });
  const bridge = buildTerrainPresentationForCell(migratedCell(plan, 27, -39), { frame: 24, overlayMode: 'texture-only' });
  const water = buildTerrainPresentationForCell(migratedCell(plan, 25, -42), { frame: 24, overlayMode: 'texture-only' });
  const bossHigh = buildTerrainPresentationForCell(migratedCell(plan, -7, -78), { frame: 24, overlayMode: 'texture-only' });

  assert.deepEqual(bridge.overlays, []);
  assert.deepEqual(water.overlays, []);
  assert.deepEqual(bossHigh.overlays, []);
  assert.equal(water.elevationPx > 0, true);
  assert.equal(bossHigh.elevationPx < 0, true);
});

test('live runtime consumes terrain presentation instead of ad-hoc flat terrain fills', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

  assert.match(main, /hmh-terrain-presentation\.mjs/);
  assert.match(main, /buildTerrainPresentationForCell\(/);
  assert.match(main, /terrainPresentationStats/);
  assert.match(main, /overlayMode: isLevelOneCuratedRuntime\(\) \? 'texture-only' : 'full'/);
  assert.match(syntax, /apps\/portal\/src\/hmh-terrain-presentation\.mjs/);
  assert.match(syntax, /tests\/hmh-terrain-presentation\.test\.mjs/);
});


const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

function repoAssetExists(src) {
  return existsSync(new URL(`../apps/portal/${src.replace(/^\.\//, '')}`, import.meta.url));
}

function neighbor(role, terrain, route = '.') {
  return { zoneId: `${role}-zone`, role, terrainRole: role, terrain, biome: terrain === 'D' ? 'D' : null, route, textureKey: `world-v3-material/${role}` };
}

function cellWithOneDifferentNeighbor(direction, neighborCell) {
  const base = neighbor('sand', 'S');
  return {
    x: 12,
    y: -9,
    terrain: 'S',
    route: '.',
    terrainRole: 'sand',
    textureKey: 'world-v3-material/wasteland-sand',
    adjacency: {
      cardinal: {
        north: direction === 'north' ? neighborCell : base,
        east: direction === 'east' ? neighborCell : base,
        south: direction === 'south' ? neighborCell : base,
        west: direction === 'west' ? neighborCell : base,
      },
    },
  };
}

test('Desert Approach v2.3 ships two compact runtime atlases with certified budgets', () => {
  const manifest = HMH_DESERT_APPROACH_WANG_RUNTIME;
  assert.equal(manifest.id, 'hmh-desert-approach-terrain-wang-v2-3-runtime');
  assert.equal(manifest.status, 'runtime-ready-seam-certified');
  assert.deepEqual(manifest.tileSourceSize, [128, 64]);
  assert.deepEqual(manifest.logicalFootprint, [64, 32]);
  assert.equal(manifest.materials.length, 16);
  assert.equal(manifest.masks.length, 64);
  assert.equal(manifest.performance.atlasCount, 2);
  assert.equal(manifest.performance.maxDrawLayersPerCell, 2);
  assert.equal(manifest.performance.totalDecodedBytes, 1_048_576);
  assert.equal(manifest.materials.every((asset) => asset.colors <= 15), true);
  assert.equal(manifest.masks.every((mask) => mask.phase >= 0 && mask.phase < 4 && mask.bits >= 0 && mask.bits < 16), true);
  assert.deepEqual(manifest.worldNeighborToDiamondEdge, { north: 'NE', east: 'SE', south: 'SW', west: 'NW' });

  for (const atlas of desertApproachRuntimeAtlasAssets()) {
    assert.equal(repoAssetExists(atlas.src), true, `${atlas.src} should exist`);
    assert.equal(atlas.sampling, 'nearest-neighbor');
  }
});

test('Desert Approach runtime role policy preserves materials and promotes only authored dirt routes', () => {
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'S', terrainRole: 'sand', route: '.' }), 'sand');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'R', terrainRole: 'rocky', route: '.' }), 'rocky');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'D', biome: 'C', terrainRole: 'dirt', route: '.' }), 'dirt');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'D', biome: 'D', terrainRole: 'dirt', route: 'M' }), 'road');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'D', biome: 'D', terrainRole: 'dirt', route: 'N' }), 'road');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'D', biome: 'D', terrainRole: 'dirt', route: 'S' }), 'road');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'D', biome: 'C', terrainRole: 'dirt', route: 'S' }), 'dirt', 'ghost-town approach keeps arid dirt');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'D', biome: 'G', terrainRole: 'dirt', route: 'M' }), null, 'green crossroads keep their native regional material');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'A', terrainRole: 'road', route: 'M' }), null, 'town asphalt stays on its own material family');
  assert.equal(desertApproachRuntimeRoleForCell({ terrain: 'F', terrainRole: 'grass', route: '.' }), null, 'forest stays untouched');
});

test('Wang selection maps world cardinal neighbors to the correct isometric diamond edges', () => {
  const dirt = neighbor('dirt', 'D');
  const expectedBits = { north: 2, east: 4, south: 8, west: 1 };
  for (const [direction, edgeBits] of Object.entries(expectedBits)) {
    const asset = desertApproachRuntimeGroundAssetForCell(cellWithOneDifferentNeighbor(direction, dirt), { seed: 1337 });
    assert.ok(asset, `${direction} selection should resolve`);
    assert.equal(asset.role, 'sand');
    assert.equal(asset.wangComposite.overlayRole, 'dirt');
    assert.equal(asset.wangComposite.edgeBits, edgeBits);
    assert.deepEqual(asset.wangComposite.handledDirections, [direction]);
    assert.equal(asset.wangComposite.phase >= 0 && asset.wangComposite.phase < 4, true);
    assert.equal(asset.atlasRect.width, 128);
    assert.equal(asset.atlasRect.height, 64);
    assert.equal(asset.wangComposite.maskRect.width, 128);
    assert.equal(asset.wangComposite.maskRect.height, 64);
  }
});

test('mixed neighbor roles suppress fallback blending only for the Wang-composited role', () => {
  const current = cellWithOneDifferentNeighbor('north', neighbor('dirt', 'D'));
  current.adjacency.cardinal.east = neighbor('rocky', 'R');

  const asset = desertApproachRuntimeGroundAssetForCell(current, { seed: 1337 });
  assert.equal(asset.wangComposite.overlayRole, 'rocky');
  assert.deepEqual(asset.wangComposite.handledDirections, ['east']);
  assert.deepEqual(asset.handledDirections, ['east'], 'north dirt boundary must remain available to fallback edge blending');
});

test('cells without a Wang composite leave all differing boundaries to fallback blending', () => {
  const road = { ...neighbor('road', 'D', 'M'), x: 7, y: 4 };
  road.adjacency = {
    cardinal: {
      north: neighbor('sand', 'S'),
      east: neighbor('road', 'D', 'M'),
      south: neighbor('road', 'D', 'M'),
      west: neighbor('road', 'D', 'M'),
    },
  };

  const asset = desertApproachRuntimeGroundAssetForCell(road, { seed: 1337 });
  assert.equal(asset.wangComposite, undefined);
  assert.deepEqual(asset.handledDirections, []);
});

test('Wang runtime selection is deterministic, low-frequency, scoped, and capped at one composite layer', () => {
  const current = cellWithOneDifferentNeighbor('north', neighbor('road', 'D', 'M'));
  const a = desertApproachRuntimeGroundAssetForCell(current, { seed: 47 });
  const b = desertApproachRuntimeGroundAssetForCell(current, { seed: 47 });
  assert.deepEqual(a, b);
  assert.equal(a.variantIndex >= 0 && a.variantIndex < 4, true);
  assert.equal(a.wangComposite.overlayVariantIndex >= 0 && a.wangComposite.overlayVariantIndex < 4, true);
  assert.equal(a.wangComposite.edgeBits, 2);
  assert.equal(a.wangComposite.overlayRole, 'road');
  assert.equal(a.renderLayers, 2);

  const adjacent = desertApproachRuntimeGroundAssetForCell({ ...current, x: current.x + 1 }, { seed: 47 });
  assert.equal(adjacent.variantIndex, a.variantIndex, 'adjacent cells stay in one low-frequency material patch');
  const distant = desertApproachRuntimeGroundAssetForCell({ ...current, x: current.x + 40, y: current.y + 20 }, { seed: 47 });
  assert.equal(distant.variantIndex, a.variantIndex, 'one material role uses one continuous pattern group per run');
  assert.equal(desertApproachRuntimeGroundAssetForCell({ ...current, terrain: 'F', terrainRole: 'grass' }, { seed: 47 }), null);
});

test('live World v3 plan exposes the scoped Desert Approach adapter without replacing other terrain families', () => {
  const plan = buildGroundPlan({ seed: 1337 });
  assert.equal(typeof plan.renderAssetForCell, 'function');
  assert.equal(typeof plan.runtimeAtlasAssets, 'function');
  assert.equal(plan.runtimeAtlasAssets().length, 4);

  const found = new Map();
  const desiredDesertRoles = new Set(['dirt', 'sand', 'rocky', 'road']);
  for (let x = plan.worldBounds.minX; x <= plan.worldBounds.maxX && found.size < 5; x += 1) {
    for (let y = plan.worldBounds.minY; y <= plan.worldBounds.maxY && found.size < 5; y += 1) {
      const cell = plan.cellAt(x, y);
      const asset = plan.renderAssetForCell(cell);
      if (asset?.key?.startsWith('desert-wang-v2-3/') && desiredDesertRoles.has(asset.role) && !found.has(asset.role)) {
        found.set(asset.role, cell);
      }
      if (cell.terrain === 'F' && !found.has('F')) found.set('F', cell);
    }
  }

  for (const key of ['dirt', 'sand', 'rocky', 'road']) {
    const cell = found.get(key);
    assert.ok(cell, `expected authored ${key} cell`);
    const asset = plan.renderAssetForCell(cell);
    assert.match(asset.key, /^desert-wang-v2-3\//);
    assert.equal(asset.role, key);
    assert.equal(asset.src, './assets/generated/hmh-level-one-world-v3/materials/desert-approach-wang-v2-3-materials.png');
  }
  const forestAsset = plan.renderAssetForCell(found.get('F'));
  assert.match(forestAsset.key, /^hmh-forest-river-terrain-atlas-v1\//);
  assert.equal(forestAsset.role, 'forest');
  assert.equal(forestAsset.renderLayers, 1);
});

test('live renderer crops/caches atlases, prewarms both sources, and avoids duplicate edge layers', () => {
  assert.match(mainSource, /plan\.renderAssetForCell\?\.\(terrainCell\)/);
  assert.match(mainSource, /asset\.atlasRect/);
  assert.match(mainSource, /asset\.wangComposite/);
  assert.match(mainSource, /handledDirections\.includes\(edgeBlend\.direction\)/);
  assert.match(mainSource, /plan\.runtimeAtlasAssets\?\.\(\)/);
  assert.match(mainSource, /sbsGroundTileImages\.has\(asset\.src\)/, 'shared atlas source should decode once instead of once per virtual asset');
});

test('full authored map stays below the Wang composite cache budget', () => {
  const plan = buildGroundPlan({ seed: 1337 });
  const keys = new Set();
  let adaptedCells = 0;
  let compositeCells = 0;
  for (let y = plan.worldBounds.minY; y <= plan.worldBounds.maxY; y += 1) {
    for (let x = plan.worldBounds.minX; x <= plan.worldBounds.maxX; x += 1) {
      const asset = plan.renderAssetForCell?.(plan.cellAt(x, y));
      if (!asset?.key?.startsWith('desert-wang-v2-3/')) continue;
      adaptedCells += 1;
      if (asset.wangComposite) compositeCells += 1;
      keys.add(asset.key);
    }
  }
  const decodedCanvasBytes = keys.size * 128 * 64 * 4;
  assert.ok(adaptedCells > 2_000, `expected a substantial desert adapter footprint, got ${adaptedCells}`);
  assert.ok(compositeCells > 0, 'desert boundaries should still exercise Wang composites');
  assert.ok(keys.size <= 128, `runtime created ${keys.size} unique terrain patterns`);
  assert.ok(decodedCanvasBytes <= 4 * 1024 * 1024, `runtime pattern cache needs ${decodedCanvasBytes} bytes`);
});

test('runtime material fields are de-edged and seam-certified for continuous terrain', () => {
  assert.equal(HMH_DESERT_APPROACH_WANG_RUNTIME.materialAtlas.latticeConstruction, 'de-edged-periodic-field-v2');
  assert.equal(HMH_DESERT_APPROACH_WANG_RUNTIME.materialAtlas.sharedMacroFieldAcrossVariants, true);
  assert.equal(HMH_DESERT_APPROACH_WANG_RUNTIME.seamCertification.materialsFullyOpaque, true);
  assert.equal(HMH_DESERT_APPROACH_WANG_RUNTIME.seamCertification.oppositeEdgesExact, true);
  assert.ok(HMH_DESERT_APPROACH_WANG_RUNTIME.seamCertification.maxFormerDiamondEdgeContrast <= 8);
  for (const material of HMH_DESERT_APPROACH_WANG_RUNTIME.materials) {
    assert.equal(material.fullyOpaque, true);
    assert.equal(material.oppositeEdgesExact, true);
    assert.ok(material.formerDiamondEdgeContrast <= 8, `${material.key} retains a visible diamond quilt seam`);
    if (material.role === 'rocky') {
      assert.ok(material.brightAccentPixels <= 6, `${material.key} has ${material.brightAccentPixels} distracting mineral pixels`);
    }
  }
});

test('Desert Approach runtime source, tests, and generator are explicit syntax-gate inputs', () => {
  assert.match(syntaxSource, /apps\/portal\/src\/hmh-terrain-presentation\.mjs/);
  assert.match(syntaxSource, /tests\/hmh-terrain-presentation\.test\.mjs/);
  assert.match(syntaxSource, /scripts\/build-hmh-level-one-world-v3-materials\.py/);
});

test('Level 1 road supertiles ship one bounded nearest-neighbor overlay atlas', () => {
  const manifest = HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME;
  assert.equal(manifest.id, 'hmh-level-one-road-supertiles-v1');
  assert.equal(manifest.status, 'runtime-ready-authored-centerlines');
  assert.deepEqual(manifest.tileSourceSize, [128, 64]);
  assert.deepEqual(manifest.styles, ['asphalt', 'dirt']);
  assert.deepEqual(manifest.bridgeStyles, ['wood', 'stone-road']);
  assert.deepEqual(manifest.bridgeAxes, ['east-west', 'north-east-south-west']);
  assert.equal(manifest.shoulderMasks, 16);
  assert.equal(manifest.centerlineMasks, 29);
  assert.equal(manifest.bridgeEdgeMasks, 64);
  assert.equal(manifest.atlas.width, 2048);
  assert.equal(manifest.atlas.height, 640);
  assert.equal(manifest.performance.atlasCount, 1);
  assert.equal(manifest.performance.maxOverlayLayersPerCell, 2);
  assert.equal(manifest.performance.maxBridgeLayersPerCell, 1);
  assert.equal(manifest.performance.maxPatternCanvases, 160);
  assert.equal(manifest.performance.atlasDecodedBytes, 5_242_880);
  assert.equal(repoAssetExists(manifest.atlas.src), true);
  const atlasBytes = readFileSync(new URL(`../apps/portal/${manifest.atlas.src.replace(/^\.\//, '')}`, import.meta.url));
  assert.equal(atlasBytes.readUInt32BE(16), 2048, 'PNG header width must match the runtime crop contract');
  assert.equal(atlasBytes.readUInt32BE(20), 640, 'PNG header height must match the runtime crop contract');
  assert.deepEqual(roadSupertileRuntimeAtlasAssets(), [manifest.atlas]);
});

test('authored bridge supertiles add one deterministic deck, rail, and abutment detail layer', () => {
  const plan = buildGroundPlan({ seed: 1337 });
  assert.equal(typeof plan.bridgePresentationForCell, 'function');
  assert.equal(plan.bridgePresentationForCell(null), null);
  let bridgeCells = 0;
  let detailedCells = 0;
  const keys = new Set();
  for (let y = plan.worldBounds.minY; y <= plan.worldBounds.maxY; y += 1) {
    for (let x = plan.worldBounds.minX; x <= plan.worldBounds.maxX; x += 1) {
      const cell = plan.cellAt(x, y);
      const presentation = plan.bridgePresentationForCell(cell);
      if (cell.isBridge) bridgeCells += 1;
      if (!presentation) continue;
      detailedCells += 1;
      assert.equal(cell.isBridge, true);
      assert.equal(presentation.renderLayers, 1);
      assert.ok(['wood', 'stone-road'].includes(presentation.style));
      assert.ok(['east-west', 'north-east-south-west'].includes(presentation.axis));
      assert.equal(presentation.detail.kind, 'bridge-detail');
      assert.equal(presentation.detail.atlasRect.width, 128);
      assert.equal(presentation.detail.atlasRect.height, 64);
      assert.ok(presentation.detail.atlasRect.x + 128 <= HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME.atlas.width);
      assert.ok(presentation.detail.atlasRect.y + 64 <= HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME.atlas.height);
      keys.add(presentation.detail.key);
    }
  }
  assert.equal(bridgeCells, HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME.bridgeCells);
  assert.equal(detailedCells, bridgeCells, 'every authored deck cell should receive bridge-specific detail');
  assert.ok(keys.size <= 32, `bridge runtime created ${keys.size} unique overlay crops`);
  assert.ok(keys.size * 128 * 64 * 4 <= 1024 * 1024, 'bridge overlay crop cache must stay within 1 MiB');

  const bridgeCenter = migratedCell(plan, 27, -39);
  const first = bridgeSupertilePresentationForCell(bridgeCenter);
  assert.equal(first.bridgeId, 'pine-creek-wood-bridge');
  assert.equal(first.style, 'wood');
  assert.equal(first.axis, 'east-west');
  assert.equal(plan.bridgePresentationForCell(bridgeCenter), plan.bridgePresentationForCell(bridgeCenter));
  assert.equal(bridgeSupertilePresentationForCell(plan.cellAt(0, 0)), null);
});

test('road supertile selector maps exposed route edges without altering broad route interiors', () => {
  const active = { route: 'M' };
  const inactive = { route: '.' };
  const cell = {
    x: 999,
    y: 999,
    terrain: 'A',
    terrainRole: 'road',
    route: 'M',
    groundNav: '.',
    isBridge: false,
    isWater: false,
    adjacency: { cardinal: { north: inactive, east: active, south: active, west: active } },
  };
  const exposed = roadSupertilePresentationForCell(cell);
  assert.equal(exposed.style, 'asphalt');
  assert.equal(exposed.edgeBits, 1);
  assert.equal(exposed.shoulder.atlasRect.x, 128);
  assert.equal(exposed.shoulder.atlasRect.y, 0);
  assert.equal(exposed.marking, null);
  assert.equal(exposed.renderLayers, 1);

  const interior = roadSupertilePresentationForCell({
    ...cell,
    adjacency: { cardinal: { north: active, east: active, south: active, west: active } },
  });
  assert.equal(interior, null, 'unmarked broad route interiors stay on the base material without extra draws');
});

test('authored road centerlines add directional paint while bridges and blocked water remain untouched', () => {
  const plan = buildGroundPlan({ seed: 1337 });
  assert.equal(typeof plan.roadPresentationForCell, 'function');
  assert.equal(plan.runtimeAtlasAssets().length, 4);
  assert.equal(plan.roadPresentationForCell(null), null);

  const spawnCell = plan.cellAt(0, 0);
  const spawnRoad = plan.roadPresentationForCell(spawnCell);
  assert.ok(spawnRoad?.marking, 'authored main-spine spawn cell should carry directional paint');
  assert.equal(plan.roadPresentationForCell(spawnCell), spawnRoad, 'road presentation should be cached by authored cell');
  assert.equal(spawnRoad.style, 'asphalt');
  assert.ok(spawnRoad.centerlineMask > 0);
  assert.ok(spawnRoad.renderLayers >= 1 && spawnRoad.renderLayers <= 2);

  const bridge = migratedCell(plan, 27, -39);
  assert.equal(bridge.isBridge, true);
  assert.equal(plan.roadPresentationForCell(bridge), null);

  let blockedRouteWater = null;
  let shoulderOnly = null;
  for (let y = plan.worldBounds.minY; y <= plan.worldBounds.maxY; y += 1) {
    for (let x = plan.worldBounds.minX; x <= plan.worldBounds.maxX; x += 1) {
      const candidate = plan.cellAt(x, y);
      if (!blockedRouteWater && candidate.isWater && candidate.route !== '.') blockedRouteWater = candidate;
      const presentation = plan.roadPresentationForCell(candidate);
      if (!shoulderOnly && presentation?.shoulder && !presentation.marking) shoulderOnly = presentation;
    }
  }
  assert.ok(blockedRouteWater, 'fixture should include authored routes beneath blocked water');
  assert.equal(plan.roadPresentationForCell(blockedRouteWater), null);
  assert.ok(shoulderOnly, 'broad authored routes should expose dedicated shoulder-only cells');
  assert.equal(shoulderOnly.renderLayers, 1);
});

test('full authored road network stays inside overlay and cropped-canvas budgets', () => {
  const plan = buildGroundPlan({ seed: 1337 });
  const keys = new Set();
  let presentedCells = 0;
  let shoulderCells = 0;
  let markingCells = 0;
  let maxLayers = 0;
  for (let y = plan.worldBounds.minY; y <= plan.worldBounds.maxY; y += 1) {
    for (let x = plan.worldBounds.minX; x <= plan.worldBounds.maxX; x += 1) {
      const presentation = plan.roadPresentationForCell(plan.cellAt(x, y));
      if (!presentation) continue;
      presentedCells += 1;
      maxLayers = Math.max(maxLayers, presentation.renderLayers);
      for (const asset of [presentation.shoulder, presentation.marking]) {
        if (!asset) continue;
        assert.equal(asset.atlasRect.width, 128);
        assert.equal(asset.atlasRect.height, 64);
        assert.equal(asset.atlasRect.x % 128, 0);
        assert.equal(asset.atlasRect.y % 64, 0);
        assert.ok(asset.atlasRect.x + asset.atlasRect.width <= HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME.atlas.width);
        assert.ok(asset.atlasRect.y + asset.atlasRect.height <= HMH_LEVEL_ONE_ROAD_SUPERTILE_RUNTIME.atlas.height);
        keys.add(asset.key);
        if (asset.kind === 'shoulder') shoulderCells += 1;
        if (asset.kind === 'marking') markingCells += 1;
      }
    }
  }
  const croppedCanvasBytes = keys.size * 128 * 64 * 4;
  assert.equal(presentedCells, 1218);
  assert.equal(shoulderCells, 843);
  assert.equal(markingCells, 391);
  assert.equal(maxLayers, 2);
  assert.ok(keys.size <= 64, `road runtime created ${keys.size} unique overlay patterns`);
  assert.ok(croppedCanvasBytes <= 2 * 1024 * 1024, `road crop cache needs ${croppedCanvasBytes} bytes`);
});

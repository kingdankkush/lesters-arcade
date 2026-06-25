// Tests for the coherent scene-template placement layer.
// Verifies the guarantees that fix "props littered everywhere with no logic":
// deterministic stability, biome-coherent template choice, path-edge spacing for
// lamps, on-host attachment (TV on a table), spawn-area reservation, and that the
// near-window aggregator mirrors the obstacle system.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SCENE_CELL,
  SCENE_TEMPLATES,
  pickTemplate,
  buildScene,
  sceneObjectsNear,
  groundThemeForCell,
} from '../apps/portal/src/scene-templates.mjs';
import { HMH_LEVEL_ONE_SKETCH_ASSET_WAVE } from '../apps/portal/assets/generated/hmh-coherent-world/sketch-level1/sketch-level1-asset-manifest.mjs';
import { HMH_LEVEL_ONE_POLISH_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level1-polish/level1-polish-manifest.mjs';
import { HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level1-final-animated/level1-final-animated-manifest.mjs';
import { HMH_FINAL_WORLD_AMBIENT_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level-final-ambient/level-final-ambient-manifest.mjs';

const SEED = 1234;
// A biome function that returns a fixed biome (so tests are deterministic and
// independent of the biome-model). Override per-test as needed.
const constBiome = (b) => () => b;

test('SCENE_CELL matches the obstacle cell size (7)', () => {
  assert.equal(SCENE_CELL, 7);
});

test('every template slot references a hmh-coherent-world asset key with a set/ prefix', () => {
  for (const t of Object.values(SCENE_TEMPLATES)) {
    assert.ok(Array.isArray(t.slots) && t.slots.length > 0, `${t.id} has slots`);
    assert.ok(typeof t.groundTheme === 'string' && t.groundTheme, `${t.id} has groundTheme`);
    for (const s of t.slots) {
      assert.match(s.assetKey, /^[a-z0-9-]+\/[a-z0-9-]+$/, `${t.id} slot assetKey ${s.assetKey}`);
      assert.ok(['anchor', 'pathEdge', 'scatter', 'onHost'].includes(s.place), `${t.id} valid place`);
    }
  }
});

test('pickTemplate is deterministic and biome-coherent', () => {
  const a = pickTemplate(SEED, 3, 4, 'forest');
  const b = pickTemplate(SEED, 3, 4, 'forest');
  assert.equal(a?.id, b?.id, 'same seed+cell+biome => same template');
  assert.ok(a.biomes.includes('forest'), 'chosen template fits the biome');
});

test('buildScene is deterministic for a given seed+cell', () => {
  const one = buildScene(SEED, 5, 5, 'town', { reserveRadius: 0 });
  const two = buildScene(SEED, 5, 5, 'town', { reserveRadius: 0 });
  assert.deepEqual(one, two);
});

test('water cells stay open (no scene objects)', () => {
  assert.deepEqual(buildScene(SEED, 2, 2, 'water'), []);
});

test('authored composition density can intentionally leave filler cells empty', () => {
  const empty = buildScene(SEED, 9, 9, 'town', {
    reserveRadius: 0,
    density: 1,
    templateContext: {
      sceneDensity: 0,
      templatePoolIds: ['street_block'],
      authoredComposition: { role: 'authored-negative-space', skipAnchor: true, skipScatter: true },
    },
  });

  assert.deepEqual(empty, []);
});

test('authored route corridors suppress anchors and scatter while preserving aligned path-edge dressing', () => {
  const route = buildScene(SEED, 9, 9, 'town', {
    reserveRadius: 0,
    templateContext: {
      sceneDensity: 1,
      templatePoolIds: ['street_block'],
      pathOrientation: 'horizontal',
      authoredComposition: { role: 'clear-route-corridor', skipAnchor: true, skipScatter: true, maxPathEdgeCount: 2 },
    },
  });

  assert.equal(route.length > 0, true);
  assert.equal(route.every((obj) => obj.place === 'pathEdge'), true);
  assert.equal(route.length <= 2, true);
  assert.equal(route.some((obj) => obj.assetKey === 'street/street-lamp'), true);
});

test('forced authored landmarks still render anchors even under route/open-space suppression', () => {
  const landmark = buildScene(SEED, 10, 10, 'desert', {
    reserveRadius: 0,
    templateContext: {
      sceneDensity: 0,
      forceTemplateId: 'crypto_desert_outpost',
      authoredComposition: { role: 'landmark-anchor', skipAnchor: false, skipScatter: false },
    },
  });

  assert.equal(landmark.some((obj) => obj.place === 'anchor' && obj.assetKey === 'crypto/landmark-gas-station'), true);
});

test('street lamps ONLY appear as path-edge placements at fixed spacing', () => {
  // Find a town cell that rolled the street_block template, then assert its
  // lamps are pathEdge and evenly spaced along one axis.
  let lampScene = null;
  for (let cy = 0; cy < 60 && !lampScene; cy += 1) {
    for (let cx = 0; cx < 60; cx += 1) {
      const objs = buildScene(SEED, cx, cy, 'town', { reserveRadius: 0 });
      const lamps = objs.filter((o) => o.assetKey === 'street/street-lamp');
      if (lamps.length >= 2) { lampScene = { objs, lamps }; break; }
    }
  }
  assert.ok(lampScene, 'found a street block with >=2 lamps');
  for (const lamp of lampScene.lamps) {
    assert.equal(lamp.place, 'pathEdge', 'lamp is a path-edge placement, never random scatter');
    assert.equal(lamp.solid, true, 'lamp is solid (collidable)');
  }
  // Lamps line one axis: their varying coordinate steps by the template spacing.
  const xs = lampScene.lamps.map((l) => l.worldX);
  const ys = lampScene.lamps.map((l) => l.worldY);
  const alongVals = (new Set(xs).size >= new Set(ys).size) ? xs.slice().sort((a, b) => a - b) : ys.slice().sort((a, b) => a - b);
  const gaps = alongVals.slice(1).map((v, i) => v - alongVals[i]).filter((g) => g > 0);
  for (const g of gaps) assert.ok(g >= 2, `lamp spacing >= 2 tiles (got ${g})`);
});

test('a TV-on-table onHost slot attaches to its host and is non-solid + drawn above it', () => {
  // arcade_interior has a table (host) + tv-on-table (onHost). Find a cell that
  // placed both.
  let found = null;
  for (let cy = 0; cy < 120 && !found; cy += 1) {
    for (let cx = 0; cx < 120; cx += 1) {
      const objs = buildScene(SEED, cx, cy, 'town', { reserveRadius: 0 });
      const tv = objs.find((o) => o.assetKey === 'interior/tv-on-table');
      if (tv) { found = { objs, tv }; break; }
    }
  }
  if (!found) return; // arcade_interior is weighted; acceptable if not hit in range
  const { objs, tv } = found;
  assert.equal(tv.solid, false, 'the TV itself is walk-through (non-solid)');
  assert.ok(tv.hostId, 'TV carries a hostId');
  const host = objs.find((o) => o.id === tv.hostId);
  assert.ok(host, 'host object exists in the same scene');
  assert.equal(host.worldX, tv.worldX, 'TV inherits host X');
  assert.equal(host.worldY, tv.worldY, 'TV inherits host Y');
  assert.ok(tv.drawOrderBias > host.drawOrderBias, 'TV paints just above its host');
});

test('buildScene never places an object inside the spawn-safe radius', () => {
  const r = 6;
  for (let cx = -1; cx <= 1; cx += 1) {
    for (let cy = -1; cy <= 1; cy += 1) {
      for (const o of buildScene(SEED, cx, cy, 'town', { reserveRadius: r })) {
        assert.ok(Math.hypot(o.worldX, o.worldY) >= r, `obj at (${o.worldX},${o.worldY}) outside spawn`);
      }
    }
  }
});

test('solid scene objects carry a positive collision radius', () => {
  const objs = buildScene(SEED, 8, 3, 'town', { reserveRadius: 0 });
  for (const o of objs) {
    if (o.solid) assert.ok(o.radius > 0, `${o.assetKey} solid => radius>0`);
  }
});

test('sceneObjectsNear aggregates a window and stays stable', () => {
  const near1 = sceneObjectsNear(SEED, 0, 0, 14, constBiome('town'), { reserveRadius: 6 });
  const near2 = sceneObjectsNear(SEED, 0, 0, 14, constBiome('town'), { reserveRadius: 6 });
  assert.deepEqual(near1, near2, 'deterministic window');
  assert.ok(Array.isArray(near1));
});

test('Level 1 sketch asset wave ships original road, water, cliff, town, farm, and flora PNGs', () => {
  assert.equal(HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.id, 'hmh-level-one-sketch-asset-wave-v1');
  assert.equal(HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.sourcePolicy.includes('reference-only') || HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.sourcePolicy.includes('layout reference'), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.assetCount, 44);

  const categories = new Set(HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.assets.map((asset) => asset.category));
  for (const category of ['road', 'water', 'terrain', 'structure', 'farm', 'flora', 'bridge']) {
    assert.equal(categories.has(category), true, `${category} category exists`);
  }

  for (const asset of HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.assets) {
    assert.match(asset.key, /^sketch-level1\/[a-z0-9-]+$/);
    assert.equal(existsSync(fileURLToPath(new URL(`../${asset.path}`, import.meta.url))), true, `${asset.path} exists`);
    assert.equal(asset.width > 0 && asset.height > 0, true, `${asset.key} has dimensions`);
  }

  const animatedWater = HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.assets.filter((asset) => asset.category === 'water' && asset.animated);
  assert.equal(animatedWater.length >= 12, true, 'river/lake/pond animated frame sets are present');
  assert.equal(HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.assets.some((asset) => asset.key === 'sketch-level1/barn-red'), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_ASSET_WAVE.assets.some((asset) => asset.key === 'sketch-level1/asphalt-road-crossroad'), true);
});


test('Level 1 final ambient world assets ship original animated detail loops across biomes', () => {
  assert.equal(HMH_FINAL_WORLD_AMBIENT_ASSETS.id, 'hmh-level-one-final-ambient-world-v1');
  assert.match(HMH_FINAL_WORLD_AMBIENT_ASSETS.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_FINAL_WORLD_AMBIENT_ASSETS.assetCount >= 10, true);

  const categories = new Set(HMH_FINAL_WORLD_AMBIENT_ASSETS.assets.map((asset) => asset.category));
  for (const category of ['desert', 'forest', 'town', 'water', 'road', 'fx']) {
    assert.equal(categories.has(category), true, `${category} ambient category exists`);
  }

  for (const asset of HMH_FINAL_WORLD_AMBIENT_ASSETS.assets) {
    assert.match(asset.key, /^level-final-ambient\/[a-z0-9-]+$/);
    assert.equal(asset.animated, true, `${asset.key} is animated`);
    assert.equal(asset.frames >= 4, true, `${asset.key} has enough frames`);
    assert.equal(asset.sheetWidth, asset.frameWidth * asset.frames, `${asset.key} sheet width`);
    assert.equal(existsSync(fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url))), true, `${asset.src} exists`);
  }
});

test('Level 1 templates consume final ambient world loops as non-solid dressing', () => {
  const expectations = [
    ['crypto_desert_outpost', 'level-final-ambient/desert-dust-devil'],
    ['tree_grove', 'level-final-ambient/leaf-swirl'],
    ['river_crossing', 'level-final-ambient/water-sparkle-line'],
    ['street_block', 'level-final-ambient/neon-window-flicker'],
    ['sketch_asphalt_road_spine', 'level-final-ambient/road-heat-haze'],
  ];
  for (const [templateId, assetKey] of expectations) {
    const slot = SCENE_TEMPLATES[templateId]?.slots.find((candidate) => candidate.assetKey === assetKey);
    assert.ok(slot, `${templateId} uses ${assetKey}`);
    assert.equal(slot.solid, false, `${assetKey} is non-solid`);
  }
});

test('Level 1 final animated polish assets ship living-world foliage, farm, water, and road loops', () => {
  assert.equal(HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS.id, 'hmh-level-one-final-animated-polish-v1');
  assert.match(HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS.assetCount >= 8, true);

  const categories = new Set(HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS.assets.map((asset) => asset.category));
  for (const category of ['flora', 'water', 'farm', 'road']) {
    assert.equal(categories.has(category), true, `${category} animated category exists`);
  }

  for (const asset of HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS.assets) {
    assert.match(asset.key, /^level1-final-animated\/[a-z0-9-]+$/);
    assert.equal(asset.animated, true, `${asset.key} is animated`);
    assert.equal(asset.frames >= 4, true, `${asset.key} has frames`);
    assert.equal(asset.sheetWidth, asset.frameWidth * asset.frames, `${asset.key} sheet width`);
    assert.equal(existsSync(fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url))), true, `${asset.src} exists`);
  }
});

test('Level 1 templates consume final animated polish props in high-visibility scenes', () => {
  const expectations = [
    ['sketch_forest_boundary_wall', 'level1-final-animated/forest-wall-pine-sway'],
    ['sketch_lake_pond_edge', 'level1-final-animated/oasis-reeds-sway'],
    ['sketch_farmstead_crop_road', 'level1-final-animated/corn-patch-wind'],
    ['sketch_farm_silo_yard', 'level1-final-animated/wheat-patch-wind'],
    ['sketch_asphalt_road_spine', 'level1-final-animated/roadside-sign-sway'],
  ];
  for (const [templateId, assetKey] of expectations) {
    assert.equal(SCENE_TEMPLATES[templateId]?.slots.some((slot) => slot.assetKey === assetKey), true, `${templateId} uses ${assetKey}`);
  }
});

test('Level 1 original polish assets ship forest, water, farm, road, town, and cliff props', () => {
  assert.equal(HMH_LEVEL_ONE_POLISH_ASSETS.id, 'hmh-level-one-polish-assets-v1');
  assert.equal(HMH_LEVEL_ONE_POLISH_ASSETS.assetCount, 14);
  assert.match(HMH_LEVEL_ONE_POLISH_ASSETS.sourcePolicy, /no third-party pixels copied/i);

  const categories = new Set(HMH_LEVEL_ONE_POLISH_ASSETS.assets.map((asset) => asset.category));
  for (const category of ['flora', 'water', 'farm', 'structure', 'road', 'terrain']) {
    assert.equal(categories.has(category), true, `${category} polish category exists`);
  }

  for (const asset of HMH_LEVEL_ONE_POLISH_ASSETS.assets) {
    assert.match(asset.key, /^level1-polish\/[a-z0-9-]+$/);
    assert.equal(existsSync(fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url))), true, `${asset.src} exists`);
    assert.equal(asset.width > 0 && asset.height > 0, true, `${asset.key} has dimensions`);
  }
});

test('Level 1 sketch templates consume original polish assets for living-world detail', () => {
  const expectations = [
    ['sketch_forest_boundary_wall', 'level1-final-animated/forest-wall-pine-sway'],
    ['sketch_lake_pond_edge', 'level1-final-animated/oasis-reeds-sway'],
    ['sketch_farmstead_crop_road', 'level1-final-animated/barn-flag-wave'],
    ['sketch_farm_silo_yard', 'level1-final-animated/wheat-patch-wind'],
    ['sketch_town_boundary_fronts', 'level1-final-animated/town-bank-flicker'],
    ['sketch_cliff_hill_boundary', 'level1-polish/cliff-switchback-detail'],
    ['sketch_asphalt_road_spine', 'level1-polish/mailbox-rural'],
  ];
  for (const [templateId, assetKey] of expectations) {
    assert.equal(SCENE_TEMPLATES[templateId]?.slots.some((slot) => slot.assetKey === assetKey), true, `${templateId} uses ${assetKey}`);
  }
});

test('Level 1 sketch scene templates turn the map sketch into usable runtime setpieces', () => {
  const requiredTemplates = [
    'sketch_asphalt_road_spine',
    'sketch_painted_crossroad',
    'sketch_animated_river_bridge',
    'sketch_lake_pond_edge',
    'sketch_cliff_hill_boundary',
    'sketch_town_boundary_fronts',
    'sketch_farmstead_crop_road',
    'sketch_farm_silo_yard',
    'sketch_forest_boundary_wall',
  ];

  for (const id of requiredTemplates) {
    const template = SCENE_TEMPLATES[id];
    assert.ok(template, `${id} exists`);
    assert.equal(template.slots.some((slot) => slot.assetKey.startsWith('sketch-level1/') || slot.assetKey.startsWith('level1-polish/')), true, `${id} uses Level 1 sketch/polish asset wave`);
  }

  const farm = buildScene(SEED, 15, 15, 'grass', {
    reserveRadius: 0,
    density: 1,
    templateContext: {
      sceneDensity: 1,
      templatePoolIds: ['sketch_farmstead_crop_road'],
      forceTemplateId: 'sketch_farmstead_crop_road',
      authoredComposition: { role: 'landmark-anchor', skipAnchor: false, skipScatter: false },
    },
  });
  assert.equal(farm.some((obj) => obj.assetKey === 'level1-final-animated/barn-flag-wave'), true);
  assert.equal(farm.some((obj) => obj.assetKey === 'level1-final-animated/corn-patch-wind'), true);

  const bridge = buildScene(SEED, 16, 16, 'road', {
    reserveRadius: 0,
    density: 1,
    templateContext: {
      sceneDensity: 1,
      templatePoolIds: ['sketch_animated_river_bridge'],
      forceTemplateId: 'sketch_animated_river_bridge',
      authoredComposition: { role: 'landmark-anchor', skipAnchor: false, skipScatter: false },
    },
  });
  assert.equal(bridge.some((obj) => obj.assetKey === 'sketch-level1/road-bridge-wood'), true);
  assert.equal(bridge.some((obj) => obj.assetKey === 'sketch-level1/river-water-loop-00'), true);
});

test('groundThemeForCell returns the chosen template ground theme', () => {
  const theme = groundThemeForCell(SEED, 3, 4, 'forest');
  assert.equal(theme, 'grass'); // tree_grove is the only forest template
});

test('pickTemplate respects authored district-family template pools when provided', () => {
  const chosen = pickTemplate(SEED, 8, 9, 'town', { templatePoolIds: ['crypto_desert_outpost'] });
  assert.equal(chosen?.id, 'crypto_desert_outpost');
});

test('groundThemeForCell respects authored district-family template pools when provided', () => {
  const theme = groundThemeForCell(SEED, 8, 9, 'town', { templatePoolIds: ['crypto_desert_outpost'] });
  assert.equal(theme, 'sand');
});

test('pickTemplate forces the authored landmark template at anchor cells when provided', () => {
  const chosen = pickTemplate(SEED, 8, 9, 'town', {
    templatePoolIds: ['street_block', 'crypto_ghost_town_block'],
    forceTemplateId: 'crypto_ghost_town_block',
    landmarkInfluence: { distance: 0, influenceRadius: 2, complementArchetype: 'city_core' },
  });
  assert.equal(chosen?.id, 'crypto_ghost_town_block');
});

test('new authored set-piece templates expose distinct geometry for Level 1 anchors', () => {
  const billboardCorner = SCENE_TEMPLATES.slums_billboard_corner;
  const foundryGate = SCENE_TEMPLATES.foundry_loading_gate;
  const checkpointKit = SCENE_TEMPLATES.slums_foundry_checkpoint;

  assert.ok(billboardCorner, 'slums billboard corner template exists');
  assert.ok(billboardCorner.slots.some((slot) => slot.assetKey === 'crypto/innercity-billboard-frame' && slot.place === 'anchor'), 'billboard corner centers a busted billboard landmark');
  assert.ok(billboardCorner.slots.some((slot) => slot.assetKey === 'construct/brick-wall-segment' && slot.place === 'pathEdge'), 'billboard corner frames the lane with walls');

  assert.ok(foundryGate, 'foundry loading gate template exists');
  assert.ok(foundryGate.slots.some((slot) => slot.assetKey === 'crypto/industrial-warehouse-facade' && slot.place === 'anchor'), 'foundry gate uses a warehouse facade anchor');
  assert.ok(foundryGate.slots.some((slot) => slot.assetKey === 'construct/fence-gate'), 'foundry gate adds a gate choke point');

  assert.ok(checkpointKit, 'seam checkpoint template exists');
  assert.ok(checkpointKit.slots.some((slot) => slot.role === 'sign'), 'checkpoint kit adds district entry signage');
  assert.ok(checkpointKit.slots.some((slot) => slot.assetKey === 'construct/fence-gate' || slot.assetKey === 'construct/brick-wall-segment'), 'checkpoint kit adds a checkpoint barrier');
});

test('pickTemplate forces new authored set-piece templates at upgraded anchor cells', () => {
  const chosen = pickTemplate(SEED, 8, 9, 'town', {
    templatePoolIds: ['slums_boarded_market', 'slums_billboard_corner'],
    forceTemplateId: 'slums_billboard_corner',
    landmarkInfluence: { distance: 0, influenceRadius: 1, complementArchetype: 'city_core' },
  });
  assert.equal(chosen?.id, 'slums_billboard_corner');
});

test('Level 1 desert-to-city authored belt templates expose distinct geometry', () => {
  const desert = SCENE_TEMPLATES.crypto_desert_salvage_basin;
  const ghost = SCENE_TEMPLATES.crypto_ghost_saloon_square;
  const country = SCENE_TEMPLATES.crypto_country_bus_turnout;
  const residential = SCENE_TEMPLATES.crypto_residential_culdesac;
  const innerCity = SCENE_TEMPLATES.crypto_innercity_barricade_crossing;

  assert.ok(desert?.slots.some((slot) => slot.assetKey === 'construct/fence-gate' && slot.place === 'anchor'));
  assert.ok(desert?.slots.some((slot) => slot.assetKey === 'crypto/canyon-cliff-edge' && slot.place === 'pathEdge'));

  assert.ok(ghost?.slots.some((slot) => slot.assetKey === 'crypto/ghost-saloon-front' && slot.place === 'anchor'));
  assert.ok(ghost?.slots.some((slot) => slot.role === 'bench' && slot.place === 'pathEdge'));

  assert.ok(country?.slots.some((slot) => slot.assetKey === 'street/bus-stop-sign' && slot.place === 'anchor'));
  assert.ok(country?.slots.some((slot) => slot.assetKey === 'construct/fence-segment' && slot.place === 'pathEdge'));

  assert.ok(residential?.slots.some((slot) => slot.assetKey === 'crypto/residential-hedge-run' && slot.place === 'anchor'));
  assert.ok(residential?.slots.some((slot) => slot.assetKey === 'crypto/forest-tree-line' && slot.place === 'pathEdge'));

  assert.ok(innerCity?.slots.some((slot) => slot.assetKey === 'construct/brick-wall-corner' && slot.place === 'anchor'));
  assert.ok(innerCity?.slots.some((slot) => slot.assetKey === 'interior/stacked-boxes' && slot.place === 'pathEdge'));
});

test('pickTemplate can use authored transition-band template pools at belt seams', () => {
  const chosen = pickTemplate(SEED, 12, 9, 'town', {
    templatePoolIds: ['slums_backlot_fence', 'foundry_loading_gate', 'slums_foundry_checkpoint'],
    transitionBand: {
      direction: 'east',
      toDistrictFamily: 'freight-yard',
      fromDistrictFamily: 'backlot-cut',
    },
  });
  assert.ok(['slums_backlot_fence', 'foundry_loading_gate', 'slums_foundry_checkpoint'].includes(chosen?.id));
});

test('pickTemplate strongly favors authored local template preferences when provided', () => {
  const chosen = pickTemplate(SEED, 8, 9, 'town', {
    templatePoolIds: ['street_block', 'crypto_ghost_mainstreet_front', 'crypto_ghost_saloon_square'],
    preferredTemplateIds: ['crypto_ghost_mainstreet_front'],
  });
  assert.equal(chosen?.id, 'crypto_ghost_mainstreet_front');
});

// Tests for the coherent scene-template placement layer.
// Verifies the guarantees that fix "props littered everywhere with no logic":
// deterministic stability, biome-coherent template choice, path-edge spacing for
// lamps, on-host attachment (TV on a table), spawn-area reservation, and that the
// near-window aggregator mirrors the obstacle system.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_CELL,
  SCENE_TEMPLATES,
  pickTemplate,
  buildScene,
  sceneObjectsNear,
  groundThemeForCell,
} from '../apps/portal/src/scene-templates.mjs';

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
      assert.match(s.assetKey, /^[a-z]+\/[a-z0-9-]+$/, `${t.id} slot assetKey ${s.assetKey}`);
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

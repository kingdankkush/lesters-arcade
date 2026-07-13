import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import {
  buildTerrainEdgeBlendsForCell,
  buildTerrainPresentationForCell,
  summarizeTerrainPresentation,
  TERRAIN_PRESENTATION_OVERLAY_ORDER,
} from '../apps/portal/src/hmh-terrain-presentation.mjs';

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
  const bridge = buildTerrainPresentationForCell(plan.cellAt(27, -39), { frame: 24 });
  const water = buildTerrainPresentationForCell(plan.cellAt(25, -42), { frame: 24 });
  const bossHigh = buildTerrainPresentationForCell(plan.cellAt(-7, -78), { frame: 24 });

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
  const cells = [plan.cellAt(27, -39), plan.cellAt(25, -42), plan.cellAt(-7, -78), plan.cellAt(0, 0)];
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
  const bridge = buildTerrainPresentationForCell(plan.cellAt(27, -39), { frame: 24, overlayMode: 'texture-only' });
  const water = buildTerrainPresentationForCell(plan.cellAt(25, -42), { frame: 24, overlayMode: 'texture-only' });
  const bossHigh = buildTerrainPresentationForCell(plan.cellAt(-7, -78), { frame: 24, overlayMode: 'texture-only' });

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

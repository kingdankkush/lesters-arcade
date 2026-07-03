import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import {
  buildTerrainBlobCell,
  buildTerrainRenderingCapabilityReport,
} from '../apps/portal/src/hmh-terrain-blob-map.mjs';

test('terrain blob cell derives 47-blob masks and bridge/water metadata from the authored ground plan', () => {
  const plan = buildGroundPlan({ seed: 47 });
  const bridge = buildTerrainBlobCell(plan, 61, 5);
  const water = buildTerrainBlobCell(plan, 61, 7);

  assert.equal(bridge.zoneId, 'river-bridge-planks');
  assert.equal(bridge.role, 'road');
  assert.equal(bridge.isBridge, true);
  assert.equal(bridge.adjacency.cardinal.north.role, 'shore');
  assert.equal(bridge.blob.variantIndex >= 0 && bridge.blob.variantIndex < 47, true);
  assert.equal(bridge.renderLayers.includes('bridge-deck'), true);
  assert.equal(bridge.vfx.includes('bridge-shadow'), true);

  assert.equal(water.role, 'water');
  assert.equal(water.isWater, true);
  assert.equal(water.adjacency.cardinal.north.zoneId, 'river-bridge-planks');
  assert.equal(water.renderLayers.includes('water-ripple'), true);
  assert.equal(water.vfx.includes('shoreline-foam'), true);
});

test('terrain capability report covers EPIC 4-6 features without legacy terrain fallbacks', () => {
  const report = buildTerrainRenderingCapabilityReport(buildGroundPlan({ seed: 47 }));

  assert.equal(report.policy.legacyTerrainFallbacksAllowed, false);
  assert.deepEqual(report.policy.disallowedFallbacks, ['generic-biome-random-tile', 'per-tile-sbs-fallback', 'rectangle-ground-fill', 'random-scatter-road']);
  for (const gate of ['47-blob-terrain', 'roads', 'water', 'bridges', 'elevation', 'shadows', 'vfx']) {
    assert.equal(report.gates.some((entry) => entry.id === gate && entry.status === 'pass'), true, `${gate} gate should pass`);
  }
  assert.equal(report.summary.sampledCells > 0, true);
  assert.equal(report.summary.bridgeCells > 0, true);
  assert.equal(report.summary.waterCells > 0, true);
  assert.equal(report.summary.elevationBands.includes('low'), true);
  assert.equal(report.summary.elevationBands.includes('high'), true);
});

test('terrain blob-map module and test are covered by the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-terrain-blob-map\.mjs/);
  assert.match(syntax, /tests\/hmh-terrain-blob-map\.test\.mjs/);
});

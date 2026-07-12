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
  const bridge = buildTerrainBlobCell(plan, 27, -39);
  const water = buildTerrainBlobCell(plan, 25, -42);

  assert.equal(bridge.zoneId, 'world-v3-wood-bridge-bridge');
  assert.equal(bridge.role, 'bridge');
  assert.equal(bridge.isBridge, true);
  assert.equal(bridge.adjacency.cardinal.north.role, 'bridge');
  assert.equal(bridge.blob.variantIndex >= 0 && bridge.blob.variantIndex < 47, true);
  assert.equal(bridge.renderLayers.includes('bridge-deck'), true);
  assert.equal(bridge.vfx.includes('bridge-shadow'), true);

  assert.equal(water.role, 'water');
  assert.equal(water.isWater, true);
  assert.equal(water.adjacency.cardinal.south.zoneId, 'world-v3-wood-bridge-bridge');
  assert.equal(water.renderLayers.includes('water-ripple'), true);
  assert.equal(water.vfx.includes('shoreline-foam'), true);
});

test('ground plan serves immutable terrain blob cells from a per-run cache', () => {
  const plan = buildGroundPlan({ seed: 61 });
  assert.equal(typeof plan.cellAt, 'function');
  assert.equal(typeof plan.terrainCellCacheStats, 'function');

  const first = plan.cellAt(27, -39);
  const second = plan.cellAt(27, -39);
  const fractional = plan.cellAt(27.2, -39.2);

  assert.equal(first, second, 'same tile should return the exact cached object');
  assert.equal(first, fractional, 'rounded equivalent tile should return the exact cached object');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.isBridge, true);
  assert.deepEqual(plan.terrainCellCacheStats(), { size: 1, hits: 2, misses: 1 });
});

test('ground plan exposes the deterministic Level 1 texture set for loading prewarm', () => {
  const plan = buildGroundPlan({ seed: 62 });
  assert.equal(typeof plan.textureKeys, 'function');
  const textureKeys = plan.textureKeys();
  assert.equal(Object.isFrozen(textureKeys), true);
  assert.equal(textureKeys.length > 1, true);
  assert.equal(textureKeys.every((key) => typeof key === 'string' && key.length > 0), true);
  assert.equal(new Set(textureKeys).size, textureKeys.length, 'texture keys should be unique');
  assert.equal(textureKeys.some((key) => plan.textureForKey(key)?.src), true, 'texture keys should resolve to image assets');
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

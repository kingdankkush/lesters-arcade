import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import {
  BLOCKER_PRODUCTION_KITS,
  DISTRICT_PRODUCTION_MATERIALS,
  INTERACTION_PRODUCTION_KITS,
  LANDMARK_PRODUCTION_KITS,
  WORLD_PRODUCTION_ART,
  resolveWorldParticleField,
  resolveWorldShaderState,
  resolveWorldSurfaceBase,
} from '../apps/hmh-reboot/src/world-production-art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const DISTRICT_IDS = Object.freeze([
  'frontier-relay',
  'rugpull-ravine',
  'liquidity-crossing',
  'hashwood',
  'mining-camp',
  'liquidation-yard',
]);
const LANDMARK_KINDS = Object.freeze(['signal-tower', 'forked-cliff', 'bridge', 'beacon-tree', 'headframe', 'extraction-tower']);
const BLOCKER_KINDS = Object.freeze(['fence', 'cliff', 'bridge-rail', 'dense-trees', 'machinery', 'building', 'containers']);

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
}

test('six districts have frozen production terrain materials and visual motifs', () => {
  assert.deepEqual(Object.keys(DISTRICT_PRODUCTION_MATERIALS).sort(), [...DISTRICT_IDS].sort());
  for (const id of DISTRICT_IDS) {
    const kit = DISTRICT_PRODUCTION_MATERIALS[id];
    assert.equal(kit.classification, 'production-art');
    assert.equal(kit.runtimeAuthority, 'projection-only');
    assert.ok(Number.isInteger(kit.groundColor));
    assert.ok(Number.isInteger(kit.detailColor));
    assert.ok(kit.motif.length > 2);
    assert.ok(kit.materialLayers.length >= 3);
    assertFrozen(kit);
  }
});

test('blockers and landmarks map every authored visual kind to readable production art', () => {
  assert.deepEqual(Object.keys(BLOCKER_PRODUCTION_KITS).sort(), [...BLOCKER_KINDS].sort());
  assert.deepEqual(Object.keys(LANDMARK_PRODUCTION_KITS).sort(), [...LANDMARK_KINDS].sort());
  for (const blocker of LEVEL_ONE_WORLD.blockers) assert.ok(BLOCKER_PRODUCTION_KITS[blocker.visualKind], blocker.visualKind);
  for (const landmark of LEVEL_ONE_WORLD.landmarks) assert.ok(LANDMARK_PRODUCTION_KITS[landmark.visualKind], landmark.visualKind);
  for (const kit of Object.values(BLOCKER_PRODUCTION_KITS)) {
    assert.equal(kit.runtimeAuthority, 'projection-only');
    assert.ok(kit.identityCues.length >= 2);
  }
  for (const kit of Object.values(LANDMARK_PRODUCTION_KITS)) {
    assert.equal(kit.runtimeAuthority, 'projection-only');
    assert.ok(kit.identityCues.length >= 3);
  }
});

test('interaction production kits cover every POI hook and hazard kind', () => {
  const keys = new Set(Object.keys(INTERACTION_PRODUCTION_KITS));
  for (const poi of LEVEL_ONE_WORLD.pointsOfInterest) assert.ok(keys.has(poi.hook), poi.hook);
  for (const hazard of LEVEL_ONE_WORLD.interactions.hazards) assert.ok(keys.has(hazard.kind), hazard.kind);
  for (const kit of Object.values(INTERACTION_PRODUCTION_KITS)) {
    assert.equal(kit.runtimeAuthority, 'projection-only');
    assert.ok(kit.icon.length > 0);
  }
});

test('particles and shader states are deterministic, bounded, and tick-driven only', () => {
  for (const tick of [0, 1, 59, 60, 600]) {
    const first = resolveWorldShaderState({ tick, districtId: 'liquidity-crossing' });
    const second = resolveWorldShaderState({ tick, districtId: 'liquidity-crossing' });
    assert.deepEqual(first, second);
    assert.ok(first.waterShimmer >= 0 && first.waterShimmer <= 1);
    assert.ok(first.hazardPulse >= 0 && first.hazardPulse <= 1);
    assert.ok(first.beaconGlow >= 0 && first.beaconGlow <= 1);
    assertFrozen(first);
  }
  const field = resolveWorldParticleField({ id: 'hashwood-spore-bed', x: 7500, y: 3500, tick: 120, count: 12, radius: 52 });
  assert.equal(field.length, 12);
  assert.deepEqual(field, resolveWorldParticleField({ id: 'hashwood-spore-bed', x: 7500, y: 3500, tick: 120, count: 12, radius: 52 }));
  assert.ok(field.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.alpha >= 0 && point.alpha <= 1));
  assert.throws(() => resolveWorldParticleField({ id: '', x: 0, y: 0, tick: 0, count: 1, radius: 1 }), /id/);
  assert.throws(() => resolveWorldParticleField({ id: 'x', x: 0, y: 0, tick: 0, count: 65, radius: 1 }), /count/);
});

test('water base fully occludes route marks while raised surfaces retain authored district material', () => {
  const water = resolveWorldSurfaceBase({ kind: 'water', districtId: 'liquidity-crossing' });
  const shallows = resolveWorldSurfaceBase({ kind: 'shallow-water', districtId: 'liquidity-crossing' });
  const ledge = resolveWorldSurfaceBase({ kind: 'ledge', districtId: 'rugpull-ravine' });

  assert.deepEqual(water, {
    color: 0x126d91,
    alpha: 1,
    strokeColor: 0x84e8ff,
    isWater: true,
    isRaised: false,
  });
  assert.deepEqual(shallows, { ...water, color: 0x20a3b8 });
  assert.equal(ledge.alpha, 1);
  assert.equal(ledge.isWater, false);
  assert.equal(ledge.isRaised, true);
  assertFrozen(water);
  assertFrozen(ledge);
  assert.throws(() => resolveWorldSurfaceBase({ kind: '', districtId: 'liquidity-crossing' }), /kind/);
  assert.throws(() => resolveWorldSurfaceBase({ kind: 'water', districtId: 'missing' }), /districtId/);
});

test('world art contract is production, layered, and never gains gameplay authority', () => {
  assert.equal(WORLD_PRODUCTION_ART.classification, 'production-art');
  assert.equal(WORLD_PRODUCTION_ART.runtimeAuthority, 'projection-only');
  // `vignette` is a dedicated normal-blended layer above the additive
  // lighting pass; drawing the edge darkening into `lighting` lightened it.
  assert.deepEqual(WORLD_PRODUCTION_ART.layers, ['terrain', 'groundDetails', 'routes', 'surfaces', 'details', 'blockers', 'landmarks', 'interactions', 'particles', 'lighting', 'vignette']);
  assert.deepEqual(WORLD_PRODUCTION_ART.shaderIds, ['water-shimmer-v1', 'hazard-pulse-v1', 'beacon-glow-v1', 'edge-vignette-v1']);
  const source = read('apps/hmh-reboot/src/main.mjs');
  assert.match(source, /createWorldProductionLayers/);
  assert.match(source, /renderWorldProductionArt/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.worldArt = 'production-vector-world-v1'/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.worldShader/);
  assert.doesNotMatch(source, /worldProduction(?:Layers)?\.(?:collision|damage|health|spawn|score|wallet|settlement|bridge|persistence)\s*=/);

  const worldSource = read('apps/hmh-reboot/src/world-production-art.mjs');
  assert.match(worldSource, /const details = layers\.groundDetails;/);
  assert.match(worldSource, /layers\.details\.roundRect\(center\.x-s/);
  // Cycle 046 regression guard: circle blockers project from the canonical
  // x/y fields. The old `shape.center` read produced NaN anchors that
  // silently culled every circle blocker from the render.
  assert.match(worldSource, /shape\.type === 'circle' \? \[\{ x: shape\.x, y: shape\.y \}\]/);
  assert.doesNotMatch(worldSource, /\[shape\.center\]/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildElevationDebugContours,
  createAuthoredGroundQuery,
  createElevationSurface,
  filterLegalTraversalNeighbors,
  movementSpeedMultiplierForTransition,
  projectileHeightBand,
  resolveHeightAdvantage,
  resolveSweptTraversalPath,
  resolveTraversalTransition,
  traceHeightAwareLineOfSight,
} from '../apps/hmh-reboot/src/elevation.mjs';

const base = createElevationSurface({
  id: 'base',
  kind: 'ground',
  area: { type: 'rect', minX: 0, minY: 0, maxX: 400, maxY: 300 },
  groundZ: 0,
  visibleTerrainId: 'graybox-ground',
});

const ramp = createElevationSurface({
  id: 'east-ramp',
  kind: 'ramp',
  area: { type: 'rect', minX: 100, minY: 80, maxX: 200, maxY: 140 },
  fromZ: 0,
  toZ: 48,
  axis: 'x',
  visibleTerrainId: 'graybox-ramp',
  priority: 2,
});

const upper = createElevationSurface({
  id: 'upper-deck',
  kind: 'ground',
  area: { type: 'rect', minX: 200, minY: 40, maxX: 300, maxY: 180 },
  groundZ: 48,
  visibleTerrainId: 'graybox-upper-deck',
  priority: 1,
});

test('authored ramp interpolation returns continuous height and a truthful normal', () => {
  const query = createAuthoredGroundQuery({ baseSurface: base, surfaces: [upper, ramp] });
  const start = query(100, 100);
  const middle = query(150, 100);
  const end = query(200, 100);
  assert.equal(start.groundZ, 0);
  assert.equal(middle.groundZ, 24);
  assert.equal(end.groundZ, 48);
  assert.equal(middle.surfaceId, 'east-ramp');
  assert.ok(middle.normal.x < 0 && middle.normal.z > 0);
  assert.equal(middle.ascentAllowed, true);
});

test('bridge deck overrides deep water while adjacent water remains blocked', () => {
  const water = createElevationSurface({
    id: 'river', kind: 'water', area: { type: 'rect', minX: 40, minY: 180, maxX: 360, maxY: 260 },
    groundZ: -20, waterLevel: 4, deepWater: true, visibleTerrainId: 'graybox-river', priority: 1,
  });
  const bridge = createElevationSurface({
    id: 'river-bridge', kind: 'bridge', area: { type: 'rect', minX: 180, minY: 170, maxX: 220, maxY: 270 },
    groundZ: 20, visibleTerrainId: 'graybox-bridge', priority: 3,
  });
  const query = createAuthoredGroundQuery({ baseSurface: base, surfaces: [water, bridge] });
  assert.equal(query(100, 220).walkable, false);
  assert.equal(query(100, 220).waterLevel, 4);
  assert.deepEqual({ kind: query(200, 220).kind, z: query(200, 220).groundZ, walkable: query(200, 220).walkable }, { kind: 'bridge', z: 20, walkable: true });
});

test('swept traversal cannot skip narrow deep water and accepts the authored bridge path', () => {
  const water = createElevationSurface({
    id: 'narrow-river', kind: 'water', area: { type: 'rect', minX: 40, minY: 0, maxX: 60, maxY: 100 },
    groundZ: -12, waterLevel: 2, deepWater: true, visibleTerrainId: 'narrow-river-art', priority: 1,
  });
  const bridge = createElevationSurface({
    id: 'narrow-bridge', kind: 'bridge', area: { type: 'rect', minX: 38, minY: 45, maxX: 62, maxY: 55 },
    groundZ: 0, visibleTerrainId: 'narrow-bridge-art', priority: 2,
  });
  const blockedQuery = createAuthoredGroundQuery({ baseSurface: base, surfaces: [water] });
  const bridgeQuery = createAuthoredGroundQuery({ baseSurface: base, surfaces: [water, bridge] });
  const blocked = resolveSweptTraversalPath({ start: { x: 20, y: 20 }, end: { x: 100, y: 20 }, queryGround: blockedQuery, maxSampleDistance: 4 });
  const crossed = resolveSweptTraversalPath({ start: { x: 20, y: 50 }, end: { x: 100, y: 50 }, queryGround: bridgeQuery, maxSampleDistance: 4 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'deep-water');
  assert.ok(blocked.position.x < 40);
  assert.deepEqual(crossed.position, { x: 100, y: 50 });
  assert.equal(crossed.allowed, true);
});

test('legal ramps and stairs permit ascent while an unmarked cliff does not', () => {
  const flat = { surfaceId: 'base', kind: 'ground', groundZ: 0, walkable: true };
  const rampStep = { surfaceId: 'ramp', kind: 'ramp', groundZ: 20, walkable: true, ascentAllowed: true };
  const stairs = { surfaceId: 'stairs', kind: 'stairs', groundZ: 20, walkable: true, ascentAllowed: true };
  const cliff = { surfaceId: 'cliff', kind: 'ground', groundZ: 20, walkable: true };
  assert.equal(resolveTraversalTransition(flat, rampStep, { x: 1, y: 0 }).allowed, true);
  assert.equal(resolveTraversalTransition(flat, stairs, { x: 1, y: 0 }).allowed, true);
  assert.deepEqual(resolveTraversalTransition(flat, cliff, { x: 1, y: 0 }), { allowed: false, reason: 'upward-cliff', deltaZ: 20, dropped: false });
});

test('one-way ledges permit authored downward drops but never upward cliff climbing', () => {
  assert.throws(() => createElevationSurface({
    id: 'bad-ledge', kind: 'ledge', area: { type: 'rect', minX: 0, minY: 0, maxX: 1, maxY: 1 },
    groundZ: 10, visibleTerrainId: 'bad-ledge-art', oneWayDrop: { x: 0, y: 0 },
  }), /drop direction/i);
  const high = { surfaceId: 'ledge-top', kind: 'ledge', groundZ: 48, walkable: true, oneWayDrop: { x: 0, y: 1 } };
  const low = { surfaceId: 'ledge-bottom', kind: 'ground', groundZ: 0, walkable: true };
  assert.equal(resolveTraversalTransition(high, low, { x: 0, y: 1 }).dropped, true);
  assert.equal(resolveTraversalTransition(high, low, { x: 0, y: -1 }).allowed, false);
  assert.equal(resolveTraversalTransition(low, high, { x: 0, y: -1 }).allowed, false);
});

test('curb tolerance requires visible authored step metadata', () => {
  const current = { surfaceId: 'road', kind: 'ground', groundZ: 0, walkable: true };
  const visibleCurb = { surfaceId: 'curb', kind: 'ground', groundZ: 6, walkable: true, visibleStepId: 'curb-mesh' };
  const invisibleStep = { surfaceId: 'bad-step', kind: 'ground', groundZ: 6, walkable: true };
  assert.equal(resolveTraversalTransition(current, visibleCurb, { x: 1, y: 0 }, { maxCurbHeight: 8 }).allowed, true);
  assert.equal(resolveTraversalTransition(current, invisibleStep, { x: 1, y: 0 }, { maxCurbHeight: 8 }).allowed, false);
});

test('terrain and slope movement modifiers are restrained and deterministic', () => {
  assert.equal(movementSpeedMultiplierForTransition({ kind: 'ground', groundZ: 0 }, { kind: 'shallow-water', groundZ: 0 }, 20), 0.72);
  assert.equal(movementSpeedMultiplierForTransition({ kind: 'ground', groundZ: 0 }, { kind: 'ramp', groundZ: 10 }, 20), 0.9);
  assert.equal(movementSpeedMultiplierForTransition({ kind: 'ramp', groundZ: 10 }, { kind: 'ground', groundZ: 0 }, 20), 1.04);
});

test('high ground extends readable range and knockback by bounded authored amounts', () => {
  assert.deepEqual(resolveHeightAdvantage({ sourceZ: 48, targetZ: 0, baseRange: 300, baseKnockback: 100, layerHeight: 24 }), {
    layerDelta: 2, range: 330, knockback: 110,
  });
  assert.deepEqual(resolveHeightAdvantage({ sourceZ: 0, targetZ: 48, baseRange: 300, baseKnockback: 100, layerHeight: 24 }), {
    layerDelta: -2, range: 285, knockback: 95,
  });
});

test('projectile height bands pass low cover but stop on high cover at the same path', () => {
  assert.deepEqual(projectileHeightBand({ z: 40, radius: 2 }), { minZ: 38, maxZ: 42, band: 'torso' });
  const from = { x: 0, y: 0, z: 40 };
  const to = { x: 100, y: 0, z: 40 };
  const low = { id: 'low-cover', shape: { type: 'capsule', a: { x: 50, y: -10 }, b: { x: 50, y: 10 }, radius: 4 }, minZ: 0, maxZ: 24 };
  const high = { ...low, id: 'high-cover', minZ: 0, maxZ: 80 };
  assert.equal(traceHeightAwareLineOfSight({ from, to, radius: 2, blockers: [low] }).clear, true);
  assert.deepEqual(traceHeightAwareLineOfSight({ from, to, radius: 2, blockers: [high] }), { clear: false, blockerId: 'high-cover', time: 0.44 });
});

test('enemy route selection filters deep water and illegal elevation transitions', () => {
  const current = { surfaceId: 'ground', kind: 'ground', groundZ: 0, walkable: true };
  const candidates = [
    { id: 'road', x: 1, y: 0, ground: { surfaceId: 'road', kind: 'ground', groundZ: 0, walkable: true } },
    { id: 'water', x: 0, y: 1, ground: { surfaceId: 'river', kind: 'water', groundZ: -10, walkable: false } },
    { id: 'cliff', x: -1, y: 0, ground: { surfaceId: 'cliff', kind: 'ground', groundZ: 30, walkable: true } },
  ];
  assert.deepEqual(filterLegalTraversalNeighbors(current, candidates).map((candidate) => candidate.id), ['road']);
});

test('debug contours sample the same authored query used by actor ground and shadow height', () => {
  const query = createAuthoredGroundQuery({ baseSurface: base, surfaces: [ramp, upper] });
  const contours = buildElevationDebugContours({ bounds: { minX: 100, minY: 100, maxX: 200, maxY: 100 }, spacing: 50, queryGround: query });
  assert.deepEqual(contours.samples.map((sample) => sample.groundZ), [0, 24, 48]);
  assert.match(contours.samples[1].label, /east-ramp.*z=24/);
  assert.equal(Object.isFrozen(contours), true);
});

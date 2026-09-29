// W0 diagnostic data only. Never imported by a cabinet, simulation or verifier.
// These repeatable rooms are a sizing load, not the future ten-area map.
import { createAuthoredGroundQuery, createElevationSurface } from '../../apps/hmh-reboot/src/elevation.mjs';
import { createStaticBlocker } from '../../apps/hmh-reboot/src/collision.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../../apps/hmh-reboot/src/level-one-world.mjs';

export const TARGET_WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 20_000, maxY: 14_000 });
export const SYNTHETIC_MODULE_SIZE = 2_000;

function checkedBounds(bounds) {
  if (!bounds || !['minX', 'minY', 'maxX', 'maxY'].every(key => Number.isFinite(bounds[key]))
    || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) throw new TypeError('ordered finite sizing bounds are required');
  return Object.freeze(Object.fromEntries(['minX', 'minY', 'maxX', 'maxY'].map(key => [key, bounds[key]])));
}
const rect = (minX, minY, maxX, maxY) => ({ type: 'rect', minX, minY, maxX, maxY });
const ground = bounds => createElevationSurface({ id: 'w0-synthetic-ground', area: rect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY), visibleTerrainId: 'w0-diagnostic-ground' });

export function createSyntheticSizingWorld(rawBounds) {
  const bounds = checkedBounds(rawBounds), surfaces = [], blockers = [];
  // A 2,000-unit module contains deep water, a shallow ford, a building,
  // a round obstacle and a ramp/one-way ledge. No simulation RNG is involved.
  // Full modules reserve about half their area for the open network; actual
  // walkability is reported from the real 60-unit nav lattice, not assumed.
  let module = 0;
  for (let y = bounds.minY; y < bounds.maxY; y += SYNTHETIC_MODULE_SIZE) {
    for (let x = bounds.minX; x < bounds.maxX; x += SYNTHETIC_MODULE_SIZE) {
      const width = Math.min(SYNTHETIC_MODULE_SIZE, bounds.maxX - x);
      const height = Math.min(SYNTHETIC_MODULE_SIZE, bounds.maxY - y);
      const id = `w0-room-${module++}`;
      const addSurface = (suffix, options) => surfaces.push(createElevationSurface({ id: `${id}-${suffix}`, visibleTerrainId: 'w0-diagnostic-surface', ...options }));
      if (width > 400 && height > 400) {
        addSurface('water', { kind: 'water', area: rect(x + 200, y + 200, x + Math.min(1100, width - 200), y + height - 200), priority: 10 });
        if (height >= 1200) addSurface('ford', { kind: 'shallow-water', deepWater: false, walkable: true, area: rect(x + 200, y + 900, x + Math.min(1100, width - 200), y + 1100), priority: 20 });
      }
      if (width >= 1900 && height >= 1900) {
        blockers.push(createStaticBlocker({ id: `${id}-building`, visibleAssetId: 'w0-diagnostic-building', shape: { type: 'polygon', vertices: [
          { x: x + 1250, y: y + 350 }, { x: x + 1850, y: y + 350 },
          { x: x + 1850, y: y + 1450 }, { x: x + 1250, y: y + 1450 },
        ] } }));
        blockers.push(createStaticBlocker({ id: `${id}-rock`, visibleAssetId: 'w0-diagnostic-rock', shape: { type: 'circle', x: x + 1700, y: y + 180, radius: 60 } }));
        addSurface('ramp', { kind: 'ramp', area: rect(x + 1400, y + 1480, x + 1800, y + 1600), fromZ: 0, toZ: 32, axis: 'y', priority: 30 });
        addSurface('ledge', { kind: 'ledge', area: rect(x + 1400, y + 1600, x + 1800, y + 1850), groundZ: 32, oneWayDrop: { x: 0, y: 1 }, priority: 30 });
      }
    }
  }
  const corners = [
    { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY },
  ];
  for (let edge = 0; edge < corners.length; edge += 1) blockers.push(createStaticBlocker({
    id: `w0-perimeter-${edge}`, terrainBoundaryId: 'w0-diagnostic-perimeter',
    shape: { type: 'capsule', a: corners[edge], b: corners[(edge + 1) % corners.length], radius: 18 },
  }));
  return Object.freeze({ bounds, baseSurface: ground(bounds), surfaces: Object.freeze(surfaces), collisionBlockers: Object.freeze(blockers) });
}

export function createSizingScenarios() {
  const boundsOnly = Object.freeze({
    bounds: TARGET_WORLD_BOUNDS,
    baseSurface: createElevationSurface({ ...LEVEL_ONE_WORLD.baseSurface, area: rect(0, 0, 20_000, 14_000) }),
    surfaces: LEVEL_ONE_WORLD.surfaces,
    collisionBlockers: LEVEL_ONE_WORLD.collisionBlockers,
  });
  const syntheticCurrent = createSyntheticSizingWorld(LEVEL_ONE_WORLD.bounds);
  const syntheticTarget = createSyntheticSizingWorld(TARGET_WORLD_BOUNDS);
  return Object.freeze([
    { id: 'current-authored-12000x4800', topologyKind: 'actual-current-map', world: LEVEL_ONE_WORLD, queryGround: createLevelOneGroundQuery(), note: 'The actual current authored map; no dimension or topology changes.' },
    { id: 'bounds-only-20000x14000', topologyKind: 'bounds-only-control', world: boundsOnly, queryGround: createAuthoredGroundQuery(boundsOnly), note: 'Larger bounds/base ground only. Old surfaces and old perimeter remain: deliberately NOT a connected future map.' },
    { id: 'synthetic-12000x4800', topologyKind: 'representative-synthetic', world: syntheticCurrent, queryGround: createAuthoredGroundQuery(syntheticCurrent), note: 'Repeated diagnostic rooms at current dimensions; not the current map or a playable greybox.' },
    { id: 'synthetic-20000x14000', topologyKind: 'representative-synthetic', world: syntheticTarget, queryGround: createAuthoredGroundQuery(syntheticTarget), note: 'The same repeated-room density at target dimensions; NOT the actual future ten-area topology.' },
  ].map(Object.freeze));
}

// Small differential probes deliberately place gates inside the global edge
// cells. They are NOT additions to the active world or accepted layouts.
export function createGatePatchProbes() {
  const specs = [
    ['interior', { x: 270, y: 300 }, { x: 690, y: 300 }],
    ['west-border', { x: 30, y: 300 }, { x: 450, y: 300 }],
    ['north-border', { x: 270, y: 30 }, { x: 690, y: 30 }],
  ];
  return specs.map(([id, a, b]) => {
    const bounds = checkedBounds({ minX: 0, minY: 0, maxX: 960, maxY: 720 });
    const gate = createStaticBlocker({ id: `w0-${id}-gate`, visibleAssetId: 'w0-diagnostic-gate', shape: { type: 'capsule', a, b, radius: 18 } });
    const world = Object.freeze({ bounds, baseSurface: ground(bounds), surfaces: Object.freeze([]), collisionBlockers: Object.freeze([gate]) });
    return Object.freeze({ id, gateId: gate.id, world, queryGround: createAuthoredGroundQuery(world) });
  });
}

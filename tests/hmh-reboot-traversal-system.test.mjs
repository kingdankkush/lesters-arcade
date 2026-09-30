import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  TRAVERSAL_POSES,
  TRAVERSAL_RULES_V1,
  beginLandRecovery,
  createTraversalMarker,
  createTraversalState,
  hashTraversalState,
  stepTraversal,
  traversalInvulnerability,
  traversalMarkerFromGreybox,
} from '../apps/hmh-reboot/src/traversal-system.mjs';
import { createGreyboxPiece } from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import { createAuthoredGroundQuery, createElevationSurface, resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';

// A ledge at z=64 north of y=100. The climb zone sits on the low side (south)
// and pushes north; the drop zone sits on the high side and pushes south.
const CLIMB = createTraversalMarker({ id: 'ridge-climb', kind: 'climb', zone: { minX: 100, minY: 100, maxX: 220, maxY: 140 }, direction: { x: 0, y: -1 }, fromZ: 0, toZ: 64 });
const DROP = createTraversalMarker({ id: 'ridge-drop', kind: 'drop', zone: { minX: 100, minY: 60, maxX: 220, maxY: 100 }, direction: { x: 0, y: 1 }, fromZ: 64, toZ: 0 });
const MARKERS = Object.freeze([CLIMB, DROP]);

function player(x, y, groundZ) {
  return { x, y, groundZ, radius: 12 };
}

test('traversal-v1 rules are frozen, versioned, and the module draws no randomness or wall clock', () => {
  assert.equal(TRAVERSAL_RULES_V1.rulesVersion, 'traversal-v1');
  assert.equal(Object.isFrozen(TRAVERSAL_RULES_V1), true);
  assert.equal(TRAVERSAL_RULES_V1.mantleTicks, 18);
  assert.equal(TRAVERSAL_RULES_V1.landRecoveryTicks, 6);
  assert.equal(TRAVERSAL_RULES_V1.meleeInvulnerableWhileMantling, true);
  assert.equal(TRAVERSAL_RULES_V1.projectileInvulnerableWhileMantling, false);
  assert.deepEqual(TRAVERSAL_POSES, ['none', 'mantle', 'drop', 'land']);
  const source = readFileSync(new URL('../apps/hmh-reboot/src/traversal-system.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random|\bDate\b|performance\.now|document\.|window\./);
});

test('markers validate their kind, zone, direction and height change', () => {
  assert.equal(CLIMB.travel, 48);
  assert.equal(DROP.travel, 32);
  assert.deepEqual(CLIMB.direction, { x: 0, y: -1 });
  assert.equal(Object.isFrozen(CLIMB), true);
  assert.deepEqual(createTraversalMarker({ id: 'd', kind: 'climb', zone: CLIMB.zone, direction: { x: 3, y: 4 }, fromZ: 0, toZ: 48 }).direction, { x: 0.6, y: 0.8 });
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'vault', zone: CLIMB.zone, direction: { x: 0, y: 1 }, fromZ: 0, toZ: 48 }), /kind/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'climb', zone: CLIMB.zone, direction: { x: 0, y: 0 }, fromZ: 0, toZ: 48 }), /direction/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'climb', zone: CLIMB.zone, direction: { x: 0, y: 1 }, fromZ: 0, toZ: 16 }), /rise/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'climb', zone: CLIMB.zone, direction: { x: 0, y: 1 }, fromZ: 0, toZ: 200 }), /rise/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'drop', zone: CLIMB.zone, direction: { x: 0, y: 1 }, fromZ: 0, toZ: 48 }), /fall/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'drop', zone: CLIMB.zone, direction: { x: 0, y: 1 }, fromZ: 500, toZ: 0 }), /fall/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'climb', zone: { minX: 0, minY: 0, maxX: 0, maxY: 10 }, direction: { x: 0, y: 1 }, fromZ: 0, toZ: 48 }), /zone/);
  assert.throws(() => createTraversalMarker({ id: 'x', kind: 'climb', zone: CLIMB.zone, direction: { x: 0, y: 1 }, fromZ: 0, toZ: 48, travel: 0 }), /travel/);
});

test('a greybox climb or drop marker adapts with the metadata the kit does not carry', () => {
  const piece = createGreyboxPiece({ id: 'climb-intent', kind: 'climb-marker', bounds: { minX: 360, minY: 830, maxX: 480, maxY: 870 }, height: 24, areaId: 'bayou' });
  const marker = traversalMarkerFromGreybox(piece, { direction: { x: 0, y: -1 }, fromZ: 0, toZ: 96 });
  assert.equal(marker.kind, 'climb');
  assert.equal(marker.id, 'climb-intent');
  assert.equal(marker.areaId, 'bayou');
  assert.deepEqual(marker.zone, { minX: 360, minY: 830, maxX: 480, maxY: 870 });
  const drop = createGreyboxPiece({ id: 'drop-intent', kind: 'drop-marker', bounds: { minX: 540, minY: 650, maxX: 580, maxY: 770 }, height: 24 });
  assert.equal(traversalMarkerFromGreybox(drop, { direction: { x: 1, y: 0 }, fromZ: 96, toZ: 0 }).kind, 'drop');
  const mass = createGreyboxPiece({ id: 'mass-1', kind: 'mass', bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40 } });
  assert.throws(() => traversalMarkerFromGreybox(mass, { direction: { x: 1, y: 0 }, fromZ: 0, toZ: 48 }), /climb-marker or drop-marker/);
});

test('a climb mantles for exactly 18 locked ticks, melee-invulnerable, and lands at the marker height', () => {
  const state = createTraversalState();
  const start = stepTraversal(state, { player: player(160, 120, 0), input: { move: { x: 0, y: -1 } }, markers: MARKERS, tick: 10 });
  assert.equal(start.phase, 'mantling');
  assert.equal(start.event, 'mantle-start');
  assert.equal(start.pose, 'mantle');
  assert.equal(start.movementLocked, true);
  assert.equal(start.meleeInvulnerable, true);
  assert.equal(start.projectileInvulnerable, false);
  assert.deepEqual(start.position, { x: 160, y: 120, z: 0 });
  assert.equal(start.remainingTicks, 18);
  assert.deepEqual(traversalInvulnerability(state), { melee: true, projectile: false });
  const frames = [];
  for (let tick = 11; tick <= 28; tick += 1) frames.push(stepTraversal(state, { player: player(state.position.x, state.position.y, 0), input: { move: { x: 0, y: 1 } }, markers: MARKERS, tick }));
  assert.equal(frames.length, 18);
  assert.deepEqual(frames[0].position, { x: 160, y: 120 - 48 / 18, z: 0 });
  assert.deepEqual(frames[8].position, { x: 160, y: 96, z: 0 }, 'halfway across on the ninth tick, still at the low height');
  assert.equal(frames[16].phase, 'mantling');
  assert.equal(frames[16].meleeInvulnerable, true);
  assert.deepEqual(frames[17].position, { x: 160, y: 72, z: 64 }, 'the height switches on the final tick');
  assert.equal(frames[17].event, 'mantle-complete');
  assert.equal(frames[17].pose, 'mantle');
  assert.equal(frames[17].movementLocked, true);
  assert.equal(state.phase, 'free');
  assert.equal(state.mantles, 1);
  assert.equal(state.mantleTicks, 18);
  const free = stepTraversal(state, { player: player(160, 72, 64), input: {}, markers: MARKERS, tick: 29 });
  assert.equal(free.phase, 'free');
  assert.equal(free.pose, 'none');
  assert.equal(free.movementLocked, false);
  assert.equal(free.meleeInvulnerable, false);
  assert.equal(free.position, null);
});

test('a climb needs the zone, the low ground level and a push across the edge', () => {
  const outside = createTraversalState();
  assert.equal(stepTraversal(outside, { player: player(160, 150, 0), input: { move: { x: 0, y: -1 } }, markers: MARKERS, tick: 0 }).phase, 'free');
  const idle = createTraversalState();
  assert.equal(stepTraversal(idle, { player: player(160, 120, 0), input: { move: { x: 0, y: 0 } }, markers: MARKERS, tick: 0 }).phase, 'free');
  const sideways = createTraversalState();
  assert.equal(stepTraversal(sideways, { player: player(160, 120, 0), input: { move: { x: 1, y: 0 } }, markers: MARKERS, tick: 0 }).phase, 'free');
  const diagonal = createTraversalState();
  assert.equal(stepTraversal(diagonal, { player: player(160, 120, 0), input: { move: { x: 0.7, y: -0.71 } }, markers: MARKERS, tick: 0 }).phase, 'mantling');
  const wrongLevel = createTraversalState();
  assert.equal(stepTraversal(wrongLevel, { player: player(160, 120, 64), input: { move: { x: 0, y: -1 } }, markers: MARKERS, tick: 0 }).phase, 'free', 'already on the high side');
  const backwards = createTraversalState();
  assert.equal(stepTraversal(backwards, { player: player(160, 80, 0), input: { move: { x: 0, y: 1 } }, markers: MARKERS, tick: 0 }).phase, 'free', 'the drop zone from the low level does nothing');
});

test('a drop is instant and lands with six locked recovery ticks and no invulnerability', () => {
  const state = createTraversalState();
  const drop = stepTraversal(state, { player: player(160, 80, 64), input: { move: { x: 0, y: 1 } }, markers: MARKERS, tick: 5 });
  assert.equal(drop.phase, 'landing');
  assert.equal(drop.event, 'drop');
  assert.equal(drop.pose, 'drop');
  assert.deepEqual(drop.position, { x: 160, y: 112, z: 0 });
  assert.equal(drop.movementLocked, true);
  assert.equal(drop.meleeInvulnerable, false);
  assert.equal(drop.projectileInvulnerable, false);
  assert.equal(drop.remainingTicks, 6);
  const frames = [];
  for (let tick = 6; tick <= 11; tick += 1) frames.push(stepTraversal(state, { player: player(160, 112, 0), input: { move: { x: 1, y: 0 } }, markers: MARKERS, tick }));
  assert.equal(frames.every((frame) => frame.pose === 'land' && frame.movementLocked && !frame.meleeInvulnerable), true);
  assert.equal(frames[4].phase, 'landing');
  assert.equal(frames[5].event, 'land-complete');
  assert.equal(state.phase, 'free');
  assert.equal(state.drops, 1);
  assert.equal(state.landTicks, 6);
  const free = stepTraversal(state, { player: player(160, 112, 0), input: { move: { x: 1, y: 0 } }, markers: MARKERS, tick: 12 });
  assert.equal(free.phase, 'free');
  assert.equal(free.movementLocked, false);
});

test('an authored one-way ledge drop from the elevation layer starts the same land recovery', () => {
  const base = createElevationSurface({ id: 'base', kind: 'ground', area: { type: 'rect', minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, groundZ: 0, visibleTerrainId: 'base' });
  const ledge = createElevationSurface({ id: 'ledge', kind: 'ledge', area: { type: 'rect', minX: 0, minY: 0, maxX: 1000, maxY: 100 }, groundZ: 64, oneWayDrop: { x: 0, y: 1 }, visibleTerrainId: 'ledge', priority: 4 });
  const queryGround = createAuthoredGroundQuery({ baseSurface: base, surfaces: [ledge] });
  const path = resolveSweptTraversalPath({ start: { x: 160, y: 96 }, end: { x: 160, y: 112 }, queryGround, maxSampleDistance: 4 });
  assert.equal(path.dropped, true);
  const state = createTraversalState();
  const land = beginLandRecovery(state, { tick: 20, position: { x: path.position.x, y: path.position.y, z: path.ground.groundZ } });
  assert.equal(land.phase, 'landing');
  assert.equal(land.event, 'land-start');
  assert.equal(land.markerId, null);
  assert.deepEqual(land.position, { x: 160, y: 112, z: 0 });
  let last;
  for (let tick = 21; tick <= 26; tick += 1) last = stepTraversal(state, { player: player(160, 112, 0), input: {}, markers: MARKERS, tick });
  assert.equal(last.event, 'land-complete');
  assert.equal(state.phase, 'free');
  const busy = createTraversalState();
  stepTraversal(busy, { player: player(160, 120, 0), input: { move: { x: 0, y: -1 } }, markers: MARKERS, tick: 0 });
  assert.equal(beginLandRecovery(busy, { tick: 1, position: { x: 0, y: 0, z: 0 } }).phase, 'mantling', 'a running mantle is never interrupted');
});

test('overlapping markers resolve to the lexically first id', () => {
  const twin = createTraversalMarker({ id: 'aa-climb', kind: 'climb', zone: CLIMB.zone, direction: CLIMB.direction, fromZ: 0, toZ: 48 });
  const state = createTraversalState();
  const start = stepTraversal(state, { player: player(160, 120, 0), input: { move: { x: 0, y: -1 } }, markers: [CLIMB, twin], tick: 0 });
  assert.equal(start.markerId, 'aa-climb');
});

function scriptedInput(tick) {
  if (tick < 4) return { move: { x: 0, y: -1 } };
  if (tick < 40) return { move: { x: 1, y: 0 } };
  if (tick < 60) return { move: { x: 0, y: 1 } };
  return { move: { x: 0, y: -1 } };
}

function scriptedRun(inputAt, ticks = 200) {
  const state = createTraversalState();
  const hashes = [];
  const events = [];
  let at = { x: 160, y: 120, z: 0 };
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = stepTraversal(state, { player: player(at.x, at.y, at.z), input: inputAt(tick), markers: MARKERS, tick });
    if (result.position) at = result.position;
    else if (inputAt(tick).move) at = { x: at.x, y: at.y + inputAt(tick).move.y * 2, z: at.z };
    if (result.event) events.push(`${tick}:${result.event}`);
    hashes.push(hashTraversalState(state));
  }
  return { hashes, events };
}

test('the same scripted inputs produce identical traversal hashes on two fresh runs', () => {
  const first = scriptedRun(scriptedInput);
  const second = scriptedRun(scriptedInput);
  assert.deepEqual(first.hashes, second.hashes);
  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.events.slice(0, 2), ['0:mantle-start', '18:mantle-complete']);
  assert.ok(first.events.some((event) => event.endsWith(':drop')), first.events.join(' '));
  assert.ok(first.events.some((event) => event.endsWith(':land-complete')), first.events.join(' '));
  const changed = scriptedRun((tick) => (tick === 50 ? { move: { x: 0, y: 0 } } : scriptedInput(tick)));
  assert.deepEqual(changed.hashes.slice(0, 50), first.hashes.slice(0, 50));
  assert.notDeepEqual(changed.hashes, first.hashes);
});

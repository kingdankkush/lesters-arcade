import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COVER_POSES,
  COVER_RULES_V1,
  applyCoverToDamage,
  canonicalCoverJson,
  coverDamageMultiplier,
  coverFaceIndex,
  coverKindForBlocker,
  coverSignal,
  createCoverState,
  hashCoverState,
  stepCover,
} from '../apps/hmh-reboot/src/cover-system.mjs';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { createHurtTarget, createProjectileState, resolveProjectilePath } from '../apps/hmh-reboot/src/projectile-physics.mjs';
import { createGreyboxPiece } from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';

const RADIUS = 12;

function rectangle(id, minX, minY, maxX, maxY, maxZ, extra = {}) {
  return createStaticBlocker({
    id,
    shape: { type: 'polygon', vertices: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] },
    visibleAssetId: `art-${id}`,
    minZ: 0,
    maxZ,
    combatCover: true,
    ...extra,
  });
}

// A tall wall along y=100..140 and a short wall along y=300..340. Their
// north faces (index 0) have outward normal (0, -1).
const TALL = rectangle('wall-tall', 100, 100, 300, 140, 128);
const SHORT = rectangle('wall-short', 100, 300, 300, 340, 48);
const WORLD = Object.freeze([TALL, SHORT]);
const FACES = coverFaceIndex(WORLD);

function player(x, y, groundZ = 0) {
  return { x, y, groundZ, radius: RADIUS };
}

function run(state, ticks, inputAt, options = {}) {
  const results = [];
  for (let tick = options.startTick ?? 0; tick < (options.startTick ?? 0) + ticks; tick += 1) {
    const current = state.position ?? options.at ?? { x: 200, y: 68 };
    results.push(stepCover(state, { player: player(current.x, current.y, options.groundZ ?? 0), input: inputAt(tick), faces: options.faces ?? FACES, tick }));
  }
  return results;
}

function enterTall(state, x = 200, startTick = 0) {
  return run(state, COVER_RULES_V1.enterTicks, () => ({ move: { x: 0, y: 1 } }), { at: { x, y: 68 }, startTick });
}

test('cover-v1 rules are frozen, versioned, and the module draws no randomness or wall clock', () => {
  assert.equal(COVER_RULES_V1.rulesVersion, 'cover-v1');
  assert.equal(Object.isFrozen(COVER_RULES_V1), true);
  assert.equal(COVER_RULES_V1.enterDistance, 24);
  assert.equal(COVER_RULES_V1.enterTicks, 6);
  assert.equal(COVER_RULES_V1.leaveTicks, 4);
  assert.equal(COVER_RULES_V1.tallDamageMultiplier, 0.4);
  assert.equal(COVER_RULES_V1.shortDamageMultiplier, 0.6);
  const source = readFileSync(new URL('../apps/hmh-reboot/src/cover-system.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random|\bDate\b|performance\.now|document\.|window\./);
  assert.equal(Object.isFrozen(COVER_POSES), true);
});

test('cover kind comes from declared level data, else from blocker height', () => {
  assert.equal(coverKindForBlocker(rectangle('a', 0, 0, 100, 40, 128)), 'tall');
  assert.equal(coverKindForBlocker(rectangle('b', 0, 0, 100, 40, 96)), 'tall');
  assert.equal(coverKindForBlocker(rectangle('c', 0, 0, 100, 40, 72)), 'short');
  assert.equal(coverKindForBlocker(rectangle('d', 0, 0, 100, 40, 24)), 'short');
  assert.equal(coverKindForBlocker(rectangle('e', 0, 0, 100, 40, 80)), 'none');
  assert.equal(coverKindForBlocker(rectangle('f', 0, 0, 100, 40, 12)), 'none');
  assert.equal(coverKindForBlocker(rectangle('g', 0, 0, 100, 40, 128, { coverKind: 'short' })), 'short');
  assert.equal(coverKindForBlocker(rectangle('h', 0, 0, 100, 40, 128, { coverKind: 'none' })), 'none');
  assert.equal(coverKindForBlocker(rectangle('i', 0, 0, 100, 40, 128, { combatCover: false })), 'none');
  assert.equal(coverKindForBlocker(createStaticBlocker({ id: 'j', shape: { type: 'circle', x: 0, y: 0, radius: 10 }, visibleAssetId: 'j', combatCover: true })), 'tall');
  assert.throws(() => rectangle('k', 0, 0, 100, 40, 128, { coverKind: 'medium' }), /coverKind/);
  const tallPiece = createGreyboxPiece({ id: 'kit-tall', kind: 'cover-tall', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 40 } });
  const shortPiece = createGreyboxPiece({ id: 'kit-short', kind: 'cover-short', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 40 } });
  const massPiece = createGreyboxPiece({ id: 'kit-mass', kind: 'mass', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 40 } });
  assert.equal(tallPiece.blocker.coverKind, 'tall');
  assert.equal(shortPiece.blocker.coverKind, 'short');
  assert.equal(massPiece.blocker.coverKind, null);
});

test('face index lists outward edges of polygons and the two long sides of capsules, never circles', () => {
  assert.equal(FACES.length, 8);
  assert.equal(Object.isFrozen(FACES), true);
  assert.deepEqual(FACES.map((face) => face.id), ['wall-short:0', 'wall-short:1', 'wall-short:2', 'wall-short:3', 'wall-tall:0', 'wall-tall:1', 'wall-tall:2', 'wall-tall:3']);
  const north = FACES.find((face) => face.id === 'wall-tall:0');
  assert.deepEqual(north.normal, { x: 0, y: -1 });
  assert.deepEqual(north.a, { x: 100, y: 100 });
  assert.deepEqual(north.b, { x: 300, y: 100 });
  assert.equal(north.length, 200);
  assert.equal(north.kind, 'tall');
  assert.equal(north.topZ, 128);
  assert.equal(north.baseZ, 0);
  const south = FACES.find((face) => face.id === 'wall-tall:2');
  assert.deepEqual(south.normal, { x: 0, y: 1 });
  assert.deepEqual(FACES.find((face) => face.id === 'wall-tall:1').normal, { x: 1, y: 0 });
  assert.deepEqual(FACES.find((face) => face.id === 'wall-tall:3').normal, { x: -1, y: 0 });
  assert.equal(FACES.find((face) => face.id === 'wall-short:0').kind, 'short');
  assert.equal(Object.isFrozen(north), true);
  assert.equal(coverFaceIndex(WORLD), FACES, 'frozen blocker arrays are indexed once');

  const capsule = createStaticBlocker({ id: 'truck', shape: { type: 'capsule', a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, radius: 30 }, visibleAssetId: 'truck', minZ: 0, maxZ: 150, combatCover: true });
  const circle = createStaticBlocker({ id: 'tank', shape: { type: 'circle', x: 500, y: 500, radius: 40 }, visibleAssetId: 'tank', minZ: 0, maxZ: 150, combatCover: true });
  const faces = coverFaceIndex([capsule, circle]);
  assert.deepEqual(faces.map((face) => face.id), ['truck:0', 'truck:1']);
  assert.deepEqual(faces[0].a, { x: 0, y: 30 });
  assert.deepEqual(faces[0].normal, { x: 0, y: 1 });
  assert.deepEqual(faces[1].a, { x: 0, y: -30 });
  assert.deepEqual(faces[1].normal, { x: 0, y: -1 });

  const stub = rectangle('stub', 0, 0, 20, 100, 128);
  assert.deepEqual(coverFaceIndex([stub]).map((face) => face.id), ['stub:1', 'stub:3'], 'faces shorter than minFaceLength are dropped');
});

test('enter snaps on the sixth consecutive pushing tick, quantized against the face, facing away from tall cover', () => {
  const state = createCoverState();
  const results = enterTall(state);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(results[index].inCover, false, `tick ${index} stays free`);
    assert.equal(results[index].pose, 'none');
    assert.equal(results[index].position, null);
  }
  assert.equal(results[5].inCover, true);
  assert.equal(results[5].pose, 'cover-enter');
  assert.equal(results[5].event, 'enter');
  assert.equal(results[5].faceId, 'wall-tall:0');
  assert.equal(results[5].kind, 'tall');
  assert.deepEqual(results[5].position, { x: 200, y: 87 }, 'radius 12 plus a one-unit integer standoff off the y=100 face');
  assert.deepEqual(results[5].facing, { x: 0, y: -1 });
  assert.equal(state.along, 100);
  assert.equal(state.enteredTick, 5);
  assert.equal(state.enters, 1);
  assert.equal(Object.isFrozen(results[5]), true);
});

test('short cover faces the hero toward the wall and keeps the same timing', () => {
  const state = createCoverState();
  const results = run(state, 6, () => ({ move: { x: 0, y: 1 } }), { at: { x: 150, y: 268 } });
  assert.equal(results[4].inCover, false);
  assert.equal(results[5].inCover, true);
  assert.equal(results[5].kind, 'short');
  assert.equal(results[5].faceId, 'wall-short:0');
  assert.deepEqual(results[5].facing, { x: 0, y: 1 });
  assert.deepEqual(results[5].position, { x: 150, y: 287 });
});

test('an interrupted push restarts the enter count', () => {
  const state = createCoverState();
  const results = run(state, 10, (tick) => ({ move: tick === 3 ? { x: 0, y: 0 } : { x: 0, y: 1 } }));
  assert.equal(results.slice(0, 9).every((result) => !result.inCover), true, 'three ticks, a gap, then five ticks never snap');
  assert.equal(results[9].inCover, true, 'six clean ticks after the gap at tick 3');
});

test('enter requires range, a push toward the face, and the same ground level', () => {
  const tooFar = createCoverState();
  assert.equal(run(tooFar, 12, () => ({ move: { x: 0, y: 1 } }), { at: { x: 200, y: 60 } }).some((result) => result.inCover), false, 'gap 28 > 24');
  const atLimit = createCoverState();
  assert.equal(run(atLimit, 6, () => ({ move: { x: 0, y: 1 } }), { at: { x: 200, y: 64 } })[5].inCover, true, 'gap exactly 24 enters');
  const sideways = createCoverState();
  assert.equal(run(sideways, 12, () => ({ move: { x: 1, y: 0 } })).some((result) => result.inCover), false, 'pushing along the face never enters');
  const shallow = createCoverState();
  assert.equal(run(shallow, 12, () => ({ move: { x: 0.87, y: 0.49 } })).some((result) => result.inCover), false, 'just outside the 60 degree push cone');
  const diagonal = createCoverState();
  assert.equal(run(diagonal, 6, () => ({ move: { x: 0.7, y: 0.71 } }))[5].inCover, true, 'inside the push cone');
  const elevated = createCoverState();
  assert.equal(run(elevated, 12, () => ({ move: { x: 0, y: 1 } }), { groundZ: 64 }).some((result) => result.inCover), false, 'standing 64 above the blocker base');
  const dodging = createCoverState();
  assert.equal(run(dodging, 12, () => ({ move: { x: 0, y: 1 }, dodge: true })).some((result) => result.inCover), false, 'a dash never snaps into cover');
});

test('two faces in range: the nearest wins and an exact tie goes to the lexically first face id', () => {
  const wallA = rectangle('wall-a', 0, 0, 400, 40, 128);
  const wallC = rectangle('wall-c', 300, 40, 340, 240, 128);
  const faces = coverFaceIndex(Object.freeze([wallA, wallC]));
  const push = () => ({ move: { x: 0.7071, y: -0.7071 } });
  const nearest = createCoverState();
  const nearestResults = run(nearest, 6, push, { at: { x: 272, y: 62 }, faces });
  assert.equal(nearestResults[5].faceId, 'wall-a:2', 'gap 10 to wall-a beats gap 16 to wall-c');
  const tie = createCoverState();
  const tieResults = run(tie, 6, push, { at: { x: 278, y: 62 }, faces });
  assert.equal(tieResults[5].faceId, 'wall-a:2', 'both gaps are 10');
  const nearer = createCoverState();
  const nearerResults = run(nearer, 6, push, { at: { x: 280, y: 66 }, faces });
  assert.equal(nearerResults[5].faceId, 'wall-c:3', 'gap 8 to wall-c beats gap 14 to wall-a');
});

test('a corner entry clamps the hero one radius inside the face end', () => {
  const state = createCoverState();
  const results = enterTall(state, 105);
  assert.equal(state.along, 12);
  assert.deepEqual(results[5].position, { x: 112, y: 87 });
  const far = createCoverState();
  enterTall(far, 298);
  assert.equal(far.along, 188);
  assert.deepEqual(far.position, { x: 288, y: 87 });
});

test('shuffling moves two units a tick along the face and running past the end leaves', () => {
  const state = createCoverState();
  enterTall(state);
  const ticks = [];
  let leaveTick = null;
  for (let tick = 6; tick < 200 && leaveTick === null; tick += 1) {
    const result = stepCover(state, { player: player(state.position.x, state.position.y), input: { move: { x: 1, y: 0 } }, faces: FACES, tick });
    ticks.push(result);
    if (!result.inCover) leaveTick = tick;
  }
  assert.equal(ticks[0].pose, 'cover-shuffle');
  assert.deepEqual(ticks[0].position, { x: 202, y: 87 });
  assert.equal(ticks[43].position.x, 288, 'along 188: clamped one radius short of the b end after 44 shuffles');
  assert.equal(ticks[43].inCover, true);
  assert.equal(state.along, 0);
  assert.equal(leaveTick, 6 + 44, 'the next push past the end runs out');
  assert.equal(ticks[44].pose, 'cover-leave-run');
  assert.equal(ticks[44].event, 'leave-run');
  assert.equal(ticks[44].position, null);
  assert.equal(ticks[44].movementLocked, false);
});

test('tall cover: firing near an end leans out at that corner, mid-face fire is blind fire, release returns', () => {
  const state = createCoverState();
  enterTall(state, 120);
  assert.equal(state.along, 20);
  const peek = stepCover(state, { player: player(state.position.x, state.position.y), input: { fire: true }, faces: FACES, tick: 6 });
  assert.equal(peek.pose, 'cover-peek-fire');
  assert.equal(peek.peeking, true);
  assert.equal(peek.peekMode, 'lean-l', 'facing north, the west end is on the hero left');
  assert.deepEqual(peek.position, { x: 100, y: 87 }, 'the hero centre sits on the corner');
  const held = stepCover(state, { player: player(state.position.x, state.position.y), input: { fire: true }, faces: FACES, tick: 7 });
  assert.deepEqual(held.position, { x: 100, y: 87 });
  const release = stepCover(state, { player: player(state.position.x, state.position.y), input: {}, faces: FACES, tick: 8 });
  assert.equal(release.pose, 'cover-idle-l');
  assert.equal(release.peeking, false);
  assert.deepEqual(release.position, { x: 120, y: 87 }, 'back to the rest position');

  const east = createCoverState();
  enterTall(east, 285);
  const eastPeek = stepCover(east, { player: player(east.position.x, east.position.y), input: { aimHeld: true }, faces: FACES, tick: 6 });
  assert.equal(eastPeek.peekMode, 'lean-r');
  assert.deepEqual(eastPeek.position, { x: 300, y: 87 });

  const middle = createCoverState();
  enterTall(middle);
  const blind = stepCover(middle, { player: player(middle.position.x, middle.position.y), input: { fire: true }, faces: FACES, tick: 6 });
  assert.equal(blind.pose, 'cover-blind-fire');
  assert.equal(blind.peekMode, 'blind');
  assert.deepEqual(blind.position, { x: 200, y: 87 }, 'blind fire never moves the hero');
  const aimOnly = stepCover(middle, { player: player(middle.position.x, middle.position.y), input: { aimHeld: true }, faces: FACES, tick: 7 });
  assert.equal(aimOnly.pose, 'cover-idle-l', 'aiming mid-face with nothing to lean around stays idle');
  assert.equal(aimOnly.peeking, false);
});

test('short cover: firing pops up in place and releasing crouches back', () => {
  const state = createCoverState();
  run(state, 6, () => ({ move: { x: 0, y: 1 } }), { at: { x: 150, y: 268 } });
  const pop = stepCover(state, { player: player(150, 287), input: { fire: true }, faces: FACES, tick: 6 });
  assert.equal(pop.pose, 'cover-peek-fire');
  assert.equal(pop.peekMode, 'pop');
  assert.deepEqual(pop.position, { x: 150, y: 287 });
  const down = stepCover(state, { player: player(150, 287), input: {}, faces: FACES, tick: 7 });
  assert.equal(down.peeking, false);
  assert.equal(down.pose, 'cover-idle-r', 'facing south into the wall, the west end is on the hero right');
});

test('reload and hit poses read from the input while the hero holds position', () => {
  const state = createCoverState();
  enterTall(state);
  assert.equal(stepCover(state, { player: player(200, 87), input: { reload: true }, faces: FACES, tick: 6 }).pose, 'cover-reload');
  assert.equal(stepCover(state, { player: player(200, 87), input: { hit: true }, faces: FACES, tick: 7 }).pose, 'cover-hit');
  assert.equal(stepCover(state, { player: player(200, 87), input: { fire: true, hit: true }, faces: FACES, tick: 8 }).pose, 'cover-hit');
  assert.deepEqual(state.position, { x: 200, y: 87 });
});

test('pushing away for four consecutive ticks steps out; a broken push restarts the count', () => {
  const state = createCoverState();
  enterTall(state);
  const results = [];
  for (let tick = 6; tick < 10; tick += 1) results.push(stepCover(state, { player: player(200, 87), input: { move: { x: 0, y: -1 } }, faces: FACES, tick }));
  assert.equal(results[2].inCover, true);
  assert.equal(results[2].pose, 'cover-idle-l');
  assert.equal(results[3].inCover, false);
  assert.equal(results[3].pose, 'cover-leave-step');
  assert.equal(results[3].event, 'leave-step');
  assert.equal(results[3].position, null);

  const broken = createCoverState();
  enterTall(broken);
  const sequence = [{ x: 0, y: -1 }, { x: 0, y: -1 }, { x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -1 }, { x: 0, y: -1 }, { x: 0, y: -1 }];
  const brokenResults = sequence.map((move, index) => stepCover(broken, { player: player(200, 87), input: { move }, faces: FACES, tick: 6 + index }));
  assert.equal(brokenResults.slice(0, 7).every((result) => result.inCover), true);
  assert.equal(brokenResults[7].pose, 'cover-leave-step');
});

test('a dodge in cover rolls out immediately', () => {
  const state = createCoverState();
  enterTall(state);
  const roll = stepCover(state, { player: player(200, 87), input: { move: { x: 0, y: 1 }, dodge: true }, faces: FACES, tick: 6 });
  assert.equal(roll.inCover, false);
  assert.equal(roll.pose, 'cover-leave-roll');
  assert.equal(roll.event, 'leave-roll');
  assert.equal(roll.position, null);
  assert.equal(state.faceId, null);
  assert.equal(state.enterCounter, 0);
});

test('cover ticks accumulate only while in cover', () => {
  const state = createCoverState();
  enterTall(state);
  assert.equal(state.coverTicks, 1);
  for (let tick = 6; tick < 16; tick += 1) stepCover(state, { player: player(200, 87), input: {}, faces: FACES, tick });
  assert.equal(state.coverTicks, 11);
  stepCover(state, { player: player(200, 87), input: { dodge: true }, faces: FACES, tick: 16 });
  stepCover(state, { player: player(200, 87), input: {}, faces: FACES, tick: 17 });
  assert.equal(state.coverTicks, 12, 'the roll-out tick counts, the free tick after it does not');
});

test('damage multiplier: through the cover reduced, from behind or the side full, from above the top full', () => {
  const tall = createCoverState();
  enterTall(tall);
  assert.equal(coverDamageMultiplier(tall, { x: 200, y: 300 }), 0.4, 'front, through the wall');
  assert.equal(coverDamageMultiplier(tall, { x: 200, y: 0 }), 1, 'behind the hero');
  assert.equal(coverDamageMultiplier(tall, { x: 400, y: 87 }), 1, 'along the face');
  assert.equal(coverDamageMultiplier(tall, { x: 320, y: 300 }), 0.4, 'front-right inside the 60 degree cone');
  assert.equal(coverDamageMultiplier(tall, { x: 420, y: 200 }), 1, 'outside the cone');
  assert.equal(coverDamageMultiplier(tall, { x: 200, y: 300, z: 140 }), 1, 'a shooter above the 128 top');
  assert.equal(coverDamageMultiplier(tall, { x: 200, y: 300, z: 60 }), 0.4, 'a shooter below the top');
  assert.equal(coverDamageMultiplier(tall, { x: 200, y: 87 }), 1, 'a hit at the hero centre has no direction');
  assert.equal(applyCoverToDamage(tall, { x: 200, y: 300 }, 25), 10);
  assert.equal(applyCoverToDamage(tall, { x: 200, y: 300 }, 7), 3);
  assert.equal(applyCoverToDamage(tall, { x: 200, y: 0 }, 7), 7);

  const short = createCoverState();
  run(short, 6, () => ({ move: { x: 0, y: 1 } }), { at: { x: 150, y: 268 } });
  assert.equal(coverDamageMultiplier(short, { x: 150, y: 500 }), 0.6);
  assert.equal(coverDamageMultiplier(short, { x: 150, y: 500, z: 48 }), 1, 'a shooter at the short top shoots over it');
  assert.equal(applyCoverToDamage(short, { x: 150, y: 500 }, 25), 15);
  assert.equal(coverDamageMultiplier(createCoverState(), { x: 0, y: 0 }), 1);
});

test('the enemy signal exposes the covered hero without touching state', () => {
  const state = createCoverState();
  assert.deepEqual(coverSignal(state, 3), { playerInCover: false, kind: null, faceId: null, blockerId: null, normal: null, position: null, peeking: false, ticksInCover: 0 });
  enterTall(state);
  const before = canonicalCoverJson(state);
  const signal = coverSignal(state, 9);
  assert.deepEqual(signal, { playerInCover: true, kind: 'tall', faceId: 'wall-tall:0', blockerId: 'wall-tall', normal: { x: 0, y: -1 }, position: { x: 200, y: 87 }, peeking: false, ticksInCover: 5 });
  assert.equal(Object.isFrozen(signal), true);
  assert.equal(canonicalCoverJson(state), before);
});

test('projectiles hitting cover geometry are blocked; an elevated shot passes over short cover', () => {
  const hero = (x, y) => createHurtTarget({
    id: 'player', bodyShape: { type: 'circle', radius: RADIUS }, hurtShape: { type: 'circle', radius: RADIUS },
    previousGround: { x, y, z: 0 }, currentGround: { x, y, z: 0 }, minZ: 0, maxZ: 58, health: 100,
  });
  const shot = (id, from, to) => createProjectileState({ id, ownerId: 'enemy', previous: from, current: to, radius: 2, damage: 10, policy: { type: 'hitscan' } });

  const throughTall = resolveProjectilePath({ projectile: shot('a', { x: 200, y: 250, z: 24 }, { x: 200, y: 60, z: 24 }), targets: [hero(200, 87)], blockers: WORLD });
  assert.equal(throughTall.coverHit?.blockerId, 'wall-tall');
  assert.equal(throughTall.hits.length, 0);

  const throughShort = resolveProjectilePath({ projectile: shot('b', { x: 150, y: 500, z: 24 }, { x: 150, y: 260, z: 24 }), targets: [hero(150, 287)], blockers: WORLD });
  assert.equal(throughShort.coverHit?.blockerId, 'wall-short');
  assert.equal(throughShort.hits.length, 0);

  const overShort = resolveProjectilePath({ projectile: shot('c', { x: 150, y: 500, z: 60 }, { x: 150, y: 260, z: 52 }), targets: [hero(150, 287)], blockers: WORLD });
  assert.equal(overShort.coverHit, null, 'a shooter above the 48 top clears the wall');
  assert.deepEqual(overShort.hits.map((hit) => hit.targetId), ['player']);

  const overTall = resolveProjectilePath({ projectile: shot('d', { x: 200, y: 250, z: 60 }, { x: 200, y: 60, z: 52 }), targets: [hero(200, 87)], blockers: WORLD });
  assert.equal(overTall.coverHit?.blockerId, 'wall-tall', 'the same elevation does not clear a 128 wall');

  assert.equal(traceHeightAwareLineOfSight({ from: { x: 200, y: 250, z: 24 }, to: { x: 200, y: 87, z: 24 }, radius: 2, blockers: WORLD }).clear, false);
  assert.equal(traceHeightAwareLineOfSight({ from: { x: 150, y: 500, z: 60 }, to: { x: 150, y: 287, z: 52 }, radius: 2, blockers: WORLD }).clear, true);
  assert.equal(traceHeightAwareLineOfSight({ from: { x: 150, y: 500, z: 24 }, to: { x: 150, y: 287, z: 24 }, radius: 2, blockers: WORLD }).clear, false);
});

function scriptedInput(tick) {
  if (tick < 8) return { move: { x: 0, y: 1 } };
  if (tick < 40) return { move: { x: 1, y: 0 } };
  if (tick < 60) return { fire: true };
  if (tick < 70) return { move: { x: -1, y: 0 }, reload: tick % 3 === 0 };
  if (tick === 70) return { dodge: true };
  if (tick < 90) return { move: { x: 0, y: 1 } };
  if (tick < 120) return { aimHeld: true, hit: tick === 100 };
  if (tick < 130) return { move: { x: 0, y: -1 } };
  if (tick < 140) return { move: { x: 0, y: 1 } };
  return { move: { x: 1, y: 0 } };
}

function scriptedRun(inputAt, ticks = 400) {
  const state = createCoverState();
  const hashes = [];
  let at = { x: 200, y: 68 };
  const events = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = stepCover(state, { player: player(at.x, at.y), input: inputAt(tick), faces: FACES, tick });
    if (result.position) at = result.position;
    else if (inputAt(tick).move) at = { x: at.x + inputAt(tick).move.x * 2, y: at.y + inputAt(tick).move.y * 2 };
    // A free hero is kept off the wall the way the collision solver would.
    if (at.y > 87) at = { x: at.x, y: 87 };
    if (result.event) events.push(`${tick}:${result.event}`);
    hashes.push(hashCoverState(state));
  }
  return { hashes, events, state };
}

test('the same scripted inputs produce identical state hashes on two fresh runs', () => {
  const first = scriptedRun(scriptedInput);
  const second = scriptedRun(scriptedInput);
  assert.deepEqual(first.hashes, second.hashes);
  assert.deepEqual(first.events, second.events);
  assert.ok(first.events.includes('5:enter'), first.events.join(' '));
  assert.ok(first.events.some((event) => event.endsWith(':leave-roll')), first.events.join(' '));
  assert.ok(first.events.some((event) => event.endsWith(':leave-step')), first.events.join(' '));
  assert.ok(first.events.filter((event) => event.endsWith(':enter')).length >= 2, first.events.join(' '));
  const changed = scriptedRun((tick) => (tick === 30 ? { move: { x: 0, y: 0 } } : scriptedInput(tick)));
  assert.notDeepEqual(changed.hashes, first.hashes, 'a one-tick input change changes the trajectory');
  assert.deepEqual(changed.hashes.slice(0, 30), first.hashes.slice(0, 30), 'and only from that tick on');
});

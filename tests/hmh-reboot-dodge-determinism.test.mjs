// Death-cam-dodge slice (design package S1.1) same-seed evidence check. A
// headless run of the real kernel, the real InputState driven through
// keyboard, touch and gamepad phases, the real dodge intent, dash state and
// dash world step. Two runs of one seed give one digest; the per-tick input
// stream the kernel hands its replay observers reproduces the run exactly when
// fed back one tick per frame (the Ranked replay property); and a different
// seed gives a different digest. The keyboard phases never dodge on their own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FIXED_STEP_MS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { InputState } from '../apps/hmh-reboot/src/input.mjs';
import { resolveDodgeIntent } from '../apps/hmh-reboot/src/dodge-intent.mjs';
import { beginDash, createDashState, isDashInvulnerable, resolveDashWorldStep, stepDash } from '../apps/hmh-reboot/src/dash.mjs';
import { createCollisionBody } from '../apps/hmh-reboot/src/collision.mjs';
import { createCameraState } from '../apps/hmh-reboot/src/world-space.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';

const RUN_TICKS = 4_200;
const BODY = createCollisionBody({ id: 'player', kind: 'player', radius: 24, minZ: 0, maxZ: 48 });
const BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 6000, maxY: 6000, visibleBoundaryId: 'edge' });
// A cliff drop runs down the west edge of the field.
const queryGround = (x) => (x < 200 ? { groundZ: -64, kind: 'ground', walkable: true } : { groundZ: 0, kind: 'ground', walkable: true });
const safeStand = (x, y) => { const ground = queryGround(x, y); return ground.walkable && !ground.deepWater && Math.abs(ground.groundZ) <= 6; };
const KEYBOARD_PHASES = [[0, 1000], [3000, RUN_TICKS]];

// Device events, keyed by the tick they are meant for (applied half a tick
// early in wall time, so the frame partition decides which tick admits them).
const SCRIPT = Object.freeze([
  [1, (input, at) => input.setKey('ShiftLeft', true, at)], // no move yet: away from the aim
  [4, (input, at) => input.setKey('ShiftLeft', false, at)],
  [370, (input, at) => input.setKey('KeyA', true, at)], // walk to the cliff edge
  [440, (input, at) => input.setKey('ShiftLeft', true, at)], // refused: the drop
  [445, (input, at) => input.setKey('ShiftLeft', false, at)],
  [450, (input, at) => { input.setKey('KeyA', false, at); input.setKey('KeyD', true, at); }],
  [460, (input, at) => input.setKey('ShiftLeft', true, at)], // the refusal spent nothing
  [465, (input, at) => input.setKey('ShiftLeft', false, at)],
  [470, (input, at) => input.setKey('ShiftLeft', true, at)], // held across the cooldown: no repeat
  [900, (input, at) => input.setKey('ShiftLeft', false, at)],
  [910, (input, at) => input.setKey('ShiftLeft', true, at)],
  [915, (input, at) => input.setKey('ShiftLeft', false, at)],
  [950, (input, at) => input.setKey('KeyD', false, at)],
  [1000, (input, at) => input.setTouch({ moveX: 1, moveY: 0 }, at)],
  [1500, (input, at) => input.setTouch({ moveX: -1, moveY: 0 }, at)],
  [2000, (input, at) => { input.setTouch({}, at); input.setGamepad({ moveX: 0, moveY: -1 }, at); }],
  [2500, (input, at) => input.setGamepad({ moveX: 0, moveY: 1 }, at)],
  [3000, (input, at) => { input.setGamepad({}, at); input.setKey('KeyS', true, at); }],
  [3250, (input, at) => input.setKey('ShiftLeft', true, at)],
  [3255, (input, at) => input.setKey('ShiftLeft', false, at)],
  [3300, (input, at) => input.setKey('KeyS', false, at)],
  [3700, (input, at) => input.setKey('ShiftLeft', true, at)], // standing: the last move
  [3705, (input, at) => input.setKey('ShiftLeft', false, at)],
]);

function createWorld(seed) {
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const actor = { x: 236, y: 3000, groundZ: 0 };
  // Tier 2 (360 ticks) keeps several dodges inside one minute.
  const dash = createDashState({ cooldownTier: 2 });
  const events = [];
  const hash = createHash('sha256');
  let lastMove = null;
  let previousDash = false;
  let attacker = null;
  simulation.onStep(({ tick, input }) => {
    const moveLength = Math.hypot(input.move.x, input.move.y);
    if (moveLength > 0) lastMove = { x: input.move.x / moveLength, y: input.move.y / moveLength };
    // A seeded aim in the west half-plane: the aim fallback dodges east-ish.
    const angle = Math.PI / 2 + seededUnit(seed, `aim:${Math.floor(tick / 60)}`) * Math.PI;
    const aim = { x: Math.cos(angle), y: Math.sin(angle) };
    // A melee attacker tells behind the hero every two seconds.
    if (attacker && tick > attacker.attackPhaseUntilTick) attacker = null;
    if (tick % 120 === 60 && lastMove) {
      attacker = {
        id: 'attacker', archetypeId: 'bagholder-rusher', x: actor.x - lastMove.x * 35, y: actor.y - lastMove.y * 35, groundZ: 0,
        active: true, health: 20, attackPhase: 'tell', attackPhaseUntilTick: tick + 4, telegraphTarget: { x: actor.x, y: actor.y, groundZ: 0 },
      };
    }
    // The dodge edge is also edge-detected in the simulation, as main.mjs does.
    const pressed = input.dash === true && !previousDash;
    previousDash = input.dash === true;
    const intent = resolveDodgeIntent({
      tick, input: { ...input, dash: pressed }, actor, state: dash, body: BODY, bounds: BOUNDS, blockers: [], queryGround,
      enemies: attacker ? [attacker] : [], lastMove, aim,
    });
    if (intent?.blocked) events.push({ tick, mode: 'blocked', distance: intent.distance });
    else if (intent) {
      beginDash(dash, { tick, direction: intent.direction, distance: intent.distance });
      events.push({ tick, mode: intent.mode, distance: intent.distance, direction: intent.direction });
    }
    const frame = stepDash(dash, { tick });
    if (frame.active) {
      const step = resolveDashWorldStep({ state: dash, start: { x: actor.x, y: actor.y, z: actor.groundZ }, delta: frame.delta, body: BODY, blockers: [], bounds: BOUNDS, queryGround, enemies: [] });
      actor.x = step.position.x;
      actor.y = step.position.y;
    } else if (moveLength > 0) {
      const next = { x: Math.min(BOUNDS.maxX - 24, Math.max(24, actor.x + input.move.x * 4)), y: Math.min(BOUNDS.maxY - 24, Math.max(24, actor.y + input.move.y * 4)) };
      if (safeStand(next.x, next.y)) Object.assign(actor, next);
    }
    hash.update(JSON.stringify([tick, actor.x, actor.y, dash.active, dash.cooldownReadyTick, isDashInvulnerable(dash, tick), input.manualDodge]));
  });
  simulation.start();
  return { simulation, actor, dash, events, digest: () => createHash('sha256').update(hash.copy().digest('hex')).update(JSON.stringify(events)).digest('hex') };
}

function liveRun({ seed, partitionSeed }) {
  const world = createWorld(seed);
  const input = new InputState();
  const recorded = [];
  world.simulation.onReplayEvent((event) => recorded.push(event.input));
  const context = { actor: { x: 0, y: 0, z: 0 }, camera: createCameraState({ x: 0, y: 0 }), viewport: { width: 800, height: 450 } };
  let nowMs = 0;
  let cursor = 0;
  let frameIndex = 0;
  while (world.simulation.tick < RUN_TICKS) {
    const steps = Math.min(RUN_TICKS - world.simulation.tick, 1 + Math.floor(seededUnit(partitionSeed, `frame:${frameIndex}`) * 4));
    frameIndex += 1;
    nowMs += steps * FIXED_STEP_MS;
    while (cursor < SCRIPT.length && (SCRIPT[cursor][0] - 0.5) * FIXED_STEP_MS <= nowMs) {
      SCRIPT[cursor][1](input, (SCRIPT[cursor][0] - 0.5) * FIXED_STEP_MS);
      cursor += 1;
    }
    const snapshot = input.snapshot({ ...context, nowMs });
    const frame = world.simulation.update(steps * FIXED_STEP_MS, snapshot.actions, snapshot.heldActions);
    if (frame.steps > 0) input.consumeBufferedActions(snapshot.sequence);
  }
  return { digest: world.digest(), events: world.events, recorded };
}

function replayRun({ seed, recorded }) {
  const world = createWorld(seed);
  for (const tickInput of recorded) world.simulation.update(FIXED_STEP_MS, tickInput);
  return { digest: world.digest(), events: world.events };
}

const inKeyboardPhase = (tick) => KEYBOARD_PHASES.some(([from, to]) => tick >= from && tick < to);

test('the dodge run exercises manual, refused and automatic dodges, and the keyboard never dodges on its own', () => {
  const { events } = liveRun({ seed: 0x5eed, partitionSeed: 7 });
  const modes = (predicate) => events.filter(predicate).map((event) => event.mode);
  assert.ok(events.filter((event) => event.mode === 'manual').length >= 5, JSON.stringify(events));
  assert.ok(events.some((event) => event.mode === 'blocked'), 'a dodge into the cliff is refused');
  assert.ok(events.some((event) => event.mode === 'automatic' && event.tick >= 1000 && event.tick < 2000), 'touch keeps the automatic dodge');
  assert.ok(events.some((event) => event.mode === 'automatic' && event.tick >= 2000 && event.tick < 3000), 'the gamepad keeps the automatic dodge');
  assert.deepEqual(modes((event) => inKeyboardPhase(event.tick) && event.mode === 'automatic'), [], 'no automatic dodge while the keyboard is active');
  assert.deepEqual(modes((event) => !inKeyboardPhase(event.tick) && event.mode !== 'automatic'), [], 'touch and gamepad have no manual dodge');
  const [first] = events;
  assert.equal(first.mode, 'manual');
  assert.ok(first.direction.x > 0, 'with no move yet the first dodge goes directly away from the (westward) aim');
  const blocked = events.find((event) => event.mode === 'blocked');
  const next = events.find((event) => event.tick > blocked.tick);
  assert.equal(next.mode, 'manual', 'the refused dodge spent no cooldown');
  assert.ok(next.tick - blocked.tick < 40);
  const held = events.filter((event) => event.mode === 'manual' && event.tick > next.tick && event.tick < 900);
  assert.deepEqual(held, [], 'a held key never repeats the dodge');
  const standing = events.at(-1);
  assert.equal(standing.mode, 'manual');
  assert.ok(standing.tick >= 3700 && standing.direction.y === 1, 'standing still dodges along the last move');
});

test('two runs of one seed give one digest, the recorded input stream replays it, and another seed differs', () => {
  for (const partitionSeed of [7, 99]) {
    const first = liveRun({ seed: 0x5eed, partitionSeed });
    const second = liveRun({ seed: 0x5eed, partitionSeed });
    assert.equal(first.digest, second.digest, `partition ${partitionSeed}`);
    assert.equal(first.recorded.length, RUN_TICKS);
    const replay = replayRun({ seed: 0x5eed, recorded: first.recorded });
    assert.equal(replay.digest, first.digest, `the Ranked input stream reproduces the run (partition ${partitionSeed})`);
  }
  assert.notEqual(liveRun({ seed: 0x5eee, partitionSeed: 7 }).digest, liveRun({ seed: 0x5eed, partitionSeed: 7 }).digest);
});

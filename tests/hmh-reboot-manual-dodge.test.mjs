// Design package S1.1 / 7.7: the manual dodge on a desktop keyboard. Automatic
// dodge is off while the keyboard is the active input; touch and gamepad keep
// it. Both dodges share one dash state, so the cooldown (600/480/360 ticks)
// and the eight i-frame ticks are identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DODGE_SAMPLE_STEP,
  MANUAL_DODGE_MIN_DISTANCE,
  manualDodgeDirection,
  planManualDodge,
  resolveDodgeIntent,
} from '../apps/hmh-reboot/src/dodge-intent.mjs';
import { automaticDodgeIntent, firstUnsafeDodgeSample } from '../apps/hmh-reboot/src/automatic-actions.mjs';
import {
  DASH_COOLDOWN_TICKS_BY_TIER,
  DASH_DISTANCE,
  DASH_DURATION_TICKS,
  DASH_INVULNERABILITY_TICKS,
  beginDash,
  createDashState,
  getDashStatus,
  isDashInvulnerable,
  resolveDashWorldStep,
  stepDash,
} from '../apps/hmh-reboot/src/dash.mjs';
import { createCollisionBody, createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';

const body = createCollisionBody({ id: 'player', kind: 'player', radius: 24, minZ: 0, maxZ: 48 });
const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000, visibleBoundaryId: 'edge' };
const ground = () => ({ groundZ: 0, kind: 'ground', walkable: true });
const actor = { x: 400, y: 400, groundZ: 0 };
const tellingEnemy = {
  id: 'e', archetypeId: 'bagholder-rusher', x: 365, y: 400, groundZ: 0, active: true, health: 20,
  attackPhase: 'tell', attackPhaseUntilTick: 15, telegraphTarget: { x: 400, y: 400, groundZ: 0 },
};
const world = (overrides = {}) => ({
  tick: 10, actor, state: createDashState(), body, bounds, blockers: [], queryGround: ground,
  enemies: [tellingEnemy], lastMove: null, aim: { x: 1, y: 0 }, ...overrides,
});
const keyboard = (overrides = {}) => ({ move: { x: 1, y: 0 }, dash: false, manualDodge: true, ...overrides });
const touch = (overrides = {}) => ({ move: { x: 1, y: 0 }, dash: false, manualDodge: false, ...overrides });

test('the keyboard turns the automatic dodge off; the dodge key is its only trigger', () => {
  const args = world();
  // The same imminent tell the automatic dodge answers on touch or a gamepad.
  assert.deepEqual(automaticDodgeIntent({ ...args, move: { x: 1, y: 0 } }), { x: 1, y: 0 });
  assert.deepEqual(resolveDodgeIntent({ ...args, input: touch() }), { mode: 'automatic', direction: { x: 1, y: 0 }, distance: DASH_DISTANCE });
  assert.equal(resolveDodgeIntent({ ...args, input: keyboard() }), null, 'no automatic dodge while the keyboard is active');
  assert.deepEqual(resolveDodgeIntent({ ...args, input: keyboard({ dash: true }) }), { mode: 'manual', direction: { x: 1, y: 0 }, distance: DASH_DISTANCE });
  // With nothing to dodge the key still dodges: it is the player's call.
  assert.deepEqual(resolveDodgeIntent({ ...args, enemies: [], input: keyboard({ dash: true }) }).mode, 'manual');
  // Touch and gamepad have no dodge binding: a stray dash bit never dodges for them.
  assert.equal(resolveDodgeIntent({ ...args, enemies: [], input: touch({ dash: true }) }), null);
});

test('the dodge direction is the move input, else the last move, else directly away from the aim', () => {
  assert.deepEqual(manualDodgeDirection({ move: { x: 3, y: 4 }, lastMove: { x: 0, y: 1 }, aim: { x: 1, y: 0 } }), { x: 0.6, y: 0.8 });
  assert.deepEqual(manualDodgeDirection({ move: { x: 0, y: 0 }, lastMove: { x: 0, y: -2 }, aim: { x: 1, y: 0 } }), { x: 0, y: -1 });
  assert.deepEqual(manualDodgeDirection({ move: { x: 0, y: 0 }, lastMove: null, aim: { x: 0.6, y: -0.8 } }), { x: -0.6, y: 0.8 });
  assert.equal(manualDodgeDirection({ move: { x: 0, y: 0 }, lastMove: null, aim: { x: 0, y: 0 } }), null);
  const standing = resolveDodgeIntent({ ...world({ enemies: [], aim: { x: 1, y: 0 } }), input: keyboard({ move: { x: 0, y: 0 }, dash: true }) });
  assert.deepEqual(standing.direction, { x: -1, y: 0 }, 'standing still dodges away from the aim, never along it');
});

test('a manual dodge on cooldown or mid-dash is ignored and spends nothing', () => {
  const state = createDashState();
  state.cooldownReadyTick = 100;
  assert.equal(resolveDodgeIntent({ ...world({ state }), input: keyboard({ dash: true }) }), null);
  const active = createDashState();
  beginDash(active, { tick: 5, direction: { x: 1, y: 0 } });
  assert.equal(resolveDodgeIntent({ ...world({ state: active }), input: keyboard({ dash: true }) }), null);
});

test('the footprint rule is shared: the first unsafe 4-unit sample, or null for a safe route', () => {
  const start = { x: 400, y: 400 };
  const direction = { x: 1, y: 0 };
  assert.equal(DODGE_SAMPLE_STEP, 4);
  assert.equal(firstUnsafeDodgeSample({ start, direction, distance: 192, radius: 24, groundZ: 0, queryGround: ground }), null);
  const drop = (x) => (x > 470 ? { groundZ: -64, kind: 'ground', walkable: true } : ground());
  assert.equal(firstUnsafeDodgeSample({ start, direction, distance: 192, radius: 24, groundZ: 0, queryGround: drop }), 72);
  // A narrow bridge: the side samples hang over deep water at the very start.
  const bridge = (x, y) => (Math.abs(y - 400) > 10 ? { groundZ: -18, kind: 'water', walkable: false, deepWater: true } : ground());
  assert.equal(firstUnsafeDodgeSample({ start, direction, distance: 192, radius: 24, groundZ: 0, queryGround: bridge }), 0);
});

test('a manual dodge is truncated at the last safe sample before a drop, deep water, a wall or the world edge', () => {
  const plan = (overrides) => planManualDodge({ ...world(overrides), direction: { x: 1, y: 0 } });
  assert.deepEqual(plan({}), { allowed: true, distance: DASH_DISTANCE });
  assert.deepEqual(plan({ queryGround: (x) => (x > 470 ? { groundZ: -64, kind: 'ground', walkable: true } : ground()) }), { allowed: true, distance: 68 });
  assert.deepEqual(plan({ queryGround: (x) => (x > 520 ? { groundZ: -18, kind: 'water', walkable: false, deepWater: true } : ground()) }), { allowed: true, distance: 120 });
  const wall = createStaticBlocker({ id: 'wall', shape: { type: 'capsule', a: { x: 500, y: 300 }, b: { x: 500, y: 500 }, radius: 12 }, minZ: 0, maxZ: 80, visibleAssetId: 'wall', combatCover: true });
  // A wall or the world edge: the last whole sample short of the contact.
  for (const [label, overrides, contact] of [
    ['wall', { blockers: [wall] }, 500 - 12 - 24 - 400],
    ['world edge', { bounds: { ...bounds, maxX: 520 } }, 520 - 24 - 400],
  ]) {
    const planned = plan(overrides);
    assert.equal(planned.allowed, true, label);
    assert.equal(planned.distance % DODGE_SAMPLE_STEP, 0, label);
    assert.ok(planned.distance < contact && planned.distance >= contact - DODGE_SAMPLE_STEP, `${label}: ${planned.distance} vs contact ${contact}`);
  }
});

test('under 48 safe units the dodge is refused, no cooldown is spent, and the refusal is reported', () => {
  assert.equal(MANUAL_DODGE_MIN_DISTANCE, 48);
  const cliff = (x) => (x > 440 ? { groundZ: 64, kind: 'ledge', walkable: true } : ground());
  const state = createDashState();
  const refused = resolveDodgeIntent({ ...world({ state, enemies: [], queryGround: cliff }), input: keyboard({ dash: true }) });
  assert.deepEqual(refused, { mode: 'manual', blocked: true, direction: { x: 1, y: 0 }, distance: 40 });
  assert.equal(state.cooldownReadyTick, 0);
  assert.equal(getDashStatus(state, 10).ready, true, 'a refused dodge leaves the dodge ready');
  const edge = (x) => (x > 448 ? { groundZ: -64, kind: 'ground', walkable: true } : ground());
  assert.equal(resolveDodgeIntent({ ...world({ enemies: [], queryGround: edge }), input: keyboard({ dash: true }) }).distance, 48, '48 safe units still dodge');
});

test('a truncated dodge keeps dash speed, the eight i-frame ticks and the full cooldown of its tier', () => {
  for (const [tier, cooldown] of DASH_COOLDOWN_TICKS_BY_TIER.entries()) {
    const state = createDashState({ cooldownTier: tier });
    const start = beginDash(state, { tick: 10, direction: { x: 1, y: 0 }, distance: 68 });
    assert.equal(start.started, true);
    assert.equal(state.cooldownReadyTick, 10 + cooldown);
    const deltas = [];
    for (let tick = 10; tick < 20 && state.active; tick += 1) deltas.push(stepDash(state, { tick }).delta.x);
    assert.deepEqual(deltas, [24, 24, 20], 'full-speed ticks, then the remainder');
    assert.equal(state.active, false);
    for (let tick = 10; tick < 10 + DASH_INVULNERABILITY_TICKS; tick += 1) assert.equal(isDashInvulnerable(state, tick), true);
    assert.equal(isDashInvulnerable(state, 10 + DASH_INVULNERABILITY_TICKS), false);
  }
  // The automatic dodge (and any full dodge) is still eight equal steps.
  const full = createDashState();
  beginDash(full, { tick: 0, direction: { x: 1, y: 0 } });
  const steps = [];
  while (full.active) steps.push(stepDash(full, { tick: steps.length }).delta.x);
  assert.deepEqual(steps, Array(DASH_DURATION_TICKS).fill(DASH_DISTANCE / DASH_DURATION_TICKS));
  assert.throws(() => beginDash(createDashState(), { tick: 0, direction: { x: 1, y: 0 }, distance: DASH_DISTANCE + 1 }), /dash distance/i);
  assert.throws(() => beginDash(createDashState(), { tick: 0, direction: { x: 1, y: 0 }, distance: 0 }), /dash distance/i);
});

test('a planned dodge runs to its planned end through the real world step without clipping the hazard', () => {
  const drop = (x) => (x > 470 ? { groundZ: -64, kind: 'ground', walkable: true } : ground());
  const args = world({ enemies: [], queryGround: drop });
  const intent = resolveDodgeIntent({ ...args, input: keyboard({ dash: true }) });
  assert.deepEqual(intent, { mode: 'manual', direction: { x: 1, y: 0 }, distance: 68 });
  beginDash(args.state, { tick: 10, direction: intent.direction, distance: intent.distance });
  let position = { x: actor.x, y: actor.y, z: 0 };
  for (let tick = 10; args.state.active; tick += 1) {
    const frame = stepDash(args.state, { tick });
    position = resolveDashWorldStep({ ...args, start: position, delta: frame.delta }).position;
  }
  assert.equal(position.x, 468);
  assert.equal(position.y, 400);
  assert.equal(drop(position.x).groundZ, 0, 'the dodge ends on the near side of the drop');
});

test('Shift is the dodge key, so Shift+Escape pauses a live run or an open level-up instead of exiting', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /const shiftExit = event\.shiftKey && !\['active', 'upgrade'\]\.includes\(simulation\?\.state\);/);
  assert.match(source, /if \(shiftExit && bridge\?\.initialized\)/);
  assert.doesNotMatch(source, /if \(event\.shiftKey && bridge\?\.initialized\)/, 'a dodge followed by Escape never quits the run');
});

// Feel pass (1.8.7, slice "feel"). Projection only.
//
// B2  camera shake is a trauma accumulator: events add, the total clamps at the
//     boss-defeat ceiling, decay is exponential, amplitude is trauma^2 and the
//     offset comes from two layered sines phased by the tick.
// B1  a deterministic damped spring (semi-implicit Euler at 1/120 s) drives the
//     held-weapon recoil, a hero squash on hit and a small camera kick toward
//     the hit direction. Sim events kick; the render pass reads the springs.
// E2  ordinary-enemy tell rings are coloured by ATTACK KIND (melee, ranged,
//     area, support), sized to the attack's reach, in a palette kept apart
//     from pickup and interactive colours.
//
// Nothing here reads back into the simulation; scripts/hmh-sim-digest.mjs
// prints the same combined digest with and without the slice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Container } from 'pixi.js';

import {
  SHAKE_MAX_PX,
  TRAUMA_DECAY_PER_TICK,
  createFeelRig,
  createSpring,
  stepSpring,
  withRecoilClimb,
  withRecoilPullback,
} from '../apps/hmh-reboot/src/feel-motion.mjs';
import { weaponRecoilShake } from '../apps/hmh-reboot/src/combat-feedback.mjs';
import { createEnemyRenderPass, ENEMY_TELL_KIND_COLORS, ENEMY_TELL_KIND_REACH } from '../apps/hmh-reboot/src/enemy-render-pass.mjs';
import { isScreenPointVisible } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { worldToScreenInto } from '../apps/hmh-reboot/src/world-space.mjs';
import { prepareWorldDesignEnemyPose } from '../apps/hmh-reboot/src/world-design-life.mjs';
import {
  isEliteEnemyProjection,
  resolveEnemyRuntimeVisualState,
  selectEnemyRosterPose,
} from '../apps/hmh-reboot/src/enemy-production-art.mjs';
import { creatureAnimationTick, creatureIdPhase } from '../apps/hmh-reboot/src/creature-presentation.mjs';
import { resolveEnemyVisualDirection } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
import { worldDepthKey } from '../apps/hmh-reboot/src/world-depth.mjs';
import { projectGasBomberCanister } from '../apps/hmh-reboot/src/enemy-attack-presentation.mjs';
import { ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const mainSource = read('../apps/hmh-reboot/src/main.mjs');

// ---------------------------------------------------------------- B2 trauma

test('B2: a lone event peaks at its authored magnitude, so per-weapon tuning survives', () => {
  const rig = createFeelRig();
  for (const magnitude of [1.6, 4.2, 5, 7.5, 10, 12]) {
    rig.reset();
    rig.addTrauma(40, magnitude);
    assert.ok(Math.abs(rig.shakeAmplitude(40) - magnitude) < 1e-9, `${magnitude} px`);
  }
});

test('B2: overlapping events stack instead of the strongest overriding', () => {
  const rig = createFeelRig();
  rig.addTrauma(10, 5);
  const one = rig.shakeAmplitude(10);
  rig.addTrauma(10, 5);
  assert.ok(rig.shakeAmplitude(10) > one, 'two same-tick hits outweigh one');
  // The old rule dropped a weaker impulse while a stronger one decayed.
  rig.reset();
  rig.addTrauma(0, 10);
  const before = rig.shakeAmplitude(3);
  rig.addTrauma(3, 1.6);
  assert.ok(rig.shakeAmplitude(3) > before, 'a weak event still adds on top of a strong one');
});

test('B2: trauma clamps at 1, so no pile-up out-shakes the boss defeat', () => {
  const rig = createFeelRig();
  for (let tick = 0; tick < 40; tick += 1) {
    rig.addTrauma(tick, 12);
    rig.addTrauma(tick, 10);
    assert.ok(rig.shakeAmplitude(tick) <= SHAKE_MAX_PX + 1e-9);
  }
  assert.equal(SHAKE_MAX_PX, 12, 'the ceiling is the boss-defeat shake');
});

test('B2: decay is exponential and bounded to the old nine-tick window', () => {
  const rig = createFeelRig();
  rig.addTrauma(100, 10);
  for (let age = 0; age < 20; age += 1) {
    const ratio = rig.shakeAmplitude(100 + age + 1) / rig.shakeAmplitude(100 + age);
    assert.ok(Math.abs(ratio - TRAUMA_DECAY_PER_TICK ** 2) < 1e-9, 'constant per-tick ratio');
  }
  assert.ok(rig.shakeAmplitude(109) < 0.06 * 10, 'under 6% of the peak nine ticks on');
  assert.ok(rig.shakeAmplitude(160) < 0.001, 'gone within a second');
  assert.equal(rig.shakeAmplitude(99), 0, 'nothing before the event');
  assert.deepEqual({ ...rig.cameraOffset(200) }, { x: 0, y: 0 }, 'exactly still once spent');
});

test('B2: sustained minigun fire stays lighter than its old per-shot kick', () => {
  // auto-miner fires 12 times a second, one shot every five ticks.
  const rig = createFeelRig();
  let peak = 0;
  for (let tick = 0; tick < 600; tick += 1) {
    if (tick % 5 === 0) rig.addTrauma(tick, weaponRecoilShake('auto-miner'));
    peak = Math.max(peak, rig.shakeAmplitude(tick));
  }
  assert.ok(peak <= 0.9, `held minigun peaks at ${peak.toFixed(3)} px`);
  assert.ok(peak < weaponRecoilShake('coin-blaster'), 'still lighter than one pistol shot');
});

test('B2: the offset is two layered sines, deterministic and inside the envelope', () => {
  const a = createFeelRig();
  const b = createFeelRig();
  a.addTrauma(50, 8);
  b.addTrauma(50, 8);
  const seen = new Set();
  for (let step = 0; step < 40; step += 1) {
    const time = 50 + step * 0.25;
    const left = { ...a.cameraOffset(time) };
    const right = { ...b.cameraOffset(time) };
    assert.deepEqual(left, right, 'same tick, same offset');
    const envelope = a.shakeAmplitude(time);
    assert.ok(Math.abs(left.x) <= envelope + 1e-9 && Math.abs(left.y) <= envelope + 1e-9);
    seen.add(`${left.x.toFixed(4)}|${left.y.toFixed(4)}`);
  }
  assert.ok(seen.size > 30, 'the offset moves');
  const idle = createFeelRig();
  assert.deepEqual({ ...idle.cameraOffset(12.5) }, { x: 0, y: 0 }, 'no trauma, no offset');
});

// ---------------------------------------------------------------- B1 springs

test('B1: the spring is sub-stepped at a fixed rate, so batching ticks changes nothing', () => {
  const once = createSpring(900, 0.55);
  const each = createSpring(900, 0.55);
  once.v = each.v = 120;
  stepSpring(once, 10);
  for (let tick = 0; tick < 10; tick += 1) stepSpring(each, 1);
  assert.equal(once.x, each.x);
  assert.equal(once.v, each.v);
});

test('B1: a kicked spring overshoots a little and comes back to rest', () => {
  const spring = createSpring(900, 0.55);
  spring.v = 100;
  let peak = 0;
  let under = 0;
  for (let tick = 0; tick < 60; tick += 1) {
    stepSpring(spring, 1);
    peak = Math.max(peak, spring.x);
    under = Math.min(under, spring.x);
  }
  assert.ok(peak > 0 && -under < peak * 0.2, 'damped, small overshoot');
  assert.deepEqual([spring.x, spring.v], [0, 0], 'exactly at rest after a second');
  const idle = createSpring(900, 0.55);
  stepSpring(idle, 10_000);
  assert.deepEqual([idle.x, idle.v], [0, 0], 'a long gap settles');
});

test('B1: the rig is refresh-rate independent: kicks land on their own tick', () => {
  // One renderer advances every tick, the other only once per "frame" of
  // three ticks; the events are the same, so the springs must be identical.
  const everyTick = createFeelRig();
  const perFrame = createFeelRig();
  const kicks = new Map([[3, ['recoil', 90]], [7, ['squash', 3.6]], [8, ['kickX', -160]], [13, ['recoil', 300]]]);
  for (let tick = 0; tick <= 30; tick += 1) {
    const kick = kicks.get(tick);
    if (kick) {
      everyTick.kick(tick, ...kick);
      perFrame.kick(tick, ...kick);
    }
    everyTick.advance(tick);
    if (tick % 3 === 0) perFrame.advance(tick);
  }
  perFrame.advance(30);
  for (const name of ['recoil', 'squash', 'kickX', 'kickY']) {
    assert.equal(perFrame.springs[name].x, everyTick.springs[name].x, name);
  }
});

test('B1: a rewind or reset settles every spring', () => {
  const rig = createFeelRig();
  rig.kick(20, 'recoil', 300);
  rig.addTrauma(20, 9);
  rig.advance(22);
  assert.ok(rig.springs.recoil.x > 0);
  rig.advance(0);
  assert.equal(rig.springs.recoil.x, 0, 'a new run starting at tick 0 does not inherit a kick');
  rig.kick(5, 'squash', 3);
  rig.reset();
  assert.equal(rig.springs.squash.v, 0);
  assert.equal(rig.shakeAmplitude(20), 0);
});

test('B1: recoil helpers pull back against the aim and climb the muzzle', () => {
  assert.equal(withRecoilClimb(null, 0), null, 'at rest the reload dip passes through');
  const dip = { dy: 4, rotation: 0.2 };
  assert.equal(withRecoilClimb(dip, 0), dip);
  const climbed = withRecoilClimb(dip, 5);
  assert.equal(climbed.dy, 4);
  assert.ok(climbed.rotation < dip.rotation, 'climb opposes the reload dip, which tilts toward the ground');
  assert.equal(withRecoilPullback(undefined, { x: 1, y: 0 }, 0), undefined);
  const offset = withRecoilPullback({ x: 1, y: 2, rotation: 0.1 }, { x: 0.6, y: 0.8 }, 10);
  assert.deepEqual(offset, { x: -5, y: -6, rotation: 0.1 });
});

// ---------------------------------------------------------------- wiring

test('the runtime drives shake and springs through the rig, gated by the settings', () => {
  assert.doesNotMatch(mainSource, /SHAKE_DECAY_TICKS|shakeStartTick|shakeMagnitude/, 'the strongest-overrides shake is gone');
  assert.match(mainSource, /const triggerCameraShake = \(tick, magnitude\) => feel\.addTrauma\(tick, magnitude\)/);
  assert.match(mainSource, /settings\.screenShake && !settings\.reduceMotion/);
  assert.match(mainSource, /feel\.cameraOffset\(simulation\.tick \+ renderAlpha\)/);
  assert.match(mainSource, /feel\.kick\(tick, 'recoil', /, 'weapon fire kicks the recoil spring');
  assert.match(mainSource, /feel\.kick\(tick, 'squash', /, 'a player hit squashes the hero');
  assert.match(mainSource, /feel\.kick\(tick, 'kickX', /, 'a player hit kicks the camera');
  assert.match(mainSource, /feel\.reset\(\)/, 'a restart clears the rig');
  // Reduced motion zeroes the hero-side springs.
  assert.match(mainSource, /settings\.reduceMotion \? 0 : feel\.springs\.recoil\.x/);
  assert.match(mainSource, /settings\.reduceMotion \? 0 : feel\.springs\.squash\.x/);
  // Never through the camera, which screenToGround reads back for aim.
  assert.doesNotMatch(mainSource, /camera\.shake[XY]\s*=/);
});

// ---------------------------------------------------------------- E2 tells

const rgb = (color) => [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
const distance = (a, b) => Math.hypot(...rgb(a).map((value, index) => value - rgb(b)[index]));

// Pickup markers and banners, the interactive site rings and the aim reticle.
const RESERVED = [0x72ddeb, 0x99e7a5, 0xf2c56e, 0x83f28f, 0xff6b86, 0xfff06a, 0x9de4b1, 0xf1bd83, 0x81dce4, 0xc6e798, 0xffbe75, 0xe9afd0, 0x49ddff, 0xffd166];

test('E2: every attack kind has its own tell colour, apart from pickups and interactives', () => {
  const kinds = ['melee', 'ranged', 'area', 'support'];
  assert.deepEqual(Object.keys(ENEMY_TELL_KIND_COLORS).sort(), [...kinds].sort());
  const families = new Set(Object.values(ENEMY_ARCHETYPES).map((archetype) => archetype.attack.tokenFamily));
  for (const family of families) assert.ok(kinds.includes(family), `${family} has a colour`);
  const colors = kinds.map((kind) => ENEMY_TELL_KIND_COLORS[kind]);
  for (let a = 0; a < colors.length; a += 1) {
    for (let b = a + 1; b < colors.length; b += 1) assert.ok(distance(colors[a], colors[b]) >= 120, `${kinds[a]} vs ${kinds[b]}`);
    for (const reserved of RESERVED) {
      assert.ok(distance(colors[a], reserved) >= 90, `${kinds[a]} too close to ${reserved.toString(16)}`);
    }
  }
});

test('E2: the tell reach mirrors the simulated attack geometry', () => {
  const combat = read('../apps/hmh-reboot/src/enemy-combat.mjs');
  assert.match(combat, new RegExp(`type: 'area-circle', center: target, radius: ${ENEMY_TELL_KIND_REACH.area} `));
  assert.match(combat, new RegExp(`type: 'support-ring', center: target, radius: ${ENEMY_TELL_KIND_REACH.support} `));
  assert.match(combat, new RegExp(`type: 'lane', from: origin, to: target, halfWidth: ${ENEMY_TELL_KIND_REACH.ranged} `));
});

function recorder() {
  const calls = [];
  const graphics = new Proxy({}, {
    get: (_, key) => (...args) => {
      calls.push([key, ...args]);
      return graphics;
    },
  });
  return { graphics, calls };
}

function tellMarker() {
  const display = new Container();
  display.phaseRelativePoses = true;
  display.applyPose = () => ({ frame: { h: 60 }, anchor: { y: 0.5 } });
  display.setTint = () => {};
  return display;
}

function tellPass(tellByKind, enemyId) {
  const { graphics, calls } = recorder();
  const pass = createEnemyRenderPass({
    markers: new Map([[enemyId, tellMarker()]]),
    facing: new Map(),
    hitFeedbackById: new Map(),
    archetypes: ENEMY_ARCHETYPES,
    enemyTelegraphs: graphics,
    worldToScreenInto,
    isScreenPointVisible,
    resolveEnemyRuntimeVisualState,
    selectEnemyRosterPose,
    creatureAnimationTick,
    creatureIdPhase,
    isEliteEnemyProjection,
    resolveEnemyVisualDirection,
    prepareWorldDesignEnemyPose,
    worldDepthKey,
    contactShadowFootY: (_display, _pose, screenY) => screenY,
    drawEliteGroundRing: () => {},
    placeWeaponGlow: () => {},
    projectGasBomberCanister,
    tellByKind,
  });
  return { pass, calls };
}

const tellingEnemy = (archetypeId) => ({
  id: `tell-${archetypeId}`,
  archetypeId,
  active: true,
  x: 400,
  y: 300,
  groundZ: 0,
  radius: 20,
  health: 10,
  maxHealth: 10,
  velocity: { x: 0, y: 0 },
  spawnedTick: 0,
  attackPhase: 'tell',
  attackTellStartedTick: 90,
  attackPhaseUntilTick: 110,
  telegraphTarget: { x: 460, y: 330, groundZ: 0 },
  hitUntilTick: null,
});

function drawTell(archetypeId, tellByKind, zoom = 1) {
  const { pass, calls } = tellPass(tellByKind, `tell-${archetypeId}`);
  pass.render({
    enemies: [tellingEnemy(archetypeId)],
    camera: { x: 400, y: 300, zoom, shakeX: 0, shakeY: 0, groundZ: 0 },
    view: { width: 800, height: 600 },
    tick: 100,
    heroScreen: { x: 400, y: 300 },
    cullMargin: 200,
    animationBudget: 64,
    simulationActive: true,
    contactShadowPool: null,
    hitFeedback: null,
    particleScale: 1,
    reduceMotion: false,
    reduceFlash: false,
  });
  return calls;
}

// Leaves out the dark contour and the gas canister's cream stripe, which are
// fixed accents rather than the tell colour.
const strokeColors = (calls) => calls
  .filter(([key, style]) => key === 'stroke' && style.color !== 0x080d12 && style.color !== 0xfff4c7)
  .map(([, style]) => style.color);

test('E2: each archetype tells in its attack kind colour, sized to its reach', () => {
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    const family = archetype.attack.tokenFamily;
    const calls = drawTell(archetype.id, true, 1.25);
    const colors = strokeColors(calls);
    assert.ok(colors.length > 0, `${archetype.id} drew a tell`);
    for (const color of colors) assert.equal(color, ENEMY_TELL_KIND_COLORS[family], `${archetype.id} (${family})`);
    const circle = calls.find(([key]) => key === 'circle');
    if (family === 'melee') assert.equal(circle[3], archetype.attack.range * 1.25);
    if (family === 'area') assert.equal(circle[3], ENEMY_TELL_KIND_REACH.area * 1.25);
    if (family === 'support') assert.equal(circle[3], ENEMY_TELL_KIND_REACH.support * 1.25);
    if (family === 'ranged') {
      const lane = calls.find(([key, style]) => key === 'stroke' && style.cap === 'round');
      assert.equal(lane[1].width, ENEMY_TELL_KIND_REACH.ranged * 2 * 1.25, 'the glow is the full lane width');
    }
  }
});

test('E2: without the flag the pass keeps the 1.8.1 archetype colours for the reference replay', () => {
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    for (const color of strokeColors(drawTell(archetype.id, false))) assert.equal(color, archetype.visual.color);
  }
  assert.match(mainSource, /projectGasBomberCanister,\n\s+tellByKind: true,/, 'the runtime opts in');
});

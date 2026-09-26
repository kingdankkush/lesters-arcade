// Projection-only enemy body pass (perf step: render-alloc).
//
// The per-frame enemy loop moved out of main.mjs renderWorld into
// enemy-render-pass.mjs and stopped allocating per enemy. These tests replay
// seeded crowds through BOTH the new pass and a verbatim copy of the 1.8.1 loop
// (tests/fixtures/hmh-render-reference/enemy-body-pass.mjs) and require the same
// calls, in the same order, with the same arguments, and the same display and
// facing state after every frame. The budget selector is checked against
// selectAnimatedEnemyIds on randomized crowds with deliberate ties.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Container } from 'pixi.js';

import { animationPriority, createEnemyRenderPass, markAnimatedRows } from '../apps/hmh-reboot/src/enemy-render-pass.mjs';
import { referenceEnemyBodyPass, referenceHealthPips } from './fixtures/hmh-render-reference/enemy-body-pass.mjs';
import * as reference from './fixtures/hmh-render-reference/render-helpers.mjs';
import { isScreenPointVisible, selectAnimatedEnemyIds } from '../apps/hmh-reboot/src/runtime-performance.mjs';
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
import { ENEMY_ARCHETYPES, ENEMY_ARCHETYPE_IDS } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Argument snapshots: the new pass reuses its argument objects, so a recorder
// must copy what it is handed at call time.
const snapshot = (value) => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);

function recordingGraphics(log, name) {
  const graphics = new Proxy({}, {
    get: (_, method) => (...args) => { log.push([name, method, ...args.map(snapshot)]); return graphics; },
  });
  return graphics;
}

// A display honouring the contract the loop relies on: applyPose returns a
// frame-like pose and sets eliteProjection, setTint restores the base tint.
function makeMarker(log, id, kind) {
  const display = new Container();
  display.label = id;
  if (kind === 'roster') {
    display.phaseRelativePoses = true;
    display.rosterScale = 0.55;
    display.contactShadowFootprint = 22;
  }
  display.applyPose = (pose) => {
    log.push(['applyPose', display.label, snapshot(pose)]);
    // A vector death pose tilts its own root; the loop must set it upright.
    display.rotation = pose.state === 'death' ? 0.46 : pose.state === 'hit' ? 0.1 : display.rotation;
    display.eliteProjection = pose.elite === true;
    display.visualState = pose.state;
    display.frameId = `${id}:${pose.state}:${pose.direction}:${pose.tick}`;
    return { frame: { h: 60 + (pose.tick % 7) }, anchor: { y: 0.4 + (pose.direction % 3) * 0.1 } };
  };
  display.setTint = (tint) => log.push(['setTint', display.label, tint]);
  return display;
}

const markerState = (display) => ({
  visible: display.visible,
  x: display.position.x,
  y: display.position.y,
  scaleX: display.scale.x,
  scaleY: display.scale.y,
  rotation: display.rotation,
  alpha: display.alpha,
  zIndex: display.zIndex,
  poseInput: display.worldDesignPoseInput,
  lastPose: display.worldDesignLastPose,
  eliteProjection: display.eliteProjection,
});

// main.mjs closures the loop calls, shared verbatim by both sides.
const contactShadowFootY = (display, pose, screenY, zoom) =>
  screenY + (pose?.frame?.h ?? 0) * (1 - (pose?.anchor?.y ?? 1)) * (display.rosterScale ?? 1) * zoom;

function makeEnemy(random, index, tick) {
  const archetypeId = ENEMY_ARCHETYPE_IDS[index % ENEMY_ARCHETYPE_IDS.length];
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  return {
    id: `crowd-${String(index).padStart(4, '0')}`,
    archetypeId,
    active: true,
    x: 600 + (random() - 0.5) * 1800,
    y: 900 + (random() - 0.5) * 2600,
    groundZ: random() < 0.2 ? Math.round(random() * 40) : 0,
    radius: archetype.radius,
    health: archetype.maxHealth,
    maxHealth: archetype.maxHealth,
    velocity: { x: 0, y: 0 },
    spawnedTick: tick - Math.floor(random() * 60),
    attackPhase: 'ready',
    hitUntilTick: null,
  };
}

function evolve(random, enemy, tick) {
  enemy.x += (random() - 0.5) * 30;
  enemy.y += (random() - 0.5) * 30;
  const speed = random() < 0.3 ? 0 : random() * 90;
  const angle = random() * Math.PI * 2;
  enemy.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  const roll = random();
  if (roll < 0.08) {
    enemy.attackPhase = 'tell';
    enemy.attackTellStartedTick = tick - Math.floor(random() * 10);
    enemy.attackPhaseUntilTick = tick + 1 + Math.floor(random() * 30);
    enemy.telegraphTarget = { x: enemy.x + (random() - 0.5) * 300, y: enemy.y + (random() - 0.5) * 300, groundZ: random() < 0.5 ? 0 : 12 };
  } else if (roll < 0.12) {
    enemy.attackPhase = 'attack';
    enemy.attackPhaseUntilTick = tick + 3;
  } else if (roll < 0.16) {
    enemy.attackPhase = 'recovery';
    enemy.attackRecoveryUntilTick = tick + 10;
  } else if (roll < 0.5) {
    enemy.attackPhase = 'ready';
    enemy.telegraphTarget = null;
  }
  if (random() < 0.1) enemy.hitUntilTick = tick + Math.floor(random() * 6);
  // Land spawn ages on the 30-tick spawn-cue boundary often.
  if (random() < 0.08) enemy.spawnedTick = tick - 29 - Math.floor(random() * 3);
  if (random() < 0.15) enemy.health = Math.max(0, enemy.health - Math.ceil(random() * 25));
  if (random() < 0.02) enemy.active = !enemy.active;
}

function side(name, markers, log) {
  const facing = new Map();
  const hitFeedbackById = new Map();
  const dataset = {};
  const telegraphs = recordingGraphics(log, 'telegraphs');
  const placeWeaponGlow = (...args) => log.push(['glow', ...args]);
  const drawEliteGroundRing = (...args) => log.push(['eliteRing', ...args]);
  const contactShadowPool = { place: (args) => { log.push(['shadow', snapshot(args)]); return true; } };
  return { name, markers, log, facing, hitFeedbackById, dataset, telegraphs, placeWeaponGlow, drawEliteGroundRing, contactShadowPool };
}

// A deterministic stand-in for the lazily loaded enemy-hit-feedback module.
const hitFeedbackFor = (log) => ({
  resolveEnemyHitReaction: (args) => {
    log.push(['reaction', snapshot(args)]);
    const shards = args.reduceMotion ? [] : [{ dx: args.age, dy: -args.age, radius: 2, color: 0xffffff, alpha: 0.5 }];
    return args.age % 3 === 2 ? null : { offsetX: args.age - 2, offsetY: 1, squashX: 1.05, squashY: 0.95, shards, tint: args.age < 2 ? 0xff0000 : null };
  },
});

function replay({ seed, frames, population, view, profile, telemetry, withSimulation = true, shadows = true }) {
  const random = rng(seed);
  const enemies = [];
  let nextIndex = 0;
  const logA = [];
  const logB = [];
  const markersA = new Map();
  const markersB = new Map();
  const a = side('reference', markersA, logA);
  const b = side('pass', markersB, logB);
  const hitA = hitFeedbackFor(logA);
  const hitB = hitFeedbackFor(logB);
  const pass = createEnemyRenderPass({
    markers: markersB,
    facing: b.facing,
    hitFeedbackById: b.hitFeedbackById,
    archetypes: ENEMY_ARCHETYPES,
    enemyTelegraphs: b.telegraphs,
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
    contactShadowFootY,
    drawEliteGroundRing: b.drawEliteGroundRing,
    placeWeaponGlow: b.placeWeaponGlow,
    projectGasBomberCanister,
  });
  const camera = { x: 600, y: 900, zoom: 0.9, shakeX: 0, shakeY: 0, groundZ: 0 };
  const settings = { reduceMotion: false, reduceFlash: false };
  let tick = 300;
  // Retired displays go back to a free list and serve new ids, as the pool
  // hands them out, pose memo cleared exactly as the pool clears it.
  const free = [];
  const addEnemy = () => {
    const enemy = makeEnemy(random, nextIndex, tick);
    nextIndex += 1;
    enemies.push(enemy);
    // A few bodies have no display at all: they still compete for the budget.
    if (random() < 0.04) return;
    let pair = free.length > 0 && random() < 0.7 ? free.splice(Math.floor(random() * free.length), 1)[0] : null;
    if (!pair) {
      const kind = random() < 0.8 ? 'roster' : 'vector';
      const label = `display-${nextIndex}`;
      pair = [makeMarker(logA, label, kind), makeMarker(logB, label, kind)];
    }
    for (const display of pair) display.worldDesignPoseInput = display.worldDesignLastPose = undefined;
    markersA.set(enemy.id, pair[0]);
    markersB.set(enemy.id, pair[1]);
  };
  for (let index = 0; index < population; index += 1) addEnemy();
  for (let frame = 0; frame < frames; frame += 1) {
    tick += 1 + Math.floor(random() * 3);
    camera.x += (random() - 0.5) * 40;
    camera.y += (random() - 0.5) * 40;
    camera.zoom = random() < 0.1 ? 0.7 + random() * 0.6 : camera.zoom;
    camera.shakeX = random() < 0.2 ? (random() - 0.5) * 4 : 0;
    settings.reduceMotion = random() < 0.1;
    settings.reduceFlash = random() < 0.1;
    for (const enemy of enemies) evolve(random, enemy, tick);
    // Retire a few and spawn a few, the way kills and director inserts do.
    for (let count = Math.floor(random() * 4); count > 0 && enemies.length > 0; count -= 1) {
      const [gone] = enemies.splice(Math.floor(random() * enemies.length), 1);
      if (markersA.has(gone.id)) free.push([markersA.get(gone.id), markersB.get(gone.id)]);
      markersA.delete(gone.id);
      markersB.delete(gone.id);
    }
    for (let count = Math.floor(random() * 4); count > 0; count -= 1) addEnemy();
    for (const enemy of enemies) {
      if (random() < 0.12) {
        const hit = { tick: tick - Math.floor(random() * 8), direction: { x: 1, y: 0 }, critical: random() < 0.2 };
        a.hitFeedbackById.set(enemy.id, hit);
        b.hitFeedbackById.set(enemy.id, hit);
      }
    }
    const animationCap = random() < 0.5 ? 24 : 72;
    const heroScreen = { x: view.width / 2 + (random() - 0.5) * 30, y: view.height / 2 + (random() - 0.5) * 30 };
    const simulation = withSimulation ? { tick } : null;
    const particleScale = random() < 0.5 ? 10 : 4;
    const aResult = referenceEnemyBodyPass({
      grayboxEnemies: enemies,
      enemyMarkers: markersA,
      enemyVisualFacing: a.facing,
      enemyHitFeedback: frame > 3 ? hitA : null,
      enemyHitFeedbackById: a.hitFeedbackById,
      simulation,
      camera,
      view,
      screen: heroScreen,
      performanceProfile: profile,
      releaseTelemetryEnabled: telemetry,
      dataset: a.dataset,
      settings,
      particleScale,
      contactShadowPool: shadows ? a.contactShadowPool : null,
      enemyTelegraphs: a.telegraphs,
      runtimeEncounterSnapshot: () => ({ animationCap }),
      worldToScreen: reference.worldToScreen,
      isScreenPointVisible: reference.isScreenPointVisible,
      resolveEnemyRuntimeVisualState,
      isEliteEnemyProjection,
      selectAnimatedEnemyIds,
      ENEMY_ARCHETYPES,
      resolveEnemyVisualDirection,
      resolveEnemyRosterPoseSelection: reference.resolveEnemyRosterPoseSelection,
      prepareWorldDesignEnemyPose: reference.prepareWorldDesignEnemyPose,
      creatureAnimationTick,
      placeWeaponGlow: a.placeWeaponGlow,
      worldDepthKey,
      contactShadowFootY,
      drawEliteGroundRing: a.drawEliteGroundRing,
      projectGasBomberCanister,
    });
    const bCount = pass.render({
      enemies,
      camera,
      view,
      tick: simulation?.tick ?? 0,
      heroScreen,
      cullMargin: profile.enemyCullMargin,
      animationBudget: Math.min(profile.maxAnimatedEnemies, animationCap),
      simulationActive: Boolean(simulation),
      contactShadowPool: shadows ? b.contactShadowPool : null,
      hitFeedback: frame > 3 ? hitB : null,
      particleScale,
      reduceMotion: settings.reduceMotion || profile.particlesPerHazard === 0,
      reduceFlash: settings.reduceFlash,
      dataset: telemetry ? b.dataset : null,
    });
    const offset = { x: (random() - 0.5) * 6, y: (random() - 0.5) * 6 };
    referenceHealthPips({ enemyHealthPips: aResult.enemyHealthPips, camera, world: { position: offset }, overlayVisuals: recordingGraphics(logA, 'pips') });
    pass.drawHealthPips(recordingGraphics(logB, 'pips'), camera.zoom, offset.x, offset.y);

    assert.equal(bCount, aResult.animatedEnemyCount, `frame ${frame}: animated count`);
    assert.deepEqual(logB, logA, `frame ${frame}: calls`);
    assert.deepEqual([...b.facing], [...a.facing], `frame ${frame}: facing memory`);
    assert.deepEqual(b.dataset, a.dataset, `frame ${frame}: telemetry`);
    for (const [id, displayA] of markersA) {
      assert.deepEqual(markerState(markersB.get(id)), markerState(displayA), `frame ${frame}: display ${id}`);
    }
    assert.equal(pass.pipCount, aResult.enemyHealthPips.filter((pip) => !(pip.ratio >= 1)).length);
    logA.length = 0;
    logB.length = 0;
  }
  return { pass, enemies, markersB, facing: b.facing };
}

const MOBILE = { enemyCullMargin: 160, maxAnimatedEnemies: 32, particlesPerHazard: 4 };
const DESKTOP = { enemyCullMargin: 224, maxAnimatedEnemies: 96, particlesPerHazard: 10 };
const REDUCED = { enemyCullMargin: 128, maxAnimatedEnemies: 48, particlesPerHazard: 0 };

test('the pass reproduces the 1.8.1 loop call for call on a mobile crowd', () => {
  replay({ seed: 0x484d4804, frames: 240, population: 128, view: { width: 414, height: 896 }, profile: MOBILE, telemetry: false });
});

test('the pass reproduces the 1.8.1 loop on a desktop crowd with telemetry on', () => {
  replay({ seed: 17, frames: 160, population: 110, view: { width: 1440, height: 900 }, profile: DESKTOP, telemetry: true });
});

test('the pass reproduces the 1.8.1 loop with reduced motion, no shadow pool and no simulation', () => {
  replay({ seed: 99, frames: 80, population: 60, view: { width: 800, height: 600 }, profile: REDUCED, telemetry: true, shadows: false });
  replay({ seed: 5, frames: 40, population: 40, view: { width: 800, height: 600 }, profile: MOBILE, telemetry: true, withSimulation: false });
});

test('the budget heap picks exactly the ids selectAnimatedEnemyIds picks', () => {
  const random = rng(42);
  const states = ['idle', 'run', 'tell', 'attack', 'hit', 'death'];
  for (let trial = 0; trial < 1500; trial += 1) {
    const count = Math.floor(random() * 140);
    const enemies = [];
    const entries = [];
    const visible = new Uint8Array(count);
    const priority = new Uint8Array(count);
    const distance = new Float64Array(count);
    for (let row = 0; row < count; row += 1) {
      // Coarse distances and a small id space force priority, distance and id ties.
      const id = `e-${Math.floor(random() * (trial % 3 === 0 ? 40 : 1000))}-${row}`;
      const entry = {
        id,
        visible: random() < 0.8,
        distance: trial % 2 === 0 ? Math.floor(random() * 5) * 10 : random() * 900,
        state: states[Math.floor(random() * states.length)],
        spawnCue: random() < 0.1,
        elite: random() < 0.125,
      };
      entries.push(entry);
      enemies.push({ id });
      visible[row] = entry.visible ? 1 : 0;
      priority[row] = animationPriority(entry.state, entry.spawnCue, entry.elite);
      distance[row] = entry.distance;
    }
    const cap = Math.floor(random() * (count + 4));
    const selected = new Uint8Array(count);
    const heap = new Int32Array(count);
    const picked = markAnimatedRows(count, enemies, visible, priority, distance, cap, heap, selected);
    const expected = selectAnimatedEnemyIds(entries, cap);
    const actual = new Set(enemies.filter((_, row) => selected[row] === 1).map((enemy) => enemy.id));
    assert.equal(picked, expected.size, `trial ${trial}`);
    assert.deepEqual([...actual].sort(), [...expected].sort(), `trial ${trial}`);
  }
});

test('the budget heap validates like selectAnimatedEnemyIds', () => {
  const enemies = [{ id: 'a' }, { id: 'b' }];
  const visible = Uint8Array.of(1, 1);
  const priority = Uint8Array.of(4, 4);
  const heap = new Int32Array(2);
  const selected = new Uint8Array(2);
  assert.throws(() => markAnimatedRows(2, enemies, visible, priority, Float64Array.of(1, 2), -1, heap, selected), /animation cap must be a non-negative integer/);
  assert.throws(() => markAnimatedRows(2, enemies, visible, priority, Float64Array.of(1, 2), 1.5, heap, selected), /animation cap/);
  assert.throws(() => markAnimatedRows(2, enemies, visible, priority, Float64Array.of(1, NaN), 1, heap, selected), /b\.distance must be non-negative and finite/);
  assert.throws(() => selectAnimatedEnemyIds([{ id: 'a', visible: true, distance: 1 }, { id: 'b', visible: true, distance: NaN }], 1), /b\.distance must be non-negative and finite/);
  // A hidden row is never validated, as the filter drops it first.
  assert.equal(markAnimatedRows(2, enemies, Uint8Array.of(1, 0), priority, Float64Array.of(1, NaN), 2, heap, selected), 1);
  assert.equal(markAnimatedRows(2, enemies, visible, priority, Float64Array.of(1, 2), 0, heap, selected), 0);
  assert.deepEqual([...selected], [0, 0]);
});

test('facing memory is pruned to the live markers after a sync', () => {
  const { pass, markersB, facing } = replay({ seed: 3, frames: 60, population: 50, view: { width: 414, height: 896 }, profile: MOBILE, telemetry: false });
  // Retired bodies never render inactive, so their facing entries linger
  // until a prune; the replay retires a few every frame.
  const stale = [...facing.keys()].filter((id) => !markersB.has(id));
  assert.ok(stale.length > 0, 'the replay should leave retired entries behind');
  const live = [...facing.keys()].filter((id) => markersB.has(id));
  pass.pruneFacing();
  assert.deepEqual([...facing.keys()], live);
});

test('main.mjs routes the enemy loop through the lazily loaded pass', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /import\('\.\/enemy-render-pass\.mjs'\)/);
  assert.doesNotMatch(main, /from '\.\/enemy-render-pass\.mjs'/, 'the pass must stay a lazy chunk');
  assert.match(main, /enemyRenderPass\.render\(\{/);
  assert.match(main, /enemyRenderPass\.drawHealthPips\(overlayVisuals, camera\.zoom, world\.position\.x, world\.position\.y\)/);
  assert.match(main, /enemyRenderPass\.pruneFacing\(\)/);
  assert.doesNotMatch(main, /worldToScreen\(\{ \.\.\.enemy, z:/, 'no per-enemy spread copies in the render path');
  assert.doesNotMatch(main, /animationCandidates/);
  const pass = readFileSync(new URL('../apps/hmh-reboot/src/enemy-render-pass.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(pass, /^import /mu, 'every dependency is injected');
});

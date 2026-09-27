// Render smoothness pass (1.8.7 feel, slice "smoothness"). Projection only.
//
// D1  enemies, the boss and projectiles are drawn between simulation steps by
//     the same frame alpha the hero uses; spawns and teleports snap.
// A6b the animation LOD tier has hysteresis: a body animated last frame keeps
//     its slot until rank cap + 8 and beats a newcomer at the boundary; free
//     slots always fill, so the tier is min(cap, visible), never over the cap.
// D3  run cycles are locked to the distance a body is drawn travelling, so a
//     slowed or blocked enemy stops moonwalking; tell, attack, hit and death
//     stay on the tick clock.
//
// None of this reads back into the simulation: the pass writes displays only,
// and the sim digest (scripts/hmh-sim-digest.mjs) is unchanged by the slice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Container } from 'pixi.js';

import { createEnemyRenderPass, markAnimatedRows, animationPriority } from '../apps/hmh-reboot/src/enemy-render-pass.mjs';
import { isScreenPointVisible } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { interpolateStep, worldToScreen, worldToScreenInto } from '../apps/hmh-reboot/src/world-space.mjs';
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

const VIEW = { width: 800, height: 600 };
const camera = () => ({ x: 400, y: 300, zoom: 1, shakeX: 0, shakeY: 0, groundZ: 0 });
const ARCHETYPE_ID = Object.keys(ENEMY_ARCHETYPES).find((id) => ENEMY_ARCHETYPES[id].speed > 0);
const SPEED = ENEMY_ARCHETYPES[ARCHETYPE_ID].speed;

function makeMarker(poses) {
  const display = new Container();
  display.phaseRelativePoses = true;
  display.applyPose = (pose) => {
    poses.push({ ...pose });
    return { frame: { h: 60 }, anchor: { y: 0.5 } };
  };
  display.setTint = () => {};
  return display;
}

function harness() {
  const markers = new Map();
  const poses = new Map();
  const pass = createEnemyRenderPass({
    markers,
    facing: new Map(),
    hitFeedbackById: new Map(),
    archetypes: ENEMY_ARCHETYPES,
    enemyTelegraphs: new Proxy({}, { get: (_, key, receiver) => () => receiver }),
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
  });
  const add = (enemy) => {
    const log = [];
    poses.set(enemy.id, log);
    markers.set(enemy.id, makeMarker(log));
    return enemy;
  };
  const render = (enemies, extra = {}) => pass.render({
    enemies,
    camera: camera(),
    view: VIEW,
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
    ...extra,
  });
  return { pass, markers, poses, add, render };
}

const enemyAt = (id, x, y, extra = {}) => ({
  id,
  archetypeId: ARCHETYPE_ID,
  active: true,
  x,
  y,
  groundZ: 0,
  radius: 16,
  health: 10,
  maxHealth: 10,
  velocity: { x: 0, y: 0 },
  spawnedTick: 0,
  attackPhase: 'ready',
  hitUntilTick: null,
  ...extra,
});

test('interpolateStep lerps by the frame alpha and snaps spawns and teleports', () => {
  assert.equal(interpolateStep(100, 110, 0.25), 102.5);
  assert.equal(interpolateStep(100, 110, 0), 100);
  // alpha 1 is the simulated position bit for bit, not previous + delta.
  assert.equal(interpolateStep(0.1, 0.3, 1), 0.3);
  assert.equal(interpolateStep(undefined, 42, 0.5), 42, 'no previous sample snaps');
  assert.equal(interpolateStep(null, 42, 0.5), 42);
  assert.equal(interpolateStep(Number.NaN, 42, 0.5), 42);
  assert.equal(interpolateStep(0, 500, 0.5), 500, 'a teleport snaps instead of streaking');
  assert.equal(interpolateStep(0, 60, 0.5, 40), 60, 'the snap distance is configurable');
});

test('D1: enemy bodies draw between steps by the hero alpha and snap without a previous sample', () => {
  const { markers, add, render } = harness();
  const moving = add(enemyAt('moving', 400, 300, { previousX: 380, previousY: 290, previousGroundZ: 0 }));
  const fresh = add(enemyAt('fresh', 300, 320));
  const teleported = add(enemyAt('teleported', 450, 250, { previousX: 2000, previousY: 2000 }));
  render([moving, fresh, teleported], { alpha: 0.25 });
  const expect = worldToScreen({ x: 385, y: 292.5, z: 0 }, camera(), VIEW);
  assert.equal(markers.get('moving').position.x, expect.x);
  assert.equal(markers.get('moving').position.y, expect.y);
  assert.equal(markers.get('moving').zIndex, worldDepthKey(292.5), 'depth follows the drawn position');
  const freshScreen = worldToScreen({ x: 300, y: 320, z: 0 }, camera(), VIEW);
  assert.equal(markers.get('fresh').position.x, freshScreen.x, 'a spawn frame snaps');
  const teleportScreen = worldToScreen({ x: 450, y: 250, z: 0 }, camera(), VIEW);
  assert.equal(markers.get('teleported').position.x, teleportScreen.x, 'a teleport snaps');
  // Without an alpha the pass draws the simulated position (the 1.8.1 contract).
  render([moving], {});
  const current = worldToScreen({ x: 400, y: 300, z: 0 }, camera(), VIEW);
  assert.equal(markers.get('moving').position.x, current.x);
  // Drawing never writes the simulation.
  assert.deepEqual([moving.x, moving.y, moving.previousX, moving.previousY], [400, 300, 380, 290]);
});

const chosenRows = (selected) => [...selected].map((value, row) => (value ? row : -1)).filter((row) => row >= 0);

function rankedRows(count) {
  const enemies = [];
  const visible = new Uint8Array(count).fill(1);
  const priority = new Uint8Array(count).fill(4);
  const distance = new Float64Array(count);
  for (let row = 0; row < count; row += 1) {
    enemies.push({ id: `r-${String(row).padStart(3, '0')}` });
    distance[row] = 10 + row * 10;
  }
  return { enemies, visible, priority, distance, heap: new Int32Array(count), selected: new Uint8Array(count) };
}

test('A6b: an uncontended tier fills to min(cap, visible) on the first frame and in steady state', () => {
  const rows = rankedRows(30);
  const was = new Uint8Array(30);
  const picked = markAnimatedRows(30, rows.enemies, rows.visible, rows.priority, rows.distance, 20, rows.heap, rows.selected, 8, was);
  assert.equal(picked, 20, 'bodies arriving from off screen are not held back by the band');
  assert.deepEqual(chosenRows(rows.selected), [...Array(20).keys()]);
  // N <= cap: every visible body animates, frame after frame, like band 0.
  for (const [count, cap] of [[20, 20], [40, 40], [40, 48], [60, 48], [100, 64]]) {
    const crowd = rankedRows(count);
    let last = new Uint8Array(count);
    let steady = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      steady = markAnimatedRows(count, crowd.enemies, crowd.visible, crowd.priority, crowd.distance, cap, crowd.heap, crowd.selected, 8, last);
      last = Uint8Array.from(crowd.selected);
    }
    assert.equal(steady, Math.min(count, cap), `${count} bodies under cap ${cap}`);
    assert.equal(steady, markAnimatedRows(count, crowd.enemies, crowd.visible, crowd.priority, crowd.distance, cap, crowd.heap, crowd.selected));
  }
});

test('A6b: holders beat newcomers at the boundary and the tier never exceeds the cap', () => {
  const rows = rankedRows(40);
  // Last frame animated rows 0-11 and 22-29 (ranks 22-29): 20 bodies.
  const was = new Uint8Array(40);
  for (let row = 0; row < 12; row += 1) was[row] = 1;
  for (let row = 22; row < 30; row += 1) was[row] = 1;
  const picked = markAnimatedRows(40, rows.enemies, rows.visible, rows.priority, rows.distance, 20, rows.heap, rows.selected, 8, was);
  // Rows 22-27 (ranks < cap + 8) hold; rows 28-29 drop out; the two free
  // slots go to the best non-holders under the cap, rows 12 and 13.
  assert.deepEqual(chosenRows(rows.selected), [...Array(14).keys(), 22, 23, 24, 25, 26, 27]);
  assert.equal(picked, 20);
  // A holder at rank cap..cap+band-1 keeps its slot over a non-holder at rank cap-1.
  const edge = rankedRows(40);
  const held = new Uint8Array(40);
  for (let row = 0; row < 19; row += 1) held[row] = 1;
  held[25] = 1;
  assert.equal(markAnimatedRows(40, edge.enemies, edge.visible, edge.priority, edge.distance, 20, edge.heap, edge.selected, 8, held), 20);
  assert.equal(edge.selected[25], 1, 'the holder at rank 25 stays');
  assert.equal(edge.selected[19], 0, 'the newcomer at rank 19 waits');
  // Every body was animated last frame: the best 20 keep the tier, not 28.
  const full = rankedRows(40);
  const all = new Uint8Array(40).fill(1);
  assert.equal(markAnimatedRows(40, full.enemies, full.visible, full.priority, full.distance, 20, full.heap, full.selected, 8, all), 20);
  assert.deepEqual([...full.selected].slice(0, 20), new Array(20).fill(1));
});

test('A6b: priority still wins, and a band of 0 is the exact 1.8.1 selection', () => {
  const rows = rankedRows(40);
  rows.priority[35] = animationPriority('tell', false, false);
  const was = new Uint8Array(40);
  markAnimatedRows(40, rows.enemies, rows.visible, rows.priority, rows.distance, 20, rows.heap, rows.selected, 8, was);
  assert.equal(rows.selected[35], 1, 'an attack tell ranks first and enters');
  const plain = rankedRows(40);
  assert.equal(markAnimatedRows(40, plain.enemies, plain.visible, plain.priority, plain.distance, 20, plain.heap, plain.selected), 20);
  assert.equal(markAnimatedRows(40, plain.enemies, plain.visible, plain.priority, plain.distance, 20, plain.heap, plain.selected, 0, was), 20);
});

test('A6b: the pass remembers the tier per display so an edge body stops flickering', () => {
  const { markers, add, render } = harness();
  // 30 idle bodies in a row east of the hero; the budget is 20.
  // Elites outrank plain bodies, so the row uses plain ids only.
  const enemies = [];
  for (let serial = 0; enemies.length < 30; serial += 1) {
    const id = `edge-${serial}`;
    if (!isEliteEnemyProjection(id)) enemies.push(add(enemyAt(id, 410 + enemies.length * 5, 300)));
  }
  const banded = { animationBudget: 20, animationHysteresis: 8 };
  const animated = () => enemies.map((enemy, index) => (markers.get(enemy.id).renderPassAnimated === 1 ? index : -1)).filter((index) => index >= 0);
  assert.equal(render(enemies, banded), 20, 'the first frame fills the whole budget');
  assert.deepEqual(animated(), [...Array(20).keys()]);
  // Swap ranks 12 and 13, then the boundary ranks 19 and 20, back and forth:
  // the tier stays full and the same bodies stay animated.
  for (const [first, second] of [[12, 13], [19, 20]]) {
    for (let frame = 0; frame < 6; frame += 1) {
      const [a, b] = [enemies[first], enemies[second]];
      [a.x, b.x] = [b.x, a.x];
      assert.equal(render(enemies, banded), 20);
      assert.deepEqual(animated(), [...Array(20).keys()], `no flicker swapping ranks ${first} and ${second}`);
    }
  }
  // Pull body 25 close: it enters and the worst holder (body 19) steps out.
  const mover = enemies[25];
  mover.x = 400.5;
  assert.equal(render(enemies, banded), 20);
  assert.deepEqual(animated(), [...Array(19).keys(), 25]);
  // Walk it back out to rank 23: it keeps its slot over body 19 at rank 19.
  mover.x = 410 + 22 * 5 + 1;
  assert.equal(render(enemies, banded), 20, 'a held body stays animated inside the band');
  assert.deepEqual(animated(), [...Array(19).keys(), 25]);
  // Past rank cap + 8 it lets go and body 19 fills the free slot.
  mover.x = 410 + 29 * 5 + 1;
  assert.equal(render(enemies, banded), 20);
  assert.deepEqual(animated(), [...Array(20).keys()]);
  assert.equal(render(enemies, { animationBudget: 20 }), 20, 'no band keeps the plain top-cap rule');
});

test('D3: run frames advance by distance drawn, so a slowed body stops moonwalking', () => {
  const { poses, add, render } = harness();
  const perTick = SPEED / 60;
  const walker = add(enemyAt('walker', 300, 300, { velocity: { x: SPEED, y: 0 } }));
  const clock = add(enemyAt('clock', 300, 340, { velocity: { x: SPEED, y: 0 } }));
  const options = { distanceLockedWalk: true };
  render([walker], { ...options, tick: 100 });
  render([clock], { tick: 100 });
  // 20 ticks pass but the walker only covers 10 ticks of nominal ground.
  walker.x += perTick * 10;
  clock.x += perTick * 10;
  render([walker], { ...options, tick: 120 });
  render([clock], { tick: 120 });
  const [w0, w1] = poses.get('walker');
  const [c0, c1] = poses.get('clock');
  assert.equal(w0.state, 'run');
  assert.equal(w1.tick - w0.tick, 10, 'half speed plays the run cycle at half rate');
  assert.equal(c1.tick - c0.tick, 20, 'without the lock the cycle stays on the tick clock');
  // A body pushing into a wall: run state, no ground covered, frame held.
  render([walker], { ...options, tick: 150 });
  const w2 = poses.get('walker').at(-1);
  assert.equal(w2.tick, w1.tick);
});

test('D3: tell, attack and hit poses stay on the tick clock under the lock', () => {
  const { poses, add, render } = harness();
  const hit = add(enemyAt('hitter', 300, 300, { velocity: { x: SPEED, y: 0 }, hitUntilTick: 104 }));
  render([hit], { distanceLockedWalk: true, tick: 100 });
  hit.x += 1;
  render([hit], { distanceLockedWalk: true, tick: 103 });
  const [h0, h1] = poses.get('hitter');
  assert.equal(h0.state, 'hit');
  assert.equal(h1.tick - h0.tick, 3);
});

const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');

test('main.mjs feeds the hero alpha to enemies, the boss and projectiles', () => {
  assert.match(main, /renderAlpha = frame\.alpha;/);
  assert.match(main, /alpha: renderAlpha,/);
  assert.match(main, /animationHysteresis: 8,/);
  assert.match(main, /distanceLockedWalk: true,/);
  assert.match(main, /interpolateStep\(bossPreviousX, liquidatorBoss\.x, renderAlpha\)/);
  assert.match(main, /bossPreviousX = liquidatorBoss\?\.x;/);
  // The tracer head is drawn back along its last step by (1 - alpha).
  assert.match(main, /const lag = 1 - renderAlpha;/);
});

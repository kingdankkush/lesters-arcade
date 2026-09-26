// Render-path allocation cuts (perf step: render-alloc).
//
// Every helper the per-frame render path leans on was rewritten to stop
// allocating: worldToScreen (a throwaway viewport object per call),
// isScreenPointVisible (an array and a closure per call), the enemy pose memo
// (an array and a closure per call), roster frame lookups (four template-string
// keys per pose) and the roster pose selection (a frozen object per enemy).
// Each is checked here against its verbatim 1.8.1 copy
// (tests/fixtures/hmh-render-reference/) for identical results, identical
// errors and identical returned objects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Container, Graphics, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';

import * as reference from './fixtures/hmh-render-reference/render-helpers.mjs';
import * as referenceRoster from './fixtures/hmh-render-reference/enemy-roster-atlas.mjs';
import * as referenceGore from './fixtures/hmh-render-reference/gore-presentation.mjs';
import * as referenceShadows from './fixtures/hmh-render-reference/contact-shadows.mjs';
import { createGorePresentation } from '../apps/hmh-reboot/src/gore-presentation.mjs';
import { createContactShadowPool, resolveContactShadow } from '../apps/hmh-reboot/src/contact-shadows.mjs';
import { worldToScreen, worldToScreenInto } from '../apps/hmh-reboot/src/world-space.mjs';
import { isScreenPointVisible } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { prepareWorldDesignEnemyPose } from '../apps/hmh-reboot/src/world-design-life.mjs';
import {
  resolveEnemyRosterPoseSelection,
  resolveEnemyRuntimeVisualState,
  selectEnemyRosterPose,
} from '../apps/hmh-reboot/src/enemy-production-art.mjs';
import { creatureAnimationTick, creatureIdPhase } from '../apps/hmh-reboot/src/creature-presentation.mjs';
import {
  ENEMY_ROSTER_ACTORS,
  ENEMY_ROSTER_DIRECTIONS,
  ENEMY_ROSTER_STATES,
  createEnemyRosterAtlasIndex,
  createEnemyRosterDisplay,
  enemyRosterAsset,
  resolveEnemyRosterPose,
} from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

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

// Same value, or the same error type and message.
function outcome(run) {
  try {
    return { value: run() };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
}

const bits = (value) => (Object.is(value, -0) ? '-0' : String(value));

test('worldToScreen and worldToScreenInto project bit-identically to 1.8.1 and throw the same errors', () => {
  const random = rng(7);
  const odd = [undefined, null, NaN, Infinity, -Infinity, '12', 0, -0, 1e-300];
  for (let trial = 0; trial < 4000; trial += 1) {
    const pick = (normal) => (random() < 0.06 ? odd[Math.floor(random() * odd.length)] : normal);
    const point = { x: pick((random() - 0.5) * 9000), y: pick((random() - 0.5) * 9000) };
    if (random() < 0.7) point.z = pick(random() * 80);
    if (random() < 0.3) point.visualLiftZ = pick(random() * 20);
    const camera = { x: (random() - 0.5) * 9000, y: (random() - 0.5) * 9000, zoom: 0.4 + random() * 1.4, shakeX: (random() - 0.5) * 3, shakeY: (random() - 0.5) * 3 };
    if (random() < 0.5) camera.groundZ = random() * 40;
    const view = random() < 0.05 ? { width: pick(0), height: pick(-3) } : { width: pick(320 + random() * 1600), height: pick(480 + random() * 900) };
    const expected = outcome(() => reference.worldToScreen(point, camera, view));
    const actual = outcome(() => worldToScreen(point, camera, view));
    const out = { x: 'stale', y: 'stale' };
    const into = outcome(() => worldToScreenInto(out, point, camera, view));
    if (expected.error) {
      assert.equal(actual.error, expected.error, `trial ${trial}`);
      assert.equal(into.error, expected.error, `trial ${trial}`);
      continue;
    }
    assert.deepEqual([bits(actual.value.x), bits(actual.value.y)], [bits(expected.value.x), bits(expected.value.y)], `trial ${trial}`);
    assert.equal(into.value, out, 'the into form returns its target');
    assert.deepEqual(Object.keys(out), ['x', 'y']);
    assert.deepEqual([bits(out.x), bits(out.y)], [bits(expected.value.x), bits(expected.value.y)], `trial ${trial}`);
  }
});

test('isScreenPointVisible answers and throws exactly as 1.8.1', () => {
  const random = rng(11);
  const odd = [undefined, null, NaN, Infinity, '40', 0, -1, -0];
  for (let trial = 0; trial < 4000; trial += 1) {
    const pick = (normal) => (random() < 0.08 ? odd[Math.floor(random() * odd.length)] : normal);
    const point = random() < 0.02 ? null : { x: pick((random() - 0.3) * 2000), y: pick((random() - 0.3) * 2000) };
    const view = random() < 0.02 ? undefined : { width: pick(300 + random() * 1200), height: pick(300 + random() * 900) };
    const margin = random() < 0.2 ? undefined : pick(random() * 300);
    const args = margin === undefined ? [point, view] : [point, view, margin];
    assert.deepEqual(outcome(() => isScreenPointVisible(...args)), outcome(() => reference.isScreenPointVisible(...args)), `trial ${trial}`);
  }
});

function poseRecorder() {
  const marker = { applied: [] };
  marker.applyPose = (pose) => { const result = { ...pose, n: marker.applied.length }; marker.applied.push(result); return result; };
  return marker;
}

test('the enemy pose memo reapplies exactly when 1.8.1 did, even with one reused pose object', () => {
  const random = rng(19);
  const states = ['idle', 'run', 'tell', 'attack', 'hit'];
  for (let trial = 0; trial < 300; trial += 1) {
    const old = poseRecorder();
    const fresh = poseRecorder();
    const reused = poseRecorder();
    const scratch = { state: 'idle', tick: 0, direction: 0, elite: false, phaseTick: null };
    for (let frame = 0; frame < 60; frame += 1) {
      const pose = {
        state: states[Math.floor(random() * states.length)],
        tick: frame,
        direction: Math.floor(random() * 3),
        elite: random() < 0.1,
        phaseTick: random() < 0.5 ? Math.floor(random() * 20) : random() < 0.5 ? null : NaN,
      };
      if (random() < 0.1) pose.phase = random() < 0.5 ? 'margin-call' : undefined;
      if (random() < 0.6) { pose.state = 'run'; pose.direction = 1; pose.elite = false; }
      const animate = random() < 0.3;
      const expected = reference.prepareWorldDesignEnemyPose(old, animate, pose);
      assert.equal(prepareWorldDesignEnemyPose(fresh, animate, { ...pose }).n, expected.n, `trial ${trial} frame ${frame}`);
      Object.assign(scratch, pose);
      if (!('phase' in pose)) delete scratch.phase;
      assert.equal(prepareWorldDesignEnemyPose(reused, animate, scratch).n, expected.n, `trial ${trial} frame ${frame}`);
      assert.notEqual(reused.worldDesignPoseInput, scratch, 'the memo is a copy, never the caller\'s object');
      assert.deepEqual(reused.worldDesignPoseInput, old.worldDesignPoseInput);
      assert.deepEqual(fresh.worldDesignPoseInput, old.worldDesignPoseInput);
    }
    assert.deepEqual(reused.applied.map((pose) => pose.n), old.applied.map((pose) => pose.n));
  }
});

function crowdEnemy(random, tick) {
  const phases = ['ready', 'tell', 'attack', 'recovery', undefined];
  return {
    id: `pose-${Math.floor(random() * 1e6)}`,
    archetypeId: ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'whale-enforcer'][Math.floor(random() * 4)],
    active: random() < 0.95,
    health: random() < 0.1 ? 0 : 40,
    attackPhase: phases[Math.floor(random() * phases.length)],
    attackTellStartedTick: random() < 0.8 ? tick - Math.floor(random() * 20) : undefined,
    attackPhaseUntilTick: random() < 0.8 ? tick + Math.floor(random() * 20) - 4 : undefined,
    attackRecoveryUntilTick: random() < 0.7 ? tick + Math.floor(random() * 20) : undefined,
    hitUntilTick: random() < 0.3 ? tick + Math.floor(random() * 6) - 2 : null,
    velocity: random() < 0.5 ? { x: random() * 3, y: 0 } : undefined,
  };
}

test('the roster pose selection matches 1.8.1 whether or not the caller already has the state', () => {
  const random = rng(23);
  const out = { state: null, phaseTick: null };
  for (let trial = 0; trial < 5000; trial += 1) {
    const tick = 50 + Math.floor(random() * 500);
    const enemy = crowdEnemy(random, tick);
    const expected = reference.resolveEnemyRosterPoseSelection(enemy, tick);
    const selection = resolveEnemyRosterPoseSelection(enemy, tick);
    assert.deepEqual(selection, expected, `trial ${trial}`);
    assert.ok(Object.isFrozen(selection));
    assert.deepEqual(Object.keys(selection), ['state', 'phaseTick']);
    assert.equal(selectEnemyRosterPose(out, enemy, tick, resolveEnemyRuntimeVisualState(enemy, tick)), out);
    assert.deepEqual({ ...out }, { ...expected }, `trial ${trial}`);
    selectEnemyRosterPose(out, enemy, tick);
    assert.deepEqual({ ...out }, { ...expected }, `trial ${trial}`);
  }
  assert.throws(() => resolveEnemyRosterPoseSelection(null, 1), /enemy is required/);
  assert.throws(() => resolveEnemyRosterPoseSelection({ active: true }, -1), /tick/);
});

test('a cached id phase gives the same creature animation tick', () => {
  const random = rng(29);
  for (let trial = 0; trial < 3000; trial += 1) {
    const id = random() < 0.1 ? Math.floor(random() * 1000) : `enemy-${Math.floor(random() * 1e5)}`;
    const tick = Math.floor(random() * 90000);
    const state = ['idle', 'run', 'tell', 'attack', 'hit', 'death'][Math.floor(random() * 6)];
    const started = tick - Math.floor(random() * 12);
    assert.equal(creatureAnimationTick(id, tick, state, started, creatureIdPhase(id)), creatureAnimationTick(id, tick, state, started));
    assert.equal(creatureAnimationTick(id, tick, state, undefined, creatureIdPhase(id)), creatureAnimationTick(id, tick, state));
  }
});

const loadRoster = async (actorId) => JSON.parse(await readFile(new URL(`../apps/portal/${enemyRosterAsset(actorId).metadataUrl.replace('../', '')}`, import.meta.url), 'utf8'));

test('roster frame lookups return the very frame records the 1.8.1 string keys found', async () => {
  const random = rng(31);
  for (const actorId of ENEMY_ROSTER_ACTORS) {
    const metadata = await loadRoster(actorId);
    const index = createEnemyRosterAtlasIndex(metadata, actorId);
    const expected = referenceRoster.createEnemyRosterAtlasIndex(metadata, actorId);
    const phases = [...index.phases, undefined, null, 'no-such-phase'];
    const states = [...ENEMY_ROSTER_STATES, 'walk', undefined];
    const directions = [...ENEMY_ROSTER_DIRECTIONS, 'up', 3];
    for (const phase of phases) {
      for (const state of states) {
        for (const direction of directions) {
          const args = phase === undefined ? [state, direction] : [state, direction, phase];
          assert.deepEqual(index.clipFor(...args), expected.clipFor(...args), `${actorId} ${phase}/${state}/${direction}`);
          assert.equal(index.frameCountFor(...args), expected.frameCountFor(...args));
          assert.equal(index.fpsFor(...args), expected.fpsFor(...args));
          for (const frameIndex of [0, 1, 2, 5, 11, 40, -1, -7, 2.7, -2.7, NaN, Infinity, -0, 1e9]) {
            const frameArgs = phase === undefined ? [state, direction, frameIndex] : [state, direction, frameIndex, phase];
            assert.equal(index.frameFor(...frameArgs), expected.frameFor(...frameArgs), `${actorId} ${phase}/${state}/${direction}/${frameIndex}`);
          }
        }
      }
    }
    for (let trial = 0; trial < 3000; trial += 1) {
      const pose = {
        state: states[Math.floor(random() * states.length)],
        tick: random() < 0.05 ? [NaN, -5, Infinity, 2.5][Math.floor(random() * 4)] : Math.floor(random() * 5000),
        direction: random() < 0.05 ? 1.5 : Math.floor(random() * 20) - 6,
        phaseTick: random() < 0.4 ? null : random() < 0.05 ? NaN : Math.floor(random() * 90),
      };
      if (random() < 0.5) pose.phase = phases[Math.floor(random() * phases.length)];
      assert.equal(resolveEnemyRosterPose(index, pose), referenceRoster.resolveEnemyRosterPose(expected, pose), `${actorId} trial ${trial}`);
    }
  }
});

test('a roster display shows the same frame, tint and elite layers as 1.8.1 through any pose and hit sequence', async () => {
  const random = rng(37);
  for (const actorId of ['forkrunner', 'the-liquidator']) {
    const metadata = await loadRoster(actorId);
    const index = createEnemyRosterAtlasIndex(metadata, actorId);
    const expectedIndex = referenceRoster.createEnemyRosterAtlasIndex(metadata, actorId);
    const atlasTexture = new Texture({ source: new TextureSource({ width: 4096, height: 4096 }) });
    const classes = { ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle, GraphicsClass: Graphics };
    for (const elite of [false, true]) {
      const display = createEnemyRosterDisplay({ index, atlasTexture, ...classes, elite });
      const expected = referenceRoster.createEnemyRosterDisplay({ index: expectedIndex, atlasTexture, ...classes, elite });
      const look = (container) => container.children.map((child) => ({
        tint: child.tint, visible: child.visible, y: child.y,
        frame: child instanceof Sprite ? [child.texture.frame.x, child.texture.frame.y, child.texture.frame.width, child.texture.frame.height] : null,
        anchor: child instanceof Sprite ? [child.anchor.x, child.anchor.y] : null,
      }));
      const summary = (container) => ({ frameId: container.frameId, visualState: container.visualState, visualPhase: container.visualPhase, eliteProjection: container.eliteProjection });
      assert.deepEqual(look(display), look(expected));
      for (let step = 0; step < 400; step += 1) {
        if (random() < 0.6) {
          const pose = {
            state: ENEMY_ROSTER_STATES[Math.floor(random() * ENEMY_ROSTER_STATES.length)],
            tick: Math.floor(random() * 3000),
            direction: Math.floor(random() * 8),
            elite: random() < 0.5,
            phaseTick: random() < 0.5 ? null : Math.floor(random() * 40),
          };
          if (random() < 0.3) pose.phase = index.phases[Math.floor(random() * index.phases.length)];
          assert.equal(display.applyPose(pose), expected.applyPose(pose));
        } else {
          const tint = random() < 0.5 ? null : [0xff0000, 0xffffff, 0xfff0c0, 0x123456][Math.floor(random() * 4)];
          display.setTint(tint);
          expected.setTint(tint);
        }
        assert.deepEqual(look(display), look(expected), `${actorId} elite=${elite} step ${step}`);
        assert.deepEqual(summary(display), summary(expected));
      }
      display.destroy({ children: true });
      expected.destroy({ children: true });
    }
  }
});

// A Graphics stand-in keeping the draw ops since its last clear, with the
// fill/stroke instruction list Pixi exposes (an empty layer may skip clear()).
class RecordingLayer {
  constructor() { this.ops = []; this.context = { instructions: [] }; this.clears = 0; }
  clear() { this.ops = []; this.context.instructions.length = 0; this.clears += 1; return this; }
}
for (const name of ['ellipse', 'circle', 'poly', 'moveTo', 'lineTo']) {
  RecordingLayer.prototype[name] = function draw(...args) { this.ops.push([name, ...args.map((arg) => (Array.isArray(arg) ? [...arg] : arg))]); return this; };
}
for (const name of ['fill', 'stroke']) {
  RecordingLayer.prototype[name] = function paint(style) { this.ops.push([name, { ...style }]); this.context.instructions.push(name); return this; };
}

test('gore draws the same shapes, keeps the same pools and reports the same counts as 1.8.1', () => {
  const random = rng(41);
  let oldClears = 0;
  let newClears = 0;
  for (let trial = 0; trial < 40; trial += 1) {
    const old = referenceGore.createGorePresentation();
    const next = createGorePresentation();
    const oldGround = new RecordingLayer(); const oldAir = new RecordingLayer();
    const newGround = new RecordingLayer(); const newAir = new RecordingLayer();
    const camera = { x: 500, y: 500, zoom: 0.8 + random() * 0.6, shakeX: 0, shakeY: 0, groundZ: random() < 0.3 ? 6 : 0 };
    const view = { width: 414, height: 896 };
    const settings = { gore: true, reduceMotion: false };
    // Every fourth trial projects through `project` alone, as a caller
    // without projectInto would.
    const projectInto = trial % 4 === 3 ? undefined : worldToScreenInto;
    // Odd trials are sparse, so marks live through their 120-tick fade
    // instead of being pushed out of the 48-mark pool by newer ones.
    const eventRate = trial % 2 === 1 ? 0.03 : 0.35;
    let tick = 10;
    for (let frame = 0; frame < 320; frame += 1) {
      tick += 1 + Math.floor(random() * 3);
      if (random() < eventRate) {
        const kill = random() < 0.4;
        const event = {
          type: random() < 0.05 ? 'muzzle' : kill ? 'kill' : 'impact',
          tick: tick - Math.floor(random() * 3),
          surface: random() < 0.9 ? 'flesh' : 'metal',
          shielded: random() < 0.1,
          point: { x: 250 + random() * 600, y: 150 + random() * 800, z: random() < 0.5 ? 24 : undefined },
          direction: random() < 0.7 ? { x: random() - 0.5, y: random() - 0.5 } : null,
          dismember: kill && random() < 0.5,
        };
        const groundZ = random() < 0.8 ? 0 : 8;
        old.add(event, groundZ);
        next.add(event, groundZ);
      }
      // A bounded sway: the view crosses the cull edge without drifting off
      // the marks for good.
      camera.x = 500 + Math.sin(frame / 17) * 180 + (random() - 0.5) * 20;
      // Switching gore off clears every pool; sparse trials keep it on.
      settings.gore = trial % 2 === 1 || random() < 0.97;
      settings.reduceMotion = random() < 0.1;
      const particleScale = random() < 0.5 ? 10 : 4;
      const expected = old.render({ ground: oldGround, air: oldAir, tick, settings, particleScale, camera, view, project: reference.worldToScreen });
      const drawn = next.render({ ground: newGround, air: newAir, tick, settings, particleScale, camera, view, project: worldToScreen, projectInto });
      assert.deepEqual(newGround.ops, oldGround.ops, `trial ${trial} frame ${frame}: ground layer`);
      assert.deepEqual(newAir.ops, oldAir.ops, `trial ${trial} frame ${frame}: air layer`);
      assert.equal(drawn.marks, expected.marks.length, `trial ${trial} frame ${frame}: marks`);
      assert.equal(drawn.fragments, expected.fragments.length, `trial ${trial} frame ${frame}: fragments`);
      if (frame % 20 === 0) {
        const options = { enabled: true, reduceMotion: settings.reduceMotion, particleScale };
        assert.deepEqual(next.frame(tick, options), old.frame(tick, options), `trial ${trial} frame ${frame}: frame()`);
      }
    }
    oldClears += oldGround.clears + oldAir.clears;
    newClears += newGround.clears + newAir.clears;
  }
  assert.ok(newClears < oldClears, 'an empty gore layer is no longer cleared every frame');
});

class ShadowSprite {
  constructor({ texture }) {
    this.texture = texture;
    this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
    this.anchor = { set() {} };
    this.width = 0; this.height = 0; this.alpha = 1; this.visible = true; this.tint = 0xffffff;
  }
}
class ShadowContainer { constructor() { this.children = []; } addChild(child) { this.children.push(child); return child; } }

test('contact shadow geometry and pooled placements match 1.8.1', () => {
  const random = rng(43);
  const odd = [undefined, null, NaN, Infinity, 0, -3];
  for (let trial = 0; trial < 3000; trial += 1) {
    const pick = (normal) => (random() < 0.05 ? odd[Math.floor(random() * odd.length)] : normal);
    const input = { footprintPx: pick(random() * 80 - 5) };
    if (random() < 0.6) input.lift = pick(random() * 60);
    if (random() < 0.6) input.zoom = pick(0.5 + random());
    if (random() < 0.4) input.baseAlpha = pick(random());
    const expected = outcome(() => referenceShadows.resolveContactShadow(input));
    const actual = outcome(() => resolveContactShadow(input));
    assert.deepEqual(actual, expected, `trial ${trial}`);
    if (actual.value) {
      assert.ok(Object.isFrozen(actual.value));
      assert.deepEqual(Object.keys(actual.value), Object.keys(expected.value));
    }
  }
  const textures = { blob: { id: 'blob' }, ao: { id: 'ao' } };
  const make = (factory) => factory({ ContainerClass: ShadowContainer, SpriteClass: ShadowSprite, textures, max: 24 });
  const old = make(referenceShadows.createContactShadowPool);
  const next = make(createContactShadowPool);
  const look = (pool) => pool.container.children.map((sprite) => ({ texture: sprite.texture.id, x: sprite.position.x, y: sprite.position.y, width: sprite.width, height: sprite.height, alpha: sprite.alpha, visible: sprite.visible }));
  for (let frame = 0; frame < 300; frame += 1) {
    old.begin(); next.begin();
    for (let count = Math.floor(random() * 30); count > 0; count -= 1) {
      const placement = { x: random() * 400, y: random() * 800, footprintPx: random() < 0.03 ? NaN : random() * 60 - 2 };
      if (random() < 0.3) placement.lift = random() * 30;
      if (random() < 0.3) placement.alpha = random();
      if (random() < 0.3) placement.ao = random() < 0.5;
      if (random() < 0.1) placement.zoom = 0.7;
      assert.deepEqual(outcome(() => next.place(placement)), outcome(() => old.place(placement)), `frame ${frame}`);
    }
    old.finish(); next.finish();
    assert.deepEqual(look(next), look(old), `frame ${frame}`);
    assert.equal(next.count, old.count);
    assert.equal(next.dropped, old.dropped);
  }
});

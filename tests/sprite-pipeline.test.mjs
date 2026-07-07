import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ISO_8_DIRECTIONS,
  directionFromVector,
  resolveState,
  frameIndexFor,
  SpriteActor,
  collectSpriteManifestFrameSources,
  validateSpriteManifest,
} from '../apps/portal/src/sprite-pipeline.mjs';

// A fake image loader returns a marker object so we can assert resolution
// without a DOM / real image decoding.
const fakeLoader = (src) => (src ? { __src: src } : null);

function demoManifest() {
  return {
    id: 'demo-hero',
    frameSize: [80, 80],
    anchor: 'bottom-center',
    directions: ISO_8_DIRECTIONS,
    defaultDirection: 'south',
    targetFps: 60,
    states: {
      idle: { fps: 10, loop: true, frames: { south: ['idle-s-0.png', 'idle-s-1.png'], east: ['idle-e-0.png'] } },
      run: { fps: 20, loop: true, frames: { south: ['run-s-0.png', 'run-s-1.png', 'run-s-2.png'] } },
      shoot: { fps: 18, loop: false, frames: { south: ['shoot-s-0.png', 'shoot-s-1.png'] } },
    },
    stateAliases: { walk: 'run', melee: 'shoot' },
    stills: { south: 'still-s.png', east: 'still-e.png' },
  };
}

test('directionFromVector snaps to nearest 8-way direction', () => {
  assert.equal(directionFromVector(1, 0), 'east');
  assert.equal(directionFromVector(0, 1), 'south');
  assert.equal(directionFromVector(-1, 0), 'west');
  assert.equal(directionFromVector(0, -1), 'north');
  assert.equal(directionFromVector(1, 1), 'south-east');
  assert.equal(directionFromVector(-1, -1), 'north-west');
});

test('directionFromVector returns null for zero vector (keep last facing)', () => {
  assert.equal(directionFromVector(0, 0), null);
});

test('directionFromVector collapses onto a 4-way actor', () => {
  const fourWay = ['east', 'south', 'west', 'north'];
  // A south-east request has no exact match; should snap to east or south.
  const result = directionFromVector(1, 1, fourWay);
  assert.ok(['east', 'south'].includes(result));
});

test('resolveState follows aliases and falls back to idle', () => {
  const m = demoManifest();
  assert.equal(resolveState(m, 'run'), 'run');
  assert.equal(resolveState(m, 'walk'), 'run'); // alias
  assert.equal(resolveState(m, 'melee'), 'shoot'); // alias
  assert.equal(resolveState(m, 'nonexistent'), 'idle'); // fallback
});

test('frameIndexFor loops and clamps correctly', () => {
  const loopDef = { fps: 60, loop: true, __frameCount: 3 };
  assert.equal(frameIndexFor(loopDef, 0, 60), 0);
  assert.equal(frameIndexFor(loopDef, 1, 60), 1);
  assert.equal(frameIndexFor(loopDef, 3, 60), 0); // wraps
  const clampDef = { fps: 60, loop: false, __frameCount: 2 };
  assert.equal(frameIndexFor(clampDef, 5, 60), 1); // clamps to last
});

test('SpriteActor returns the correct frame image for state+direction+clock', () => {
  const actor = new SpriteActor(demoManifest(), fakeLoader);
  const f0 = actor.frame({ state: 'idle', direction: 'south', clock: 0 });
  assert.equal(f0.src, 'idle-s-0.png');
  assert.equal(f0.image.__src, 'idle-s-0.png');
  assert.equal(f0.direction, 'south');
  assert.equal(f0.state, 'idle');
  // idle fps=10, targetFps=60 => 6 ticks per frame; clock 6 => frame 1
  const f1 = actor.frame({ state: 'idle', direction: 'south', clock: 6 });
  assert.equal(f1.src, 'idle-s-1.png');
});

test('SpriteActor resolves an unknown direction to available art', () => {
  const actor = new SpriteActor(demoManifest(), fakeLoader);
  // 'run' only has south frames; requesting east should still draw something.
  const f = actor.frame({ state: 'run', direction: 'east', clock: 0 });
  assert.ok(f.src, 'expected a usable src even when requested direction lacks art');
});

test('SpriteActor uses still fallback when a state has no frames', () => {
  const m = demoManifest();
  m.states.death = { fps: 12, loop: false, frames: {} }; // empty
  const actor = new SpriteActor(m, fakeLoader);
  const f = actor.frame({ state: 'death', direction: 'south', clock: 0 });
  assert.equal(f.src, 'still-s.png');
});

test('SpriteActor.hasState honors aliases', () => {
  const actor = new SpriteActor(demoManifest(), fakeLoader);
  assert.equal(actor.hasState('walk'), true);
  assert.equal(actor.hasState('idle'), true);
});

test('SpriteActor frameSources and prewarm enumerate unique manifest frames', () => {
  const loaded = [];
  const actor = new SpriteActor(demoManifest(), (src) => {
    loaded.push(src);
    return { __src: src };
  });
  assert.deepEqual(actor.frameSources({ states: ['idle'] }).sort(), ['idle-e-0.png', 'idle-s-0.png', 'idle-s-1.png'].sort());
  const count = actor.prewarm({ states: ['idle'] });
  assert.equal(count, 3);
  assert.deepEqual(loaded.sort(), ['idle-e-0.png', 'idle-s-0.png', 'idle-s-1.png'].sort());
});

test('collectSpriteManifestFrameSources supports manifest-level preload audits', () => {
  assert.deepEqual(
    collectSpriteManifestFrameSources(demoManifest(), { states: ['shoot'] }),
    ['shoot-s-0.png', 'shoot-s-1.png'],
  );
});

test('validateSpriteManifest accepts a good manifest and rejects bad ones', () => {
  assert.equal(validateSpriteManifest(demoManifest()).ok, true);
  const bad = validateSpriteManifest({ id: 'x', frameSize: [80], states: {} });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 2);
  const unknownDir = validateSpriteManifest({
    id: 'y', frameSize: [64, 64],
    states: { idle: { frames: { nowhere: ['a.png'] } } },
  });
  assert.equal(unknownDir.ok, false);
  assert.ok(unknownDir.errors.some((e) => e.includes('unknown direction')));
});

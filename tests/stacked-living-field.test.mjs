import assert from 'node:assert/strict';
import test from 'node:test';
import { createLivingField } from '../apps/stacked/src/render/living-field.mjs';

const input = (now, extra = {}) => ({ now, width: 1400, height: 1000, lines: 0, reducedMotion: false, reducedEffects: false, level: 0.2, bass: 0.3, high: 0.1, ...extra });
test('medusa membranes never draw accidental bridges between separate tendrils', () => {
  const state = createLivingField().update(input(0));
  for (const index of [0, 24, 32, 40, 48, 96, 144]) assert.equal(state.connected[index], 0);
  for (const index of [1, 23, 25, 31, 33, 39, 41, 47, 49]) assert.equal(state.connected[index], 1);
});
test('living visualizer swims with stable bounded buffers and audio response', () => {
  const field = createLivingField();
  const initial = field.update(input(0));
  const positions = initial.x;
  const before = Array.from(initial.x.slice(0, initial.count));
  const moved = field.update(input(1000));
  assert.equal(moved.x, positions, 'reuse the particle buffer');
  assert.notDeepEqual(Array.from(moved.x.slice(0, moved.count)), before);
  assert.equal(moved.phase, 'swimming');
  assert.ok(moved.count <= 192);
  assert.ok(Array.from(moved.x).every(Number.isFinite));
  const quiet = createLivingField().update(input(1000, { bass: 0, level: 0, high: 0 }));
  assert.notDeepEqual(Array.from(moved.x), Array.from(quiet.x), 'music changes the forms');
});
test('each real line increase bursts once then reforms a new generation', () => {
  const field = createLivingField();
  field.update(input(0));
  const before = Array.from(field.update(input(300)).x);
  const burst = field.update(input(300, { lines: 1 }));
  assert.equal(burst.phase, 'burst');
  assert.equal(burst.generation, 1);
  assert.deepEqual(Array.from(burst.x), before, 'the burst starts from the current positions');
  assert.equal(field.update(input(500, { lines: 1 })).generation, 1, 'no repeated event');
  assert.equal(field.update(input(1000, { lines: 1 })).phase, 'reforming');
  assert.equal(field.update(input(2600, { lines: 1 })).phase, 'swimming');
  const quad = field.update(input(3000, { lines: 5 }));
  assert.equal(quad.generation, 2);
  assert.equal(quad.intensity, 4);
});
test('rapid clears retarget without position snaps, and undo never triggers a false burst', () => {
  const field = createLivingField();
  field.update(input(0));
  field.update(input(100, { lines: 1 }));
  const current = Array.from(field.update(input(300, { lines: 1 })).x);
  assert.deepEqual(Array.from(field.update(input(300, { lines: 2 })).x), current);
  const generation = field.update(input(400, { lines: 0 })).generation;
  assert.equal(generation, 2);
});
test('reduced motion disables swimming and bursts; reduced effects bounds particle work', () => {
  const field = createLivingField();
  const a = Array.from(field.update(input(0, { reducedMotion: true })).x);
  const b = field.update(input(1000, { reducedMotion: true, bass: 1 }));
  assert.deepEqual(Array.from(b.x), a);
  assert.equal(field.update(input(1200, { reducedMotion: true, lines: 4 })).phase, 'still');
  assert.ok(b.count <= 72);
  assert.ok(createLivingField().update(input(100, { reducedEffects: true })).count <= 72);
});
test('long running and resized fields stay finite and inside their viewport', () => {
  const field = createLivingField();
  for (let index = 0; index < 1200; index++) {
    const width = index % 2 ? 620 : 1400;
    const state = field.update(input(index * 50, { width, lines: Math.floor(index / 11) }));
    for (let i = 0; i < state.count; i++) {
      assert.ok(Number.isFinite(state.x[i]) && Math.abs(state.x[i]) <= width / 2);
      assert.ok(Number.isFinite(state.y[i]) && Math.abs(state.y[i]) <= 500);
    }
  }
});

test('resizing or toggling reduced motion during a burst never resurrects stale scatter positions', () => {
  const field = createLivingField();
  field.update(input(0)); field.update(input(100, { lines: 1 }));
  assert.equal(field.update(input(200, { lines: 1, reducedMotion: true })).phase, 'still');
  assert.equal(field.update(input(250, { lines: 1 })).phase, 'swimming');
  assert.equal(field.update(input(266, { lines: 1 })).phase, 'swimming');
});

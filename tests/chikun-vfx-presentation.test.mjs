import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CHIKUN_PARTICLES,
  planChikunVfx,
} from '../apps/chikun/src/vfx.mjs';
import {
  buildChikunReplayTimeline,
  buildChikunShareText,
} from '../apps/chikun/src/presentation.mjs';

test('Chikun VFX plans bounded deterministic particles without gameplay randomness', () => {
  const a = planChikunVfx({ event: 'near-miss', x: 280, y: 320, tick: 777, reduceMotion: false });
  const b = planChikunVfx({ event: 'near-miss', x: 280, y: 320, tick: 777, reduceMotion: false });

  assert.deepEqual(a, b);
  assert.ok(a.particles.length >= 8);
  assert.ok(a.particles.length <= MAX_CHIKUN_PARTICLES);
  assert.ok(a.shake > 0);
  assert.ok(a.flash > 0);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.particles), true);
});

test('reduced motion keeps event feedback but removes shake and limits particles', () => {
  const plan = planChikunVfx({ event: 'crash', x: 280, y: 360, tick: 900, reduceMotion: true });
  assert.equal(plan.shake, 0);
  assert.ok(plan.flash > 0);
  assert.ok(plan.particles.length <= 2);
});

test('replay timeline bins bounded canonical flap evidence without copying every tick', () => {
  const evidence = { maxTicks: 120, flapSteps: [0, 1, 29, 30, 31, 60, 90, 119] };
  const timeline = buildChikunReplayTimeline(evidence, 4);
  assert.deepEqual(timeline.bins, [3, 2, 1, 2]);
  assert.equal(timeline.peak, 3);
  assert.equal(timeline.totalFlaps, 8);
  assert.equal(Object.isFrozen(timeline.bins), true);
});

test('share text reports mode and mastery stats without wallet or session data', () => {
  const text = buildChikunShareText({ score: 1_234, forksPassed: 12, nearMisses: 4, bestCombo: 3, survivalTime: 42.5 }, 'ranked');
  assert.match(text, /Chikun's Escape/i);
  assert.match(text, /1,234 points/i);
  assert.match(text, /12 forks/i);
  assert.match(text, /4 near misses/i);
  assert.match(text, /Replay Verified/i);
  assert.doesNotMatch(text, /0x[a-f0-9]{40}/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CHIKUN_PARTICLES,
  planChikunVfx,
} from '../apps/chikun/src/vfx.mjs';
import * as presentation from '../apps/chikun/src/presentation.mjs';

const { buildChikunReplayTimeline } = presentation;

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

test('reduced motion keeps restrained event feedback but removes shake and flashes', () => {
  const plan = planChikunVfx({ event: 'crash', x: 280, y: 360, tick: 900, reduceMotion: true });
  assert.equal(plan.shake, 0);
  assert.equal(plan.flash, 0);
  assert.ok(plan.particles.length <= 2);
});

test('replay timeline bins bounded canonical flap evidence without copying every tick', () => {
  const evidence = { version: 'chikun-flap-evidence-v6', maxTicks: 120, flapDeltas: [0, 1, 28, 1, 1, 29, 30, 29] };
  const timeline = buildChikunReplayTimeline(evidence, 4);
  assert.deepEqual(buildChikunReplayTimeline({ maxTicks: 120, flapSteps: [0, 1, 29, 30, 31, 60, 90, 119] }, 4).bins, [3, 2, 1, 2], 'historical flapSteps bin the same way');
  assert.equal(buildChikunReplayTimeline({ maxTicks: 120, flapDeltas: [5, 0] }, 4).totalFlaps, 0, 'malformed deltas draw an empty timeline');
  assert.deepEqual(timeline.bins, [3, 2, 1, 2]);
  assert.equal(timeline.peak, 3);
  assert.equal(timeline.totalFlaps, 8);
  assert.equal(Object.isFrozen(timeline.bins), true);
});

test('the Chikun child shares the Free template, not a presentation one-liner', () => {
  // Free share plan docs/handoffs/free-share-20260926.md J9: the child calls
  // buildFreeShareText('chikun', ...) from share-links.mjs and links to the
  // run's /f/ page (tests/share-links.test.mjs drives the real renderShareRow).
  assert.equal(presentation.buildChikunShareText, undefined);
});
